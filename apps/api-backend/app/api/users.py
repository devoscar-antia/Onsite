from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.database import get_db
from app.db.models import AuditLog
from app.db.models import Session as UserSession
from app.db.models import User

users_router = APIRouter(tags=["users"])
admin_router = APIRouter(prefix="/admin", tags=["admin-users"])


def _audit(db: Session, actor_id: int, action: str, target_user_id: int, details: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, target_user_id=target_user_id, details=details))
    db.commit()

PREFS_DEFAULTS = {
    "theme": "dark",
    "language": "es",
    "density": "normal",
    "dateFormat": "DD/MM/YYYY",
    "timezone": "America/Bogota",
    "notifications": {
        "video_uploaded": True,
        "video_processed": True,
    },
}


def _to_iso(value: Optional[datetime]) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _name_from_email(email: str) -> tuple[str, str]:
    local = email.split("@")[0]
    chunks = [x for x in local.replace(".", " ").replace("_", " ").split(" ") if x]
    first = (chunks[0] if chunks else "Usuario").capitalize()
    last = (chunks[1] if len(chunks) > 1 else "").capitalize()
    return first, last


def _ensure_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para esta acción.")


def _prefs(user: User) -> dict:
    return dict(user.preferences or {})


def _merge_prefs(db: Session, user: User, patch: dict) -> dict:
    merged = {**_prefs(user), **patch}
    user.preferences = merged
    db.commit()
    return merged


class UserMeResponse(BaseModel):
    id: int
    name: str
    lastName: str
    email: EmailStr
    role: str
    company: str
    createdAt: str


class UpdateMeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    lastName: str = Field(default="", max_length=80)
    email: EmailStr


class PasswordUpdateRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)
    confirmPassword: str = Field(min_length=8, max_length=128)


class SessionResponse(BaseModel):
    id: int
    type: str
    device: str
    location: str
    ip: str
    city: str
    country: str
    lastSeen: str
    isCurrent: bool


class PreferencesRequest(BaseModel):
    theme: str = "dark"
    density: str = "normal"
    language: str = "es"
    dateFormat: str = "DD/MM/YYYY"
    timezone: str = "America/Bogota"
    notifications: dict = {}


class AdminRolePatchRequest(BaseModel):
    role: str


@users_router.get("/users/me/preferences")
def get_preferences(current_user: User = Depends(get_current_user)):
    return {**PREFS_DEFAULTS, **_prefs(current_user)}


@users_router.get("/users/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    first, last = _name_from_email(current_user.email)
    p = _prefs(current_user)
    return UserMeResponse(
        id=current_user.id,
        name=p.get("name", first),
        lastName=p.get("lastName", last),
        email=current_user.email,
        role=current_user.role,
        company=p.get("company", "Onsite"),
        createdAt=_to_iso(current_user.created_at),
    )


@users_router.put("/users/me", response_model=UserMeResponse)
def update_me(payload: UpdateMeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email_owner = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
    if email_owner:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este correo ya está en uso por otro usuario.")

    current_user.email = payload.email
    _merge_prefs(db, current_user, {"name": payload.name, "lastName": payload.lastName})
    db.refresh(current_user)
    return get_me(current_user)


@users_router.put("/users/me/password")
def change_password(payload: PasswordUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.newPassword != payload.confirmPassword:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La confirmación no coincide con la nueva contraseña.")
    if not verify_password(payload.currentPassword, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta.")

    current_user.password_hash = hash_password(payload.newPassword)
    db.commit()
    return {"status": "ok"}


@users_router.get("/users/me/sessions", response_model=List[SessionResponse])
def get_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id)
        .order_by(UserSession.created_at.desc())
        .all()
    )
    rows: List[SessionResponse] = []
    for index, session in enumerate(sessions):
        ua = session.user_agent or "Unknown"
        ip = session.ip_address or "—"
        city = session.city or "—"
        country = session.country or "—"
        is_mobile = any(k in ua.lower() for k in ("android", "ios", "iphone", "ipad", "mobile"))
        location = f"{city}, {country}" if city != "—" else country
        rows.append(
            SessionResponse(
                id=session.id,
                type="mobile" if is_mobile else "desktop",
                device=ua,
                location=location,
                ip=ip,
                city=city,
                country=country,
                lastSeen=_to_iso(session.created_at),
                isCurrent=index == 0,
            )
        )
    return rows


@users_router.delete("/users/me/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    db.delete(session)
    db.commit()
    return {"status": "deleted", "id": session_id}


@users_router.delete("/users/me")
def delete_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(current_user)
    db.commit()
    return {"status": "deleted"}


@users_router.put("/users/me/preferences")
def save_preferences(payload: PreferencesRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    payload_data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    merged = _merge_prefs(db, current_user, payload_data)
    return {"status": "ok", "preferences": merged}


@admin_router.get("/users")
def admin_list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    all_users = db.query(User).order_by(User.created_at.desc()).all()
    active_cutoff = datetime.now(timezone.utc) - timedelta(days=1)
    rows = []
    for user in all_users:
        first, last = _name_from_email(user.email)
        p = _prefs(user)
        latest_session = (
            db.query(UserSession)
            .filter(UserSession.user_id == user.id)
            .order_by(UserSession.created_at.desc())
            .first()
        )
        last_seen_dt = latest_session.created_at if latest_session else user.created_at
        status_name = "active" if last_seen_dt and last_seen_dt >= active_cutoff else "inactive"
        rows.append(
            {
                "id": user.id,
                "name": f"{p.get('name', first)} {p.get('lastName', last)}".strip(),
                "email": user.email,
                "role": user.role,
                "status": status_name,
                "lastSeen": _to_iso(last_seen_dt),
                "initials": f"{(p.get('name', first)[:1] or 'U').upper()}{(p.get('lastName', last)[:1] or '').upper()}",
            }
        )
    return rows


@admin_router.get("/users/stats")
def admin_users_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    total = db.query(User).count()
    admins = db.query(User).filter(User.role == "admin").count()
    active_cutoff = datetime.now(timezone.utc) - timedelta(days=1)
    active = (
        db.query(UserSession.user_id)
        .filter(UserSession.created_at >= active_cutoff)
        .distinct()
        .count()
    )
    pending = max(total - active, 0)
    return {"total": total, "admins": admins, "active": active, "pending": pending}


@admin_router.patch("/users/{user_id}/role")
def admin_update_user_role(
    user_id: int,
    payload: AdminRolePatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_admin(current_user)
    allowed_roles = {"admin", "analyst", "supervisor", "engineer", "viewer"}
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rol no válido.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    old_role = user.role
    user.role = payload.role
    db.commit()
    _audit(db, current_user.id, "user.role_changed", user_id, {"old_role": old_role, "new_role": payload.role})
    return {"status": "ok", "id": user_id, "role": payload.role}


@admin_router.delete("/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes revocar tu propio acceso aquí.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    _audit(db, current_user.id, "user.deleted", user_id, {"email": user.email, "role": user.role})
    db.delete(user)
    db.commit()
    return {"status": "deleted", "id": user_id}


class AdminSetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


@admin_router.patch("/users/{user_id}/password")
def admin_set_password(
    user_id: int,
    payload: AdminSetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    _audit(db, current_user.id, "user.password_reset", user_id, {})
    return {"status": "ok", "id": user_id}


@admin_router.delete("/users/{user_id}/sessions")
def admin_invalidate_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    deleted = db.query(UserSession).filter(UserSession.user_id == user_id).delete()
    db.commit()
    _audit(db, current_user.id, "user.sessions_invalidated", user_id, {"sessions_deleted": deleted})
    return {"status": "ok", "id": user_id, "sessions_deleted": deleted}
