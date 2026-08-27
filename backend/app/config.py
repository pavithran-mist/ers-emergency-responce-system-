"""Application configuration and environment settings."""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="allow")

    APP_NAME: str = "ASTRA AI"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,https://*.onrender.com,*")
    
    # Security & Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "astra-ai-super-secure-secret-key-2026-road-safety")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./astra_ai.db")
    
    # AI Engine & Models
    MODELS_DIR: str = os.getenv("MODELS_DIR", "models")
    ACCIDENT_MODEL_PATH: str = os.path.join(MODELS_DIR, "road_accident.pt")
    FIRE_MODEL_PATH: str = os.path.join(MODELS_DIR, "fire_detection.pt")
    
    # Initial Accounts Seed
    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@astra.ai")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin@12345")
    DEFAULT_ADMIN_NAME: str = "System Administrator"

    DEFAULT_OPERATOR_EMAIL: str = os.getenv("DEFAULT_OPERATOR_EMAIL", "operator@astra.ai")
    DEFAULT_OPERATOR_PASSWORD: str = os.getenv("DEFAULT_OPERATOR_PASSWORD", "Operator@123")
    DEFAULT_OPERATOR_NAME: str = "Lead Emergency Dispatcher"


settings = Settings()
