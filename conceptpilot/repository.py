from __future__ import annotations

from copy import deepcopy
from threading import Lock

from fastapi import HTTPException

from .config import get_settings
from .models import SessionSnapshot


class SessionRepository:
    def save(self, session: SessionSnapshot) -> None:
        raise NotImplementedError

    def get(self, session_id: str) -> SessionSnapshot:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError


class InMemorySessionRepository(SessionRepository):
    def __init__(self) -> None:
        self._sessions: dict[str, SessionSnapshot] = {}
        self._lock = Lock()

    def save(self, session: SessionSnapshot) -> None:
        with self._lock:
            self._sessions[session.session_id] = deepcopy(session)

    def get(self, session_id: str) -> SessionSnapshot:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise HTTPException(status_code=404, detail="Session not found")
            return deepcopy(session)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()


class FirestoreSessionRepository(SessionRepository):
    def __init__(self) -> None:
        settings = get_settings()
        from google.cloud import firestore

        kwargs = {}
        if settings.google_cloud_project:
            kwargs["project"] = settings.google_cloud_project
        if settings.firestore_database:
            kwargs["database"] = settings.firestore_database
        self._client = firestore.Client(**kwargs)
        self._collection = self._client.collection("conceptpilot_sessions")

    def save(self, session: SessionSnapshot) -> None:
        self._collection.document(session.session_id).set(session.model_dump(mode="json"))

    def get(self, session_id: str) -> SessionSnapshot:
        snapshot = self._collection.document(session_id).get()
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="Session not found")
        return SessionSnapshot.model_validate(snapshot.to_dict())

    def clear(self) -> None:
        for document in self._collection.limit(100).stream():
            document.reference.delete()


def build_repository() -> SessionRepository:
    settings = get_settings()
    if settings.use_firestore:
        try:
            return FirestoreSessionRepository()
        except Exception:
            return InMemorySessionRepository()
    return InMemorySessionRepository()


session_repository: SessionRepository = build_repository()

