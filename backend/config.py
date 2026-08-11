import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # JWT configuration
    JWT_SECRET_KEY: str = Field(default="3eB6je8kvP8VMHQ0SA7H9FP4Pk_-8_EvQwBA5AOM_g5B7DqShAKdBotO06k1deitsExhtxg9LR6h-6cz_ybgww", env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440, env="ACCESS_TOKEN_EXPIRE_MINUTES") # 24 hours

    # MongoDB configuration
    MONGODB_URL: str = Field(default="mongodb://localhost:27017", env="MONGODB_URL")
    DATABASE_NAME: str = Field(default="panchayat_ai", env="DATABASE_NAME")

    # AI configuration
    GOOGLE_API_KEY: str = Field(default="", env="GOOGLE_API_KEY")
    AI_API_KEY: str = Field(default="", env="AI_API_KEY")
    LLM_MODEL: str = Field(default="gemini-1.5-mini", env="LLM_MODEL")
    EMBEDDING_MODEL: str = Field(default="textembedding-gecko-001", env="EMBEDDING_MODEL")
    TRANSCRIPTION_MODEL: str = Field(default="whisper-1", env="TRANSCRIPTION_MODEL")

    # Twilio configuration
    TWILIO_ACCOUNT_SID: str = Field(default="", env="TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: str = Field(default="", env="TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: str = Field(default="", env="TWILIO_PHONE_NUMBER")

    # File storage
    UPLOAD_DIR: str = Field(default="/tmp/uploads" if os.environ.get("VERCEL") else "uploads", env="UPLOAD_DIR")

    # SMTP Mail Server (Simulated by default)
    SMTP_HOST: str = Field(default="smtp.gmail.com", env="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, env="SMTP_PORT")
    SMTP_USERNAME: str = Field(default="", env="SMTP_USERNAME")
    SMTP_PASSWORD: str = Field(default="", env="SMTP_PASSWORD")
    SMTP_FROM: str = Field(default="noreply@panchayatai.gov.in", env="SMTP_FROM")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# Ensure uploads directory exists
try:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "documents"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "complaints"), exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "voice"), exist_ok=True)
except Exception as e:
    import logging
    logging.getLogger("panchayat_ai.config").warning(f"Could not create upload directories: {e}. If running on Vercel, this is expected.")
