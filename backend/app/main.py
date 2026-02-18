from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os

from app.database import init_db
from app.api.v1.endpoints import enterprises, roadmap, documents, rag

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown


app = FastAPI(
    title="NPF Development API",
    description="API для управления развитием корпоративного блока НПФ",
    version="0.1.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(enterprises.router, prefix="/api/v1/enterprises", tags=["Enterprises"])
app.include_router(roadmap.router, prefix="/api/v1/roadmap", tags=["Roadmap"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(rag.router, prefix="/api/v1/rag", tags=["RAG"])


@app.get("/")
async def root():
    return {"message": "NPF Development API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
