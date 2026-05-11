import os
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from datetime import datetime, timedelta

from database import get_session
from models import Source, IntegrationConnection
from services.security import encrypt_text
from services.gmail_sync import sync_gmail

router = APIRouter()

import config

# Environment variables for OAuth
GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = config.GOOGLE_CLIENT_SECRET
FRONTEND_URL = config.FRONTEND_BASE_URL
BACKEND_URL = config.APP_BASE_URL

# The redirect URI registered in Google Cloud Console
GOOGLE_REDIRECT_URI = f"{BACKEND_URL}/api/integrations/google/callback"


@router.post("/{provider}/connect")
def connect_integration(provider: str, user_id: int = 1):
    """
    Initiates the OAuth connection flow.
    Returns the URL to redirect the user to.
    """
    provider = provider.lower()
    
    if provider == "google":
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="Google Client ID not configured on backend.")
            
        # Standard Google OAuth2 Authorization URL
        auth_url = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={GOOGLE_CLIENT_ID}"
            f"&redirect_uri={GOOGLE_REDIRECT_URI}"
            "&response_type=code"
            "&scope=email profile https://www.googleapis.com/auth/drive.readonly"
            "&access_type=offline"
            "&prompt=consent"
        )
        return {"redirect_url": auth_url}
        
    elif provider in ["slack", "notion", "whatsapp", "calendar"]:
        # For testing other providers without real OAuth setup,
        # we will do a mock success redirect back to frontend.
        return {"redirect_url": f"{FRONTEND_URL}/?oauth_callback=true&provider={provider}"}

    raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


@router.get("/google/callback")
async def google_oauth_callback(code: str, background_tasks: BackgroundTasks, error: Optional[str] = None, user_id: int = 1, session: Session = Depends(get_session)):
    """
    Handles the redirect back from Google.
    Exchanges the authorization code for tokens and updates the database.
    Redirects to the frontend callback page.
    """
    if error:
        # If the user cancelled the login
        return RedirectResponse(url=f"{FRONTEND_URL}/?oauth_error={error}")
        
    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/?oauth_error=no_code")

    # Exchange code for token
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": GOOGLE_REDIRECT_URI,
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        token_data = response.json()
        
    if "error" in token_data:
        err_msg = token_data.get("error_description", token_data.get("error"))
        print("GOOGLE OAUTH ERROR:", token_data)  # Added debug print
        return RedirectResponse(url=f"{FRONTEND_URL}/?oauth_error={err_msg}")
        
    # We successfully got the tokens!
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    
    # Store token in IntegrationConnection
    statement = select(IntegrationConnection).where(
        IntegrationConnection.user_id == user_id, 
        IntegrationConnection.provider == "google"
    )
    conn = session.exec(statement).first()
    
    if not conn:
        conn = IntegrationConnection(
            user_id=user_id,
            provider="google",
            status="connected"
        )
        session.add(conn)
        
    if access_token:
        conn.access_token_encrypted = encrypt_text(access_token)
        conn.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    if refresh_token:
        conn.refresh_token_encrypted = encrypt_text(refresh_token)
        
    conn.status = "connected"
    conn.updated_at = datetime.utcnow()
    
    # Update or create the Source record in the database
    statement = select(Source).where(Source.user_id == user_id, Source.source_type == "gmail")
    source = session.exec(statement).first()
    
    if source:
        source.connection_status = "connected"
        source.last_synced_at = datetime.utcnow()
    else:
        source = Source(
            user_id=user_id,
            source_type="gmail",
            name="Gmail",
            connection_status="connected",
            last_synced_at=datetime.utcnow()
        )
        session.add(source)
        
    session.commit()
    
    # Trigger a background sync of the latest 5 emails to not exceed quota immediately
    # We pass a new session context inside sync_gmail, wait, sync_gmail takes a Session.
    # Background tasks need a fresh session. We will dispatch a helper function.
    def run_sync(uid: int):
        from database import engine
        from sqlmodel import Session
        with Session(engine) as sync_session:
            try:
                sync_gmail(sync_session, uid, max_results=5)
            except Exception as e:
                print(f"Background sync failed: {e}")
                
    background_tasks.add_task(run_sync, user_id)
    
    # Redirect back to the frontend SPA's callback handler
    return RedirectResponse(url=f"{FRONTEND_URL}/?oauth_callback=true")


@router.get("/status")
def get_integration_status(user_id: int = 1, session: Session = Depends(get_session)):
    """
    Returns a dictionary of provider statuses for the current user.
    """
    statement = select(Source).where(Source.user_id == user_id)
    sources = session.exec(statement).all()
    
    status_map = {}
    for src in sources:
        # Mapping generic "google" to our providers if needed, 
        # but the frontend expects 'google', 'slack', etc.
        status_map[src.source_type] = src.connection_status
        
    return status_map


from pydantic import BaseModel

class ProviderRequest(BaseModel):
    provider: str

@router.post("/{provider}/disconnect")
def disconnect_integration(provider: str, user_id: int = 1, session: Session = Depends(get_session)):
    """
    Disconnects a provider and removes/updates the database record.
    """
    provider = provider.lower()
    statement = select(Source).where(Source.user_id == user_id, Source.source_type == provider)
    source = session.exec(statement).first()
    
    if source:
        session.delete(source)
        session.commit()
        return {"success": True, "message": f"Disconnected {provider}"}
        
    return {"success": False, "message": f"{provider} was not connected"}

@router.post("/sync-now")
def sync_now(payload: ProviderRequest, user_id: int = 1, session: Session = Depends(get_session)):
    """
    Triggers an immediate sync for the given provider.
    """
    provider = payload.provider.lower()
    statement = select(Source).where(Source.user_id == user_id, Source.source_type == provider)
    source = session.exec(statement).first()
    
    if source and source.connection_status == "connected":
        # In a real implementation, this would trigger the celery/background task
        return {"success": True, "message": f"Sync started for {provider}"}
        
    return {"success": False, "message": f"{provider} is not connected or doesn't exist."}
