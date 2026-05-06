import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from actions.save_db.handler import handle_event as handle_save_db
from actions.types import ActionEvent
from actions.video.handler import handle_event as handle_video
from actions.visualization.handler import handle_event as handle_visualization


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "conveyor-products" / "product_bag_detector.pt"
DEFAULT_SOURCE_PATH = PROJECT_ROOT / "assets" / "videos" / "Procesamiento.mp4"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "assets" / "processed_videos"
SCRIPT_PATH = PROJECT_ROOT / "process_count_video.py"


def _find_latest_processed_video(output_dir: Path) -> str | None:
    if not output_dir.exists():
        return None
    candidates = [p for p in output_dir.glob("*.mp4") if p.is_file()]
    if not candidates:
        return None
    return str(max(candidates, key=lambda p: p.stat().st_mtime))


def run_conveyor_products_pipeline(
    source: Path | None = None,
    output_dir: Path | None = None,
    model_path: Path | None = None,
) -> int:
    """
    Run the current production conveyor counting pipeline using the trained model.
    Returns the process exit code.
    """
    effective_source = source or DEFAULT_SOURCE_PATH
    effective_output_dir = output_dir or DEFAULT_OUTPUT_PATH
    effective_model = model_path or DEFAULT_MODEL_PATH

    cmd = [
        sys.executable,
        str(SCRIPT_PATH),
        "--model",
        str(effective_model),
        "--source",
        str(effective_source),
        "--output-dir",
        str(effective_output_dir),
    ]
    exit_code = subprocess.call(cmd)

    base_event = ActionEvent(
        event_type="conveyor_pipeline_finished",
        feature="conveyor_products",
        source=str(effective_source),
        timestamp=datetime.now(timezone.utc),
        metadata={
            "status": "success" if exit_code == 0 else "failed",
            "exit_code": exit_code,
            "model_path": str(effective_model),
            "output_dir": str(effective_output_dir),
        },
    )
    handle_save_db(base_event)
    handle_visualization(base_event)

    if exit_code == 0:
        latest_output = _find_latest_processed_video(effective_output_dir)
        video_event = ActionEvent(
            event_type="conveyor_video_generated",
            feature="conveyor_products",
            source=str(effective_source),
            timestamp=datetime.now(timezone.utc),
            metadata={
                "output_path": latest_output,
                "output_dir": str(effective_output_dir),
                "model_path": str(effective_model),
            },
        )
        handle_video(video_event)
        handle_visualization(video_event)

    return exit_code


if __name__ == "__main__":
    raise SystemExit(run_conveyor_products_pipeline())

