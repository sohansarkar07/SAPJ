import json
from datetime import datetime
from typing import Any

import httpx
from sqlmodel import Session, select

from ai_engine import extract_action_items, summarize_document
from models import Document, IntegrationConnection, IntegrationSyncLog, Notification, Source
from services.google_oauth import refresh_access_token
from services.security import decrypt_text, encrypt_text


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


def sync_calendar(session: Session, user_id: int, max_results: int = 25) -> dict[str, Any]:
    conn = session.exec(
        select(IntegrationConnection).where(
            IntegrationConnection.user_id == user_id,
            IntegrationConnection.provider == "google",
        )
    ).first()
    if not conn or not conn.access_token_encrypted:
        raise ValueError("Google integration not connected")

    cal_source = session.exec(
        select(Source).where(Source.user_id == user_id, Source.source_type == "calendar")
    ).first()
    if not cal_source:
        cal_source = Source(user_id=user_id, source_type="calendar", name="Google Calendar", connection_status="connected")
        session.add(cal_source)
        session.commit()
        session.refresh(cal_source)

    access_token = _valid_access_token(session, conn)
    imported = 0
    deduped = 0
    next_sync_token = None
    params: dict[str, Any] = {"singleEvents": "true", "orderBy": "updated", "maxResults": max_results}
    if conn.last_sync_cursor:
        params["syncToken"] = conn.last_sync_cursor
    else:
        params["timeMin"] = datetime.utcnow().isoformat() + "Z"

    with httpx.Client(timeout=45.0) as client:
        res = client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
        )
        res.raise_for_status()
        data = res.json()
        next_sync_token = data.get("nextSyncToken")
        for event in data.get("items", []):
            event_id = event.get("id")
            if not event_id:
                continue
            existing = session.exec(
                select(Document).where(
                    Document.user_id == user_id,
                    Document.provider_item_id == event_id,
                    Document.doc_type == "calendar_event",
                )
            ).first()
            if existing:
                deduped += 1
                continue
            summary_txt = event.get("summary") or "Untitled calendar event"
            description = event.get("description") or ""
            when = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date", "")
            content = f"{summary_txt}\nWhen: {when}\n{description}".strip()
            doc = Document(
                source_id=cal_source.source_id,
                user_id=user_id,
                title=summary_txt,
                raw_content=content,
                doc_type="calendar_event",
                summary=summarize_document(content, summary_txt),
                action_items_json=json.dumps(extract_action_items(content)),
                provider_item_id=event_id,
                external_url=event.get("htmlLink"),
                provider_payload_json=json.dumps(event)[:30000],
            )
            session.add(doc)
            imported += 1

            session.add(
                Notification(
                    user_id=user_id,
                    type="info",
                    message=f"Calendar event synced: {summary_txt} ({when})",
                )
            )

    conn.last_sync_cursor = next_sync_token or conn.last_sync_cursor
    conn.last_error = None
    conn.updated_at = datetime.utcnow()
    cal_source.last_synced_at = datetime.utcnow()
    cal_source.connection_status = "connected"
    session.add(conn)
    session.add(cal_source)
    session.add(
        IntegrationSyncLog(
            user_id=user_id,
            provider="calendar",
            status="success",
            message=f"Calendar sync imported {imported} events ({deduped} duplicates skipped).",
            details_json=json.dumps({"imported": imported, "deduped": deduped}),
        )
    )
    session.commit()
    return {"imported": imported, "deduped": deduped}

