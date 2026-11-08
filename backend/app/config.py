import json
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings

_WEAK_SECRETS = {"", "changeme", "secret", "changeme_generate_with_openssl_rand_hex_32"}


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

    # CMI Payment Gateway
    CMI_STORE_KEY: str = ""  # HMAC key for callback verification

    # Admin — only used once by the migration that seeds `merchants.is_admin`;
    # authorization itself relies on that DB flag, never on these values.
    ADMIN_PHONE: str = ""
    ADMIN_EMAIL: str = ""

    # Locale defaults for new merchants (see core/locale.py)
    DEFAULT_COUNTRY: str = "MA"

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = False
    BACKEND_CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:3000"]'
    FRONTEND_URL: str = "http://localhost:8080"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in ("production", "prod")

    @model_validator(mode="after")
    def _refuse_weak_secret_in_production(self):
        if self.is_production and (self.SECRET_KEY in _WEAK_SECRETS or len(self.SECRET_KEY) < 32):
            raise ValueError("SECRET_KEY must be set to a random value of >= 32 chars in production")
        return self

    @property
    def cors_origins(self) -> List[str]:
        return json.loads(self.BACKEND_CORS_ORIGINS)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
