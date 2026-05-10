"""
Second Brain — Database Setup & Session Management
"""
from sqlmodel import SQLModel, Session, create_engine
from typing import Generator
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./second_brain.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    seed_demo_data()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def seed_demo_data():
    from models import (
        Organization, User, Source, Document, Grant,
        VolunteerSchedule, Mentee, SessionNote, Flashcard,
        Notification, Project, ImpactReport
    )
    from datetime import date, datetime, timedelta
    import json

    with Session(engine) as session:
        from sqlmodel import select
        existing = session.exec(select(User)).first()
        if existing:
            return

        ngo_org = Organization(org_name="GreenHope Foundation", org_type="ngo", plan="pro")
        agency_org = Organization(org_name="Webcraftzs", org_type="agency", plan="team")
        mentor_org = Organization(org_name="The Ascent Circle", org_type="mentor", plan="pro")
        session.add_all([ngo_org, agency_org, mentor_org])
        session.flush()

        priya = User(name="Priya Sharma", email="priya@greenhope.org", role="ngo", organization_id=ngo_org.org_id)
        rahul_agency = User(name="Rahul Mehta", email="rahul@webcraftzs.com", role="agency", organization_id=agency_org.org_id)
        mentor_user = User(name="Ananya Singh", email="ananya@ascentcircle.in", role="mentor", organization_id=mentor_org.org_id)
        session.add_all([priya, rahul_agency, mentor_user])
        session.flush()

        sources = [
            Source(user_id=priya.user_id, source_type="gmail", name="Gmail (priya@greenhope.org)", connection_status="connected", last_synced_at=datetime.utcnow()),
            Source(user_id=priya.user_id, source_type="drive", name="Google Drive", connection_status="syncing", last_synced_at=datetime.utcnow()),
            Source(user_id=priya.user_id, source_type="pdf", name="Local Documents", connection_status="connected", last_synced_at=datetime.utcnow()),
            Source(user_id=priya.user_id, source_type="slack", name="Slack Workspace", connection_status="paused"),
        ]
        session.add_all(sources)
        session.flush()

        docs = [
            Document(
                source_id=sources[0].source_id, user_id=priya.user_id,
                title="Re: ActionAid Grant Q3 Update",
                raw_content="Dear Priya, We are pleased to confirm the Q3 disbursement of Rs 8,50,000 is approved pending the impact report by October 31. Please ensure Kolkata program data is included. Best, Sarah Jenkins, ActionAid India",
                doc_type="email",
                summary="ActionAid confirmed Q3 grant disbursement of Rs 8.5L pending impact report by Oct 31.",
                action_items_json=json.dumps(["Submit impact report by Oct 31", "Include Kolkata program field data"]),
                entities_json=json.dumps([{"type": "person", "value": "Sarah Jenkins"}, {"type": "amount", "value": "Rs 8,50,000"}])
            ),
            Document(
                source_id=sources[2].source_id, user_id=priya.user_id,
                title="GreenHope Annual Report 2025.pdf",
                raw_content="GreenHope Foundation Annual Report 2025. Digital Literacy Kolkata: 1,240 beneficiaries, 87 sessions. Clean Water Initiative: 3,400 households. Budget: Rs 42,00,000 of Rs 50,00,000. Volunteers: 48 active, 2,800 hours.",
                doc_type="pdf",
                summary="Annual report: 4,640 beneficiaries, Rs 42L utilized, 2,800 volunteer hours.",
            ),
            Document(
                source_id=sources[1].source_id, user_id=priya.user_id,
                title="CSIR Fund Guidelines 2026.pdf",
                raw_content="CSIR Science Society Programme 2026. Eligible: NGOs in STEM, environment, health. Grant: Rs 5L-25L. Deadline: December 15 2026. Sections required: org overview, problem statement, solution, impact metrics, budget, timeline.",
                doc_type="pdf",
                summary="CSIR grant for STEM NGOs. Range Rs 5L-25L. Deadline Dec 15 2026.",
            ),
        ]
        session.add_all(docs)
        session.flush()

        grant1 = Grant(
            user_id=priya.user_id, org_id=ngo_org.org_id,
            title="CSIR Science Society Programme 2026",
            status="draft", deadline=date(2026, 12, 15),
            draft_content=json.dumps({
                "org_overview": "GreenHope Foundation is a registered non-profit dedicated to bridging the digital divide in West Bengal. Since 2019, we have impacted 4,640 beneficiaries across 12 districts.",
                "problem_statement": "Over 2.3 million children in rural West Bengal lack STEM education. 78% of schools have no computer labs.",
                "proposed_solution": "The Digital Futures Program will establish 5 STEM labs, train 30 educators, and reach 2,000 children annually.",
                "expected_impact": "Year 1: 2,000 students, 30 teachers trained. Year 2: 85% measurable STEM improvement.",
                "budget_breakdown": "Lab setup: Rs 12L\nCurriculum: Rs 3L\nTraining: Rs 2.5L\nDelivery: Rs 5L\nM&E: Rs 2.5L\nTotal: Rs 25L",
                "timeline": "Jan 2027: Setup\nMar 2027: Training\nApr 2027: Launch\nDec 2027: Year 1 assessment"
            })
        )
        grant2 = Grant(user_id=priya.user_id, org_id=ngo_org.org_id, title="ActionAid Q4 Impact Grant", status="submitted", deadline=date(2026, 10, 31))
        session.add_all([grant1, grant2])

        today = date.today()
        schedules = [
            VolunteerSchedule(org_id=ngo_org.org_id, volunteer_name="Amit Kumar", shift_date=today + timedelta(days=3), program_name="Community Cleanup", shift_time="9AM-1PM", status="confirmed"),
            VolunteerSchedule(org_id=ngo_org.org_id, volunteer_name="Sunita Devi", shift_date=today + timedelta(days=3), program_name="Community Cleanup", shift_time="9AM-1PM", status="confirmed"),
            VolunteerSchedule(org_id=ngo_org.org_id, volunteer_name="Ravi Gupta", shift_date=today + timedelta(days=6), program_name="Food Drive Sorting", shift_time="2PM-6PM", status="pending"),
            VolunteerSchedule(org_id=ngo_org.org_id, volunteer_name="Meera Patel", shift_date=today + timedelta(days=6), program_name="Food Drive Sorting", shift_time="2PM-6PM", status="cancelled"),
            VolunteerSchedule(org_id=ngo_org.org_id, volunteer_name="Kavya Nair", shift_date=today + timedelta(days=10), program_name="Digital Literacy Class", shift_time="10AM-12PM", status="confirmed"),
        ]
        session.add_all(schedules)

        report = ImpactReport(
            org_id=ngo_org.org_id, user_id=priya.user_id, period="Q3 2026",
            content=json.dumps({
                "executive_summary": "In Q3 2026, GreenHope served 1,944 beneficiaries. Digital Literacy: 1,240 students, 87 sessions. Clean Water: 580 households. Volunteer hours: 312.",
                "financial_summary": "Budget: Rs 12L. Utilized: Rs 10.5L (87.5%). Carryforward: Rs 1.5L.",
                "volunteer_contribution": "Active: 48. Total hours: 312. New onboarded: 8.",
                "looking_ahead": "Q4: Scale Digital Literacy to 3 new districts. Complete CSIR MOU."
            })
        )
        session.add(report)

        mentees = [
            Mentee(mentor_id=mentor_user.user_id, name="Rahul Desai", email="rahul.d@gmail.com", current_goal="Land first PM role", stage="active"),
            Mentee(mentor_id=mentor_user.user_id, name="Pooja Verma", email="pooja.v@gmail.com", current_goal="Transition to UX design", stage="active"),
            Mentee(mentor_id=mentor_user.user_id, name="Arjun Singh", email="arjun.s@gmail.com", current_goal="Get into IIM for MBA", stage="active"),
        ]
        session.add_all(mentees)
        session.flush()

        notes = [
            SessionNote(
                mentee_id=mentees[0].mentee_id,
                summary="Rahul struggling with resume. Worked on STAR method. Applied to 3 jobs last week — no responses yet.",
                blockers="Resume not ATS-optimized. LinkedIn profile outdated.",
                action_items_given=json.dumps(["Update LinkedIn", "Apply to 5 PM roles by Friday", "Read Cracking the PM Interview ch1-3"]),
                session_date=today - timedelta(days=7)
            ),
            SessionNote(
                mentee_id=mentees[1].mentee_id,
                summary="Pooja completed first UX case study. Portfolio needs more process context. Needs Figma practice.",
                blockers="Not confident with prototyping yet.",
                action_items_given=json.dumps(["Complete Figma 101", "Add 2 case studies", "Apply to 3 junior UX roles"]),
                session_date=today - timedelta(days=5)
            ),
        ]
        session.add_all(notes)

        flashcards = [
            Flashcard(user_id=priya.user_id, document_id=docs[2].document_id, deck_name="CSIR Grant Guidelines", question="What is the grant range for CSIR Science Society Programme?", answer="Rs 5 Lakhs to Rs 25 Lakhs", interval=3, next_review=today),
            Flashcard(user_id=priya.user_id, document_id=docs[2].document_id, deck_name="CSIR Grant Guidelines", question="What is the CSIR 2026 submission deadline?", answer="December 15, 2026", interval=1, next_review=today),
            Flashcard(user_id=priya.user_id, document_id=docs[1].document_id, deck_name="GreenHope Annual Report", question="How many beneficiaries did Digital Literacy serve?", answer="1,240 beneficiaries, 87 sessions", interval=7, next_review=today + timedelta(days=7)),
        ]
        session.add_all(flashcards)

        projects = [
            Project(org_id=agency_org.org_id, name="Medsync Web Platform", client_name="Medsync Healthcare", tech_stack="React, Node.js, PostgreSQL", brief_summary="Mobile-first healthcare booking platform. Decision: Tailwind confirmed Oct 3. Deadline Dec 2026.", status="active", deadline=date(2026, 12, 31)),
            Project(org_id=agency_org.org_id, name="RetailPro Dashboard", client_name="RetailPro India", tech_stack="Vue.js, FastAPI, Redis", brief_summary="Inventory dashboard with real-time sync. Pending: API design approval from client.", status="active", deadline=date(2026, 11, 15)),
        ]
        session.add_all(projects)

        notifs = [
            Notification(user_id=priya.user_id, type="alert", message="Grant deadline in 3 days: ActionAid Q4 Impact Grant (Oct 31)"),
            Notification(user_id=priya.user_id, type="alert", message="Volunteer gap: Food Drive Sorting (Oct 15) — 2 dropouts need replacement"),
            Notification(user_id=priya.user_id, type="digest", message="Morning Digest: 3 new insights, 2 action items, 1 grant update"),
            Notification(user_id=priya.user_id, type="info", message="CSIR Grant PDF indexed — 3 flashcards generated"),
        ]
        session.add_all(notifs)
        session.commit()
        print("Demo data seeded!")
