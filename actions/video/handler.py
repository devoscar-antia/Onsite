from actions.types import ActionEvent


def handle_event(event: ActionEvent) -> None:
    """
    Handle processed video output registration.
    TODO: Persist output path, job id, and artifacts.
    """
    output_path = event.metadata.get("output_path")
    print(
        f"[video] event_type={event.event_type} "
        f"feature={event.feature} output_path={output_path}"
    )

