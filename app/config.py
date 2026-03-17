from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "MeetMind AI"
    environment: str = "development"

    mongodb_url: str
    mongodb_db_name: str = "meetmind"

    groq_api_key: str
    groq_model: str = "llama-3.1-70b-versatile"

    telegram_bot_token: str | None = None
    telegram_api_id: int | None = None
    telegram_api_hash: str | None = None
    telegram_session_file: str = "telegram.session"

    llm_max_tokens: int = 2048
    llm_temperature: float = 0.2

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_prefix = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()

