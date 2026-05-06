from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ActionEvent:
    event_type: str
    feature: str
    source: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    confidence: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

