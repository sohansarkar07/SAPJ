"""
Environment-driven configuration. No secrets or hostnames in code — use .env in production.
"""
import os

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./second_brain.db")

# Comma-separated list, e.g. https://app.example.com,https://www.example.com
CORS_ORIGINS = _split_csv(
    os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:3000,http://localhost:3000",
    )
)

# Resolve the signed-in user for API calls. Set to mentor/agency demo emails to switch personas.
DEFAULT_USER_EMAIL = os.getenv("DEFAULT_USER_EMAIL", "priya@greenhope.org")

# Dev / reverse-proxy only: trust X-User-Id header when set to true (never enable on public internet).
TRUST_X_USER_ID = os.getenv("TRUST_X_USER_ID", "").lower() in ("1", "true", "yes")

# App URLs
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://127.0.0.1:5500")

# Integration crypto
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"{APP_BASE_URL}/api/integrations/google/callback")
GOOGLE_OAUTH_SCOPES = os.getenv(
    "GOOGLE_OAUTH_SCOPES",
    "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email openid",
)

# WhatsApp Cloud API
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
