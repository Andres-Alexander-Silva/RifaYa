from pydantic_settings import BaseSettings
from functools import lru_cache
import json


class Settings(BaseSettings):
    # App
    APP_ENV: str = "production"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Ticket reservation window (minutes)
    RESERVATION_MINUTES: int = 15

    # Storage (Cloudinary)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Email (Gmail SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""       # Tu dirección Gmail, ej: tucuenta@gmail.com
    SMTP_PASSWORD: str = ""   # App Password de Google (no la contraseña normal)
    EMAILS_FROM_EMAIL: str = ""      # Igual que SMTP_USER
    EMAILS_FROM_NAME: str = "RifaYa"
    ADMIN_EMAIL: str = ""  # Recibe alerta cuando llega un pago pendiente

    # WhatsApp (OpenWA — servicio Node.js independiente)
    # Levantar: clonar https://github.com/rmyndharis/OpenWA y ejecutar npm run start:dev
    OPENWA_API_URL: str = ""        # ej: http://localhost:2785/api
    OPENWA_API_KEY: str = ""        # contenido de data/.api-key en el repo de OpenWA
    OPENWA_SESSION_ID: str = ""     # nombre de la sesión creada vía POST /api/sessions

    # Tenant config
    TENANT_CONFIG_PATH: str = "/app/tenant.config.json"

    # Error tracking (Sentry) — dejar vacío para deshabilitar
    SENTRY_DSN: str = ""

    # URL pública del frontend (para links en emails)
    FRONTEND_URL: str = "http://localhost:5173"

    # CORS — en producción debe configurarse explícitamente vía variable de entorno
    BACKEND_CORS_ORIGINS: list[str] = []

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def get_tenant_config() -> dict:
    try:
        with open(settings.TENANT_CONFIG_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            "name": "RifaYa",
            "slug": "rifaya",
            "primary_color": "#6366f1",
            "secondary_color": "#8b5cf6",
        }
