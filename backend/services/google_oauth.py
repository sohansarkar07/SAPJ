from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

import config


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def build_google_consent_url(state: str) -> str:
    params = {
        "client_id": config.GOOGLE_CLIENT_ID,
        "redirect_uri": config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": config.GOOGLE_OAUTH_SCOPES,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict[str, Any]:
    payload = {
        "code": code,
        "client_id": config.GOOGLE_CLIENT_ID,
        "client_secret": config.GOOGLE_CLIENT_SECRET,
        "redirect_uri": config.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    with httpx.Client(timeout=30.0) as client:
        res = client.post(GOOGLE_TOKEN_URL, data=payload)
    res.raise_for_status()
    data = res.json()
    data["expires_at"] = _compute_expiry(data.get("expires_in"))
    return data


def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    payload = {
        "refresh_token": refresh_token,
        "client_id": config.GOOGLE_CLIENT_ID,
        "client_secret": config.GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    with httpx.Client(timeout=30.0) as client:
        res = client.post(GOOGLE_TOKEN_URL, data=payload)
    res.raise_for_status()
    data = res.json()
    data["expires_at"] = _compute_expiry(data.get("expires_in"))
    return data


def fetch_google_userinfo(access_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=30.0) as client:
        res = client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    res.raise_for_status()
    return res.json()


def _compute_expiry(expires_in: Any) -> datetime | None:
    try:
        sec = int(expires_in)
    except (TypeError, ValueError):
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=sec)

