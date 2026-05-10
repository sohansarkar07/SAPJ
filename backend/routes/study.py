from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from datetime import date, timedelta
import json

from database import get_session
from models import Flashcard, Document
from ai_engine import generate_flashcards

router = APIRouter()

@router.get("/flashcards")
def get_due_flashcards(user_id: int = 1, session: Session = Depends(get_session)):
    today = date.today()
    cards = session.exec(select(Flashcard).where(
        Flashcard.user_id == user_id, 
        Flashcard.next_review <= today
    )).all()
    return cards

@router.get("/flashcards/all")
def get_all_flashcards(user_id: int = 1, session: Session = Depends(get_session)):
    cards = session.exec(select(Flashcard).where(Flashcard.user_id == user_id)).all()
    return cards

@router.post("/flashcards/generate")
def auto_generate_flashcards(document_id: int, deck_name: str, user_id: int = 1, session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if not doc or doc.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
        
    cards_data = generate_flashcards(doc.raw_content, deck_name)
    created = []
    
    for c in cards_data:
        card = Flashcard(
            user_id=user_id,
            document_id=document_id,
            deck_name=deck_name,
            question=c.get("question", ""),
            answer=c.get("answer", "")
        )
        session.add(card)
        created.append(card)
        
    session.commit()
    return created

@router.put("/flashcards/{card_id}/review")
def review_flashcard(card_id: int, quality: int, user_id: int = 1, session: Session = Depends(get_session)):
    # quality: 0=Again, 1=Hard, 2=Good, 3=Easy
    card = session.get(Flashcard, card_id)
    if not card or card.user_id != user_id:
        raise HTTPException(status_code=404, detail="Card not found")
        
    # Basic SuperMemo 2 algorithm
    if quality < 1:
        card.interval = 1
        card.review_count = 0
    else:
        if card.review_count == 0:
            card.interval = 1
        elif card.review_count == 1:
            card.interval = 6
        else:
            card.interval = int(card.interval * card.ease_factor)
            
        card.review_count += 1
        
    card.ease_factor = max(1.3, card.ease_factor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)))
    card.next_review = date.today() + timedelta(days=card.interval)
    
    session.add(card)
    session.commit()
    return card
