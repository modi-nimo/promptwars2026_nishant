from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .auth import UserContext, resolve_user_context
from .config import get_settings
from .models import (
    CheckSubmitRequest,
    CheckSubmitResponse,
    CoachRequest,
    CoachResponse,
    DiagnosticSubmitRequest,
    DiagnosticSubmitResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionSnapshot,
)
from .repository import FirestoreSessionRepository, session_repository
from .service import conceptpilot_service


logger = logging.getLogger("conceptpilot")


def configure_logging() -> None:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    if not settings.enable_cloud_logging:
        return
    try:
        import google.cloud.logging

        google.cloud.logging.Client(project=settings.google_cloud_project).setup_logging()
    except Exception as exc:
        logger.warning("cloud_logging_unavailable reason=%s", exc)


async def request_logging_middleware(
    request: Request,
    call_next: Callable[[Request], object],
) -> Response:
    request_id = request.headers.get("x-request-id", f"req_{uuid.uuid4().hex[:12]}")
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.exception(
            "request_failed request_id=%s method=%s path=%s elapsed_ms=%s",
            request_id,
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["x-request-id"] = request_id
    logger.info(
        "request_completed request_id=%s method=%s path=%s status=%s elapsed_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    app = FastAPI(
        title="ConceptPilot API",
        description="Adaptive learning assistant backend for the official PromptWars submission.",
        version="1.0.0",
    )
    app.middleware("http")(request_logging_middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    register_routes(app)
    return app


def register_routes(app: FastAPI) -> None:
    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "conceptpilot-api",
            "persistence": "firestore"
            if isinstance(session_repository, FirestoreSessionRepository)
            else "memory",
            "gemini_model": get_settings().gemini_model,
        }

    @app.post("/api/sessions", response_model=SessionCreateResponse)
    def create_session(
        payload: SessionCreateRequest,
        user: UserContext = Depends(resolve_user_context),
    ) -> SessionCreateResponse:
        return conceptpilot_service.create_session(payload, user)

    @app.get("/api/sessions/{session_id}", response_model=SessionSnapshot)
    def read_session(
        session_id: str,
        user: UserContext = Depends(resolve_user_context),
    ) -> SessionSnapshot:
        return conceptpilot_service.get_session(session_id, user)

    @app.post("/api/diagnostic/submit", response_model=DiagnosticSubmitResponse)
    def submit_diagnostic(
        payload: DiagnosticSubmitRequest,
        user: UserContext = Depends(resolve_user_context),
    ) -> DiagnosticSubmitResponse:
        return conceptpilot_service.submit_diagnostic(payload, user)

    @app.post("/api/checks/submit", response_model=CheckSubmitResponse)
    def submit_check(
        payload: CheckSubmitRequest,
        user: UserContext = Depends(resolve_user_context),
    ) -> CheckSubmitResponse:
        return conceptpilot_service.submit_check(payload, user)

    @app.post("/api/coach", response_model=CoachResponse)
    def coach(
        payload: CoachRequest,
        user: UserContext = Depends(resolve_user_context),
    ) -> CoachResponse:
        return conceptpilot_service.coach(payload, user)
