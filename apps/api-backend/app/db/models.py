from sqlalchemy import JSON, BigInteger, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(32), nullable=False, default="viewer")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    preferences = Column(JSON, nullable=True, default=dict)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="uploaded_by_user", cascade="all, delete-orphan")
    jobs = relationship("ProcessingJob", back_populates="created_by_user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token_hash = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    city = Column(String(128), nullable=True)
    country = Column(String(64), nullable=True)

    user = relationship("User", back_populates="sessions")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # filename shown to the user (original upload name)
    filename = Column(String(512), nullable=False)
    # internal storage key (UUID-based name on disk or in Supabase Storage)
    storage_key = Column(String(512), nullable=False, unique=True)
    # public/signed URL — null until uploaded to remote storage
    storage_url = Column(Text, nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    duration_sec = Column(Float, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    uploaded_by_user = relationship("User", back_populates="videos")
    jobs = relationship("ProcessingJob", foreign_keys="ProcessingJob.video_id", back_populates="video", cascade="all, delete-orphan")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    # storage_key of the output video once done
    processed_storage_key = Column(String(512), nullable=True)
    processed_storage_url = Column(Text, nullable=True)
    model_key = Column(String(128), nullable=False, default="conveyor-products")
    # queued | running | done | failed
    status = Column(String(32), nullable=False, default="queued")
    total_count = Column(Integer, nullable=True)
    processing_time_sec = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    video = relationship("Video", foreign_keys=[video_id], back_populates="jobs")
    created_by_user = relationship("User", back_populates="jobs")
