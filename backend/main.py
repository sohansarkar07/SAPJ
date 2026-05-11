"""
Second Brain — Main FastAPI App
"""
from contextlib import asynccontextmanager

import config
from database import create_db_and_tables
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import api_router
from services.sync_worker import start_sync_scheduler, stop_sync_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup db on startup
    create_db_and_tables()
    start_sync_scheduler()
    yield
    stop_sync_scheduler()

app = FastAPI(
    title="Second Brain API",
    description="Backend for the Knowledge Synthesizer SPA",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "Second Brain API is running"}
