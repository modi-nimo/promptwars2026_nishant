from __future__ import annotations

from fastapi import HTTPException

from .models import LearningPathResponse, StoredSession


class InMemorySessionStore:
    def __init__(self) -> None:
        self.sessions: dict[str, StoredSession] = {}

    def clear(self) -> None:
        self.sessions.clear()

    def save(self, learning_path: LearningPathResponse) -> StoredSession:
        session = StoredSession(
            learning_path=learning_path,
            question_lookup={question.id: question for question in learning_path.lesson.quiz},
        )
        self.sessions[learning_path.session_id] = session
        return session

    def get(self, session_id: str) -> StoredSession:
        session = self.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Learning session not found")
        return session


session_store = InMemorySessionStore()
