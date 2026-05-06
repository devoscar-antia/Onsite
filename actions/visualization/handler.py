from actions.types import ActionEvent


def handle_event(event: ActionEvent) -> None:
    """
    Handle visualization-side response (overlay, dashboard payload, etc.).
    TODO: Integrate with real-time websocket/dashboard channel.
    """
    print(
        f"[visualization] event_type={event.event_type} "
        f"feature={event.feature} source={event.source}"
    )

