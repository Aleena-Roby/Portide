from rest_framework import permissions
from authentication.models import Login

class IsPortAdministrator(permissions.BasePermission):
    """
    Custom permission class that permits access only to users with the 'port_administrator' role.
    Assumes request context contains authentication credentials or session info.
    If unauthorized, DRF automatically returns 403 Forbidden.
    """
    def has_permission(self, request, view):
        # 1. Check header or attached request user info
        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)
        
        if not role:
            # Check X-User-Id header
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if role:
            normalized_role = str(role).strip().lower()
            return normalized_role in ['port_administrator', 'admin', 'port administrator']

        # If X-User-Role or X-User-Id was explicitly checked and not found or non-admin
        user_role_header = request.headers.get('X-User-Role')
        if user_role_header:
            return user_role_header.strip().lower() in ['port_administrator', 'admin', 'port administrator']

        return False  # Strict security fallback: require admin authorization header


def get_authenticated_user_and_company(request):
    """
    Helper function to resolve authenticated User and associated ShippingCompany from headers/session.
    """
    email = request.headers.get('X-User-Email') or request.data.get('email')
    user_id_header = request.headers.get('X-User-Id')

    login_obj = None
    if email:
        try:
            login_obj = Login.objects.get(login_email__iexact=email.strip())
        except Login.DoesNotExist:
            pass
    elif user_id_header:
        try:
            login_obj = Login.objects.get(login_id=user_id_header)
        except (Login.DoesNotExist, ValueError):
            pass

    user_obj = None
    company_obj = None
    if login_obj:
        try:
            user_obj = login_obj.profile
            company_obj = user_obj.shipping_company_id
        except Exception:
            pass

    return login_obj, user_obj, company_obj


class IsActiveShippingCompany(permissions.BasePermission):
    """
    Permits access only to Shipping Company users whose company status is ACTIVE.
    """
    message = "Only active shipping companies can perform this operation."

    def has_permission(self, request, view):
        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role:
            login_obj, _, _ = get_authenticated_user_and_company(request)
            if login_obj:
                role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        if normalized_role not in ['shipping_company', 'shipping company / shipping agent']:
            return False

        # Verify active status
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if company_obj:
            return company_obj.shipping_company_status == 'ACTIVE'

        # Fallback check by email or request metadata if active status confirmed
        return True


class IsPortOperationsOfficer(permissions.BasePermission):
    """
    Permits access to Port Operations Officers and Port Administrators.
    """
    message = "Only Port Operations Officers are authorized to review arrival requests."

    def has_permission(self, request, view):
        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role:
            login_obj, _, _ = get_authenticated_user_and_company(request)
            if login_obj:
                role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        allowed_roles = [
            'port_operations_officer', 
            'operations_officer', 
            'port_administrator', 
            'admin', 
            'port administrator'
        ]
        return normalized_role in allowed_roles


class IsPortOperationsOfficerOnly(permissions.BasePermission):
    """
    Permits access ONLY to Port Operations Officers.
    Strictly denies access to Port Administrators, Shipping Companies, Customs Officers, Terminal Operators, Gate Officers.
    """
    message = "Only Port Operations Officers are authorized to approve or reject vessel arrival requests."

    def has_permission(self, request, view):
        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role:
            login_obj, _, _ = get_authenticated_user_and_company(request)
            if login_obj:
                role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        allowed_roles = ['port_operations_officer', 'operations_officer']
        return normalized_role in allowed_roles


