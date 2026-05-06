from actions.types import ActionEvent


def handle_event(event: ActionEvent) -> None:
    """
    Persist event into the database.
    TODO: Replace with real DB repository call.
    """
    print(
        f"[save_db] event_type={event.event_type} "
        f"feature={event.feature} source={event.source} ts={event.timestamp.isoformat()}"
    )

