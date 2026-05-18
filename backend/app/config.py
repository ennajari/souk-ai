from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://souk_user:changeme@localhost:5432/souk_db"  # NOSONAR

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h
    ALGORITHM: str = "HS256"

    # WhatsApp Cloud API
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "souk_ai_verify"
    WHATSAPP_APP_SECRET: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""

    # Admin
    ADMIN_PHONE: str = "212763576794"
    ADMIN_EMAIL: str = "abdellahennajari2018@gmail.com"

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    BACKEND_CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:3000"]'
    FRONTEND_URL: str = "http://localhost:8080"

    @property
    def cors_origins(self) -> List[str]:
        return json.loads(self.BACKEND_CORS_ORIGINS)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
