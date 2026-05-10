from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
import json

from database import get_session
from models import User, Source, Document, SearchQuery, Notification
from ai_engine import semantic_search, extract_text_from_pdf, summarize_document, extract_action_items, generate_morning_digest

router = APIRouter()

@router.get("/user/profile")
def get_user_profile(user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/sources")
def list_sources(user_id: int = 1, session: Session = Depends(get_session)):
    sources = session.exec(select(Source).where(Source.user_id == user_id)).all()
    return sources

@router.post("/sources")
def add_source(name: str, source_type: str, user_id: int = 1, session: Session = Depends(get_session)):
    source = Source(user_id=user_id, name=name, source_type=source_type)
    session.add(source)
    session.commit()
    session.refresh(source)
    return source

@router.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...), source_id: int = Form(...), user_id: int = Form(1), session: Session = Depends(get_session)):
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
    return {"message": "Document ingested successfully", "document_id": doc.document_id}

@router.post("/search")
def search(query: str, user_id: int = 1, session: Session = Depends(get_session)):
    # Record the search
    sq = SearchQuery(user_id=user_id, query_text=query)
    session.add(sq)
    
    docs = session.exec(select(Document).where(Document.user_id == user_id)).all()
    docs_dicts = [d.dict() for d in docs]
    
    results = semantic_search(query, docs_dicts)
    
    sq.result_count = len(results)
    session.commit()
    return {"results": results}

@router.get("/digest")
def get_morning_digest(user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    docs = session.exec(select(Document).where(Document.user_id == user_id).order_by(Document.ingested_at.desc()).limit(15)).all()
    docs_dicts = [d.dict() for d in docs]
    
    digest = generate_morning_digest(docs_dicts, user.name if user else "User")
    return digest

@router.get("/notifications")
def get_notifications(user_id: int = 1, session: Session = Depends(get_session)):
    notifs = session.exec(select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())).all()
    return notifs
