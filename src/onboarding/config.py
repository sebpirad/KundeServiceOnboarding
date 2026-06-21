"""Application configuration via environment variables (prefix ``PM_``)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PM_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./onboarding.db"
    app_name: str = "PowerMatch · Onboarding"
    # Free-form notes cap per workspace, to keep the board scannable.
    max_free_notes: int = 12
    max_links: int = 20
    debug: bool = False


settings = Settings()
