from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class JobResponse(BaseModel):
    id: int
    video_id: int
    video_filename: Optional[str] = None
    video_storage_key: Optional[str] = None
    model_key: str
    status: str
    total_count: Optional[int] = None
    processing_time_sec: Optional[float] = None
    processed_storage_key: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True
