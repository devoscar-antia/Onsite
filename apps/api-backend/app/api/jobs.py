from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.schemas.job import JobResponse
from app.services import video_db_service as vdb

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


def _to_response(job, db: Session) -> dict:
    video = job.video
    return {
        "id": job.id,
        "video_id": job.video_id,
        "video_filename": video.filename if video else None,
        "video_storage_key": video.storage_key if video else None,
        "model_key": job.model_key,
        "status": job.status,
        "total_count": job.total_count,
        "processing_time_sec": job.processing_time_sec,
        "processed_storage_key": job.processed_storage_key,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
    }


@router.get("", response_model=List[JobResponse])
def list_jobs(
    video_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    jobs = vdb.list_jobs(db, video_id=video_id)
    return [_to_response(j, db) for j in jobs]


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    job = vdb.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return _to_response(job, db)
