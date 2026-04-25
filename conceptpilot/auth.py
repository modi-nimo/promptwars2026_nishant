from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException

from .config import get_settings
from .models import AuthMode, SessionSnapshot


@dataclass(frozen=True)
class UserContext:
    auth_mode: AuthMode
    user_id: str | None = None


def resolve_user_context(authorization: str | None = Header(default=None)) -> UserContext:
    settings = get_settings()
    if not authorization or not authorization.lower().startswith("bearer "):
        return UserContext(auth_mode=AuthMode.guest)

    if not settings.firebase_project_id:
        return UserContext(auth_mode=AuthMode.guest)

    token = authorization.split(" ", 1)[1].strip()
    try:
        from google.auth.transport import requests
        from google.oauth2 import id_token

        decoded = id_token.verify_firebase_token(
            token,
            requests.Request(),
            audience=settings.firebase_project_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Firebase token") from exc

    return UserContext(auth_mode=AuthMode.google, user_id=decoded.get("user_id") or decoded.get("sub"))


def require_session_access(session: SessionSnapshot, user: UserContext) -> None:
    if session.owner_id and session.owner_id != user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this session")
