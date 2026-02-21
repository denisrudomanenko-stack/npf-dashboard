from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import os
from pathlib import Path

from app.database import init_db, async_session
from app.api.v1.endpoints import enterprises, roadmap, documents, rag, conversations, dashboard, table_config, sales_data, dashboard_config, auth, users
from app.models import Conversation, ChatMessage, LLMConfig, User  # Ensure models are registered
from sqlalchemy import select

load_dotenv()

# Determine static files path
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR.parent / "frontend" / "dist"


async def load_llm_config():
    """Load LLM configuration from database on startup."""
    from app.services.ollama_service import ollama_service

    async with async_session() as db:
        result = await db.execute(select(LLMConfig).where(LLMConfig.is_active == True))
        configs = result.scalars().all()

        for config in configs:
            if config.function == "chat" and config.provider == "ollama":
                ollama_service.model = config.model
                print(f"[LLM Config] Chat model loaded: {config.model}")
            elif config.function == "embeddings" and config.provider == "ollama":
                ollama_service.embed_model = config.model
                print(f"[LLM Config] Embeddings model loaded: {config.model}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await load_llm_config()
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
    allow_origins=["http://localhost:3000", "http://localhost:3004", "http://localhost:5173", "http://localhost:3100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(enterprises.router, prefix="/api/v1/enterprises", tags=["Enterprises"])
app.include_router(roadmap.router, prefix="/api/v1/roadmap", tags=["Roadmap"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])
app.include_router(rag.router, prefix="/api/v1/rag", tags=["RAG"])
app.include_router(conversations.router, prefix="/api/v1/conversations", tags=["Conversations"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(table_config.router, prefix="/api/v1/table-config", tags=["Table Config"])
app.include_router(sales_data.router, prefix="/api/v1/sales-data", tags=["Sales Data"])
app.include_router(dashboard_config.router, prefix="/api/v1/dashboard-config", tags=["Dashboard Config"])


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/v1/health")
async def api_health():
    return {"status": "healthy", "api": "NPF Development API", "version": "0.1.0"}


# Serve static files (production mode)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/")
    async def serve_index():
        """Serve SPA index"""
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve SPA for all non-API routes"""
        # Don't serve SPA for API routes - let them return 404
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/")
    async def root():
        return {"message": "NPF Development API", "version": "0.1.0", "note": "Frontend not built"}
