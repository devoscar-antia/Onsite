import os
import sys
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mvp.db")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_me_super_secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_VIDEOS_BUCKET = os.getenv("SUPABASE_VIDEOS_BUCKET", "videos")

# Allowed frontend origins (comma-separated). Required in production.
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")

# Fail-fast: block startup if critical secrets are missing or insecure in production
if IS_PRODUCTION:
    if JWT_SECRET_KEY == "change_me_super_secret":
        sys.exit("FATAL: JWT_SECRET_KEY must be set to a strong secret in production")
    if DATABASE_URL.startswith("sqlite"):
        sys.exit("FATAL: SQLite is not supported in production. Set DATABASE_URL to a PostgreSQL URL")
    if not ALLOWED_ORIGINS:
        sys.exit("FATAL: ALLOWED_ORIGINS must be set in production (e.g. https://app.example.com)")
