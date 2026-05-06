import mimetypes
from functools import lru_cache
from typing import Optional

from supabase import create_client, Client

from app.core.config import SUPABASE_SERVICE_KEY, SUPABASE_URL, SUPABASE_VIDEOS_BUCKET

_ORIGINALS = "originals"
_PROCESSED = "processed"


@lru_cache(maxsize=1)
def _client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _content_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "video/mp4"


def upload_original(storage_key: str, file_bytes: bytes, video_db_id: Optional[int] = None) -> str:
    path = f"{_ORIGINALS}/{storage_key}"
    _client().storage.from_(SUPABASE_VIDEOS_BUCKET).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": _content_type(storage_key), "upsert": "true"},
    )
    if video_db_id is not None:
        _persist_storage_url(video_db_id, path)
    return path


def upload_processed(storage_key: str, file_bytes: bytes, job_db_id: Optional[int] = None) -> str:
    path = f"{_PROCESSED}/{storage_key}"
    _client().storage.from_(SUPABASE_VIDEOS_BUCKET).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": _content_type(storage_key), "upsert": "true"},
    )
    if job_db_id is not None:
        _persist_processed_url(job_db_id, path)
    return path


def get_signed_url(path: str, expires_in: int = 3600) -> str:
    res = _client().storage.from_(SUPABASE_VIDEOS_BUCKET).create_signed_url(
        path=path, expires_in=expires_in
    )
    return res["signedURL"]


def get_original_signed_url(storage_key: str, expires_in: int = 3600) -> Optional[str]:
    try:
        return get_signed_url(f"{_ORIGINALS}/{storage_key}", expires_in)
    except Exception:
        return None


def get_processed_signed_url(storage_key: str, expires_in: int = 3600) -> Optional[str]:
    try:
        return get_signed_url(f"{_PROCESSED}/{storage_key}", expires_in)
    except Exception:
        return None


def delete_original(storage_key: str) -> None:
    try:
        _client().storage.from_(SUPABASE_VIDEOS_BUCKET).remove([f"{_ORIGINALS}/{storage_key}"])
    except Exception:
        pass


def delete_processed(storage_key: str) -> None:
    try:
        _client().storage.from_(SUPABASE_VIDEOS_BUCKET).remove([f"{_PROCESSED}/{storage_key}"])
    except Exception:
        pass


def _persist_storage_url(video_db_id: int, path: str) -> None:
    try:
        from app.db.database import SessionLocal
        from app.db.models import Video
        with SessionLocal() as db:
            video = db.get(Video, video_db_id)
            if video:
                video.storage_url = path
                db.commit()
    except Exception:
        pass


def _persist_processed_url(job_db_id: int, path: str) -> None:
    try:
        from app.db.database import SessionLocal
        from app.db.models import ProcessingJob
        with SessionLocal() as db:
            job = db.get(ProcessingJob, job_db_id)
            if job:
                job.processed_storage_url = path
                db.commit()
    except Exception:
        pass