from __future__ import annotations

import math
import re
from collections import Counter
from functools import lru_cache

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "your",
    "you",
    "are",
    "was",
    "were",
    "have",
    "has",
    "had",
    "will",
    "not",
    "but",
    "can",
    "about",
    "only",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s']", " ", text.lower())).strip()


def extract_keywords(text: str, top_k: int = 30) -> list[str]:
    norm = normalize(text)
    tokens = [t for t in norm.split(" ") if len(t) > 2 and t not in STOPWORDS]
    if not tokens:
        return []

    counts = Counter(tokens)
    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    return [token for token, _ in ranked[:top_k]]


def split_units(text: str) -> list[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    units: list[str] = []
    pattern = re.compile(r"^(unit|module|week|chapter)\s*\d*[:\-]?\s+", re.IGNORECASE)

    for line in lines:
        if pattern.search(line):
            units.append(line)

    if not units:
        units = [ln for ln in lines if len(ln.split()) >= 3][:8]

    return units[:12]


def summarize_syllabus(text: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    course_title = lines[0][:120] if lines else "Untitled Course"
    units = split_units(text)
    keywords = extract_keywords(text, top_k=40)
    focus_topics = [kw for kw in keywords if kw not in {"assignment", "exam", "grade", "policy"}][:12]

    summary_parts = []
    if units:
        summary_parts.append(f"Covers {len(units)} main units")
    if focus_topics:
        summary_parts.append(f"Focuses on topics like {', '.join(focus_topics[:6])}")
    summary = ". ".join(summary_parts) or "Syllabus text parsed successfully."

    return {
        "course_title": course_title,
        "units": units,
        "keywords": keywords,
        "summary": summary,
        "focus_topics": focus_topics,
    }


def _tfidf_similarity(topic_text: str, video_text: str) -> float:
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform([topic_text, video_text])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])


@lru_cache(maxsize=1)
def _load_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _embedding_similarity(topic_text: str, video_text: str) -> tuple[float, str]:
    model = _load_embedding_model()
    if model is None:
        return _tfidf_similarity(topic_text, video_text), "tfidf"

    embeddings = model.encode([topic_text, video_text], normalize_embeddings=True)
    similarity = float(embeddings[0] @ embeddings[1])
    return similarity, "sentence-transformers"


def _feedback_adjustment(feedback: dict, channel: str, matched_keywords: list[str]) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score_delta = 0.0

    liked_channels = {normalize(item) for item in feedback.get("likedChannels", [])}
    disliked_channels = {normalize(item) for item in feedback.get("dislikedChannels", [])}
    liked_terms: dict = feedback.get("likedTerms", {})
    disliked_terms: dict = feedback.get("dislikedTerms", {})

    channel_norm = normalize(channel)
    if channel_norm and channel_norm in liked_channels:
        score_delta += 0.12
        reasons.append("boosted by your relevant-channel feedback")
    if channel_norm and channel_norm in disliked_channels:
        score_delta -= 0.18
        reasons.append("penalized by your irrelevant-channel feedback")

    for kw in matched_keywords[:12]:
        score_delta += float(liked_terms.get(kw, 0)) * 0.012
        score_delta -= float(disliked_terms.get(kw, 0)) * 0.018

    return score_delta, reasons


def score_video(
    *,
    topic: str,
    subtopic: str,
    goal: str,
    syllabus_keywords: list[str],
    video_title: str,
    video_channel: str,
    video_description: str,
    feedback: dict | None = None,
) -> dict:
    topic_text = " ".join([topic, subtopic, goal, *syllabus_keywords]).strip()
    video_text = " ".join([video_title, video_channel, video_description]).strip()

    if not topic_text or not video_title:
        return {
            "score": 0.0,
            "label": "irrelevant",
            "reasons": ["insufficient topic/video context"],
            "model_used": "tfidf",
        }

    t_norm = normalize(topic_text)
    v_norm = normalize(video_text)

    topic_keywords = extract_keywords(t_norm, top_k=60)
    keyword_matches = [kw for kw in topic_keywords if kw in v_norm]
    keyword_score = min(len(keyword_matches) / 10.0, 1.0)

    similarity, model_used = _embedding_similarity(t_norm, v_norm)

    title_boost = 0.15 if any(kw in normalize(video_title) for kw in keyword_matches[:5]) else 0.0
    noise_penalty = 0.08 if re.search(r"\b(prank|meme|compilation|gaming)\b", normalize(video_channel)) else 0.0

    feedback_delta, feedback_reasons = _feedback_adjustment(feedback or {}, video_channel, keyword_matches)

    score = max(
        0.0,
        min(1.0, 0.40 * keyword_score + 0.43 * similarity + title_boost + feedback_delta - noise_penalty),
    )
    score = math.floor(score * 1000) / 1000

    if score >= 0.56:
        label = "relevant"
    elif score >= 0.33:
        label = "borderline"
    else:
        label = "irrelevant"

    reasons: list[str] = []
    if keyword_matches:
        reasons.append(f"matched keyword: {keyword_matches[0]}")
    if subtopic and normalize(subtopic) in normalize(video_title):
        reasons.append(f"matched topic phrase: {subtopic}")
    if similarity >= 0.33:
        reasons.append("semantic similarity with study focus")
    reasons.extend(feedback_reasons)
    if not reasons:
        reasons.append("low overlap with current study intent")

    return {
        "score": score,
        "label": label,
        "reasons": reasons,
        "model_used": model_used,
    }
