import json
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ai_engine import generate_grant_draft, generate_impact_report, generate_volunteer_schedule
from database import get_session
from deps import get_current_user_id
from models import Document, Grant, ImpactReport, User, VolunteerSchedule

router = APIRouter()


class GrantRequest(BaseModel):
    title: str
    deadline: date
    org_info: str
    guidelines: str


class ImpactReportRequest(BaseModel):
    period: str


class AutoScheduleRequest(BaseModel):
    availability_data: str = ""
    programs: str = ""


class VolunteerShiftCreate(BaseModel):
    volunteer_name: str
    program_name: str
    shift_date: date
    shift_time: str = "9AM-1PM"
    status: Literal["confirmed", "pending", "cancelled"] = "pending"


@router.get("/grants")
def list_grants(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    grants = session.exec(select(Grant).where(Grant.user_id == user_id)).all()
    return grants


@router.post("/grants/generate")
def create_grant(req: GrantRequest, user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    docs = session.exec(select(Document).where(Document.user_id == user_id).limit(10)).all()
    past_work = "\n".join([d.summary or (d.raw_content or "")[:500] for d in docs])

    draft = generate_grant_draft(req.org_info, req.guidelines, past_work)

    grant = Grant(
        user_id=user_id,
        org_id=user.organization_id if user else None,
        title=req.title,
        deadline=req.deadline,
        draft_content=json.dumps(draft),
        status="draft",
    )
    session.add(grant)
    session.commit()
    session.refresh(grant)
    return grant


@router.get("/volunteers")
def list_schedules(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        return []
    schedules = session.exec(
        select(VolunteerSchedule).where(VolunteerSchedule.org_id == user.organization_id)
    ).all()
    return schedules


@router.post("/volunteers")
def create_volunteer_shift(
    body: VolunteerShiftCreate,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not part of an organization")

    sched = VolunteerSchedule(
        org_id=user.organization_id,
        volunteer_name=body.volunteer_name,
        program_name=body.program_name,
        shift_date=body.shift_date,
        shift_time=body.shift_time,
        status=body.status,
    )
    session.add(sched)
    session.commit()
    session.refresh(sched)
    return sched


@router.delete("/volunteers/{schedule_id}")
def delete_volunteer_shift(
    schedule_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not part of an organization")

    sched = session.get(VolunteerSchedule, schedule_id)
    if not sched or sched.org_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Shift not found")

    session.delete(sched)
    session.commit()
    return {"ok": True}


@router.post("/volunteers/schedule")
def auto_schedule(
    req: AutoScheduleRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not part of an organization")

    availability_data = req.availability_data.strip()
    programs = req.programs.strip()

    existing = session.exec(
        select(VolunteerSchedule).where(VolunteerSchedule.org_id == user.organization_id).limit(30)
    ).all()

    if not availability_data and existing:
        availability_data = "\n".join(
            f"{s.volunteer_name}: {s.shift_date} {s.shift_time} ({s.program_name}, {s.status})"
            for s in existing
        )
    if not programs and existing:
        programs = ", ".join(sorted({s.program_name for s in existing}))

    if not availability_data:
        availability_data = "No prior schedule; infer realistic volunteer assignments."
    if not programs:
        programs = "General community programs"

    generated = generate_volunteer_schedule(availability_data, programs)
    created_schedules = []

    for item in generated:
        try:
            shift_date = date.fromisoformat(item.get("shift_date", str(date.today())))
        except (TypeError, ValueError):
            shift_date = date.today()

        raw_status = (item.get("status") or "confirmed").strip().lower()
        if raw_status not in ("confirmed", "pending", "cancelled"):
            raw_status = "pending"
        sched = VolunteerSchedule(
            org_id=user.organization_id,
            volunteer_name=item.get("volunteer_name", "Unknown"),
            program_name=item.get("program_name", "General"),
            shift_date=shift_date,
            shift_time=item.get("shift_time", "9AM-1PM"),
            status=raw_status,
        )
        session.add(sched)
        created_schedules.append(sched)

    session.commit()
    for s in created_schedules:
        session.refresh(s)
    return created_schedules


@router.get("/impact")
def list_impact_reports(user_id: int = Depends(get_current_user_id), session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        return []
    reports = session.exec(select(ImpactReport).where(ImpactReport.org_id == user.organization_id)).all()
    return reports


@router.post("/impact/generate")
def create_impact_report(
    req: ImpactReportRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)

    docs = session.exec(select(Document).where(Document.user_id == user_id).limit(20)).all()
    data = "\n".join([f"[{d.title}]: {d.summary}" for d in docs if d.summary])

    report_content = generate_impact_report(data, req.period)

    report = ImpactReport(
        org_id=user.organization_id if user else None,
        user_id=user_id,
        period=req.period,
        content=json.dumps(report_content),
    )
    session.add(report)
    session.commit()
    session.refresh(report)
    return report
