import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
from fastapi import HTTPException
from fastapi.responses import StreamingResponse, FileResponse

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

PROJECT_ROOT = Path(__file__).resolve().parents[4]
ORIGINAL_VIDEOS_DIR = PROJECT_ROOT / "assets" / "videos" / "uploaded"
PROCESSED_VIDEOS_DIR = PROJECT_ROOT / "assets" / "processed_videos"
ANALYTICS_CACHE_DIR = PROJECT_ROOT / "assets" / "analytics"
THUMBNAILS_DIR = PROJECT_ROOT / "assets" / "thumbnails"
PROCESSED_INDEX_PATH = ANALYTICS_CACHE_DIR / "processed_index.json"
ORIGINAL_NAMES_INDEX_PATH = ANALYTICS_CACHE_DIR / "original_names_index.json"
DELETED_INDEX_PATH = ANALYTICS_CACHE_DIR / "deleted_videos_index.json"
PROCESS_SCRIPT = PROJECT_ROOT / "process_count_video.py"
MODEL_PATH = PROJECT_ROOT / "models" / "conveyor-products" / "product_bag_detector.pt"

ORIGINAL_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
ANALYTICS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Index helpers
# ---------------------------------------------------------------------------

def load_processed_index() -> dict:
    if not PROCESSED_INDEX_PATH.exists():
        return {}
    try:
        raw = json.loads(PROCESSED_INDEX_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def save_processed_index(data: dict) -> None:
    PROCESSED_INDEX_PATH.write_text(json.dumps(data), encoding="utf-8")


def load_original_names_index() -> dict:
    if not ORIGINAL_NAMES_INDEX_PATH.exists():
        return {}
    try:
        raw = json.loads(ORIGINAL_NAMES_INDEX_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def save_original_names_index(data: dict) -> None:
    ORIGINAL_NAMES_INDEX_PATH.write_text(json.dumps(data), encoding="utf-8")


def load_deleted_index() -> dict:
    if not DELETED_INDEX_PATH.exists():
        return {}
    try:
        raw = json.loads(DELETED_INDEX_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def save_deleted_index(data: dict) -> None:
    DELETED_INDEX_PATH.write_text(json.dumps(data), encoding="utf-8")


# ---------------------------------------------------------------------------
# File resolution
# ---------------------------------------------------------------------------

def original_name_sidecar(video_id: str) -> Path:
    return ORIGINAL_VIDEOS_DIR / f"{video_id}.name.txt"


def get_video_path(video_id: str) -> Path:
    deleted = load_deleted_index()
    if video_id in deleted:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    for path in ORIGINAL_VIDEOS_DIR.glob("*"):
        if path.is_file() and path.name == video_id:
            return path
    raise HTTPException(status_code=404, detail="Video no encontrado")


def get_processed_path(video_id: str) -> Optional[Path]:
    index_data = load_processed_index()
    mapped = index_data.get(video_id)
    candidates = sorted(
        [p for p in PROCESSED_VIDEOS_DIR.glob("*.mp4") if p.is_file()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not mapped:
        source_stem = Path(video_id).stem.lower()
        recovered = next((p for p in candidates if source_stem and source_stem in p.stem.lower()), None)
        if recovered:
            index_data[video_id] = recovered.name
            save_processed_index(index_data)
            return recovered
        if candidates:
            recovered = candidates[0]
            index_data[video_id] = recovered.name
            save_processed_index(index_data)
            return recovered
        return None

    candidate = PROCESSED_VIDEOS_DIR / str(mapped)
    if candidate.exists() and candidate.is_file():
        return candidate

    source_stem = Path(video_id).stem.lower()
    recovered = next((p for p in candidates if source_stem and source_stem in p.stem.lower()), None)
    if recovered:
        index_data[video_id] = recovered.name
        save_processed_index(index_data)
        return recovered
    if candidates:
        recovered = candidates[0]
        index_data[video_id] = recovered.name
        save_processed_index(index_data)
        return recovered
    return None


def latest_processed_file() -> Optional[Path]:
    files = sorted(PROCESSED_VIDEOS_DIR.glob("*.mp4"), key=lambda p: p.stat().st_mtime)
    return files[-1] if files else None


# ---------------------------------------------------------------------------
# Metadata & codec
# ---------------------------------------------------------------------------

def extract_metadata(path: Path) -> dict:
    def _safe_size() -> int:
        try:
            return path.stat().st_size if path.exists() else 0
        except Exception:
            return 0

    try:
        probe = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate,duration",
                "-show_entries", "format=duration,size",
                "-of", "json",
                str(path),
            ],
            capture_output=True, text=True, check=False,
        )
        if probe.returncode == 0 and probe.stdout:
            payload = json.loads(probe.stdout)
            streams = payload.get("streams") or []
            stream = streams[0] if streams else {}
            fmt = payload.get("format") or {}
            width = int(stream.get("width") or 0)
            height = int(stream.get("height") or 0)
            fps_raw = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1"
            fps = 0.0
            if isinstance(fps_raw, str) and "/" in fps_raw:
                num, den = fps_raw.split("/", 1)
                den_f = float(den or 1)
                if den_f != 0:
                    fps = float(num or 0) / den_f
            else:
                fps = float(fps_raw or 0)
            duration = float(stream.get("duration") or fmt.get("duration") or 0)
            size = int(fmt.get("size") or 0) or _safe_size()
            return {"fps": fps if fps > 0 else 0, "width": width, "height": height, "duration": duration if duration > 0 else 0, "size": size}
    except Exception:
        pass

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {"fps": 0, "width": 0, "height": 0, "duration": 0, "size": _safe_size()}
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    duration = (frames / fps) if fps > 0 else 0
    return {"fps": fps, "width": width, "height": height, "duration": duration, "size": _safe_size()}


def is_browser_compatible(path: Path) -> bool:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return False
    try:
        fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC) or 0)
        codec = "".join(chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4)).strip().lower()
        return any(token in codec for token in ("avc1", "h264"))
    finally:
        cap.release()


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

def stream_file(video_path: Path, range_header: Optional[str]) -> StreamingResponse:
    file_size = video_path.stat().st_size

    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not match:
            raise HTTPException(status_code=416, detail="Range inválido")
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else file_size - 1
        if start >= file_size:
            raise HTTPException(status_code=416, detail="Range fuera de tamaño")
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_chunk():
            with video_path.open("rb") as fh:
                fh.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    data = fh.read(min(8192, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_chunk(),
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
                "Content-Type": "video/mp4",
            },
            media_type="video/mp4",
        )

    def iter_full():
        with video_path.open("rb") as fh:
            while chunk := fh.read(8192):
                yield chunk

    return StreamingResponse(
        iter_full(),
        status_code=200,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": "video/mp4",
        },
        media_type="video/mp4",
    )


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------

def run_processing(source_path: Path, video_filename: str) -> dict:
    if not PROCESS_SCRIPT.exists() or not MODEL_PATH.exists():
        raise HTTPException(status_code=500, detail="Model or process script not found in project")
    cmd = [
        sys.executable, str(PROCESS_SCRIPT),
        "--source", str(source_path),
        "--model", str(MODEL_PATH),
        "--output-dir", str(PROCESSED_VIDEOS_DIR),
        "--direction", "any",
        "--line-ratio", "0.5",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Model execution failed: {(result.stderr or result.stdout or '').strip()[:500]}")

    latest = latest_processed_file()
    if not latest:
        raise HTTPException(status_code=500, detail="No processed video was generated")
    count_match = re.search(r"Final count=(\d+)", result.stdout or "")
    count_value = int(count_match.group(1)) if count_match else 0
    index_data = load_processed_index()
    index_data[video_filename] = latest.name
    save_processed_index(index_data)
    return {
        "processed_filename": latest.name,
        "processed_video_url": f"/media/processed_videos/{latest.name}",
        "summary": {"model": "conveyor-products", "total_count": count_value, "status": "done"},
    }


# ---------------------------------------------------------------------------
# Detections cache
# ---------------------------------------------------------------------------

def detections_cache_path(video_id: str) -> Path:
    safe_id = video_id.replace("/", "_").replace("\\", "_")
    return ANALYTICS_CACHE_DIR / f"{safe_id}.detections.json"


def build_detections(video_id: str, video_path: Path) -> list[dict]:
    cache_path = detections_cache_path(video_id)
    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        # Regenerate if old cache lacks track_id (pre-tracking schema)
        if cached and "track_id" not in cached[0]:
            cache_path.unlink(missing_ok=True)
        else:
            return cached
    if YOLO is None or not MODEL_PATH.exists():
        raise HTTPException(status_code=503, detail="Modelo YOLO no disponible para generar detecciones.")

    model = YOLO(str(MODEL_PATH))
    detections: list[dict] = []
    for frame_idx, result in enumerate(
        model.track(source=str(video_path), stream=True, verbose=False, conf=0.1, persist=True),
        start=1,
    ):
        boxes = result.boxes
        if boxes is None:
            continue
        xywh = boxes.xywh.cpu().tolist()
        confs = boxes.conf.cpu().tolist() if boxes.conf is not None else [0.0] * len(xywh)
        classes = boxes.cls.cpu().tolist() if boxes.cls is not None else [0] * len(xywh)
        track_ids = boxes.id.cpu().tolist() if boxes.id is not None else [None] * len(xywh)
        names = result.names or {}
        for box, conf, cls, tid in zip(xywh, confs, classes, track_ids):
            x, y, w, h = box
            detections.append({
                "frame": frame_idx,
                "class": names.get(int(cls), str(int(cls))),
                "confidence": float(conf),
                "x": float(x), "y": float(y), "w": float(w), "h": float(h),
                "track_id": int(tid) if tid is not None else None,
            })

    cache_path.write_text(json.dumps(detections), encoding="utf-8")
    return detections


def generate_thumbnail(storage_key: str) -> Optional[Path]:
    """Extract a JPEG thumbnail from the video. Cached on disk."""
    thumb_path = THUMBNAILS_DIR / f"{storage_key}.jpg"
    if thumb_path.exists():
        return thumb_path

    source = ORIGINAL_VIDEOS_DIR / storage_key
    if not source.exists():
        return None

    cap = cv2.VideoCapture(str(source))
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 24
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        target_frame = min(int(fps), max(0, total - 1))
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()
    finally:
        cap.release()

    if not ret or frame is None:
        return None

    h, w = frame.shape[:2]
    max_dim = 320
    scale = max_dim / max(w, h, 1)
    if scale < 1:
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    if not ok:
        return None

    thumb_path.write_bytes(buf.tobytes())
    return thumb_path
