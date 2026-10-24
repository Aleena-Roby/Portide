import logging
from django.utils import timezone
from .models import Notification, User, ShippingCompany

logger = logging.getLogger('portide.notifications')

def create_notification(
    title: str,
    message: str,
    recipient_user=None,
    recipient_company=None,
    recipient_role: str = '',
    notification_type: str = 'info',
    category: str = 'SYSTEM',
    target_type: str = '',
    target_id: str = '',
    action_route: str = '',
    event_key: str = ''
):
    """
    Safely creates an in-app notification record.
    Deduplicates using event_key if provided.
    Never raises exceptions that would interrupt the calling business workflow.
    """
    try:
        # Check deduplication
        if event_key:
            existing = Notification.objects.filter(notification_event_key=event_key).first()
            if existing:
                logger.info(f"Duplicate notification avoided for key '{event_key}'")
                return existing

        notif = Notification.objects.create(
            notification_recipient_user=recipient_user,
            notification_recipient_company=recipient_company,
            notification_recipient_role=recipient_role or '',
            notification_title=title[:200],
            notification_message=message,
            notification_type=notification_type if notification_type in ['info', 'success', 'warning', 'danger'] else 'info',
            notification_category=category if category in ['VESSEL', 'BERTH', 'CUSTOMS', 'CARGO', 'CONTAINER', 'GATE', 'SYSTEM'] else 'SYSTEM',
            notification_target_type=target_type[:50],
            notification_target_id=str(target_id)[:100],
            notification_action_route=action_route[:255],
            notification_event_key=event_key[:150],
            notification_is_read=False
        )
        logger.info(f"Created notification ID {notif.notification_id}: [{category}] {title}")
        return notif
    except Exception as e:
        logger.error(f"Failed to create notification '{title}': {str(e)}", exc_info=True)
        return None
