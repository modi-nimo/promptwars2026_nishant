from __future__ import annotations

import os
import re
from datetime import datetime, timezone

from .models import AIStatus


STOP_WORDS = {
    "i",
    "want",
    "to",
    "learn",
    "learning",
    "study",
    "understand",
    "help",
    "me",
    "about",
    "the",
    "a",
    "an",
    "basics",
    "basic",
    "beginner",
    "intermediate",
    "advanced",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def extract_topic(goal: str) -> str:
    cleaned = normalize_text(re.sub(r"[^a-zA-Z0-9+#.\s-]", " ", goal))
    words = [word for word in cleaned.split() if word.lower() not in STOP_WORDS]
    if not words:
        words = cleaned.split()

    topic = " ".join(words[:8]).strip(" -")
    return topic[:1].upper() + topic[1:] if topic else "Your topic"


def infer_domain(goal: str) -> str:
    value = goal.lower()
    if any(word in value for word in ["python", "javascript", "react", "code", "programming", "fastapi", "next.js"]):
        return "coding"
    if any(word in value for word in ["math", "algebra", "calculus", "statistics", "probability"]):
        return "math"
    if any(word in value for word in ["english", "spanish", "french", "language", "speaking", "grammar"]):
        return "language"
    if any(word in value for word in ["business", "marketing", "sales", "product", "startup"]):
        return "business"
    return "general"


def make_ai_status(
    provider: str,
    model: str | None = None,
    used_google_search: bool = False,
    fallback_reason: str | None = None,
) -> AIStatus:
    return AIStatus(
        provider=provider,
        model=model,
        used_google_search=used_google_search,
        fallback_reason=fallback_reason,
    )


def redact_sensitive_text(value: str) -> str:
    redacted = value
    for env_key in ["GEMINI_API_KEY", "GOOGLE_API_KEY", "API_KEY"]:
        secret = os.getenv(env_key)
        if secret and len(secret) >= 8:
            redacted = redacted.replace(secret, "<redacted>")

    return re.sub(r"AIza[0-9A-Za-z_-]{20,}", "AIza<redacted>", redacted)


def summarize_exception(exc: Exception) -> str:
    message = redact_sensitive_text(" ".join(str(exc).split()))
    if not message:
        return exc.__class__.__name__

    return f"{exc.__class__.__name__}: {message[:220]}"
