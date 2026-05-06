from actions.types import ActionEvent


def handle_event(event: ActionEvent) -> None:
    """
    Send SMS notification for critical events.
    TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.).
    """
    print(
        f"[sms] event_type={event.event_type} "
        f"feature={event.feature} confidence={event.confidence}"
    )

