"""
Second Brain — Database Models (SQLModel)
"""
from datetime import datetime, date
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import json


class Organization(SQLModel, table=True):
    __tablename__ = "organizations"
    org_id: Optional[int] = Field(default=None, primary_key=True)
    org_name: str
    org_type: str = "ngo"  # ngo | it | agency | mentor
    plan: str = "free"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    __tablename__ = "users"
    user_id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    role: str = "ngo"  # ngo | it | agency | mentor
    organization_id: Optional[int] = Field(default=None, foreign_key="organizations.org_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Source(SQLModel, table=True):
    __tablename__ = "sources"
    source_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    source_type: str  # gmail | drive | pdf | slack | whatsapp | manual
    name: str
    connection_status: str = "connected"  # connected | syncing | paused | error
    provider_account: Optional[str] = None  # email / phone / workspace identifier
    metadata_json: Optional[str] = None  # provider-specific JSON metadata
    last_error: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Document(SQLModel, table=True):
    __tablename__ = "documents"
    document_id: Optional[int] = Field(default=None, primary_key=True)
    source_id: Optional[int] = Field(default=None, foreign_key="sources.source_id")
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    title: str
    raw_content: str
    embedding_json: Optional[str] = None  # JSON-encoded float list
    doc_type: str = "text"  # text | pdf | email | slack
    summary: Optional[str] = None
    action_items_json: Optional[str] = None  # JSON list of strings
    entities_json: Optional[str] = None  # JSON list of dicts
    provider_item_id: Optional[str] = None  # provider-side stable id (e.g. Gmail message id)
    provider_thread_id: Optional[str] = None
    external_url: Optional[str] = None
    provider_payload_json: Optional[str] = None  # raw provider JSON payload
    ingested_at: datetime = Field(default_factory=datetime.utcnow)


class Grant(SQLModel, table=True):
    __tablename__ = "grants"
    grant_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    org_id: Optional[int] = Field(default=None, foreign_key="organizations.org_id")
    title: str
    draft_content: Optional[str] = None  # JSON with sections
    status: str = "draft"  # draft | in_review | submitted | approved | rejected
    deadline: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VolunteerSchedule(SQLModel, table=True):
    __tablename__ = "volunteer_schedules"
    schedule_id: Optional[int] = Field(default=None, primary_key=True)
    org_id: Optional[int] = Field(default=None, foreign_key="organizations.org_id")
    volunteer_name: str
    shift_date: date
    program_name: str
    shift_time: str = "9:00 AM - 1:00 PM"
    status: str = "confirmed"  # confirmed | pending | cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ImpactReport(SQLModel, table=True):
    __tablename__ = "impact_reports"
    report_id: Optional[int] = Field(default=None, primary_key=True)
    org_id: Optional[int] = Field(default=None, foreign_key="organizations.org_id")
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    period: str  # "Q1 2026" etc
    content: Optional[str] = None  # JSON with sections
    export_url: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class Mentee(SQLModel, table=True):
    __tablename__ = "mentees"
    mentee_id: Optional[int] = Field(default=None, primary_key=True)
    mentor_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    name: str
    email: Optional[str] = None
    current_goal: Optional[str] = None
    stage: str = "active"  # active | paused | completed
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class SessionNote(SQLModel, table=True):
    __tablename__ = "session_notes"
    session_id: Optional[int] = Field(default=None, primary_key=True)
    mentee_id: int = Field(foreign_key="mentees.mentee_id")
    summary: str
    blockers: Optional[str] = None
    action_items_given: Optional[str] = None  # JSON list
    session_date: date = Field(default_factory=date.today)


class Flashcard(SQLModel, table=True):
    __tablename__ = "flashcards"
    card_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    document_id: Optional[int] = Field(default=None, foreign_key="documents.document_id")
    deck_name: str
    question: str
    answer: str
    ease_factor: float = 2.5
    interval: int = 1  # days until next review
    next_review: date = Field(default_factory=date.today)
    review_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SearchQuery(SQLModel, table=True):
    __tablename__ = "search_queries"
    query_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    query_text: str
    sources_searched: str = "all"
    result_count: int = 0
    searched_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"
    notification_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.user_id")
    type: str  # alert | digest | reminder | info
    message: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    project_id: Optional[int] = Field(default=None, primary_key=True)
    org_id: Optional[int] = Field(default=None, foreign_key="organizations.org_id")
    name: str
    client_name: str
    tech_stack: Optional[str] = None
    brief_summary: Optional[str] = None  # AI-generated
    status: str = "active"  # active | completed | on_hold
    deadline: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class IntegrationConnection(SQLModel, table=True):
    __tablename__ = "integration_connections"
    connection_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.user_id", index=True)
    provider: str = Field(index=True)  # google | whatsapp
    provider_account_id: Optional[str] = None
    provider_account_label: Optional[str] = None
    access_token_encrypted: Optional[str] = None
    refresh_token_encrypted: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: Optional[str] = None  # space-delimited scope string
    status: str = "connected"  # connected | paused | error | disconnected
    last_sync_cursor: Optional[str] = None  # Gmail historyId / Calendar syncToken
    webhook_resource_id: Optional[str] = None
    webhook_resource_data: Optional[str] = None
    last_error: Optional[str] = None
    metadata_json: Optional[str] = None
    connected_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IntegrationSyncLog(SQLModel, table=True):
    __tablename__ = "integration_sync_logs"
    log_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.user_id", index=True)
    provider: str = Field(index=True)  # gmail | calendar | whatsapp
    status: str = "success"  # success | warning | error | info
    message: str
    details_json: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
