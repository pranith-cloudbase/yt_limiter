from __future__ import annotations

import math
import re
from collections import Counter

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
        # Fallback to top non-trivial lines.
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


def score_video(
    *,
    topic: str,
    subtopic: str,
    goal: str,
    syllabus_keywords: list[str],
    video_title: str,
    video_channel: str,
    video_description: str,
) -> dict:
    topic_text = " ".join([topic, subtopic, goal, *syllabus_keywords]).strip()
    video_text = " ".join([video_title, video_channel, video_description]).strip()

    if not topic_text or not video_title:
        return {
            "score": 0.0,
            "label": "irrelevant",
            "reasons": ["insufficient topic/video context"],
        }

    t_norm = normalize(topic_text)
    v_norm = normalize(video_text)

    topic_keywords = extract_keywords(t_norm, top_k=60)
    keyword_matches = [kw for kw in topic_keywords if kw in v_norm]
    keyword_score = min(len(keyword_matches) / 10.0, 1.0)

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform([t_norm, v_norm])
    similarity = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])

    title_boost = 0.15 if any(kw in normalize(video_title) for kw in keyword_matches[:5]) else 0.0
    noise_penalty = 0.08 if re.search(r"\b(prank|meme|compilation|gaming)\b", normalize(video_channel)) else 0.0

    score = max(0.0, min(1.0, 0.55 * keyword_score + 0.35 * similarity + title_boost - noise_penalty))
    score = math.floor(score * 1000) / 1000

    if score >= 0.62:
        label = "relevant"
    elif score >= 0.40:
        label = "borderline"
    else:
        label = "irrelevant"

    reasons: list[str] = []
    if keyword_matches:
        reasons.append(f"matched keyword: {keyword_matches[0]}")
    if subtopic and normalize(subtopic) in normalize(video_title):
        reasons.append(f"matched topic phrase: {subtopic}")
    if not reasons:
        reasons.append("low overlap with current study intent")

    return {
        "score": score,
        "label": label,
        "reasons": reasons,
    }
