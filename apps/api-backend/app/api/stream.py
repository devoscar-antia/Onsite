from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.db.models import User
from app.services import live_stream_service

router = APIRouter(prefix="/stream", tags=["stream"])


@router.get("/live")
def live_stream(
    conf: float = Query(default=0.35, ge=0.1, le=0.99),
    _: User = Depends(get_current_user),
):
    return StreamingResponse(
        live_stream_service.generate_frames(conf=conf),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/live/status")
def live_status(_: User = Depends(get_current_user)):
    source = live_stream_service._get_source()
    model = live_stream_service._get_model()
    return {
        "available": source is not None,
        "source": "rtsp" if source and source.startswith("rtsp") else "video_loop" if source else None,
        "model_loaded": model is not None,
    }


@router.get("/live/stats")
def live_stats(_: User = Depends(get_current_user)):
    return live_stream_service.get_stats()