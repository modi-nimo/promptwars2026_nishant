from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ConceptPilot API"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    gemini_model: str = "gemini-2.5-flash"
    gemini_temperature: float = 0.45

    google_cloud_project: str | None = None
    firestore_database: str = "(default)"
    firebase_project_id: str | None = None
    use_firestore: bool = False
    enable_cloud_logging: bool = False

    @property
    def cors_allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
