from rest_framework import permissions
from authentication.models import Login

class IsPortAdministrator(permissions.BasePermission):
    """
    Custom permission class that permits access only to users with the 'port_administrator' role.
    Assumes request context contains authentication credentials or session info.
    If unauthorized, DRF automatically returns 403 Forbidden.
    """
    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        # 1. Check header or attached request user info
        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)
        if not role and login_obj:
            role = login_obj.login_role
        
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


class IsPortAdministratorOrCustomsOfficer(permissions.BasePermission):
    """
    Permits Port Administrators to view all audit logs,
    and Customs Officers to view customs audit logs (category='CUSTOMS').
    """
    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)
        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if role:
            normalized_role = str(role).strip().lower()
            if normalized_role in ['port_administrator', 'admin', 'port administrator']:
                return True
            if normalized_role in ['customs_officer']:
                cat = request.query_params.get('category', '').lower()
                return cat in ['customs', '']
        return False


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
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        if normalized_role not in ['shipping_company', 'shipping company / shipping agent']:
            return False

        # Verify active status
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
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
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
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        allowed_roles = ['port_operations_officer', 'operations_officer']
        return normalized_role in allowed_roles


class IsTerminalLogisticsOperator(permissions.BasePermission):
    """
    Permits access only to Terminal & Logistics Operators (and Port Administrators).
    """
    message = "Only Terminal & Logistics Operators are authorized to perform terminal container operations."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        allowed_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'port_administrator',
            'admin',
            'port administrator'
        ]
        return normalized_role in allowed_roles


class IsCustomsOfficer(permissions.BasePermission):
    """
    Permits access to Customs Officers (and Port Administrators).
    """
    message = "Only Customs Officers are authorized to perform customs operations."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        allowed_roles = [
            'customs_officer',
            'port_administrator',
            'admin',
            'port administrator'
        ]
        return normalized_role in allowed_roles


class IsCustomsOfficerOnly(permissions.BasePermission):
    """
    Permits access ONLY to Customs Officers.
    Strictly denies access to Shipping Companies, Terminal Operators, Port Operations Officers, Gate Officers.
    """
    message = "Only Customs Officers are authorized to perform this customs action."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        return normalized_role in ['customs_officer']


class IsGateTruckOfficer(permissions.BasePermission):
    """
    Permits access to Gate & Truck Operations Officers and Port Administrators.
    Strictly denies access to Shipping Company, Terminal Operator, Customs Officer, Port Operations Officer.
    """
    message = "Only Gate & Truck Operations Officers are authorized to perform gate release operations."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        allowed_roles = [
            'gate_truck_officer',
            'gate_truck_operations_officer',
            'gate_security_officer',
            'gate_officer',
            'port_administrator',
            'admin',
            'port administrator'
        ]
        return normalized_role in allowed_roles


class IsDeliveryTrackingViewer(permissions.BasePermission):
    """
    Permits viewing delivery tracking to Terminal Operators, Gate Officers,
    Shipping Companies, and Port Administrators.
    Strictly denies Customs Officers from delivery tracking responsibilities.
    """
    message = "You are not authorized to view delivery tracking."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)
        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()
        if normalized_role in ['customs_officer']:
            return False

        allowed_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'gate_truck_officer',
            'gate_officer',
            'port_administrator',
            'admin',
            'shipping_company',
            'shipping company / shipping agent',
            'port_operations_officer',
            'operations_officer'
        ]
        return normalized_role in allowed_roles


class IsYardMasterAuthorized(permissions.BasePermission):
    """
    Permission for Yard Master Management (Phase T1):
    - Full Management (CRUD & Status Toggle): Terminal & Logistics Operator, Port Administrator.
    - Read-Only (Safe Methods): Port Operations Officer.
    - Denied: Shipping Company, Customs Officer, Gate Officer, and other unprivileged roles.
    """
    message = "Unauthorized access to Yard Master Management."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()

        # Terminal & Logistics Operators and Port Administrators have full management access
        management_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'port_administrator',
            'admin',
            'port administrator',
        ]
        if normalized_role in management_roles:
            return True

        # Port Operations Officers have read-only access (GET/HEAD/OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            read_only_roles = [
                'port_operations_officer',
                'operations_officer',
            ]
            if normalized_role in read_only_roles:
                return True

        self.message = "Only Terminal & Logistics Operators and Port Administrators are authorized to manage yard master records."
        return False


class IsYardAllocationAuthorized(permissions.BasePermission):
    """
    Permission for Container Yard Allocation & Storage (Phase T2):
    - Full Management (Allocate & Release): Terminal & Logistics Operator, Port Administrator.
    - Read-Only (Safe Methods): Port Operations Officer.
    - Denied: Shipping Company, Customs Officer, Gate Officer, unprivileged roles.
    """
    message = "Unauthorized access to Container Yard Allocation."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()

        # Terminal & Logistics Operators and Port Administrators have full allocation/release access
        management_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'port_administrator',
            'admin',
            'port administrator',
        ]
        if normalized_role in management_roles:
            return True

        # Port Operations Officers have read-only access (GET/HEAD/OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            read_only_roles = [
                'port_operations_officer',
                'operations_officer',
            ]
            if normalized_role in read_only_roles:
                return True

        self.message = "Only Terminal & Logistics Operators and Port Administrators are authorized to allocate or release yard slots."
        return False


class IsYardOperationsAuthorized(permissions.BasePermission):
    """
    Permission for Yard Operations Management (Phase T3):
    - Relocation & Operational Modifications (Write Methods): Terminal & Logistics Operator, Port Administrator.
    - Read-Only (Safe Methods): Port Operations Officer, Port Administrator, Terminal & Logistics Operator.
    - Denied (All Methods): Shipping Company, Customs Officer, Gate & Truck Operations Officer.
    """
    message = "Unauthorized access to Yard Operations."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()

        # Terminal & Logistics Operators and Port Administrators have full yard operations & relocation access
        management_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'port_administrator',
            'admin',
            'port administrator',
        ]
        if normalized_role in management_roles:
            return True

        # Port Operations Officers have read-only access (GET/HEAD/OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            read_only_roles = [
                'port_operations_officer',
                'operations_officer',
            ]
            if normalized_role in read_only_roles:
                return True

        self.message = "Only Terminal & Logistics Operators and Port Administrators are authorized to perform yard operations and relocations."
        return False


class IsCraneManagementAuthorized(permissions.BasePermission):
    """
    Permission for Crane Management & Allocation (Phase T4):
    - Full Management & Operations (Write Methods: POST, PUT, PATCH, DELETE):
        Terminal & Logistics Operator, Port Administrator.
    - Read-Only (Safe Methods: GET, HEAD, OPTIONS):
        Terminal & Logistics Operator, Port Administrator, Port Operations Officer.
    - Denied (All Methods):
        Shipping Company, Customs Officer, Gate & Truck Operations Officer.
    """
    message = "Unauthorized access to Crane Management."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()

        # Terminal & Logistics Operators and Port Administrators have full management access
        management_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'port_administrator',
            'admin',
            'port administrator',
        ]
        if normalized_role in management_roles:
            return True

        # Port Operations Officers have read-only access for coordination & tracking
        if request.method in permissions.SAFE_METHODS:
            read_only_roles = [
                'port_operations_officer',
                'operations_officer',
            ]
            if normalized_role in read_only_roles:
                return True

        self.message = "Only Terminal & Logistics Operators and Port Administrators are authorized to manage cranes and allocations."
        return False


class IsUnloadingOperationsAuthorized(permissions.BasePermission):
    """
    Permission for Vessel Container Unloading Operations (Discharge):
    - Discharge Execution & Operational Actions (Write Methods: POST):
        Terminal & Logistics Operator, Port Administrator.
    - Read-Only (Safe Methods: GET, HEAD, OPTIONS):
        Terminal & Logistics Operator, Port Administrator, Port Operations Officer.
    - Denied (All Methods):
        Shipping Company, Customs Officer, Gate & Truck Operations Officer.
    """
    message = "Unauthorized access to Unloading Operations."

    def has_permission(self, request, view):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            self.message = "Password change required before accessing platform features."
            return False

        role = request.headers.get('X-User-Role') or getattr(request, 'user_role', None)

        if not role and login_obj:
            role = login_obj.login_role

        if not role and hasattr(request, 'session') and 'user' in request.session:
            role = request.session['user'].get('role')

        if not role:
            user_id = request.headers.get('X-User-Id')
            if user_id:
                try:
                    login_obj = Login.objects.get(login_id=user_id)
                    role = login_obj.login_role
                except (Login.DoesNotExist, ValueError):
                    return False

        if not role:
            return False

        normalized_role = str(role).strip().lower()

        # Terminal & Logistics Operators and Port Administrators have write access
        management_roles = [
            'terminal_logistics_operator',
            'terminal_operator',
            'port_administrator',
            'admin',
            'port administrator',
        ]
        if normalized_role in management_roles:
            return True

        # Port Operations Officers have read-only monitoring access
        if request.method in permissions.SAFE_METHODS:
            read_only_roles = [
                'port_operations_officer',
                'operations_officer',
            ]
            if normalized_role in read_only_roles:
                return True

        self.message = "Only Terminal & Logistics Operators and Port Administrators are authorized to execute vessel unloading operations."
        return False



