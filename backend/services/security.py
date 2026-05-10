import base64
import hashlib
import hmac
from urllib.parse import quote_plus

from cryptography.fernet import Fernet

import config


def _build_fernet() -> Fernet:
    if config.ENCRYPTION_KEY:
        return Fernet(config.ENCRYPTION_KEY.encode())
    # Deterministic local/dev fallback; strongly recommend setting ENCRYPTION_KEY in production.
    digest = hashlib.sha256((config.DEFAULT_USER_EMAIL + "|second-brain").encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


_fernet = _build_fernet()


def encrypt_text(plain_text: str) -> str:
    return _fernet.encrypt(plain_text.encode()).decode()


def decrypt_text(cipher_text: str) -> str:
    return _fernet.decrypt(cipher_text.encode()).decode()


def verify_whatsapp_signature(signature_header: str, raw_body: bytes) -> bool:
    if not config.WHATSAPP_APP_SECRET:
        return False
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        key=config.WHATSAPP_APP_SECRET.encode(),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    provided = signature_header.split("=", 1)[1]
    return hmac.compare_digest(expected, provided)


def safe_url(value: str) -> str:
    return quote_plus(value or "")

