import json
import secrets
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, select

import config
from database import get_session
from deps import get_current_user_id
from models import IntegrationConnection, IntegrationSyncLog, Source
from services.calendar_sync import sync_calendar
from services.gmail_sync import sync_gmail
from services.google_oauth import build_google_consent_url, exchange_code_for_tokens, fetch_google_userinfo
from services.security import encrypt_text, verify_whatsapp_signature
from services.whatsapp_webhook import ingest_whatsapp_payload

router = APIRouter(prefix="/integrations")

_oauth_state_store: dict[str, int] = {}


class SyncNowRequest(BaseModel):
    provider: str


class DisconnectRequest(BaseModel):
    provider: str


def _upsert_source(session: Session, user_id: int, source_type: str, name: str, account_label: str | None) -> Source:
    source = session.exec(
        select(Source).where(Source.user_id == user_id, Source.source_type == source_type)
    ).first()
    if not source:
        source = Source(user_id=user_id, source_type=source_type, name=name)
    source.connection_status = "connected"
    source.provider_account = account_label
    source.last_error = None
    source.last_synced_at = datetime.utcnow()
    session.add(source)
    session.flush()
    return source


@router.get("/status")
def integration_status(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    sources = session.exec(select(Source).where(Source.user_id == user_id)).all()
    logs = session.exec(
        select(IntegrationSyncLog).where(IntegrationSyncLog.user_id == user_id).order_by(IntegrationSyncLog.created_at.desc()).limit(25)
    ).all()
    conns = session.exec(
        select(IntegrationConnection).where(IntegrationConnection.user_id == user_id)
    ).all()
    return {
        "sources": sources,
        "connections": conns,
        "logs": logs,
        "providers": {
            "gmail": any(s.source_type == "gmail" and s.connection_status == "connected" for s in sources),
            "calendar": any(s.source_type == "calendar" and s.connection_status == "connected" for s in sources),
            "whatsapp": any(s.source_type == "whatsapp" and s.connection_status == "connected" for s in sources),
        },
    }


@router.get("/google/connect")
def google_connect(user_id: int = Depends(get_current_user_id)):
    if not config.GOOGLE_CLIENT_ID or not config.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google OAuth is not configured")
    state = secrets.token_urlsafe(24)
    _oauth_state_store[state] = user_id
    return {"auth_url": build_google_consent_url(state)}


@router.get("/google/callback")
def google_callback(code: str, state: str, session: Session = Depends(get_session)):
    user_id = _oauth_state_store.pop(state, None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    token_data = exchange_code_for_tokens(code)
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google token exchange failed")

    profile = fetch_google_userinfo(access_token)
    email = profile.get("email")
    sub = profile.get("sub")

    conn = session.exec(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.provider == "google",
        )
    ).first()
    if not conn:
        conn = IntegrationConnection(user_id=user_id, provider="google")
    conn.provider_account_id = sub
    conn.provider_account_label = email
    conn.access_token_encrypted = encrypt_text(access_token)
    if refresh_token:
        conn.refresh_token_encrypted = encrypt_text(refresh_token)
    conn.token_expires_at = token_data.get("expires_at")
    conn.scopes = token_data.get("scope", config.GOOGLE_OAUTH_SCOPES)
    conn.status = "connected"
    conn.last_error = None
    conn.updated_at = datetime.utcnow()
    session.add(conn)

    _upsert_source(session, user_id, "gmail", "Gmail", email)
    _upsert_source(session, user_id, "calendar", "Google Calendar", email)

    session.add(
        IntegrationSyncLog(
            user_id=user_id,
            provider="google",
            status="success",
            message=f"Google connected for {email or 'account'}.",
            details_json=json.dumps({"email": email}),
        )
    )
    session.commit()
    return RedirectResponse(url=f"{config.FRONTEND_BASE_URL}/index.html")


@router.post("/sync-now")
def sync_now(body: SyncNowRequest, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    provider = body.provider.strip().lower()
    try:
        if provider == "gmail":
            return {"provider": "gmail", **sync_gmail(session, user_id)}
        if provider == "calendar":
            return {"provider": "calendar", **sync_calendar(session, user_id)}
        if provider == "google":
            g = sync_gmail(session, user_id)
            c = sync_calendar(session, user_id)
            return {"provider": "google", "gmail": g, "calendar": c}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}")
    raise HTTPException(status_code=400, detail="Supported providers: gmail, calendar, google")


@router.post("/disconnect")
def disconnect(body: DisconnectRequest, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    provider = body.provider.strip().lower()
    if provider == "google":
        conn = session.exec(
            select(IntegrationConnection).where(
                IntegrationConnection.user_id == user_id,
                IntegrationConnection.provider == "google",
            )
        ).first()
        if conn:
            conn.status = "disconnected"
            conn.last_error = "Disconnected by user"
            session.add(conn)
        for source_type in ("gmail", "calendar"):
            source = session.exec(
                select(Source).where(Source.user_id == user_id, Source.source_type == source_type)
            ).first()
            if source:
                source.connection_status = "paused"
                source.last_error = "Disconnected by user"
                session.add(source)
        session.add(
            IntegrationSyncLog(
                user_id=user_id,
                provider="google",
                status="info",
                message="Google integration disconnected by user.",
            )
        )
        session.commit()
        return {"ok": True}
    raise HTTPException(status_code=400, detail="Supported providers: google")


@router.get("/whatsapp/webhook")
def whatsapp_verify(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
    hub_challenge: str = Query("", alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token and hub_verify_token == config.WHATSAPP_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(
    request: Request,
    x_hub_signature_256: str = Header(default=""),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    raw = await request.body()
    if config.WHATSAPP_APP_SECRET and not verify_whatsapp_signature(x_hub_signature_256, raw):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    payload: dict[str, Any] = json.loads(raw.decode() or "{}")
    imported = ingest_whatsapp_payload(session, user_id, payload)
    return {"ok": True, "imported": imported}

