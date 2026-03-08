from pydantic import BaseModel, Field


class ParseSyllabusResponse(BaseModel):
    course_title: str
    units: list[str]
    keywords: list[str]
    summary: str
    focus_topics: list[str]


class ScoreVideoRequest(BaseModel):
    topic: str = Field(default="")
    subtopic: str = Field(default="")
    goal: str = Field(default="")
    syllabus_keywords: list[str] = Field(default_factory=list)
    video_title: str = Field(default="")
    video_channel: str = Field(default="")
    video_description: str = Field(default="")
    feedback: dict = Field(default_factory=dict)


class ScoreVideoResponse(BaseModel):
    score: float
    label: str
    reasons: list[str]
    model_used: str = "tfidf"
