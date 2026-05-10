import os
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from database import get_session
from models import Source

router = APIRouter()

# Environment variables for OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:55394")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

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
async def google_oauth_callback(code: str, error: Optional[str] = None, user_id: int = 1, session: Session = Depends(get_session)):
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
        return RedirectResponse(url=f"{FRONTEND_URL}/?oauth_error={err_msg}")
        
    # We successfully got the tokens!
    # access_token = token_data.get("access_token")
    # refresh_token = token_data.get("refresh_token")
    # (In a full implementation, you would encrypt and store these in the database)
    
    # Update or create the Source record in the database
    statement = select(Source).where(Source.user_id == user_id, Source.source_type == "google")
    source = session.exec(statement).first()
    
    if source:
        source.connection_status = "connected"
    else:
        source = Source(
            user_id=user_id,
            source_type="google",
            name="Google Integration",
            connection_status="connected"
        )
        session.add(source)
        
    session.commit()
    
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
