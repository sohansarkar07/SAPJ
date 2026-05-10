from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

import config
from database import get_session
from models import User


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
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

    user = session.exec(select(User).where(User.email == config.DEFAULT_USER_EMAIL)).first()
    if user:
        return user

    user = session.exec(select(User)).first()
    if user:
        return user

    raise HTTPException(
        status_code=503,
        detail="No users in database. Run the app once to seed data or set DEFAULT_USER_EMAIL.",
    )


def get_current_user_id(user: User = Depends(get_current_user)) -> int:
    return user.user_id
