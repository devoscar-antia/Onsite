"""
Live stream service — reads a video source in loop, runs YOLO in a background
thread so frame emission stays smooth at TARGET_FPS regardless of inference speed.

Source priority:
  1. RTSP_URL env var (real camera)
  2. First video in assets/videos/uploaded/ (loop simulation)
  3. None — stream unavailable
"""
import os
import threading
import time
from pathlib import Path
from queue import Empty, Queue
from typing import Generator, Optional

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

PROJECT_ROOT = Path(__file__).resolve().parents[4]
MODEL_PATH = PROJECT_ROOT / "models" / "conveyor-products" / "product_bag_detector.pt"
UPLOADED_VIDEOS_DIR = PROJECT_ROOT / "assets" / "videos" / "uploaded"

_model: Optional[object] = None

# Shared stats — written by generator thread, read by /stats endpoint
_stats: dict = {"count": 0, "total_count": 0, "fps": 0.0, "source": None, "model_loaded": False}

# Latest inference result — written by inference thread, read by generator
_infer_lock = threading.Lock()
_infer_boxes: list = []
_infer_count: int = 0        # objects visible in current frame
_infer_total: int = 0        # unique track IDs seen since stream started

TARGET_FPS = 20
FRAME_INTERVAL = 1.0 / TARGET_FPS


def get_stats() -> dict:
    return dict(_stats)


def _get_model():
    global _model
    if _model is None and YOLO is not None and MODEL_PATH.exists():
        _model = YOLO(str(MODEL_PATH))
    return _model


def _get_source() -> Optional[str]:
    rtsp = os.getenv("RTSP_URL", "").strip()
    if rtsp:
        return rtsp
    videos = sorted(UPLOADED_VIDEOS_DIR.glob("*.mp4"))
    if not videos:
        videos = sorted(UPLOADED_VIDEOS_DIR.glob("*.avi")) + sorted(UPLOADED_VIDEOS_DIR.glob("*.mov"))
    return str(videos[0]) if videos else None


def _reset_bytetrack(model) -> None:
    """Best-effort reset of the ByteTrack state inside a YOLO model."""
    try:
        if hasattr(model, "predictor") and model.predictor is not None:
            trackers = getattr(model.predictor, "trackers", None)
            if trackers:
                for tracker in trackers:
                    if hasattr(tracker, "reset"):
                        tracker.reset()
    except Exception as e:
        print(f"[live] ByteTrack reset error (non-fatal): {e}")


def _inference_worker(model, frame_q: Queue, conf: float, stop_evt: threading.Event) -> None:
    """Runs YOLO track() on frames. Accumulates unique track IDs as running total.

    A None sentinel in frame_q signals a video loop restart: seen_ids and the
    ByteTrack state are reset so re-appearing track IDs don't inflate the count.
    """
    global _infer_boxes, _infer_count, _infer_total
    seen_ids: set = set()
    use_track = True  # flip to False if model.track() unsupported

    while not stop_evt.is_set():
        try:
            frame = frame_q.get(timeout=0.5)
        except Empty:
            continue

        # None sentinel → video looped; reset tracker state
        if frame is None:
            seen_ids.clear()
            with _infer_lock:
                _infer_total = 0
            _reset_bytetrack(model)
            continue

        try:
            if use_track:
                try:
                    results = model.track(frame, conf=conf, persist=True, verbose=False)
                except Exception as track_err:
                    print(f"[live] model.track() failed ({track_err}), falling back to model()")
                    use_track = False
                    results = model(frame, conf=conf, verbose=False)
            else:
                results = model(frame, conf=conf, verbose=False)

            boxes, count = [], 0
            for r in results:
                if r.boxes is None or len(r.boxes) == 0:
                    continue
                count += len(r.boxes)
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    c = float(box.conf[0])
                    tid = -1
                    if use_track and box.id is not None:
                        try:
                            tid = int(box.id[0].item())
                        except Exception:
                            pass
                    if tid >= 0:
                        seen_ids.add(tid)
                    boxes.append((x1, y1, x2, y2, c, tid))

            with _infer_lock:
                _infer_boxes = boxes
                _infer_count = count
                if use_track:
                    _infer_total = len(seen_ids)
                # else: _infer_total unchanged (tracking unavailable, keep last known)

        except Exception as e:
            print(f"[live] inference error: {e}")


def _draw_overlay(frame: np.ndarray, count: int, total: int) -> np.ndarray:
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 52), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)
    cv2.putText(frame, "LIVE", (12, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 60, 255), 2)
    cv2.circle(frame, (55, 22), 7, (0, 60, 255), -1)
    cv2.putText(frame, f"En frame: {count}  |  Total: {total}", (80, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    return frame


def generate_frames(conf: float = 0.35) -> Generator[bytes, None, None]:
    """
    Yields MJPEG frames at TARGET_FPS.
    YOLO inference runs in a background thread — frame emission never blocks on inference.
    """
    global _stats, _infer_boxes, _infer_count, _infer_total

    source = _get_source()
    if source is None:
        blank = np.zeros((360, 640, 3), dtype=np.uint8)
        cv2.putText(blank, "Sin fuente de video", (120, 180),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 100, 100), 2)
        _, buf = cv2.imencode(".jpg", blank)
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
        return

    model = _get_model()
    _stats["model_loaded"] = model is not None
    _stats["source"] = "rtsp" if source.startswith("rtsp") else "video_loop"

    # Reset inference state for new session
    with _infer_lock:
        _infer_boxes, _infer_count, _infer_total = [], 0, 0

    # Start background inference thread
    stop_evt = threading.Event()
    frame_q: Queue = Queue(maxsize=2)  # slot 0: live frame; slot 1: reset sentinel
    if model is not None:
        t = threading.Thread(
            target=_inference_worker,
            args=(model, frame_q, conf, stop_evt),
            daemon=True,
        )
        t.start()

    # FPS tracking
    fps_t0 = time.monotonic()
    fps_frames = 0

    try:
        while True:
            cap = cv2.VideoCapture(source)
            if not cap.isOpened():
                time.sleep(2)
                continue

            while True:
                t_start = time.monotonic()

                ret, frame = cap.read()
                if not ret:
                    break  # EOF → restart video

                # Send frame to inference thread (non-blocking; drop if busy)
                if model is not None:
                    try:
                        frame_q.put_nowait(frame.copy())
                    except Exception:
                        pass  # inference still running — skip this frame

                # Read latest inference result (never blocks)
                with _infer_lock:
                    boxes = list(_infer_boxes)
                    count = _infer_count
                    total = _infer_total

                # Draw boxes
                for (x1, y1, x2, y2, c, tid) in boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 100), 2)
                    label = f"#{tid} {c:.2f}" if tid >= 0 else f"{c:.2f}"
                    cv2.putText(frame, label, (x1, max(y1 - 6, 10)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 100), 1)

                frame = _draw_overlay(frame, count, total)

                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"

                # Update stats every second
                fps_frames += 1
                elapsed = time.monotonic() - fps_t0
                if elapsed >= 1.0:
                    _stats["fps"] = round(fps_frames / elapsed, 1)
                    _stats["count"] = count
                    _stats["total_count"] = total
                    fps_frames = 0
                    fps_t0 = time.monotonic()

                # Frame rate cap
                spent = time.monotonic() - t_start
                sleep_for = FRAME_INTERVAL - spent
                if sleep_for > 0:
                    time.sleep(sleep_for)

            cap.release()
            # Signal inference worker to reset ByteTrack + seen_ids on loop restart
            if model is not None:
                try:
                    # Drain first so the sentinel isn't blocked behind a stale frame
                    while not frame_q.empty():
                        try:
                            frame_q.get_nowait()
                        except Exception:
                            break
                    frame_q.put(None, timeout=1.0)
                except Exception:
                    pass
            time.sleep(0.05)
    finally:
        stop_evt.set()