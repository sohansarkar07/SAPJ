import json
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_engine import (
    extract_action_items,
    extract_text_from_pdf,
    generate_morning_digest,
    semantic_search,
    summarize_document,
)
from database import get_session
from deps import get_current_user, get_current_user_id
from models import Document, Notification, SearchQuery, Source, User

router = APIRouter()


@router.get("/session")
def get_session_info(user: User = Depends(get_current_user)):
    """Public session shape for the SPA — drives API base URL–agnostic clients."""
    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "organization_id": user.organization_id,
    }


@router.get("/user/profile")
def get_user_profile(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/sources")
def list_sources(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    sources = session.exec(select(Source).where(Source.user_id == user_id)).all()
    return sources

@router.get("/documents")
def list_documents(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    docs = session.exec(select(Document).where(Document.user_id == user_id).order_by(Document.ingested_at.desc())).all()
    return docs

@router.get("/documents/{document_id}")
def get_document(document_id: int, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/documents/{document_id}")
def delete_document(document_id: int, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    session.delete(doc)
    session.commit()
    return {"message": "Document deleted", "document_id": document_id}

@router.post("/sources")
def add_source(name: str, source_type: str, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    source = Source(user_id=user_id, name=name, source_type=source_type)
    session.add(source)
    session.commit()
    session.refresh(source)
    return source


def _get_or_create_pdf_source(user_id: int, session: Session) -> int:
    """Return the source_id for the user's 'Local Documents' source, creating it if needed."""
    src = session.exec(
        select(Source).where(Source.user_id == user_id, Source.source_type == "pdf")
    ).first()
    if src:
        return src.source_id
    src = Source(user_id=user_id, name="Local Documents", source_type="pdf", connection_status="connected")
    session.add(src)
    session.commit()
    session.refresh(src)
    return src.source_id


@router.post("/ingest/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    source_id: Optional[int] = Form(None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    # Auto-create a source if none provided
    if not source_id:
        source_id = _get_or_create_pdf_source(user_id, session)

    contents = await file.read()
    text = extract_text_from_pdf(contents)
    if not text:
        text = "Could not extract text from PDF."
    
    summary = summarize_document(text, file.filename)
    action_items = extract_action_items(text)
    
    doc = Document(
        source_id=source_id,
        user_id=user_id,
        title=file.filename,
        raw_content=text,
        doc_type="pdf",
        summary=summary,
        action_items_json=json.dumps(action_items)
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    return {
        "message": "Document ingested successfully",
        "document_id": doc.document_id,
        "title": doc.title,
        "summary": doc.summary,
        "action_items": action_items,
    }


class SearchBody(BaseModel):
    query: str
    doc_type: Optional[str] = None

@router.post("/search")
def search(body: SearchBody, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    # Record the search
    sq = SearchQuery(user_id=user_id, query_text=body.query)
    session.add(sq)
    
    stmt = select(Document).where(Document.user_id == user_id)
    if body.doc_type:
        stmt = stmt.where(Document.doc_type == body.doc_type)
        
    docs = session.exec(stmt).all()
    docs_dicts = [d.model_dump() for d in docs]
    
    results = semantic_search(body.query, docs_dicts)
    
    sq.result_count = len(results)
    session.commit()
    return {"results": results, "total": len(results)}

@router.get("/digest")
def get_morning_digest(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    docs = session.exec(select(Document).where(Document.user_id == user_id).order_by(Document.ingested_at.desc()).limit(15)).all()
    docs_dicts = [d.model_dump() for d in docs]
    
    digest = generate_morning_digest(docs_dicts, user.name if user else "User")
    return digest

@router.get("/notifications")
def get_notifications(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    notifs = session.exec(select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())).all()
    return notifs

@router.get("/stats")
def get_stats(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    """Dashboard statistics — real counts from the database."""
    doc_count = len(session.exec(select(Document).where(Document.user_id == user_id)).all())
    source_count = len(session.exec(select(Source).where(Source.user_id == user_id)).all())
    search_count = len(session.exec(select(SearchQuery).where(SearchQuery.user_id == user_id)).all())
    return {"documents": doc_count, "sources": source_count, "searches": search_count}
