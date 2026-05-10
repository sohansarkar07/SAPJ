import json
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from models import Document, IntegrationSyncLog, Notification, Source


def ingest_whatsapp_payload(session: Session, user_id: int, payload: dict[str, Any]) -> int:
    source = session.exec(
        select(Source).where(Source.user_id == user_id, Source.source_type == "whatsapp")
    ).first()
    if not source:
        source = Source(user_id=user_id, source_type="whatsapp", name="WhatsApp Cloud", connection_status="connected")
        session.add(source)
        session.commit()
        session.refresh(source)

    imported = 0
    entries = payload.get("entry", []) if isinstance(payload, dict) else []
    for entry in entries:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {})
            messages = value.get("messages", []) or []
            contacts = {c.get("wa_id"): c for c in value.get("contacts", []) or []}
            for msg in messages:
                msg_id = msg.get("id")
                if not msg_id:
                    continue
                exists = session.exec(
                    select(Document).where(
                        Document.user_id == user_id,
                        Document.provider_item_id == msg_id,
                        Document.doc_type == "whatsapp_message",
                    )
                ).first()
                if exists:
                    continue
                wa_id = msg.get("from")
                contact = contacts.get(wa_id, {})
                name = (contact.get("profile") or {}).get("name") or wa_id or "Unknown sender"
                text_body = ((msg.get("text") or {}).get("body") or "").strip()
                if not text_body:
                    text_body = f"Message type: {msg.get('type', 'unknown')}"
                ts = msg.get("timestamp", "")
                title = f"WhatsApp from {name}"
                raw = f"From: {name} ({wa_id})\nAt: {ts}\nMessage: {text_body}"
                session.add(
                    Document(
                        source_id=source.source_id,
                        user_id=user_id,
                        title=title,
                        raw_content=raw,
                        doc_type="whatsapp_message",
                        summary=text_body[:300],
                        provider_item_id=msg_id,
                        provider_thread_id=wa_id,
                        provider_payload_json=json.dumps(msg)[:20000],
                    )
                )
                session.add(
                    Notification(
                        user_id=user_id,
                        type="alert",
                        message=f"New WhatsApp message from {name}: {text_body[:90]}",
                    )
                )
                imported += 1

    source.last_synced_at = datetime.utcnow()
    source.connection_status = "connected"
    source.last_error = None
    session.add(source)
    session.add(
        IntegrationSyncLog(
            user_id=user_id,
            provider="whatsapp",
            status="success",
            message=f"WhatsApp webhook ingested {imported} new messages.",
            details_json=json.dumps({"imported": imported}),
        )
    )
    session.commit()
    return imported

