from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import service
from .config import settings
from .models import (
    CoachRequest,
    CoachResponse,
    LearningPathRequest,
    LearningPathResponse,
    QuizAnswerRequest,
    QuizAnswerResponse,
)
from .session_store import session_store


def create_app() -> FastAPI:
    app = FastAPI(
        title="LearnMate API",
        description="Adaptive learning companion backend for the PromptWars 2026 hackathon.",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app)
    return app


def register_routes(app: FastAPI) -> None:
    @app.get("/health")
    def health() -> dict[str, str]:
        return service.health_payload()

    @app.post("/api/learning-path", response_model=LearningPathResponse)
    def create_learning_path(payload: LearningPathRequest) -> LearningPathResponse:
        learning_path = service.build_learning_path(payload)
        session_store.save(learning_path)
        return learning_path

    @app.get("/api/sessions/{session_id}", response_model=LearningPathResponse)
    def read_learning_session(session_id: str) -> LearningPathResponse:
        return session_store.get(session_id).learning_path

    @app.post("/api/quiz/answer", response_model=QuizAnswerResponse)
    def answer_quiz(payload: QuizAnswerRequest) -> QuizAnswerResponse:
        session = session_store.get(payload.session_id)
        return service.answer_quiz(session.learning_path, session.question_lookup, payload)

    @app.post("/api/coach/reframe", response_model=CoachResponse)
    def reframe_confusion(payload: CoachRequest) -> CoachResponse:
        session = session_store.get(payload.session_id)
        return service.reframe_confusion(session.learning_path, payload)
