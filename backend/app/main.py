from __future__ import annotations

import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .models import ParseSyllabusResponse, ScoreVideoRequest, ScoreVideoResponse
from .nlp import score_video, summarize_syllabus
from .parsers import UnsupportedFileTypeError, parse_file_to_text

app = FastAPI(title="StudyTube Focus Backend", version="1.0.0")

origins_env = os.getenv("STUDYTUBE_CORS_ORIGINS", "http://localhost,http://127.0.0.1")
origins = [item.strip() for item in origins_env.split(",") if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/parse-syllabus", response_model=ParseSyllabusResponse)
async def parse_syllabus(file: UploadFile = File(...)) -> ParseSyllabusResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content = await file.read()
    try:
        text = parse_file_to_text(file.filename, content)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not parse file: {exc}") from exc

    summary = summarize_syllabus(text)
    return ParseSyllabusResponse(**summary)


@app.post("/score-video", response_model=ScoreVideoResponse)
def score_video_endpoint(payload: ScoreVideoRequest) -> ScoreVideoResponse:
    result = score_video(
        topic=payload.topic,
        subtopic=payload.subtopic,
        goal=payload.goal,
        syllabus_keywords=payload.syllabus_keywords,
        video_title=payload.video_title,
        video_channel=payload.video_channel,
        video_description=payload.video_description,
    )
    return ScoreVideoResponse(**result)
