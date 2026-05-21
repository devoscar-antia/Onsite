import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.database import get_db
from app.db.models import User
from app.schemas.video import ProcessRequest
from app.services import analytics_service as analytics
from app.services import storage_service as storage
from app.services import video_db_service as vdb
from app.services import video_service as vs

api_router = APIRouter(prefix="/api/v1/videos", tags=["videos"])
public_router = APIRouter(prefix="/videos", tags=["videos-public"])

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB

# Video magic-byte signatures: (offset, bytes)
_VIDEO_SIGNATURES = [
    (0,  b"\x00\x00\x00\x18ftyp"),   # MP4 ftyp (18-byte box)
    (0,  b"\x00\x00\x00\x1cftyp"),   # MP4 ftyp (28-byte box)
    (0,  b"\x00\x00\x00\x20ftyp"),   # MP4 ftyp (32-byte box)
    (4,  b"ftyp"),                    # MP4/MOV generic ftyp at offset 4
    (0,  b"RIFF"),                    # AVI
    (0,  b"\x1a\x45\xdf\xa3"),       # MKV/WebM (EBML)
    (0,  b"\x00\x00\x00\x14ftyp"),   # MP4 ftyp (20-byte box)
]


def _is_valid_video(data: bytes) -> bool:
    for offset, sig in _VIDEO_SIGNATURES:
        end = offset + len(sig)
        if len(data) >= end and data[offset:end] == sig:
            return True
    return False


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@api_router.post("/upload")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".mp4", ".mov", ".avi", ".mkv"}:
        raise HTTPException(status_code=400, detail="Unsupported video format")

    safe_name = f"{uuid.uuid4().hex}{suffix}"
    target_path = vs.ORIGINAL_VIDEOS_DIR / safe_name
    content = await file.read()

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 2 GB limit")
    if len(content) < 16 or not _is_valid_video(content):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid video")

    # Save to local disk (used by the processing pipeline)
    target_path.write_bytes(content)
    vs.original_name_sidecar(safe_name).write_text(file.filename, encoding="utf-8")
    names_index = vs.load_original_names_index()
    names_index[safe_name] = file.filename
    vs.save_original_names_index(names_index)

    # Register in DB
    meta = vs.extract_metadata(target_path)
    video_record = vdb.create_video(
        db,
        storage_key=safe_name,
        filename=file.filename,
        size_bytes=meta.get("size"),
        duration_sec=meta.get("duration") or None,
        uploaded_by=current_user.id,
    )

    # Upload to Supabase Storage in the background (non-blocking); persist storage_url on success
    background_tasks.add_task(storage.upload_original, safe_name, content, video_record.id)

    return {"filename": safe_name, "original_name": file.filename, "video_url": f"/media/videos/uploaded/{safe_name}"}


@api_router.post("/process")
def process_video(
    payload: ProcessRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    source_path = vs.get_video_path(payload.video_filename)
    existing = vs.get_processed_path(payload.video_filename)

    # Fast path: already processed and browser-compatible
    if existing and vs.is_browser_compatible(existing):
        video_record = vdb.get_video_by_storage_key(db, payload.video_filename)
        if video_record:
            existing_job = vdb.get_latest_job(db, video_record.id)
            if existing_job and existing_job.status == "done" and existing_job.total_count:
                return {
                    "processed_filename": existing.name,
                    "processed_video_url": f"/media/processed_videos/{existing.name}",
                    "summary": {"model": "conveyor-products", "total_count": existing_job.total_count, "status": "ready_cached"},
                }
        # No valid job with real count → re-run pipeline to get accurate count
        return _run_with_job_tracking(db, background_tasks, source_path, payload.video_filename, current_user.id)

    if existing and not vs.is_browser_compatible(existing):
        return _run_with_job_tracking(db, background_tasks, source_path, payload.video_filename, current_user.id)

    if not vs.PROCESS_SCRIPT.exists() or not vs.MODEL_PATH.exists():
        fallback = vs.get_processed_path(payload.video_filename)
        if fallback:
            return {
                "processed_filename": fallback.name,
                "processed_video_url": f"/media/processed_videos/{fallback.name}",
                "summary": {"model": "conveyor-products", "total_count": 0, "status": "ready_fallback"},
            }
        raise HTTPException(status_code=500, detail="Model or process script not found in project")

    try:
        return _run_with_job_tracking(db, background_tasks, source_path, payload.video_filename, current_user.id)
    except HTTPException:
        fallback = vs.get_processed_path(payload.video_filename)
        if fallback:
            return {
                "processed_filename": fallback.name,
                "processed_video_url": f"/media/processed_videos/{fallback.name}",
                "summary": {"model": "conveyor-products", "total_count": 0, "status": "ready_fallback"},
            }
        raise


def _class_breakdown_from_detections(detections: list[dict]) -> dict[str, int]:
    """Count unique track_ids per class. Falls back to detection count when track_id absent."""
    by_class: dict[str, set] = {}
    has_tracks = any(d.get("track_id") is not None and d.get("track_id", -1) >= 0 for d in detections)
    for d in detections:
        cls = d.get("class", "unknown")
        by_class.setdefault(cls, set())
        if has_tracks:
            tid = d.get("track_id")
            if tid is not None and tid >= 0:
                by_class[cls].add(tid)
        else:
            by_class[cls].add(id(d))
    return {cls: len(ids) for cls, ids in by_class.items()}


def _run_with_job_tracking(
    db: Session,
    background_tasks: BackgroundTasks,
    source_path: Path,
    video_filename: str,
    created_by_id: int,
) -> dict:
    video_record = vdb.get_video_by_storage_key(db, video_filename)
    job = vdb.create_job(db, video_record.id, "conveyor-products", created_by=created_by_id) if video_record else None

    if job:
        vdb.start_job(db, job)

    t_start = time.monotonic()
    try:
        result = vs.run_processing(source_path, video_filename)
    except HTTPException as exc:
        if job:
            vdb.fail_job(db, job, exc.detail)
        raise

    elapsed = time.monotonic() - t_start
    processed_filename = result["processed_filename"]
    total_count = result["summary"]["total_count"]

    if job:
        vdb.finish_job(
            db, job,
            total_count=total_count,
            processing_time_sec=round(elapsed, 2),
            processed_storage_key=processed_filename,
        )
        # Persist product count with per-class breakdown from detections cache
        try:
            detections = vs.build_detections(video_filename, source_path)
            class_breakdown = _class_breakdown_from_detections(detections)
        except Exception:
            class_breakdown = None
        vdb.save_product_count(db, job.id, job.video_id, total_count, class_breakdown)

    # Upload processed video to Storage in the background; persist processed_storage_url on success
    processed_path = vs.PROCESSED_VIDEOS_DIR / processed_filename
    if processed_path.exists():
        processed_bytes = processed_path.read_bytes()
        background_tasks.add_task(storage.upload_processed, processed_filename, processed_bytes, job.id if job else None)

    return result


def _sync_cached_job(db: Session, video_filename: str, processed_path: Path, created_by_id: int) -> None:
    """Create a 'done' job record for a video that was already processed (filesystem cache)."""
    video_record = vdb.get_video_by_storage_key(db, video_filename)
    if not video_record:
        return
    existing_job = vdb.get_latest_job(db, video_record.id)
    if existing_job:
        return
    job = vdb.create_job(db, video_record.id, "conveyor-products", created_by=created_by_id)
    vdb.start_job(db, job)
    vdb.finish_job(db, job, total_count=0, processing_time_sec=0.0, processed_storage_key=processed_path.name)


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@public_router.get("")
def get_videos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # DB is source of truth; auto-migrate filesystem-only videos on first read
    db_keys = {v.storage_key for v in vdb.list_videos(db)}
    deleted_index = vs.load_deleted_index()
    names_index = vs.load_original_names_index()

    # Auto-migrate old filesystem videos that aren't in DB yet
    for video_path in vs.ORIGINAL_VIDEOS_DIR.glob("*"):
        if not video_path.is_file() or video_path.name.endswith(".name.txt"):
            continue
        if video_path.name in deleted_index or video_path.name in db_keys:
            continue
        meta = vs.extract_metadata(video_path)
        sidecar = vs.original_name_sidecar(video_path.name)
        display_name = names_index.get(video_path.name) or (sidecar.read_text(encoding="utf-8").strip() if sidecar.exists() else video_path.name)
        vdb.create_video(db, storage_key=video_path.name, filename=display_name, size_bytes=meta.get("size"), duration_sec=meta.get("duration") or None)

    done_ids = vdb.get_done_video_ids(db)
    videos = []
    for v in vdb.list_videos(db):
        if v.storage_key in deleted_index:
            continue
        local_path = vs.ORIGINAL_VIDEOS_DIR / v.storage_key
        meta = vs.extract_metadata(local_path) if local_path.exists() else {}
        videos.append({
            "id": v.storage_key,
            "filename": v.filename,
            "original_filename": v.filename,
            "uploaded_at": v.uploaded_at.isoformat() if v.uploaded_at else datetime.fromtimestamp(local_path.stat().st_mtime).isoformat() if local_path.exists() else "",
            "duration": meta.get("duration", v.duration_sec or 0),
            "size": meta.get("size", v.size_bytes or 0),
            "has_processed": v.id in done_ids,
            "thumbnail_url": None,
        })

    return JSONResponse(content=videos, headers=NO_STORE_HEADERS)


@public_router.get("/{video_id}/thumbnail")
def get_video_thumbnail(video_id: str, current_user: User = Depends(get_current_user)):
    thumb = vs.generate_thumbnail(video_id)
    if thumb is None:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(str(thumb), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@public_router.get("/{video_id}/metadata")
def get_video_metadata(video_id: str, current_user: User = Depends(get_current_user)):
    path = vs.get_video_path(video_id)
    return JSONResponse(content=vs.extract_metadata(path), headers=NO_STORE_HEADERS)


@public_router.get("/{video_id}/stream")
def stream_video(video_id: str, request: Request, current_user: User = Depends(get_current_user)):
    try:
        path = vs.get_video_path(video_id)
        return vs.stream_file(path, request.headers.get("range"))
    except HTTPException:
        url = storage.get_original_signed_url(video_id)
        if url:
            return RedirectResponse(url)
        raise


@public_router.get("/{video_id}/download")
def download_video(video_id: str, current_user: User = Depends(get_current_user)):
    try:
        path = vs.get_video_path(video_id)
        return FileResponse(path, media_type="application/octet-stream", filename=path.name)
    except HTTPException:
        url = storage.get_original_signed_url(video_id)
        if url:
            return RedirectResponse(url)
        raise


@public_router.delete("/{video_id}")
def delete_video(video_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    deleted_index = vs.load_deleted_index()
    if video_id in deleted_index:
        return {"status": "deleted", "video_id": video_id}

    path = vs.get_video_path(video_id)
    mapped_processed = vs.get_processed_path(video_id)
    last_error = None

    for _ in range(5):
        try:
            path.unlink(missing_ok=False)
            last_error = None
            break
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Video no encontrado")
        except PermissionError as exc:
            last_error = exc
            time.sleep(0.12)
        except OSError as exc:
            last_error = exc
            break

    if last_error is not None and not isinstance(last_error, PermissionError):
        raise HTTPException(status_code=500, detail=f"No se pudo eliminar el video: {last_error}")

    cache = vs.detections_cache_path(video_id)
    if cache.exists():
        try:
            cache.unlink(missing_ok=True)
        except OSError:
            pass

    if mapped_processed and mapped_processed.exists():
        try:
            mapped_processed.unlink(missing_ok=True)
        except OSError:
            pass

    proc_index = vs.load_processed_index()
    proc_index.pop(video_id, None)
    vs.save_processed_index(proc_index)

    names_index = vs.load_original_names_index()
    names_index.pop(video_id, None)
    vs.save_original_names_index(names_index)

    sidecar = vs.original_name_sidecar(video_id)
    if sidecar.exists():
        try:
            sidecar.unlink(missing_ok=True)
        except OSError:
            pass

    # Remove from DB and Supabase Storage
    vdb.delete_video_by_storage_key(db, video_id)
    storage.delete_original(video_id)
    if mapped_processed:
        storage.delete_processed(mapped_processed.name)

    if isinstance(last_error, PermissionError):
        from datetime import datetime as _dt
        deleted_index[video_id] = {"deleted_at": _dt.now().isoformat()}
        vs.save_deleted_index(deleted_index)
        return {"status": "deleted_soft", "video_id": video_id}

    deleted_index.pop(video_id, None)
    vs.save_deleted_index(deleted_index)
    return {"status": "deleted", "video_id": video_id}


@public_router.get("/{video_id}/processed")
def get_processed_video(video_id: str, current_user: User = Depends(get_current_user)):
    vs.get_video_path(video_id)
    processed = vs.get_processed_path(video_id)
    if not processed:
        raise HTTPException(status_code=404, detail="Este video aún no ha sido procesado")
    if not vs.is_browser_compatible(processed):
        regenerated = vs.run_processing(vs.get_video_path(video_id), video_id)
        return JSONResponse(
            content={"status": "ready", "processed_filename": regenerated["processed_filename"], "processed_video_url": f"/videos/{video_id}/processed/stream"},
            headers=NO_STORE_HEADERS,
        )
    return JSONResponse(
        content={"status": "ready", "processed_filename": processed.name, "processed_video_url": f"/videos/{video_id}/processed/stream"},
        headers=NO_STORE_HEADERS,
    )


@public_router.get("/{video_id}/processed/metadata")
def get_processed_video_metadata(video_id: str, current_user: User = Depends(get_current_user)):
    vs.get_video_path(video_id)
    processed = vs.get_processed_path(video_id)
    if not processed:
        raise HTTPException(status_code=404, detail="Este video aún no ha sido procesado")
    return JSONResponse(content=vs.extract_metadata(processed), headers=NO_STORE_HEADERS)


@public_router.get("/{video_id}/processed/stream")
def stream_processed_video(video_id: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    processed = vs.get_processed_path(video_id)
    if processed:
        return vs.stream_file(processed, request.headers.get("range"))
    # Fallback: get processed_storage_key from DB job
    video_record = vdb.get_video_by_storage_key(db, video_id)
    if video_record:
        job = vdb.get_latest_job(db, video_record.id)
        if job and job.processed_storage_key:
            url = storage.get_processed_signed_url(job.processed_storage_key)
            if url:
                return RedirectResponse(url)
    raise HTTPException(status_code=404, detail="Este video aún no ha sido procesado")


@public_router.get("/{video_id}/processed/download")
def download_processed_video(video_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    processed = vs.get_processed_path(video_id)
    if processed:
        return FileResponse(processed, media_type="application/octet-stream", filename=processed.name)
    video_record = vdb.get_video_by_storage_key(db, video_id)
    if video_record:
        job = vdb.get_latest_job(db, video_record.id)
        if job and job.processed_storage_key:
            url = storage.get_processed_signed_url(job.processed_storage_key)
            if url:
                return RedirectResponse(url)
    raise HTTPException(status_code=404, detail="Este video aún no ha sido procesado")


# ---------------------------------------------------------------------------
# Jobs por video (polling de estado desde el frontend)
# ---------------------------------------------------------------------------

@public_router.get("/{video_id}/jobs")
def get_video_jobs(video_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    video_record = vdb.get_video_by_storage_key(db, video_id)
    if not video_record:
        return JSONResponse(content=[], headers=NO_STORE_HEADERS)
    jobs = vdb.list_jobs(db, video_id=video_record.id)
    result = [
        {
            "id": j.id,
            "status": j.status,
            "model_key": j.model_key,
            "total_count": j.total_count,
            "processing_time_sec": j.processing_time_sec,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "ended_at": j.ended_at.isoformat() if j.ended_at else None,
        }
        for j in jobs
    ]
    return JSONResponse(content=result, headers=NO_STORE_HEADERS)


# ---------------------------------------------------------------------------
# Detections & Analytics
# ---------------------------------------------------------------------------

@public_router.get("/{video_id}/detections")
def get_detections(video_id: str, current_user: User = Depends(get_current_user)):
    path = vs.get_video_path(video_id)
    return vs.build_detections(video_id, path)


@public_router.get("/{video_id}/analytics/summary")
def get_summary(video_id: str, current_user: User = Depends(get_current_user)):
    detections = vs.build_detections(video_id, vs.get_video_path(video_id))
    return analytics.compute_summary(detections)


@public_router.get("/{video_id}/analytics/by-frame")
def get_detections_by_frame(video_id: str, current_user: User = Depends(get_current_user)):
    detections = vs.build_detections(video_id, vs.get_video_path(video_id))
    return analytics.compute_by_frame(detections)


@public_router.get("/{video_id}/analytics/class-distribution")
def get_class_distribution(video_id: str, current_user: User = Depends(get_current_user)):
    detections = vs.build_detections(video_id, vs.get_video_path(video_id))
    return analytics.compute_class_distribution(detections)


@public_router.get("/{video_id}/analytics/confidence-timeline")
def get_confidence_timeline(video_id: str, current_user: User = Depends(get_current_user)):
    detections = vs.build_detections(video_id, vs.get_video_path(video_id))
    return analytics.compute_confidence_timeline(detections)


@public_router.get("/{video_id}/analytics/heatmap")
def get_heatmap_data(video_id: str, current_user: User = Depends(get_current_user)):
    detections = vs.build_detections(video_id, vs.get_video_path(video_id))
    return analytics.compute_heatmap(detections)


# ---------------------------------------------------------------------------
# Product counts
# ---------------------------------------------------------------------------

@public_router.get("/{video_id}/product-count")
def get_product_count(video_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    video_record = vdb.get_video_by_storage_key(db, video_id)
    if not video_record:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    record = vdb.get_product_count_by_video(db, video_record.id)
    if not record:
        raise HTTPException(status_code=404, detail="No hay conteo disponible para este video")
    return JSONResponse(content={
        "video_id": video_id,
        "job_id": record.job_id,
        "total_count": record.total_count,
        "class_breakdown": record.class_breakdown or {},
        "counted_at": record.counted_at.isoformat() if record.counted_at else None,
    }, headers=NO_STORE_HEADERS)


@public_router.get("/product-counts")
def list_all_product_counts(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = vdb.list_product_counts(db, limit=limit)
    result = []
    for r in records:
        video = r.video
        result.append({
            "id": r.id,
            "job_id": r.job_id,
            "video_id": video.storage_key if video else None,
            "video_filename": video.filename if video else None,
            "total_count": r.total_count,
            "class_breakdown": r.class_breakdown or {},
            "counted_at": r.counted_at.isoformat() if r.counted_at else None,
        })
    return JSONResponse(content=result, headers=NO_STORE_HEADERS)
