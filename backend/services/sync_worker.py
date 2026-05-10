from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlmodel import Session, select

from database import engine
from models import IntegrationConnection, IntegrationSyncLog
from services.calendar_sync import sync_calendar
from services.gmail_sync import sync_gmail

_scheduler: BackgroundScheduler | None = None


def _sync_all_google_connections() -> None:
    with Session(engine) as session:
        conns = session.exec(select(IntegrationConnection).where(IntegrationConnection.provider == "google")).all()
        for conn in conns:
            try:
                sync_gmail(session, conn.user_id, max_results=10)
                sync_calendar(session, conn.user_id, max_results=10)
            except Exception as exc:
                session.add(
                    IntegrationSyncLog(
                        user_id=conn.user_id,
                        provider="google",
                        status="error",
                        message=f"Background sync failed: {str(exc)}",
                        details_json='{"job":"background-google-sync"}',
                        created_at=datetime.utcnow(),
                    )
                )
                session.commit()


def start_sync_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_sync_all_google_connections, "interval", minutes=5, id="google_sync", replace_existing=True)
    _scheduler.start()


def stop_sync_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None

