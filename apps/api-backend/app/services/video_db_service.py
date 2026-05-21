from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.db.models import ProcessingJob, ProductCount, Video


# ---------------------------------------------------------------------------
# Video
# ---------------------------------------------------------------------------

def create_video(
    db: Session,
    storage_key: str,
    filename: str,
    size_bytes: Optional[int] = None,
    duration_sec: Optional[float] = None,
    storage_url: Optional[str] = None,
    uploaded_by: Optional[int] = None,
) -> Video:
    video = Video(
        storage_key=storage_key,
        filename=filename,
        size_bytes=size_bytes,
        duration_sec=duration_sec,
        storage_url=storage_url,
        uploaded_by=uploaded_by,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


def get_video_by_storage_key(db: Session, storage_key: str) -> Optional[Video]:
    return db.query(Video).filter(Video.storage_key == storage_key).first()


def list_videos(db: Session) -> List[Video]:
    return db.query(Video).order_by(Video.uploaded_at.desc()).all()


def delete_video_by_storage_key(db: Session, storage_key: str) -> bool:
    video = get_video_by_storage_key(db, storage_key)
    if not video:
        return False
    db.delete(video)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# ProcessingJob
# ---------------------------------------------------------------------------

def create_job(
    db: Session,
    video_id: int,
    model_key: str,
    created_by: Optional[int] = None,
) -> ProcessingJob:
    job = ProcessingJob(video_id=video_id, model_key=model_key, status="queued", created_by=created_by)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def start_job(db: Session, job: ProcessingJob) -> None:
    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    db.commit()


def finish_job(
    db: Session,
    job: ProcessingJob,
    total_count: int,
    processing_time_sec: float,
    processed_storage_key: str,
    processed_storage_url: Optional[str] = None,
) -> None:
    job.status = "done"
    job.total_count = total_count
    job.processing_time_sec = processing_time_sec
    job.processed_storage_key = processed_storage_key
    job.processed_storage_url = processed_storage_url
    job.ended_at = datetime.now(timezone.utc)
    db.commit()


def fail_job(db: Session, job: ProcessingJob, error_message: str) -> None:
    job.status = "failed"
    job.error_message = (error_message or "")[:2048]
    job.ended_at = datetime.now(timezone.utc)
    db.commit()


def get_latest_job(db: Session, video_id: int) -> Optional[ProcessingJob]:
    return (
        db.query(ProcessingJob)
        .filter(ProcessingJob.video_id == video_id)
        .order_by(ProcessingJob.created_at.desc())
        .first()
    )


def get_job_by_id(db: Session, job_id: int) -> Optional[ProcessingJob]:
    return db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()


def get_done_video_ids(db: Session) -> set[int]:
    """Returns set of Video.id that have at least one done job."""
    rows = (
        db.query(ProcessingJob.video_id)
        .filter(ProcessingJob.status == "done")
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def list_jobs(db: Session, video_id: Optional[int] = None) -> List[ProcessingJob]:
    q = db.query(ProcessingJob)
    if video_id is not None:
        q = q.filter(ProcessingJob.video_id == video_id)
    return q.order_by(ProcessingJob.created_at.desc()).all()


# ---------------------------------------------------------------------------
# ProductCount
# ---------------------------------------------------------------------------

def save_product_count(
    db: Session,
    job_id: int,
    video_id: int,
    total_count: int,
    class_breakdown: Optional[dict] = None,
) -> ProductCount:
    existing = db.query(ProductCount).filter(ProductCount.job_id == job_id).first()
    if existing:
        existing.total_count = total_count
        existing.class_breakdown = class_breakdown
        db.commit()
        db.refresh(existing)
        return existing
    record = ProductCount(
        job_id=job_id,
        video_id=video_id,
        total_count=total_count,
        class_breakdown=class_breakdown,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_product_count_by_video(db: Session, video_id: int) -> Optional[ProductCount]:
    """Return the most recent product count for a video (latest done job)."""
    return (
        db.query(ProductCount)
        .filter(ProductCount.video_id == video_id)
        .join(ProcessingJob, ProductCount.job_id == ProcessingJob.id)
        .filter(ProcessingJob.status == "done")
        .order_by(ProcessingJob.ended_at.desc())
        .first()
    )


def list_product_counts(db: Session, limit: int = 100) -> List[ProductCount]:
    return (
        db.query(ProductCount)
        .join(ProcessingJob, ProductCount.job_id == ProcessingJob.id)
        .filter(ProcessingJob.status == "done")
        .order_by(ProductCount.counted_at.desc())
        .limit(limit)
        .all()
    )
