import logging
from typing import Optional, Any
from authentication.models import AuditLog, User, Login

logger = logging.getLogger(__name__)


def get_client_ip(request: Optional[Any]) -> Optional[str]:
    """
    Extract client IP address from HttpRequest headers or REMOTE_ADDR.
    """
    if not request:
        return None
    try:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
            return ip
        return request.META.get('REMOTE_ADDR')
    except Exception:
        return None


def create_audit_log(
    user: Optional[Any] = None,
    actor_name: Optional[str] = None,
    role: Optional[str] = None,
    action: str = "SYSTEM_EVENT",
    category: str = "SYSTEM",
    target_type: str = "System",
    target_id: Optional[Any] = None,
    description: str = "",
    status: str = "SUCCESS",
    ip_address: Optional[str] = None,
    request: Optional[Any] = None
) -> Optional[AuditLog]:
    """
    Centralized, extensible audit logging service for PORTIDE.
    Used by all current modules (Auth, User Management, Shipping Company, Vessel, Arrival Request, Berth)
    and designed to seamlessly support future modules (Customs Declaration, Gate & Truck Operations).
    """
    try:
        user_obj: Optional[User] = None
        resolved_actor_name: Optional[str] = actor_name
        resolved_role: Optional[str] = role

        # 1. Resolve User/Login object if provided
        if user is not None:
            if isinstance(user, User):
                user_obj = user
                if not resolved_actor_name:
                    resolved_actor_name = user.user_full_name or (user.login_id.login_email if user.login_id else None)
                if not resolved_role and user.login_id:
                    resolved_role = user.login_id.login_role
            elif isinstance(user, Login):
                try:
                    user_obj = user.profile
                    if not resolved_actor_name:
                        resolved_actor_name = user_obj.user_full_name or user.login_email
                except Exception:
                    user_obj = None
                    if not resolved_actor_name:
                        resolved_actor_name = user.login_email
                if not resolved_role:
                    resolved_role = user.login_role

        # 2. Extract from request if actor_name or role are still missing
        if request is not None:
            if not ip_address:
                ip_address = get_client_ip(request)

            if not resolved_role:
                resolved_role = (
                    request.headers.get('X-User-Role') or 
                    getattr(request, 'user_role', None) or 
                    (request.session.get('user', {}).get('role') if hasattr(request, 'session') and 'user' in request.session else None)
                )

            if not resolved_actor_name:
                resolved_actor_name = (
                    request.headers.get('X-User-Email') or 
                    (request.session.get('user', {}).get('name') if hasattr(request, 'session') and 'user' in request.session else None)
                )

        # 3. Fallbacks
        if not resolved_role:
            resolved_role = "System"
        if not resolved_actor_name:
            resolved_actor_name = "System"

        # Format role for human display if it's snake_case
        role_display_map = {
            'port_administrator': 'Port Administrator',
            'admin': 'Port Administrator',
            'shipping_company': 'Shipping Company',
            'port_operations_officer': 'Port Operations Officer',
            'operations_officer': 'Port Operations Officer',
            'customs_officer': 'Customs Officer',
            'terminal_logistics_operator': 'Terminal Operator',
            'terminal_operator': 'Terminal Operator',
            'gate_truck_officer': 'Gate Operations Officer',
            'gate_officer': 'Gate Operations Officer',
            'system': 'System'
        }
        normalized_role_key = resolved_role.lower().strip()
        formatted_role = role_display_map.get(normalized_role_key, resolved_role)

        # 4. Target ID string conversion
        formatted_target_id = str(target_id) if target_id is not None else None

        # 5. Create immutable audit record
        audit_entry = AuditLog.objects.create(
            audit_log_user_id=user_obj,
            audit_log_actor_name=resolved_actor_name,
            audit_log_role=formatted_role,
            audit_log_action=action.upper().strip(),
            audit_log_category=category.upper().strip(),
            audit_log_target_type=target_type,
            audit_log_target_id=formatted_target_id,
            audit_log_description=description,
            audit_log_status=status.upper().strip(),
            audit_log_ip_address=ip_address
        )

        return audit_entry

    except Exception as e:
        logger.error(f"Failed to create audit log entry: {e}", exc_info=True)
        return None
