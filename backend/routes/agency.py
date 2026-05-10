from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
import json
from pydantic import BaseModel

from database import get_session
from models import User, Project, Document
from ai_engine import generate_project_brief

router = APIRouter()

class ProjectRequest(BaseModel):
    name: str
    client_name: str
    tech_stack: str

@router.get("/projects")
def list_projects(user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        return []
    projects = session.exec(select(Project).where(Project.org_id == user.organization_id)).all()
    return projects

@router.post("/projects")
def add_project(req: ProjectRequest, user_id: int = 1, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not part of an org")
        
    project = Project(
        org_id=user.organization_id,
        name=req.name,
        client_name=req.client_name,
        tech_stack=req.tech_stack
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.get("/projects/{project_id}/sync")
def sync_project_brief(project_id: int, user_id: int = 1, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Find docs related to this project
    docs = session.exec(select(Document).where(Document.user_id == user_id).limit(15)).all()
    # In a real app we'd filter by project name, here we just use what we have
    emails = "\n".join([f"[{d.title}]: {d.raw_content}" for d in docs if "email" in d.doc_type.lower() or "slack" in d.doc_type.lower()])
    
    if not emails:
        emails = "No recent communications found."
        
    brief = generate_project_brief(emails, project.name)
    project.brief_summary = brief
    session.add(project)
    session.commit()
    return {"brief": brief}
