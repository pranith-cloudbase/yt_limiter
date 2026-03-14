from app.nlp import score_video


def test_relevant_video_scored_high() -> None:
    result = score_video(
        topic="Physics",
        subtopic="Newton's Laws",
        goal="explanations and problem solving",
        syllabus_keywords=["force", "inertia", "acceleration", "dynamics"],
        video_title="Newton's Second Law Explained with Force and Acceleration Problems",
        video_channel="Physics Tutor",
        video_description="Learn F=ma with worked examples",
    )
    assert result["label"] in {"relevant", "borderline"}
    assert result["score"] >= 0.4


def test_irrelevant_video_scored_low() -> None:
    result = score_video(
        topic="Physics",
        subtopic="Newton's Laws",
        goal="focus on dynamics",
        syllabus_keywords=["force", "inertia", "acceleration"],
        video_title="Top 10 Football Skills 2026",
        video_channel="Sports Highlights",
        video_description="Best dribbles and goals",
    )
    assert result["label"] == "irrelevant"
    assert result["score"] < 0.4
