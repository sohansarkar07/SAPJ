from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

import config
from database import get_session
from models import User

try:
    import jwt as pyjwt
    _HAS_JWT = True
except ImportError:
    _HAS_JWT = False


def _extract_supabase_user(request: Request, session: Session):
    """
    Resolve the user from a Supabase JWT Bearer token.
    Returns None if no token present (allows dev fallback).
    Raises 401 if a token IS present but invalid/unrecognised.
    """
    if not _HAS_JWT:
        return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[len("Bearer "):].strip()
    if not token:
        return None

    # Decode without signature verification to extract claims.
    try:
        payload = pyjwt.decode(token, options={"verify_signature": False})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Bearer token")

    # Supabase puts user email in top-level or in user_metadata
    meta = payload.get("user_metadata") or {}
    email: str = (payload.get("email") or meta.get("email") or "").lower().strip()
    name: str = (
        meta.get("full_name")
        or meta.get("name")
        or (email.split("@")[0].replace(".", " ").title() if email else "User")
    )

    if not email:
        raise HTTPException(status_code=401, detail="Token has no email claim")

    # Look up or auto-provision the user
    user = session.exec(select(User).where(User.email == email)).first()
    if user:
        # Update display name if it changed (e.g. user updated Google profile)
        if user.name != name and name:
            user.name = name
            session.add(user)
            session.commit()
            session.refresh(user)
        return user

    # First sign-in via Google OAuth — auto-provision
    user = User(name=name, email=email, role="ngo")
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    # 1. Production path — Supabase JWT Bearer token
    user = _extract_supabase_user(request, session)
    if user:
        return user

    # 2. Dev only — trust X-User-Id header (TRUST_X_USER_ID=true in .env)
    if config.TRUST_X_USER_ID:
        raw = request.headers.get("x-user-id")
        if raw:
            try:
                uid = int(raw)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid X-User-Id header")
            user = session.get(User, uid)
            if user:
                return user
            raise HTTPException(status_code=401, detail="User not found for X-User-Id")

    # 3. Dev fallback — DEFAULT_USER_EMAIL from .env
    if config.DEFAULT_USER_EMAIL:
        user = session.exec(select(User).where(User.email == config.DEFAULT_USER_EMAIL)).first()
        if user:
            return user

    # 4. Last resort — first user in the DB
    user = session.exec(select(User)).first()
    if user:
        return user

    raise HTTPException(
        status_code=503,
        detail="No users in database. Run the app once to seed data or set DEFAULT_USER_EMAIL.",
    )


def get_current_user_id(user: User = Depends(get_current_user)) -> int:
    return user.user_id
