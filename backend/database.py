"""
Second Brain — Database Setup & Session Management
"""
from typing import Generator

from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine

import config

DATABASE_URL = config.DATABASE_URL

_engine_kwargs = {"echo": False}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_kwargs)
_schema_checked = False


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    ensure_runtime_schema()


def get_session() -> Generator[Session, None, None]:
    global _schema_checked
    if not _schema_checked:
        SQLModel.metadata.create_all(engine)
        ensure_runtime_schema()
        _schema_checked = True
    with Session(engine) as session:
        yield session


def ensure_runtime_schema() -> None:
    """
    Add newly introduced columns/indexes in existing SQLite DBs without a migration framework.
    This keeps local/dev environments working while preserving existing data.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    ddl = [
        "ALTER TABLE sources ADD COLUMN provider_account VARCHAR",
        "ALTER TABLE sources ADD COLUMN metadata_json VARCHAR",
        "ALTER TABLE sources ADD COLUMN last_error VARCHAR",
        "ALTER TABLE documents ADD COLUMN provider_item_id VARCHAR",
        "ALTER TABLE documents ADD COLUMN provider_thread_id VARCHAR",
        "ALTER TABLE documents ADD COLUMN external_url VARCHAR",
        "ALTER TABLE documents ADD COLUMN provider_payload_json VARCHAR",
        "CREATE INDEX IF NOT EXISTS ix_documents_provider_item_id ON documents(provider_item_id)",
    ]
    with engine.begin() as conn:
        for stmt in ddl:
            try:
                conn.execute(text(stmt))
            except Exception:
                # Column/index may already exist.
                pass



