from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.auth import router as auth_router
from app.api.jobs import router as jobs_router
from app.api.users import admin_router as admin_users_router
from app.api.users import users_router
from app.api.videos import api_router as videos_api_router
from app.api.videos import public_router as videos_public_router
from app.core.limiter import limiter
from app.db.database import Base, engine


app = FastAPI(title="Conveyor Product Counter API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(users_router)
app.include_router(admin_users_router)
app.include_router(videos_api_router)
app.include_router(videos_public_router)

MEDIA_ROOT = Path(__file__).resolve().parents[3] / "assets"
if MEDIA_ROOT.exists():
    app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    # Idempotent column migration for PostgreSQL (ADD COLUMN IF NOT EXISTS is pg 9.6+)
    from sqlalchemy import text
    new_cols = [
        ("ip_address", "VARCHAR(45)"),
        ("user_agent", "TEXT"),
        ("city", "VARCHAR(128)"),
        ("country", "VARCHAR(64)"),
    ]
    with engine.connect() as conn:
        for col, col_type in new_cols:
            conn.execute(text(f"ALTER TABLE sessions ADD COLUMN IF NOT EXISTS {col} {col_type}"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb"))
        conn.commit()


@app.get("/health")
def health():
    return {"status": "ok"}

