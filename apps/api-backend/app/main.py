from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.auth import router as auth_router
from app.api.jobs import router as jobs_router
from app.api.stream import router as stream_router
from app.api.users import admin_router as admin_users_router
from app.api.users import users_router
from app.api.videos import api_router as videos_api_router
from app.api.videos import public_router as videos_public_router
from app.core.config import ALLOWED_ORIGINS, IS_PRODUCTION
from app.core.limiter import limiter
from app.db.database import Base, engine


app = FastAPI(
    title="Conveyor Product Counter API",
    version="0.1.0",
    # Disable interactive API docs in production
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import logging
    logging.getLogger("uvicorn.error").error(
        "Unhandled exception: %s %s — %r", request.method, request.url.path, exc, exc_info=True
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# CORS — in production read explicit origins from env; dev allows any localhost port
if IS_PRODUCTION and ALLOWED_ORIGINS:
    _origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
    _origin_regex = None
else:
    _origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    _origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(stream_router)
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
    # Idempotent column migrations — PostgreSQL only (SQLite creates columns via create_all)
    from app.core.config import DATABASE_URL as _db_url
    from sqlalchemy import text
    if not _db_url.startswith("sqlite"):
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

