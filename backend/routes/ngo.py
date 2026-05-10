from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
import json
from pydantic import BaseModel
from datetime import date

from database import get_session
from models import Organization, User, Grant, VolunteerSchedule, ImpactReport, Document
from ai_engine import generate_grant_draft, generate_volunteer_schedule, generate_impact_report

router = APIRouter()

class GrantRequest(BaseModel):
    title: str
    deadline: date
    org_info: str
    guidelines: str
    
class ImpactReportRequest(BaseModel):
    period: str
    
@router.get("/grants")
def list_grants(user_id: int = 1, session: Session = Depends(get_session)):
    grants = session.exec(select(Grant).where(Grant.user_id == user_id)).all()
    return grants

@router.post("/grants/generate")
def create_grant(req: GrantRequest, user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    # Fetch some past work context from documents
    docs = session.exec(select(Document).where(Document.user_id == user_id).limit(10)).all()
    past_work = "\n".join([d.summary or d.raw_content[:500] for d in docs])
    
    draft = generate_grant_draft(req.org_info, req.guidelines, past_work)
    
    grant = Grant(
        user_id=user_id,
        org_id=user.organization_id if user else None,
        title=req.title,
        deadline=req.deadline,
        draft_content=json.dumps(draft),
        status="draft"
    )
    session.add(grant)
    session.commit()
    session.refresh(grant)
    return grant

@router.get("/volunteers")
def list_schedules(user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        return []
    schedules = session.exec(select(VolunteerSchedule).where(VolunteerSchedule.org_id == user.organization_id)).all()
    return schedules

@router.post("/volunteers/schedule")
def auto_schedule(availability_data: str, programs: str, user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not part of an org")
        
    generated = generate_volunteer_schedule(availability_data, programs)
    created_schedules = []
    
    for item in generated:
        try:
            shift_date = date.fromisoformat(item.get("shift_date", str(date.today())))
        except:
            shift_date = date.today()
            
        sched = VolunteerSchedule(
            org_id=user.organization_id,
            volunteer_name=item.get("volunteer_name", "Unknown"),
            program_name=item.get("program_name", "General"),
            shift_date=shift_date,
            shift_time=item.get("shift_time", "9AM-1PM"),
            status=item.get("status", "confirmed")
        )
        session.add(sched)
        created_schedules.append(sched)
        
    session.commit()
    return created_schedules

@router.get("/impact")
def list_impact_reports(user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        return []
    reports = session.exec(select(ImpactReport).where(ImpactReport.org_id == user.organization_id)).all()
    return reports

@router.post("/impact/generate")
def create_impact_report(req: ImpactReportRequest, user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    
    # Gather data from recent documents, grants, schedules
    docs = session.exec(select(Document).where(Document.user_id == user_id).limit(20)).all()
    data = "\n".join([f"[{d.title}]: {d.summary}" for d in docs if d.summary])
    
    report_content = generate_impact_report(data, req.period)
    
    report = ImpactReport(
        org_id=user.organization_id if user else None,
        user_id=user_id,
        period=req.period,
        content=json.dumps(report_content)
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return report
