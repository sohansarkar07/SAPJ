"""
Second Brain — Main FastAPI App
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables
from routes import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup db on startup
    create_db_and_tables()
    yield

app = FastAPI(
    title="Second Brain API",
    description="Backend for the Knowledge Synthesizer SPA",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "Second Brain API is running"}
