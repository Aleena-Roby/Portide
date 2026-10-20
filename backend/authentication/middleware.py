from django.http import JsonResponse
from authentication.models import Login


class MandatoryPasswordChangeMiddleware:
    """
    Backend Dashboard Bypass Protection Middleware.
    Enforces Requirement 22:
    If an authenticated user has must_change_password=True,
    they are blocked from accessing protected application functionality
    until their first-login password change is completed.
    """
    EXEMPT_PREFIXES = (
        '/api/auth/login',
        '/api/auth/logout',
        '/api/auth/me',
        '/api/auth/first-login-change-password',
        '/api/auth/first-login-password-change',
        '/api/auth/change-password',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/auth/registration',
        '/admin/',
        '/static/',
        '/media/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info.rstrip('/')

        # 1. Allow exempt endpoints (login, logout, me, password change, etc.)
        for prefix in self.EXEMPT_PREFIXES:
            clean_prefix = prefix.rstrip('/')
            if path == clean_prefix or path.startswith(clean_prefix + '/'):
                return self.get_response(request)

        # 2. Identify authenticated user from headers or session
        email = request.headers.get('X-User-Email') or request.headers.get('x-user-email')
        user_id = request.headers.get('X-User-Id') or request.headers.get('x-user-id')

        login_obj = None
        if email:
            try:
                login_obj = Login.objects.select_related('profile').get(login_email__iexact=email.strip())
            except Login.DoesNotExist:
                pass
        elif user_id:
            try:
                login_obj = Login.objects.select_related('profile').get(login_id=user_id)
            except (Login.DoesNotExist, ValueError):
                pass
        elif hasattr(request, 'session') and 'login_id' in request.session:
            try:
                login_obj = Login.objects.select_related('profile').get(login_id=request.session['login_id'])
            except Login.DoesNotExist:
                pass

        # 3. Block access to protected functionality if must_change_password is True
        if login_obj and login_obj.login_is_active:
            user_profile = getattr(login_obj, 'profile', None)
            if user_profile and getattr(user_profile, 'user_must_change_password', False):
                return JsonResponse(
                    {
                        "status": "error",
                        "must_change_password": True,
                        "message": "Mandatory password change required before accessing platform features."
                    },
                    status=403
                )

        return self.get_response(request)
