import re
from pydantic import BaseModel, field_validator

_SAFE_FILENAME = re.compile(r"^[a-f0-9]{32}\.(mp4|mov|avi|mkv)$")


class ProcessRequest(BaseModel):
    video_filename: str
    model_key: str = "conveyor-products"  # ignored — only one model active

    @field_validator("video_filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        if not _SAFE_FILENAME.fullmatch(v):
            raise ValueError("Invalid video_filename format")
        return v
