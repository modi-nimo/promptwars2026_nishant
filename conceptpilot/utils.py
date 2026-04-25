from __future__ import annotations

import re
from datetime import UTC, datetime


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def safe_id(value: str, prefix: str = "concept") -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return f"{prefix}-{cleaned[:32] or 'item'}"


def summarize_exception(exc: Exception) -> str:
    message = normalize_text(str(exc))[:180]
    if not message:
        return exc.__class__.__name__
    return message.replace("\n", " ")

