from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def load_local_env() -> None:
    project_dir = Path(__file__).resolve().parents[1]
    search_dirs = [
        Path.cwd(),
        project_dir,
        project_dir.parent,
        project_dir.parent.parent,
    ]

    for directory in dict.fromkeys(search_dirs):
        env_path = directory / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default

    return value.lower() in {"1", "true", "yes"}


def parse_float(value: str | None, default: float) -> float:
    try:
        return float(value) if value is not None else default
    except ValueError:
        return default


def parse_origins(value: str | None) -> list[str]:
    raw_value = value or "http://localhost:3000,http://127.0.0.1:3000"
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    allowed_origins: list[str]
    gemini_model: str
    gemini_thinking_level: str
    gemini_enable_search: bool
    gemini_temperature: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            allowed_origins=parse_origins(os.getenv("ALLOWED_ORIGINS")),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            gemini_thinking_level=os.getenv("GEMINI_THINKING_LEVEL", ""),
            gemini_enable_search=parse_bool(os.getenv("GEMINI_ENABLE_SEARCH"), default=False),
            gemini_temperature=parse_float(os.getenv("GEMINI_TEMPERATURE"), default=0.65),
        )


load_local_env()
settings = Settings.from_env()
