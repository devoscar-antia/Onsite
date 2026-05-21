import json
import urllib.request
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.db.models import Session as UserSession
from app.db.models import User
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, TokenResponse, UserResponse


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "—"


def _parse_device(ua: str) -> tuple[str, str]:
    u = ua.lower()
    is_mobile = any(k in u for k in ("mobile", "android", "iphone", "ipad"))
    device_type = "mobile" if is_mobile else "desktop"
    browser = (
        "Edge" if "edg" in u else
        "Firefox" if "firefox" in u else
        "Safari" if "safari" in u and "chrome" not in u else
        "Chrome" if "chrome" in u else
        "Browser"
    )
    os_name = (
        "Android" if "android" in u else
        "iOS" if any(k in u for k in ("iphone", "ipad")) else
        "Windows" if "windows" in u else
        "macOS" if "mac os" in u else
        "Linux" if "linux" in u else
        "Unknown"
    )
    return device_type, f"{os_name} · {browser}"


def _geolocate(ip: str) -> tuple[str, str]:
    _private = ("127.", "::1", "192.168.", "10.", "172.16.", "172.17.",
                 "172.18.", "172.19.", "172.20.", "172.21.", "172.22.",
                 "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
                 "172.28.", "172.29.", "172.30.", "172.31.")
    if any(ip.startswith(p) for p in _private) or ip == "::1":
        return "Local", "—"
    try:
        url = f"https://ip-api.com/json/{ip}?fields=status,city,country"
        with urllib.request.urlopen(url, timeout=2) as resp:
            data = json.loads(resp.read())
            if data.get("status") == "success":
                return data.get("city", "—"), data.get("country", "—")
    except Exception as e:
        import logging
        logging.getLogger(__name__).debug("Geolocate failed for %s: %r", ip, e)
    return "—", "—"


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role="viewer")
    db.add(user)
    db.flush()
    prefs: dict = {}
    if payload.name:
        prefs["name"] = payload.name
    if payload.lastName:
        prefs["lastName"] = payload.lastName
    if payload.company:
        prefs["company"] = payload.company
    if prefs:
        user.preferences = prefs
    db.commit()
    db.refresh(user)
    return UserResponse(id=user.id, email=user.email, role=user.role)


def _update_session_geo(session_id: int, ip: str) -> None:
    """Run geolocate after response is sent — avoids blocking login."""
    from app.db.database import SessionLocal
    city, country = _geolocate(ip)
    with SessionLocal() as db:
        s = db.get(UserSession, session_id)
        if s:
            s.city = city
            s.country = country
            db.commit()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(str(user.id), role=user.role, email=user.email)
    refresh_token, expires_at = create_refresh_token(str(user.id))
    refresh_hash = hash_password(refresh_token)

    ip = _get_client_ip(request)
    ua_str = request.headers.get("User-Agent", "")
    _, device_label = _parse_device(ua_str)

    session = UserSession(
        user_id=user.id,
        refresh_token_hash=refresh_hash,
        expires_at=expires_at,
        ip_address=ip,
        user_agent=device_label,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    background_tasks.add_task(_update_session_geo, session.id, ip)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
    token_payload = decode_token(payload.refresh_token)
    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = int(token_payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    sessions = db.query(UserSession).filter(UserSession.user_id == user.id).all()
    valid_session = None
    for session in sessions:
        if verify_password(payload.refresh_token, session.refresh_token_hash):
            valid_session = session
            break
    if not valid_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

    if valid_session.expires_at and valid_session.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    access_token = create_access_token(str(user.id), role=user.role, email=user.email)
    new_refresh_token, expires_at = create_refresh_token(str(user.id))
    valid_session.refresh_token_hash = hash_password(new_refresh_token)
    valid_session.expires_at = expires_at
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, role=current_user.role)


@router.post("/logout", status_code=204)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    try:
        token_payload = decode_token(payload.refresh_token)
        user_id = int(token_payload.get("sub", 0))
    except Exception:
        return
    sessions = db.query(UserSession).filter(UserSession.user_id == user_id).all()
    for session in sessions:
        if verify_password(payload.refresh_token, session.refresh_token_hash):
            db.delete(session)
            db.commit()
            break

