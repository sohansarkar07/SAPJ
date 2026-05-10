from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_engine import generate_mentee_brief
from database import get_session
from deps import get_current_user_id
from models import Mentee, SessionNote

router = APIRouter()

class SessionNoteRequest(BaseModel):
    summary: str
    blockers: str

@router.get("/mentees")
def list_mentees(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    mentees = session.exec(select(Mentee).where(Mentee.mentor_id == user_id)).all()
    return mentees

@router.get("/mentees/{mentee_id}/brief")
def get_mentee_brief(mentee_id: int, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    mentee = session.get(Mentee, mentee_id)
    if not mentee or mentee.mentor_id != user_id:
        raise HTTPException(status_code=404, detail="Mentee not found")
        
    notes = session.exec(select(SessionNote).where(SessionNote.mentee_id == mentee_id).order_by(SessionNote.session_date.desc()).limit(3)).all()
    
    if not notes:
        return {
            "brief": f"First session with {mentee.name}. No previous history — use this time to align on goals and blockers.",
            "mentee": mentee,
            "recent_notes": [],
        }
        
    history = "\n".join([f"Date: {n.session_date}, Summary: {n.summary}, Blockers: {n.blockers}" for n in notes])
    action_items = notes[0].action_items_given if notes else "None"
    
    brief = generate_mentee_brief(mentee.name, history, action_items)
    return {"brief": brief, "mentee": mentee, "recent_notes": notes}

@router.post("/mentees/{mentee_id}/session")
def add_session_note(mentee_id: int, req: SessionNoteRequest, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    mentee = session.get(Mentee, mentee_id)
    if not mentee or mentee.mentor_id != user_id:
        raise HTTPException(status_code=404, detail="Mentee not found")
        
    note = SessionNote(
        mentee_id=mentee_id,
        summary=req.summary,
        blockers=req.blockers
    )
    session.add(note)
    session.commit()
    session.refresh(note)
    return note
