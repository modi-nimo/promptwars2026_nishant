from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from fastapi import Header, HTTPException

from .config import get_settings
from .models import AuthMode, SessionSnapshot


@dataclass(frozen=True)
class UserContext:
    auth_mode: AuthMode
    user_id: str | None = None


@lru_cache
def _firebase_app():
    settings = get_settings()
    if not settings.firebase_project_id:
        return None

    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return firebase_admin.get_app()

    return firebase_admin.initialize_app(
        credentials.ApplicationDefault(),
        {"projectId": settings.firebase_project_id},
    )


def resolve_user_context(authorization: str | None = Header(default=None)) -> UserContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        return UserContext(auth_mode=AuthMode.guest)

    app = _firebase_app()
    if app is None:
        return UserContext(auth_mode=AuthMode.guest)

    token = authorization.split(" ", 1)[1].strip()
    try:
        from firebase_admin import auth

        decoded = auth.verify_id_token(token, app=app)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Firebase token") from exc

    return UserContext(auth_mode=AuthMode.google, user_id=decoded.get("uid"))


def require_session_access(session: SessionSnapshot, user: UserContext) -> None:
    if session.owner_id and session.owner_id != user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this session")

