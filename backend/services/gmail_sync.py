import base64
import json
from datetime import datetime
from typing import Any

import httpx
from sqlmodel import Session, select

from ai_engine import extract_action_items, summarize_document
from models import Document, IntegrationConnection, IntegrationSyncLog, Source
from services.google_oauth import refresh_access_token
from services.security import decrypt_text, encrypt_text


def _decode_base64url(value: str) -> str:
    if not value:
        return ""
    padded = value + "=" * ((4 - len(value) % 4) % 4)
    try:
        return base64.urlsafe_b64decode(padded.encode()).decode(errors="ignore")
    except Exception:
        return ""


def _extract_message_body(payload: dict[str, Any]) -> str:
    if not payload:
        return ""
    body = _decode_base64url((payload.get("body") or {}).get("data", ""))
    if body:
        return body
    for part in payload.get("parts", []) or []:
        body = _extract_message_body(part)
        if body:
            return body
    return ""


def _valid_access_token(session: Session, conn: IntegrationConnection) -> str:
    token = decrypt_text(conn.access_token_encrypted or "")
    if conn.token_expires_at and conn.token_expires_at <= datetime.utcnow() and conn.refresh_token_encrypted:
        refreshed = refresh_access_token(decrypt_text(conn.refresh_token_encrypted))
        conn.access_token_encrypted = encrypt_text(refreshed["access_token"])
        conn.token_expires_at = refreshed.get("expires_at")
        conn.updated_at = datetime.utcnow()
        session.add(conn)
        session.commit()
        session.refresh(conn)
        token = refreshed["access_token"]
    return token


def sync_gmail(session: Session, user_id: int, max_results: int = 20) -> dict[str, Any]:
    conn = session.exec(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.provider == "google",
        )
    ).first()
    if not conn or not conn.access_token_encrypted:
        raise ValueError("Google integration not connected")

    gmail_source = session.exec(
        select(Source).where(Source.user_id == user_id, Source.source_type == "gmail")
    ).first()
    if not gmail_source:
        gmail_source = Source(user_id=user_id, source_type="gmail", name="Gmail", connection_status="connected")
        session.add(gmail_source)
        session.commit()
        session.refresh(gmail_source)

    access_token = _valid_access_token(session, conn)
    imported = 0
    deduped = 0
    newest_history_id = conn.last_sync_cursor

    with httpx.Client(timeout=45.0) as client:
        list_res = client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"maxResults": max_results, "q": "in:anywhere"},
        )
        list_res.raise_for_status()
        messages = list_res.json().get("messages", [])
        for msg in messages:
            msg_id = msg.get("id")
            if not msg_id:
                continue
            existing = session.exec(
                select(Document).where(
                    Document.user_id == user_id,
                    Document.provider_item_id == msg_id,
                    Document.doc_type == "email",
                )
            ).first()
            if existing:
                deduped += 1
                continue
            msg_res = client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"format": "full"},
            )
            msg_res.raise_for_status()
            payload = msg_res.json()
            newest_history_id = str(payload.get("historyId") or newest_history_id or "")
            headers = {h.get("name", "").lower(): h.get("value", "") for h in payload.get("payload", {}).get("headers", [])}
            subject = headers.get("subject") or f"Gmail message {msg_id}"
            body = _extract_message_body(payload.get("payload", {})) or payload.get("snippet", "")
            summary = summarize_document(body, subject)
            actions = extract_action_items(body)
            doc = Document(
                source_id=gmail_source.source_id,
                user_id=user_id,
                title=subject,
                raw_content=body[:20000],
                doc_type="email",
                summary=summary,
                action_items_json=json.dumps(actions),
                provider_item_id=msg_id,
                provider_thread_id=payload.get("threadId"),
                external_url=f"https://mail.google.com/mail/u/0/#inbox/{msg_id}",
                provider_payload_json=json.dumps(payload)[:40000],
            )
            session.add(doc)
            imported += 1

    conn.last_sync_cursor = newest_history_id
    conn.last_error = None
    conn.updated_at = datetime.utcnow()
    gmail_source.last_synced_at = datetime.utcnow()
    gmail_source.connection_status = "connected"
    session.add(conn)
    session.add(gmail_source)
    session.add(
        IntegrationSyncLog(
            user_id=user_id,
            provider="gmail",
            status="success",
            message=f"Gmail sync imported {imported} messages ({deduped} duplicates skipped).",
            details_json=json.dumps({"imported": imported, "deduped": deduped}),
        )
    )
    session.commit()
    return {"imported": imported, "deduped": deduped}

