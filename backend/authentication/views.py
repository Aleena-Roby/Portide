from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction, models
from django.utils import timezone
import secrets
import hashlib
import datetime
from django.core.mail import send_mail
from django.conf import settings

from authentication.models import (
    Login, 
    User, 
    ShippingCompany, 
    RegistrationRequest, 
    PasswordResetToken,
    Vessel,
    VesselArrivalRequest,
    Berth,
    VesselSchedule,
    SystemSetting,
    AuditLog,
    get_min_arrival_advance_days
)
from authentication.serializers import (
    LoginSerializer, 
    RegistrationRequestSerializer, 
    RegistrationRequestDetailSerializer,
    ForgotPasswordSerializer, 
    ResetPasswordSerializer,
    CreateStaffSerializer,
    UserDetailSerializer,
    UpdateStaffUserSerializer,
    ChangePasswordSerializer,
    VesselSerializer,
    VesselCreateSerializer,
    VesselUpdateSerializer,
    VesselArrivalRequestSerializer,
    VesselArrivalRequestCreateSerializer,
    BerthSerializer,
    AdminBerthCreateUpdateSerializer,
    VesselScheduleSerializer,
    SystemSettingSerializer,
    AuditLogSerializer
)
from authentication.permissions import (
    IsPortAdministrator, 
    IsActiveShippingCompany, 
    IsPortOperationsOfficer,
    IsPortOperationsOfficerOnly,
    get_authenticated_user_and_company
)
from authentication.audit_service import create_audit_log

class LoginAPIView(APIView):
    """
    Public API Endpoint for User Authentication.
    Determines user role authoritatively from PostgreSQL.
    Endpoint: POST /api/auth/login/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        # 1. Lookup login record
        try:
            login_obj = Login.objects.get(login_email__iexact=email.strip())
        except Login.DoesNotExist:
            create_audit_log(
                user=None,
                actor_name=email.strip(),
                role='Unknown',
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=None,
                description=f"Failed login attempt for non-existent user: {email.strip()}",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Invalid email or password."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Verify password against PBKDF2 hash
        if not check_password(password, login_obj.login_password):
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Failed login attempt for {login_obj.login_email} (Incorrect password)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Invalid email or password."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 3. Fetch linked profile details & status
        user_profile = getattr(login_obj, 'profile', None)
        company = user_profile.shipping_company_id if user_profile else None

        # Status check rules:
        if login_obj.login_status == 'PENDING' or (user_profile and user_profile.user_status == 'PENDING'):
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt rejected for {login_obj.login_email} (Pending approval)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Your registration is awaiting Port Administrator approval."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'REJECTED' or (user_profile and user_profile.user_status == 'REJECTED'):
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt rejected for {login_obj.login_email} (Registration rejected)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Your registration request has been rejected."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'SUSPENDED' or (user_profile and user_profile.user_status == 'SUSPENDED'):
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt rejected for {login_obj.login_email} (Account suspended)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Your account has been suspended. Please contact the Port Administrator."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if company and company.shipping_company_status == 'PENDING':
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt rejected for {login_obj.login_email} (Company pending approval)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Your registration is awaiting Port Administrator approval."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if company and company.shipping_company_status == 'SUSPENDED':
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt rejected for {login_obj.login_email} (Company suspended)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Your company account has been suspended. Please contact the Port Administrator."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not login_obj.login_is_active:
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt rejected for {login_obj.login_email} (Account inactive)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "message": "Account is inactive. Please contact the Port Administrator."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Establish backend session
        if hasattr(request, 'session'):
            request.session['user_id'] = login_obj.login_id
            request.session['login_id'] = login_obj.login_id
            request.session['user_role'] = login_obj.login_role
            request.session.save()

        # Audit successful login
        actor_display = user_profile.user_full_name if user_profile else login_obj.login_email
        create_audit_log(
            user=user_profile or login_obj,
            actor_name=actor_display,
            role=login_obj.login_role,
            action='LOGIN',
            category='AUTHENTICATION',
            target_type='Authentication',
            target_id=login_obj.login_id,
            description=f"User {actor_display} ({login_obj.login_email}) logged in successfully.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Login successful.",
                "data": {
                    "login_id": login_obj.login_id,
                    "email": login_obj.login_email,
                    "role": login_obj.login_role,
                    "full_name": user_profile.user_full_name if user_profile else "User",
                    "designation": user_profile.user_designation if user_profile else "",
                    "company_id": user_profile.shipping_company_id_id if user_profile else None
                }
            },
            status=status.HTTP_200_OK
        )


class LogoutAPIView(APIView):
    """
    API Endpoint for User Logout and Session Termination.
    Endpoint: POST /api/auth/logout/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        actor_email = request.headers.get('X-User-Email') or (login_obj.login_email if login_obj else None)
        actor_role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else 'User')
        actor_name = (user_obj.user_full_name if user_obj else None) or actor_email or 'User'

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role=actor_role,
            action='LOGOUT',
            category='AUTHENTICATION',
            target_type='Authentication',
            target_id=login_obj.login_id if login_obj else None,
            description=f"User {actor_name} logged out.",
            status='SUCCESS',
            request=request
        )

        if hasattr(request, 'session'):
            request.session.flush()
        return Response(
            {
                "status": "success",
                "message": "Logged out successfully."
            },
            status=status.HTTP_200_OK
        )


class CurrentUserAPIView(APIView):
    """
    API Endpoint to retrieve current authenticated user session data.
    Endpoint: GET /api/auth/me/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        
        if not login_obj and hasattr(request, 'session') and 'login_id' in request.session:
            try:
                login_obj = Login.objects.get(login_id=request.session['login_id'])
                user_obj = getattr(login_obj, 'profile', None)
                company_obj = user_obj.shipping_company_id if user_obj else None
            except Login.DoesNotExist:
                pass

        if not login_obj or not login_obj.login_is_active:
            return Response(
                {
                    "status": "error",
                    "message": "Authentication required or session expired."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        return Response(
            {
                "status": "success",
                "message": "Authenticated user retrieved.",
                "data": {
                    "login_id": login_obj.login_id,
                    "email": login_obj.login_email,
                    "role": login_obj.login_role,
                    "full_name": user_obj.user_full_name if user_obj else "User",
                    "designation": user_obj.user_designation if user_obj else "",
                    "company_id": user_obj.shipping_company_id_id if user_obj else None,
                    "company_name": company_obj.shipping_company_name if company_obj else None,
                    "status": user_obj.user_status if user_obj else login_obj.login_status
                }
            },
            status=status.HTTP_200_OK
        )


class ShippingCompanyRegistrationAPIView(APIView):
    """
    Public API Endpoint for Shipping Company Applicant Registration.
    Endpoint: POST /api/auth/registration/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Registration validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        registration_obj = serializer.save()

        create_audit_log(
            user=None,
            actor_name=registration_obj.registration_request_applicant_name,
            role='Shipping Company',
            action='CREATE',
            category='SHIPPING_COMPANY',
            target_type='ShippingCompany',
            target_id=registration_obj.shipping_company_id.shipping_company_id,
            description=f"Shipping company registration submitted for '{registration_obj.shipping_company_id.shipping_company_name}'.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Registration request submitted successfully! Pending Port Administrator approval.",
                "data": {
                    "registration_request_id": registration_obj.registration_request_id,
                    "company_name": registration_obj.shipping_company_id.shipping_company_name,
                    "email": registration_obj.shipping_company_id.shipping_company_email,
                    "status": registration_obj.registration_request_status,
                    "submitted_at": registration_obj.registration_request_submitted_at
                }
            },
            status=status.HTTP_201_CREATED
        )


class AdminRegistrationRequestsAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to List and Retrieve Registration Requests.
    Endpoint: GET /api/admin/registration-requests/
    Endpoint: GET /api/admin/registration-requests/<id>/
    """
    permission_classes = [AllowAny]

    def get(self, request, pk=None):
        if pk:
            try:
                registration_request = RegistrationRequest.objects.get(registration_request_id=pk)
                serializer = RegistrationRequestDetailSerializer(registration_request)
                return Response({
                    "status": "success",
                    "data": serializer.data
                }, status=status.HTTP_200_OK)
            except RegistrationRequest.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": "Registration request not found."
                }, status=status.HTTP_404_NOT_FOUND)

        req_status = request.query_params.get('status')
        queryset = RegistrationRequest.objects.select_related('shipping_company_id').all().order_by('-registration_request_submitted_at')
        if req_status:
            queryset = queryset.filter(registration_request_status__iexact=req_status.strip())

        serializer = RegistrationRequestDetailSerializer(queryset, many=True)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class AdminApproveRegistrationRequestAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to Approve a Pending Registration Request.
    Endpoint: POST /api/admin/registration-requests/<id>/approve/
    """
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            req_obj = RegistrationRequest.objects.get(registration_request_id=pk)
        except RegistrationRequest.DoesNotExist:
            return Response({
                "status": "error",
                "message": "Registration request not found."
            }, status=status.HTTP_404_NOT_FOUND)

        if req_obj.registration_request_status == 'APPROVED':
            return Response({
                "status": "info",
                "message": "This registration request has already been approved."
            }, status=status.HTTP_200_OK)

        review_remarks = (request.data.get('review_remarks') or request.data.get('rejection_reason') or '').strip()

        admin_user = None
        user_id_header = request.headers.get('X-User-Id')
        if user_id_header:
            try:
                admin_user = User.objects.get(user_id=user_id_header)
            except (User.DoesNotExist, ValueError):
                pass

        with transaction.atomic():
            # 1. Update registration request status
            req_obj.registration_request_status = 'APPROVED'
            if review_remarks:
                req_obj.registration_request_rejection_reason = review_remarks
            req_obj.registration_request_reviewed_at = timezone.now()
            if admin_user:
                req_obj.user_id = admin_user
            req_obj.save()

            # 2. Update shipping company status -> ACTIVE
            company = req_obj.shipping_company_id
            if company:
                company.shipping_company_status = 'ACTIVE'
                company.save()

                # 3. Update associated user profiles & login credentials -> ACTIVE
                for user in company.users.all():
                    user.user_status = 'ACTIVE'
                    user.save()
                    if user.login_id:
                        user.login_id.login_status = 'ACTIVE'
                        user.login_id.login_is_active = True
                        user.login_id.save()

        create_audit_log(
            user=admin_user,
            actor_name=admin_user.user_full_name if admin_user else 'Port Administrator',
            role='Port Administrator',
            action='APPROVE',
            category='SHIPPING_COMPANY',
            target_type='ShippingCompany',
            target_id=company.shipping_company_id if company else req_obj.registration_request_id,
            description=f"Approved registration request #{req_obj.registration_request_id} for shipping company '{company.shipping_company_name if company else 'Unknown'}'.",
            status='SUCCESS',
            request=request
        )

        return Response({
            "status": "success",
            "message": "Shipping Company registration approved successfully."
        }, status=status.HTTP_200_OK)


class AdminRejectRegistrationRequestAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to Reject a Registration Request.
    Endpoint: POST /api/admin/registration-requests/<id>/reject/
    """
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            req_obj = RegistrationRequest.objects.get(registration_request_id=pk)
        except RegistrationRequest.DoesNotExist:
            return Response({
                "status": "error",
                "message": "Registration request not found."
            }, status=status.HTTP_404_NOT_FOUND)

        rejection_reason = (request.data.get('rejection_reason') or request.data.get('review_remarks') or '').strip()
        if not rejection_reason:
            return Response({
                "status": "error",
                "message": "Review remarks / rejection reason is required when rejecting a registration request."
            }, status=status.HTTP_400_BAD_REQUEST)

        admin_user = None
        user_id_header = request.headers.get('X-User-Id')
        if user_id_header:
            try:
                admin_user = User.objects.get(user_id=user_id_header)
            except (User.DoesNotExist, ValueError):
                pass

        with transaction.atomic():
            # 1. Update registration request status -> REJECTED
            req_obj.registration_request_status = 'REJECTED'
            req_obj.registration_request_rejection_reason = rejection_reason
            req_obj.registration_request_reviewed_at = timezone.now()
            if admin_user:
                req_obj.user_id = admin_user
            req_obj.save()

            # 2. Shipping company status MUST REMAIN PENDING (do NOT set to ACTIVE)
            company = req_obj.shipping_company_id
            if company:
                company.shipping_company_status = 'PENDING'
                company.save()

                # 3. Update associated user profiles & login credentials -> REJECTED
                for user in company.users.all():
                    user.user_status = 'REJECTED'
                    user.save()
                    if user.login_id:
                        user.login_id.login_status = 'REJECTED'
                        user.login_id.login_is_active = False
                        user.login_id.save()

        create_audit_log(
            user=admin_user,
            actor_name=admin_user.user_full_name if admin_user else 'Port Administrator',
            role='Port Administrator',
            action='REJECT',
            category='SHIPPING_COMPANY',
            target_type='ShippingCompany',
            target_id=company.shipping_company_id if company else req_obj.registration_request_id,
            description=f"Rejected registration request #{req_obj.registration_request_id} for shipping company '{company.shipping_company_name if company else 'Unknown'}'. Reason: {rejection_reason}",
            status='SUCCESS',
            request=request
        )

        return Response({
            "status": "success",
            "message": "Shipping Company registration rejected."
        }, status=status.HTTP_200_OK)


class ForgotPasswordAPIView(APIView):
    """
    Public API Endpoint to Request Password Reset Link.
    Endpoint: POST /api/auth/forgot-password
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Invalid email format.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data['email']
        GENERIC_SUCCESS_RESPONSE = Response(
            {
                "status": "success",
                "message": "If an account exists with this email, a password reset link has been sent."
            },
            status=status.HTTP_200_OK
        )

        try:
            login_obj = Login.objects.get(login_email__iexact=email)
        except Login.DoesNotExist:
            return GENERIC_SUCCESS_RESPONSE

        if not login_obj.login_is_active:
            return GENERIC_SUCCESS_RESPONSE

        # Invalidate any prior unused tokens for this user
        PasswordResetToken.objects.filter(login_id=login_obj, used_at__isnull=True).update(used_at=timezone.now())

        # Generate a cryptographically secure token & SHA-256 hash
        plain_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(plain_token.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + datetime.timedelta(minutes=30)

        PasswordResetToken.objects.create(
            login_id=login_obj,
            token_hash=token_hash,
            expires_at=expires_at
        )

        # Build secure password reset link
        reset_link = f"http://localhost:3000/?view=reset-password&token={plain_token}"

        # Email content
        subject = "Password Reset Request"
        email_body = f"""Someone requested a password reset for your account.
Click the button below to create a new password.
This link will expire in 30 minutes.

{reset_link}

If you did not request a password reset, please ignore this email.

Best regards,
PORTIDE Enterprise Platform
"""

        from_email = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER or 'webmaster@localhost'

        try:
            send_mail(
                subject,
                email_body,
                from_email,
                [login_obj.login_email],
                fail_silently=False
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"SMTP Email Delivery Failed for {login_obj.login_email}: {str(e)}", exc_info=True)
            print(f"\n==================================================")
            print(f"[SMTP EMAIL DELIVERY ERROR] {login_obj.login_email}: {str(e)}")
            print(f"==================================================\n")

            return Response(
                {
                    "status": "error",
                    "message": f"Failed to send email. SMTP Error: {str(e)}. Please configure EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in your .env file."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        create_audit_log(
            user=login_obj,
            actor_name=login_obj.login_email,
            role=login_obj.login_role,
            action='PASSWORD_RESET_REQUEST',
            category='AUTHENTICATION',
            target_type='User',
            target_id=login_obj.login_id,
            description=f"Password reset link requested for {login_obj.login_email}.",
            status='SUCCESS',
            request=request
        )

        return GENERIC_SUCCESS_RESPONSE


class ResetPasswordAPIView(APIView):
    """
    Public API Endpoint to Validate Token and Reset Password.
    Endpoints:
      - GET  /api/auth/reset-password?token=<TOKEN> (Validate token before showing form)
      - POST /api/auth/reset-password (Set new password with valid token)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Validate password reset token before allowing user to change password.
        """
        token = request.query_params.get('token', '').strip()
        if not token:
            return Response(
                {
                    "status": "error",
                    "message": "This password reset link is invalid or has expired."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

        try:
            token_obj = PasswordResetToken.objects.select_related('login_id').get(token_hash=token_hash)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "This password reset link is invalid or has expired."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not token_obj.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "This password reset link is invalid or has expired."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        login_obj = token_obj.login_id
        if not login_obj or not login_obj.login_is_active:
            return Response(
                {
                    "status": "error",
                    "message": "The associated user account is inactive or no longer exists."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "status": "success",
                "message": "Password reset token is valid."
            },
            status=status.HTTP_200_OK
        )

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = "Validation failed."
            if serializer.errors:
                first_key = next(iter(serializer.errors))
                val = serializer.errors[first_key]
                if isinstance(val, list) and len(val) > 0:
                    first_err = str(val[0])
                elif isinstance(val, str):
                    first_err = val
            return Response(
                {
                    "status": "error",
                    "message": first_err,
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        token = serializer.validated_data['token'].strip()
        new_password = serializer.validated_data['new_password']
        token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

        try:
            token_obj = PasswordResetToken.objects.select_related('login_id').get(token_hash=token_hash)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "This password reset link is invalid or has expired."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not token_obj.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "This password reset link is invalid or has expired."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        login_obj = token_obj.login_id
        if not login_obj or not login_obj.login_is_active:
            return Response(
                {
                    "status": "error",
                    "message": "The associated user account is inactive or no longer exists."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update login password securely with PBKDF2 hash
        login_obj.login_password = make_password(new_password)
        login_obj.save()

        # Mark token as used immediately
        token_obj.used_at = timezone.now()
        token_obj.save()

        create_audit_log(
            user=login_obj,
            actor_name=login_obj.login_email,
            role=login_obj.login_role,
            action='PASSWORD_RESET_SUCCESS',
            category='AUTHENTICATION',
            target_type='User',
            target_id=login_obj.login_id,
            description=f"Password successfully reset for {login_obj.login_email}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Your password has been reset successfully."
            },
            status=status.HTTP_200_OK
        )


class AdminCreateStaffAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to Create Internal Staff Accounts.
    Endpoint: POST /api/admin/users/staff/
    """
    permission_classes = [IsPortAdministrator]

    def post(self, request):
        serializer = CreateStaffSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Staff account validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user_obj = serializer.save()

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Administrator',
            role='Port Administrator',
            action='CREATE',
            category='USER_MANAGEMENT',
            target_type='User',
            target_id=user_obj.user_id,
            description=f"Created internal staff account for {user_obj.user_full_name} ({user_obj.login_id.login_email}) with role '{user_obj.login_id.login_role}'.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Internal staff account for {user_obj.user_full_name} created successfully.",
                "data": {
                    "user_id": user_obj.user_id,
                    "name": user_obj.user_full_name,
                    "email": user_obj.login_id.login_email,
                    "employee_id": user_obj.user_employee_id,
                    "department": user_obj.user_department,
                    "role": user_obj.login_id.login_role,
                    "status": user_obj.user_status,
                    "created_at": user_obj.user_created_at
                }
            },
            status=status.HTTP_201_CREATED
        )


class AdminListUsersAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to List All User Profiles.
    Endpoint: GET /api/admin/users/
    """
    permission_classes = [IsPortAdministrator]

    def get(self, request):
        role_filter = request.query_params.get('role')
        status_filter = request.query_params.get('status')

        queryset = User.objects.select_related('login_id', 'shipping_company_id').exclude(
            login_id__login_role__in=['port_administrator', 'administrator', 'admin']
        ).order_by('-user_created_at')

        if role_filter and role_filter.lower() != 'all':
            queryset = queryset.filter(login_id__login_role__iexact=role_filter.strip())

        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(user_status__iexact=status_filter.strip())

        serializer = UserDetailSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class AdminUserDetailAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to Delete Internal Staff Users.
    Endpoint: DELETE /api/admin/users/<int:pk>/
    """
    permission_classes = [IsPortAdministrator]

    def delete(self, request, pk):
        try:
            target_user = User.objects.select_related('login_id').get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "User profile not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, requesting_user, _ = get_authenticated_user_and_company(request)
        
        # Check 1: Port Administrator cannot delete their own account
        if requesting_user and requesting_user.user_id == target_user.user_id:
            return Response(
                {
                    "status": "error",
                    "message": "You cannot delete your own Port Administrator account."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        if login_obj and login_obj.login_id == target_user.login_id.login_id:
            return Response(
                {
                    "status": "error",
                    "message": "You cannot delete your own Port Administrator account."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check 2: Cannot delete any administrator account
        target_role = target_user.login_id.login_role.lower() if target_user.login_id else ''
        if target_role in ['port_administrator', 'administrator', 'admin']:
            return Response(
                {
                    "status": "error",
                    "message": "Administrator accounts cannot be deleted."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        del_name = target_user.user_full_name
        del_email = target_user.login_id.login_email if target_user.login_id else ''
        del_id = target_user.user_id

        with transaction.atomic():
            login_record = target_user.login_id
            target_user.delete()
            if login_record:
                login_record.delete()

        create_audit_log(
            user=requesting_user,
            actor_name=requesting_user.user_full_name if requesting_user else 'Port Administrator',
            role='Port Administrator',
            action='DELETE',
            category='USER_MANAGEMENT',
            target_type='User',
            target_id=del_id,
            description=f"Deleted user account {del_name} ({del_email}).",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "User deleted successfully."
            },
            status=status.HTTP_200_OK
        )

    def put(self, request, pk):
        return self._update_user(request, pk)

    def patch(self, request, pk):
        return self._update_user(request, pk)

    def _update_user(self, request, pk):
        try:
            target_user = User.objects.select_related('login_id').get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "User profile not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, requesting_user, _ = get_authenticated_user_and_company(request)

        # Port Administrator cannot edit their own account through User Management
        if requesting_user and requesting_user.user_id == target_user.user_id:
            return Response(
                {
                    "status": "error",
                    "message": "Port Administrator profile edits must be performed via Profile Settings."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        if login_obj and login_obj.login_id == target_user.login_id.login_id:
            return Response(
                {
                    "status": "error",
                    "message": "Port Administrator profile edits must be performed via Profile Settings."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cannot edit any administrator account
        target_role = target_user.login_id.login_role.lower() if target_user.login_id else ''
        if target_role in ['port_administrator', 'administrator', 'admin']:
            return Response(
                {
                    "status": "error",
                    "message": "Administrator accounts cannot be modified through user management."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = UpdateStaffUserSerializer(instance=target_user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "User update validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_user = serializer.save()
        detail_serializer = UserDetailSerializer(updated_user)

        create_audit_log(
            user=requesting_user,
            actor_name=requesting_user.user_full_name if requesting_user else 'Port Administrator',
            role='Port Administrator',
            action='UPDATE',
            category='USER_MANAGEMENT',
            target_type='User',
            target_id=updated_user.user_id,
            description=f"Updated user account for {updated_user.user_full_name} (Status: {updated_user.user_status}).",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "User information updated successfully.",
                "data": detail_serializer.data
            },
            status=status.HTTP_200_OK
        )


class ChangePasswordAPIView(APIView):
    """
    Authenticated API Endpoint for Logged-In Users/Staff to Change Their Password.
    Endpoint: POST /api/auth/change-password/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        email = request.data.get('email') or request.headers.get('X-User-Email')
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

        if not login_obj:
            return Response(
                {
                    "status": "error",
                    "message": "User account not identified. Please provide valid credentials."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        current_password = serializer.validated_data['current_password']
        new_password = serializer.validated_data['new_password']

        # 1. Verify current password
        if not check_password(current_password, login_obj.login_password):
            return Response(
                {
                    "status": "error",
                    "message": "Current password is incorrect."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Hash new password securely with PBKDF2
        login_obj.login_password = make_password(new_password)
        login_obj.save()

        create_audit_log(
            user=login_obj,
            actor_name=login_obj.login_email,
            role=login_obj.login_role,
            action='PASSWORD_CHANGE',
            category='AUTHENTICATION',
            target_type='User',
            target_id=login_obj.login_id,
            description=f"Password changed for user {login_obj.login_email}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Password changed successfully."
            },
            status=status.HTTP_200_OK
        )


class VesselListCreateAPIView(APIView):
    """
    API Endpoint for Vessel Management.
    GET: List vessels (Shipping Companies see only their own fleet; Admin/Ops Officer see all).
    POST: Register a new vessel for the authenticated Shipping Company.
    Endpoint: /api/vessels/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)

        queryset = Vessel.objects.select_related('vessel_shipping_company_id').all().order_by('-vessel_created_at')

        normalized_role = str(role).strip().lower() if role else ''
        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            if not company_obj:
                return Response(
                    {
                        "status": "error",
                        "message": "Shipping company profile not found."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            queryset = queryset.filter(vessel_shipping_company_id=company_obj)

        serializer = VesselSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def post(self, request):
        permission = IsActiveShippingCompany()
        if not permission.has_permission(request, self):
            return Response(
                {
                    "status": "error",
                    "message": "Only active shipping companies are authorized to register vessels."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not company_obj or company_obj.shipping_company_status != 'ACTIVE':
            return Response(
                {
                    "status": "error",
                    "message": "Your Shipping Company account must be ACTIVE to register vessels."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = VesselCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Vessel registration validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        vessel_obj = serializer.save(vessel_shipping_company_id=company_obj)
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name
        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='CREATE',
            category='VESSEL',
            target_type='Vessel',
            target_id=vessel_obj.vessel_id,
            description=f"Vessel '{vessel_obj.vessel_name}' (IMO: {vessel_obj.vessel_imo_number}) registered.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Vessel '{vessel_obj.vessel_name}' registered successfully.",
                "data": VesselSerializer(vessel_obj).data
            },
            status=status.HTTP_201_CREATED
        )


class VesselDetailAPIView(APIView):
    """
    API Endpoint for single Vessel Details and Updates.
    Endpoint: /api/vessels/<int:pk>/
    """
    permission_classes = [AllowAny]

    def get_object(self, pk):
        try:
            return Vessel.objects.select_related('vessel_shipping_company_id').get(pk=pk)
        except Vessel.DoesNotExist:
            return None

    def get(self, request, pk):
        vessel = self.get_object(pk)
        if not vessel:
            return Response(
                {
                    "status": "error",
                    "message": "Vessel not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to view another shipping company's vessel."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = VesselSerializer(vessel)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        vessel = self.get_object(pk)
        if not vessel:
            return Response(
                {
                    "status": "error",
                    "message": "Vessel not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        permission = IsActiveShippingCompany()
        if not permission.has_permission(request, self):
            return Response(
                {
                    "status": "error",
                    "message": "Only active shipping companies can update vessel details."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
            return Response(
                {
                    "status": "error",
                    "message": "You are not authorized to edit another shipping company's vessel."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = VesselUpdateSerializer(vessel, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Vessel update validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_vessel = serializer.save()
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name
        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='UPDATE',
            category='VESSEL',
            target_type='Vessel',
            target_id=updated_vessel.vessel_id,
            description=f"Vessel '{updated_vessel.vessel_name}' details updated.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Vessel details updated successfully.",
                "data": VesselSerializer(updated_vessel).data
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, pk):
        vessel = self.get_object(pk)
        if not vessel:
            return Response(
                {
                    "status": "error",
                    "message": "Vessel not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        permission = IsActiveShippingCompany()
        if not permission.has_permission(request, self):
            return Response(
                {
                    "status": "error",
                    "message": "Only active shipping companies are authorized to delete vessels."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
            return Response(
                {
                    "status": "error",
                    "message": "You are not authorized to delete another shipping company's vessel."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Check dependent operational records (arrival requests)
        has_arrival_requests = VesselArrivalRequest.objects.filter(
            vessel_arrival_request_vessel_id=vessel
        ).exists()

        if has_arrival_requests:
            return Response(
                {
                    "status": "error",
                    "message": "This vessel cannot be deleted because it has associated operational records or arrival requests."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        vessel_name = vessel.vessel_name
        vessel_imo = vessel.vessel_imo_number
        vessel_id_val = vessel.vessel_id
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name

        vessel.delete()

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='DELETE',
            category='VESSEL',
            target_type='Vessel',
            target_id=vessel_id_val,
            description=f"Vessel '{vessel_name}' (IMO: {vessel_imo}) deleted.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Vessel '{vessel_name}' deleted successfully."
            },
            status=status.HTTP_200_OK
        )


class ArrivalRequestListCreateAPIView(APIView):
    """
    API Endpoint for Vessel Arrival Request Management.
    GET: List arrival requests (Shipping Companies see requests for their fleet; Ops Officers see all).
    POST: Submit a new arrival request for an active vessel.
    Endpoint: /api/arrival-requests/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        status_filter = request.query_params.get('status')

        queryset = VesselArrivalRequest.objects.select_related(
            'vessel_arrival_request_vessel_id',
            'vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'vessel_arrival_request_preferred_berth_id',
            'vessel_arrival_request_reviewed_by',
            'schedule',
            'schedule__vessel_schedule_berth_id'
        ).all().order_by('-vessel_arrival_request_submitted_at')

        normalized_role = str(role).strip().lower() if role else ''
        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            if not company_obj:
                return Response(
                    {
                        "status": "error",
                        "message": "Shipping company profile not found."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            queryset = queryset.filter(vessel_arrival_request_vessel_id__vessel_shipping_company_id=company_obj)

        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(vessel_arrival_request_status__iexact=status_filter.strip())

        serializer = VesselArrivalRequestSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def post(self, request):
        permission = IsActiveShippingCompany()
        if not permission.has_permission(request, self):
            return Response(
                {
                    "status": "error",
                    "message": "Only active shipping companies are authorized to submit arrival requests."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not company_obj or company_obj.shipping_company_status != 'ACTIVE':
            return Response(
                {
                    "status": "error",
                    "message": "Your Shipping Company account must be ACTIVE to submit arrival requests."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = VesselArrivalRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Arrival request validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        vessel_obj = serializer.validated_data['vessel_arrival_request_vessel_id']
        if vessel_obj.vessel_shipping_company_id_id != company_obj.shipping_company_id:
            return Response(
                {
                    "status": "error",
                    "message": "You are not authorized to submit a request for this vessel."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        arrival_request = serializer.save(vessel_arrival_request_status='PENDING')
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name

        pref_berth = arrival_request.vessel_arrival_request_preferred_berth_id
        pref_desc = f" with preferred berth '{pref_berth.berth_name}'" if pref_berth else ""

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='CREATE',
            category='ARRIVAL_REQUEST',
            target_type='ArrivalRequest',
            target_id=arrival_request.vessel_arrival_request_id,
            description=f"Arrival request #{arrival_request.vessel_arrival_request_id} submitted for vessel '{vessel_obj.vessel_name}'{pref_desc}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Arrival request for vessel '{vessel_obj.vessel_name}' submitted successfully.",
                "data": VesselArrivalRequestSerializer(arrival_request).data
            },
            status=status.HTTP_201_CREATED
        )


class ArrivalRequestDetailAPIView(APIView):
    """
    API Endpoint for single Arrival Request Details.
    Endpoint: /api/arrival-requests/<int:pk>/
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            arrival_request = VesselArrivalRequest.objects.select_related(
                'vessel_arrival_request_vessel_id',
                'vessel_arrival_request_vessel_id__vessel_shipping_company_id',
                'vessel_arrival_request_preferred_berth_id',
                'vessel_arrival_request_reviewed_by'
            ).get(pk=pk)
        except VesselArrivalRequest.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "Arrival request not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = arrival_request.vessel_arrival_request_vessel_id
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to view another shipping company's arrival request."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = VesselArrivalRequestSerializer(arrival_request)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, pk):
        try:
            arrival_request = VesselArrivalRequest.objects.select_related(
                'vessel_arrival_request_vessel_id',
                'vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(pk=pk)
        except VesselArrivalRequest.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "Arrival request not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        permission = IsActiveShippingCompany()
        if not permission.has_permission(request, self):
            return Response(
                {
                    "status": "error",
                    "message": "Only active shipping companies are authorized to delete arrival requests."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        vessel = arrival_request.vessel_arrival_request_vessel_id
        if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
            return Response(
                {
                    "status": "error",
                    "message": "You are not authorized to delete another shipping company's arrival request."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Status check: Must be PENDING
        if arrival_request.vessel_arrival_request_status.upper() != 'PENDING':
            return Response(
                {
                    "status": "error",
                    "message": "Only pending arrival requests can be deleted."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        req_id_val = arrival_request.vessel_arrival_request_id
        v_name = vessel.vessel_name
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name

        arrival_request.delete()

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='DELETE',
            category='ARRIVAL_REQUEST',
            target_type='ArrivalRequest',
            target_id=req_id_val,
            description=f"Arrival request #{req_id_val} for vessel '{v_name}' deleted.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Arrival request deleted successfully."
            },
            status=status.HTTP_200_OK
        )


class ArrivalRequestApproveAPIView(APIView):
    """
    API Endpoint for Port Operations Officer to Approve Arrival Requests.
    Can approve preferred berth or assign an alternate berth, allocating schedule.
    Endpoint: POST /api/arrival-requests/<int:pk>/approve/
    """
    permission_classes = [IsPortOperationsOfficerOnly]

    def post(self, request, pk):
        try:
            arrival_request = VesselArrivalRequest.objects.select_related(
                'vessel_arrival_request_vessel_id',
                'vessel_arrival_request_preferred_berth_id'
            ).get(pk=pk)
        except VesselArrivalRequest.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "Arrival request not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        remarks = request.data.get('remarks') or request.data.get('operational_remarks')

        # Determine target berth: explicit berth_id from request payload, or preferred berth
        target_berth_id = request.data.get('berth_id') or request.data.get('vessel_schedule_berth_id')
        berth_obj = None

        if target_berth_id:
            try:
                berth_obj = Berth.objects.get(pk=target_berth_id)
            except (Berth.DoesNotExist, ValueError):
                return Response(
                    {
                        "status": "error",
                        "message": f"Berth #{target_berth_id} not found."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
        elif arrival_request.vessel_arrival_request_preferred_berth_id:
            berth_obj = arrival_request.vessel_arrival_request_preferred_berth_id

        # If a berth is being allocated upon approval
        if berth_obj:
            vessel_obj = arrival_request.vessel_arrival_request_vessel_id
            arr_time = arrival_request.vessel_arrival_request_requested_arrival_at
            dep_time = arrival_request.vessel_arrival_request_requested_departure_at

            if not berth_obj.berth_is_active or berth_obj.berth_status == 'INACTIVE':
                return Response(
                    {
                        "status": "error",
                        "message": f"{berth_obj.berth_name} is currently inactive and cannot be assigned."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if berth_obj.berth_status == 'MAINTENANCE':
                return Response(
                    {
                        "status": "error",
                        "message": f"{berth_obj.berth_name} is currently under maintenance and cannot be assigned."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if float(vessel_obj.vessel_length) > float(berth_obj.berth_max_length):
                return Response(
                    {
                        "status": "error",
                        "message": f"Berth allocation blocked: Vessel length ({vessel_obj.vessel_length}m) exceeds {berth_obj.berth_name} maximum length limit ({berth_obj.berth_max_length}m). Please select an alternative suitable berth."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if float(vessel_obj.vessel_draft) > float(berth_obj.berth_max_draft):
                return Response(
                    {
                        "status": "error",
                        "message": f"Berth allocation blocked: Vessel draft ({vessel_obj.vessel_draft}m) exceeds {berth_obj.berth_name} maximum draft limit ({berth_obj.berth_max_draft}m). Please select an alternative suitable berth."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Check for overlapping final/approved schedules on this berth
                overlapping_conflict = VesselSchedule.objects.select_for_update().filter(
                    vessel_schedule_berth_id=berth_obj,
                    vessel_schedule_status__in=['SCHEDULED', 'ARRIVED', 'AT_BERTH'],
                    vessel_schedule_scheduled_arrival_at__lt=dep_time,
                    vessel_schedule_scheduled_departure_at__gt=arr_time
                ).exclude(vessel_schedule_arrival_request_id=arrival_request).first()

                if overlapping_conflict:
                    conflicting_vessel_name = (
                        overlapping_conflict.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name
                        if overlapping_conflict.vessel_schedule_arrival_request_id else "another vessel"
                    )
                    return Response(
                        {
                            "status": "error",
                            "message": f"Berth availability has changed: {berth_obj.berth_name} is already allocated to an active schedule for '{conflicting_vessel_name}' during this timeframe. Please review the berth selection again."
                        },
                        status=status.HTTP_409_CONFLICT
                    )

                arrival_request.vessel_arrival_request_status = 'APPROVED'
                arrival_request.vessel_arrival_request_reviewed_at = timezone.now()
                arrival_request.vessel_arrival_request_reviewed_by = user_obj
                if remarks:
                    arrival_request.vessel_arrival_request_remarks = str(remarks).strip()
                arrival_request.save()

                # Create or update VesselSchedule
                schedule, created = VesselSchedule.objects.update_or_create(
                    vessel_schedule_arrival_request_id=arrival_request,
                    defaults={
                        'vessel_schedule_berth_id': berth_obj,
                        'vessel_schedule_scheduled_arrival_at': arr_time,
                        'vessel_schedule_scheduled_departure_at': dep_time,
                        'vessel_schedule_status': 'SCHEDULED',
                        'vessel_schedule_operational_remarks': str(remarks).strip() if remarks else f"Allocated to {berth_obj.berth_name}",
                        'vessel_schedule_created_by': user_obj
                    }
                )

                if berth_obj.berth_status == 'AVAILABLE':
                    berth_obj.berth_status = 'RESERVED'
                    berth_obj.save()
        else:
            arrival_request.vessel_arrival_request_status = 'APPROVED'
            arrival_request.vessel_arrival_request_reviewed_at = timezone.now()
            arrival_request.vessel_arrival_request_reviewed_by = user_obj
            if remarks:
                arrival_request.vessel_arrival_request_remarks = str(remarks).strip()
            arrival_request.save()

        reviewer_name = user_obj.user_full_name if user_obj else 'Port Operations Officer'
        alloc_detail = f" at berth '{berth_obj.berth_name}'" if berth_obj else ""
        create_audit_log(
            user=user_obj,
            actor_name=reviewer_name,
            role='Port Operations Officer',
            action='APPROVE',
            category='ARRIVAL_REQUEST',
            target_type='ArrivalRequest',
            target_id=arrival_request.vessel_arrival_request_id,
            description=f"Arrival request #{arrival_request.vessel_arrival_request_id} for vessel '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' approved{alloc_detail}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Arrival request #{arrival_request.vessel_arrival_request_id} for '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' approved successfully{alloc_detail}.",
                "data": VesselArrivalRequestSerializer(arrival_request).data
            },
            status=status.HTTP_200_OK
        )


class ArrivalRequestRejectAPIView(APIView):
    """
    API Endpoint for Port Operations Officer to Reject Arrival Requests with Operational Remarks.
    Endpoint: POST /api/arrival-requests/<int:pk>/reject/
    """
    permission_classes = [IsPortOperationsOfficerOnly]

    def post(self, request, pk):
        try:
            arrival_request = VesselArrivalRequest.objects.select_related(
                'vessel_arrival_request_vessel_id'
            ).get(pk=pk)
        except VesselArrivalRequest.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "Arrival request not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        remarks = request.data.get('remarks') or request.data.get('rejection_reason') or request.data.get('operational_remarks')
        if not remarks or not str(remarks).strip():
            return Response(
                {
                    "status": "error",
                    "message": "Rejection remarks/reason are required when rejecting an arrival request."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)

        arrival_request.vessel_arrival_request_status = 'REJECTED'
        arrival_request.vessel_arrival_request_remarks = str(remarks).strip()
        arrival_request.vessel_arrival_request_reviewed_at = timezone.now()
        arrival_request.vessel_arrival_request_reviewed_by = user_obj
        arrival_request.save()

        reviewer_name = user_obj.user_full_name if user_obj else 'Port Operations Officer'
        create_audit_log(
            user=user_obj,
            actor_name=reviewer_name,
            role='Port Operations Officer',
            action='REJECT',
            category='ARRIVAL_REQUEST',
            target_type='ArrivalRequest',
            target_id=arrival_request.vessel_arrival_request_id,
            description=f"Arrival request #{arrival_request.vessel_arrival_request_id} for vessel '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' rejected. Remarks: {remarks}",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Arrival request #{arrival_request.vessel_arrival_request_id} for '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' rejected.",
                "data": VesselArrivalRequestSerializer(arrival_request).data
            },
            status=status.HTTP_200_OK
        )


class BerthAvailabilityCheckAPIView(APIView):
    """
    API Endpoint to dynamically check Berth Suitability and Time Availability
    for a specific vessel and requested arrival/departure window.
    Endpoint: GET /api/berths/check-availability/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        vessel_id = request.query_params.get('vessel_id')
        arrival_str = request.query_params.get('arrival_at') or request.query_params.get('arrival')
        departure_str = request.query_params.get('departure_at') or request.query_params.get('departure')

        if not vessel_id or not arrival_str or not departure_str:
            return Response(
                {
                    "status": "error",
                    "message": "vessel_id, arrival_at (or arrival), and departure_at (or departure) are required query parameters."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Fetch and validate vessel
        try:
            vessel_obj = Vessel.objects.select_related('vessel_shipping_company_id').get(pk=vessel_id)
        except (Vessel.DoesNotExist, ValueError):
            return Response(
                {
                    "status": "error",
                    "message": f"Vessel #{vessel_id} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Check authorization if shipping company
        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            if not company_obj or vessel_obj.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to check berth availability for another company's vessel."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        # 2. Parse and validate time window
        from django.utils.dateparse import parse_datetime
        clean_arr = arrival_str.strip().replace(' ', '+')
        clean_dep = departure_str.strip().replace(' ', '+')
        arrival_dt = parse_datetime(clean_arr)
        departure_dt = parse_datetime(clean_dep)

        if not arrival_dt or not departure_dt:
            try:
                arrival_dt = datetime.datetime.fromisoformat(clean_arr.replace('Z', '+00:00'))
                departure_dt = datetime.datetime.fromisoformat(clean_dep.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                return Response(
                    {
                        "status": "error",
                        "message": "Invalid date format for arrival_at or departure_at. Expected ISO 8601 string."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        if timezone.is_naive(arrival_dt):
            arrival_dt = timezone.make_aware(arrival_dt)
        if timezone.is_naive(departure_dt):
            departure_dt = timezone.make_aware(departure_dt)

        if departure_dt <= arrival_dt:
            return Response(
                {
                    "status": "error",
                    "message": "Departure time must be later than arrival time."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        duration_seconds = (departure_dt - arrival_dt).total_seconds()
        if duration_seconds < 3600:
            return Response(
                {
                    "status": "error",
                    "message": "Departure must be at least 1 hour after arrival."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        duration_hours = round(duration_seconds / 3600.0, 2)

        # 3. Retrieve all active berths from PostgreSQL
        berths = Berth.objects.filter(berth_is_active=True).order_by('berth_id')

        # 4. Fetch all overlapping approved schedules across all berths in one query
        overlapping_schedules = VesselSchedule.objects.filter(
            vessel_schedule_status__in=['SCHEDULED', 'ARRIVED', 'AT_BERTH'],
            vessel_schedule_scheduled_arrival_at__lt=departure_dt,
            vessel_schedule_scheduled_departure_at__gt=arrival_dt
        ).select_related('vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id')

        schedule_map = {}
        for sch in overlapping_schedules:
            schedule_map[sch.vessel_schedule_berth_id_id] = sch

        # 5. Fetch all overlapping pending arrival requests
        overlapping_pending = VesselArrivalRequest.objects.filter(
            vessel_arrival_request_preferred_berth_id__isnull=False,
            vessel_arrival_request_status='PENDING',
            vessel_arrival_request_requested_arrival_at__lt=departure_dt,
            vessel_arrival_request_requested_departure_at__gt=arrival_dt
        ).values('vessel_arrival_request_preferred_berth_id').annotate(count=models.Count('vessel_arrival_request_id'))

        pending_count_map = {item['vessel_arrival_request_preferred_berth_id']: item['count'] for item in overlapping_pending}

        evaluations = []
        for berth in berths:
            is_length_compatible = float(vessel_obj.vessel_length) <= float(berth.berth_max_length)
            is_draft_compatible = float(vessel_obj.vessel_draft) <= float(berth.berth_max_draft)
            is_operational = (berth.berth_status != 'MAINTENANCE' and berth.berth_status != 'INACTIVE')

            conflicting_sch = schedule_map.get(berth.berth_id)
            has_approved_conflict = conflicting_sch is not None

            pending_count = pending_count_map.get(berth.berth_id, 0)
            has_pending_requests = pending_count > 0

            rejection_reasons = []
            if berth.berth_status == 'MAINTENANCE':
                rejection_reasons.append(f"{berth.berth_name} is currently under scheduled maintenance.")
            elif not is_operational:
                rejection_reasons.append(f"{berth.berth_name} is currently inactive.")

            if not is_length_compatible:
                diff_len = round(float(vessel_obj.vessel_length) - float(berth.berth_max_length), 2)
                rejection_reasons.append(f"Vessel length ({vessel_obj.vessel_length}m) exceeds berth limit ({berth.berth_max_length}m) by {diff_len}m.")

            if not is_draft_compatible:
                diff_draft = round(float(vessel_obj.vessel_draft) - float(berth.berth_max_draft), 2)
                rejection_reasons.append(f"Vessel draft ({vessel_obj.vessel_draft}m) exceeds berth draft limit ({berth.berth_max_draft}m) by {diff_draft}m.")

            if has_approved_conflict:
                sch_vessel_name = (
                    conflicting_sch.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name
                    if conflicting_sch.vessel_schedule_arrival_request_id else "another vessel"
                )
                rejection_reasons.append(f"Conflicting approved schedule with '{sch_vessel_name}'.")

            # Determine suitability_status
            if berth.berth_status == 'MAINTENANCE':
                suitability_status = 'MAINTENANCE'
            elif not is_operational:
                suitability_status = 'INACTIVE'
            elif not is_length_compatible or not is_draft_compatible:
                suitability_status = 'NOT_SUITABLE'
            elif has_approved_conflict:
                suitability_status = 'OCCUPIED'
            elif has_pending_requests:
                suitability_status = 'SUITABLE_PENDING'
            else:
                suitability_status = 'AVAILABLE'

            # Can be selected as preferred if physically compatible, operational, and no approved final conflict
            can_select_as_preferred = is_length_compatible and is_draft_compatible and is_operational and not has_approved_conflict

            conflicting_sch_info = None
            if conflicting_sch:
                conflicting_sch_info = {
                    "vessel_name": (
                        conflicting_sch.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name
                        if conflicting_sch.vessel_schedule_arrival_request_id else None
                    ),
                    "scheduled_arrival_at": conflicting_sch.vessel_schedule_scheduled_arrival_at.isoformat(),
                    "scheduled_departure_at": conflicting_sch.vessel_schedule_scheduled_departure_at.isoformat()
                }

            evaluations.append({
                "berth_id": berth.berth_id,
                "berth_name": berth.berth_name,
                "berth_code": berth.berth_code,
                "berth_type": berth.berth_type,
                "berth_type_display": berth.get_berth_type_display(),
                "berth_max_length": float(berth.berth_max_length),
                "berth_max_draft": float(berth.berth_max_draft),
                "berth_status": berth.berth_status,
                "berth_is_active": berth.berth_is_active,
                "is_length_compatible": is_length_compatible,
                "is_draft_compatible": is_draft_compatible,
                "is_operational": is_operational,
                "has_approved_conflict": has_approved_conflict,
                "has_pending_requests": has_pending_requests,
                "pending_request_count": pending_count,
                "suitability_status": suitability_status,
                "can_select_as_preferred": can_select_as_preferred,
                "rejection_reasons": rejection_reasons,
                "conflicting_schedule": conflicting_sch_info
            })

        return Response(
            {
                "status": "success",
                "data": {
                    "vessel": {
                        "vessel_id": vessel_obj.vessel_id,
                        "vessel_name": vessel_obj.vessel_name,
                        "vessel_imo_number": vessel_obj.vessel_imo_number,
                        "vessel_type": vessel_obj.vessel_type,
                        "vessel_length": float(vessel_obj.vessel_length),
                        "vessel_draft": float(vessel_obj.vessel_draft)
                    },
                    "requested_arrival_at": arrival_dt.isoformat(),
                    "requested_departure_at": departure_dt.isoformat(),
                    "duration_hours": duration_hours,
                    "berths": evaluations,
                    "evaluations": evaluations
                }
            },
            status=status.HTTP_200_OK
        )


class AdminBerthListCreateAPIView(APIView):
    """
    API Endpoint for Port Administrator to View All Berths and Create New Berth Master Infrastructure.
    Endpoint: GET /api/admin/berths/
              POST /api/admin/berths/
    """
    permission_classes = [IsPortAdministrator]

    def get(self, request):
        berths = Berth.objects.all().order_by('berth_id')
        serializer = BerthSerializer(berths, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def post(self, request):
        serializer = AdminBerthCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Berth master validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        berth_obj = serializer.save()

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Administrator',
            role='Port Administrator',
            action='CREATE',
            category='BERTH',
            target_type='Berth',
            target_id=berth_obj.berth_id,
            description=f"Berth '{berth_obj.berth_name}' configured in berth master.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Berth '{berth_obj.berth_name}' configured successfully.",
                "data": BerthSerializer(berth_obj).data
            },
            status=status.HTTP_201_CREATED
        )


class AdminBerthDetailAPIView(APIView):
    """
    API Endpoint for Port Administrator to Edit, View, Activate/Deactivate, or Delete a Berth.
    Endpoint: GET /api/admin/berths/<int:pk>/
              PUT /api/admin/berths/<int:pk>/
              PATCH /api/admin/berths/<int:pk>/
              DELETE /api/admin/berths/<int:pk>/
    """
    permission_classes = [IsPortAdministrator]

    def get_object(self, pk):
        try:
            return Berth.objects.get(pk=pk)
        except Berth.DoesNotExist:
            return None

    def get(self, request, pk):
        berth = self.get_object(pk)
        if not berth:
            return Response(
                {
                    "status": "error",
                    "message": f"Berth #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = BerthSerializer(berth)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        berth = self.get_object(pk)
        if not berth:
            return Response(
                {
                    "status": "error",
                    "message": f"Berth #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AdminBerthCreateUpdateSerializer(berth, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Berth configuration update failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_berth = serializer.save()

        # Sync status if berth_is_active toggled
        if updated_berth.berth_is_active is False and updated_berth.berth_status != 'INACTIVE':
            updated_berth.berth_status = 'INACTIVE'
            updated_berth.save()
        elif updated_berth.berth_is_active is True and updated_berth.berth_status == 'INACTIVE':
            updated_berth.berth_status = 'AVAILABLE'
            updated_berth.save()

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Administrator',
            role='Port Administrator',
            action='UPDATE',
            category='BERTH',
            target_type='Berth',
            target_id=updated_berth.berth_id,
            description=f"Berth '{updated_berth.berth_name}' configuration updated (Status: {updated_berth.berth_status}).",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Berth '{updated_berth.berth_name}' configuration updated successfully.",
                "data": BerthSerializer(updated_berth).data
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, pk):
        berth = self.get_object(pk)
        if not berth:
            return Response(
                {
                    "status": "error",
                    "message": f"Berth #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        has_schedules = VesselSchedule.objects.filter(vessel_schedule_berth_id=berth).exists()
        if has_schedules:
            return Response(
                {
                    "status": "error",
                    "message": f"Cannot permanently delete '{berth.berth_name}' because it has associated historical scheduling or vessel occupancy records. Please deactivate (INACTIVE) the berth instead to preserve historical log integrity."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        berth_name = berth.berth_name
        berth_id_val = berth.berth_id
        berth.delete()

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Administrator',
            role='Port Administrator',
            action='DELETE',
            category='BERTH',
            target_type='Berth',
            target_id=berth_id_val,
            description=f"Berth '{berth_name}' deleted.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Unused berth '{berth_name}' deleted successfully."
            },
            status=status.HTTP_200_OK
        )


class BerthListCreateAPIView(APIView):
    """
    API Endpoint for listing berths and creating berths.
    Seeds default berths (Berth 01 .. Berth 04) if table is empty.
    Endpoint: GET /api/berths/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if Berth.objects.count() == 0:
            default_berths = [
                {
                    'berth_name': 'Berth 01',
                    'berth_code': 'B-01',
                    'berth_type': 'CONTAINER_TERMINAL',
                    'berth_max_length': 350.00,
                    'berth_max_draft': 15.00,
                    'berth_status': 'AVAILABLE'
                },
                {
                    'berth_name': 'Berth 02',
                    'berth_code': 'B-02',
                    'berth_type': 'CONTAINER_TERMINAL',
                    'berth_max_length': 320.00,
                    'berth_max_draft': 14.50,
                    'berth_status': 'AVAILABLE'
                },
                {
                    'berth_name': 'Berth 03',
                    'berth_code': 'B-03',
                    'berth_type': 'BULK_CARGO',
                    'berth_max_length': 280.00,
                    'berth_max_draft': 14.00,
                    'berth_status': 'AVAILABLE'
                },
                {
                    'berth_name': 'Berth 04',
                    'berth_code': 'B-04',
                    'berth_type': 'OIL_TANKER',
                    'berth_max_length': 250.00,
                    'berth_max_draft': 13.50,
                    'berth_status': 'AVAILABLE'
                },
            ]
            for b_data in default_berths:
                Berth.objects.create(**b_data)

        berths = Berth.objects.all().order_by('berth_id')
        serializer = BerthSerializer(berths, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class BerthMaintenanceStatusAPIView(APIView):
    """
    API Endpoint for Port Operations Officers to toggle a Berth's MAINTENANCE status.
    Endpoint: PATCH /api/berths/<int:pk>/status/
    """
    permission_classes = [IsPortOperationsOfficerOnly]

    def patch(self, request, pk):
        return self.update_maintenance(request, pk)

    def post(self, request, pk):
        return self.update_maintenance(request, pk)

    def update_maintenance(self, request, pk):
        try:
            berth = Berth.objects.get(pk=pk)
        except Berth.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Berth #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        target_status = request.data.get('status') or request.data.get('berth_status')
        if not target_status:
            return Response(
                {
                    "status": "error",
                    "message": "Target berth status is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        target_status = str(target_status).strip().upper()
        if target_status not in ['MAINTENANCE', 'AVAILABLE']:
            return Response(
                {
                    "status": "error",
                    "message": "Status can only be set to MAINTENANCE or AVAILABLE via this endpoint."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if target_status == 'MAINTENANCE':
            has_occupied = VesselSchedule.objects.filter(
                vessel_schedule_berth_id=berth,
                vessel_schedule_status='AT_BERTH'
            ).exists()
            if has_occupied:
                return Response(
                    {
                        "status": "error",
                        "message": f"Cannot put {berth.berth_name} into maintenance while a vessel is currently AT BERTH."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            berth.berth_status = 'MAINTENANCE'
        else: # AVAILABLE
            has_at_berth = VesselSchedule.objects.filter(
                vessel_schedule_berth_id=berth,
                vessel_schedule_status='AT_BERTH'
            ).exists()
            has_reserved = VesselSchedule.objects.filter(
                vessel_schedule_berth_id=berth,
                vessel_schedule_status__in=['SCHEDULED', 'ARRIVED']
            ).exists()

            if has_at_berth:
                berth.berth_status = 'OCCUPIED'
            elif has_reserved:
                berth.berth_status = 'RESERVED'
            else:
                berth.berth_status = 'AVAILABLE'

        berth.save()

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Operations Officer',
            role='Port Operations Officer',
            action='STATUS_CHANGE',
            category='BERTH',
            target_type='Berth',
            target_id=berth.berth_id,
            description=f"Berth '{berth.berth_name}' status updated to {berth.berth_status}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"{berth.berth_name} status updated to {berth.berth_status}.",
                "data": BerthSerializer(berth).data
            },
            status=status.HTTP_200_OK
        )


class VesselScheduleListCreateAPIView(APIView):
    """
    API Endpoint for Port Operations Officer to create and view Berth/Vessel Schedules.
    Endpoints:
      GET /api/schedules/
      POST /api/schedules/
    """
    permission_classes = [IsPortOperationsOfficerOnly]

    def get(self, request):
        schedules = VesselSchedule.objects.select_related(
            'vessel_schedule_arrival_request_id',
            'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
            'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'vessel_schedule_berth_id',
            'vessel_schedule_created_by'
        ).all().order_by('-vessel_schedule_created_at')

        serializer = VesselScheduleSerializer(schedules, many=True)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def post(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)

        request_id = request.data.get('vessel_arrival_request_id') or request.data.get('arrival_request_id')
        berth_id = request.data.get('berth_id') or request.data.get('vessel_schedule_berth_id')
        scheduled_arrival = request.data.get('scheduled_arrival_at') or request.data.get('vessel_schedule_scheduled_arrival_at')
        scheduled_departure = request.data.get('scheduled_departure_at') or request.data.get('vessel_schedule_scheduled_departure_at')
        remarks = request.data.get('operational_remarks') or request.data.get('vessel_schedule_operational_remarks') or ''

        if not request_id or not berth_id or not scheduled_arrival or not scheduled_departure:
            return Response(
                {
                    "status": "error",
                    "message": "vessel_arrival_request_id, berth_id, scheduled_arrival_at, and scheduled_departure_at are required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Fetch arrival request & verify APPROVED status
        try:
            arrival_request = VesselArrivalRequest.objects.select_related(
                'vessel_arrival_request_vessel_id'
            ).get(pk=request_id)
        except VesselArrivalRequest.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Arrival request #{request_id} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if arrival_request.vessel_arrival_request_status != 'APPROVED':
            return Response(
                {
                    "status": "error",
                    "message": "Only APPROVED arrival requests can be scheduled for port operations."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Check duplicate schedule
        if hasattr(arrival_request, 'schedule') and arrival_request.schedule:
            return Response(
                {
                    "status": "error",
                    "message": f"Arrival request #{request_id} has already been scheduled."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Parse & validate dates
        try:
            if isinstance(scheduled_arrival, str):
                arrival_dt = timezone.datetime.fromisoformat(scheduled_arrival.replace('Z', '+00:00'))
            else:
                arrival_dt = scheduled_arrival

            if isinstance(scheduled_departure, str):
                departure_dt = timezone.datetime.fromisoformat(scheduled_departure.replace('Z', '+00:00'))
            else:
                departure_dt = scheduled_departure
        except ValueError:
            return Response(
                {
                    "status": "error",
                    "message": "Invalid date format for scheduled arrival or departure time."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if timezone.is_naive(arrival_dt):
            arrival_dt = timezone.make_aware(arrival_dt)
        if timezone.is_naive(departure_dt):
            departure_dt = timezone.make_aware(departure_dt)

        if departure_dt <= arrival_dt:
            return Response(
                {
                    "status": "error",
                    "message": "Scheduled departure time cannot be earlier than or equal to scheduled arrival time."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Fetch Berth & check availability
        try:
            berth_obj = Berth.objects.get(pk=berth_id)
        except Berth.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Berth #{berth_id} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if berth_obj.berth_status == 'MAINTENANCE':
            return Response(
                {
                    "status": "error",
                    "message": f"{berth_obj.berth_name} is currently under maintenance and cannot be assigned."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 5. Overlapping schedule validation on the same berth
        overlapping = VesselSchedule.objects.filter(
            vessel_schedule_berth_id=berth_obj,
            vessel_schedule_status__in=['SCHEDULED', 'ARRIVED', 'AT_BERTH'],
            vessel_schedule_scheduled_arrival_at__lt=departure_dt,
            vessel_schedule_scheduled_departure_at__gt=arrival_dt
        ).exists()

        if overlapping:
            return Response(
                {
                    "status": "error",
                    "message": f"{berth_obj.berth_name} is already reserved for an overlapping vessel schedule during this timeframe."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 6. Create schedule
        schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=arrival_request,
            vessel_schedule_berth_id=berth_obj,
            vessel_schedule_scheduled_arrival_at=arrival_dt,
            vessel_schedule_scheduled_departure_at=departure_dt,
            vessel_schedule_status='SCHEDULED',
            vessel_schedule_operational_remarks=str(remarks).strip(),
            vessel_schedule_created_by=user_obj
        )

        # Update berth status to RESERVED if not occupied or in maintenance
        if berth_obj.berth_status not in ['MAINTENANCE', 'OCCUPIED']:
            berth_obj.berth_status = 'RESERVED'
            berth_obj.save()

        actor_name = user_obj.user_full_name if user_obj else 'Port Operations Officer'
        create_audit_log(
            user=user_obj,
            actor_name=actor_name,
            role='Port Operations Officer',
            action='CREATE',
            category='BERTH',
            target_type='VesselSchedule',
            target_id=schedule.vessel_schedule_id,
            description=f"Schedule created for vessel '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' at berth '{berth_obj.berth_name}'.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Schedule created successfully for Vessel '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' at {berth_obj.berth_name}.",
                "data": VesselScheduleSerializer(schedule).data
            },
            status=status.HTTP_201_CREATED
        )


class VesselScheduleUpdateStatusAPIView(APIView):
    """
    API Endpoint for Port Operations Officer to update vessel operational status.
    Enforces valid sequence: SCHEDULED -> ARRIVED -> AT_BERTH -> DEPARTED
    Endpoint: PATCH /api/schedules/<int:pk>/status/
    """
    permission_classes = [IsPortOperationsOfficerOnly]

    VALID_TRANSITIONS = {
        'SCHEDULED': ['ARRIVED'],
        'ARRIVED': ['AT_BERTH'],
        'AT_BERTH': ['DEPARTED'],
        'DEPARTED': []
    }

    def patch(self, request, pk):
        return self.update_status(request, pk)

    def post(self, request, pk):
        return self.update_status(request, pk)

    def update_status(self, request, pk):
        try:
            schedule = VesselSchedule.objects.select_related(
                'vessel_schedule_berth_id',
                'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id'
            ).get(pk=pk)
        except VesselSchedule.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Vessel schedule #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        new_status = request.data.get('status') or request.data.get('vessel_schedule_status')
        if not new_status:
            return Response(
                {
                    "status": "error",
                    "message": "Target status is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = str(new_status).strip().upper()
        current_status = schedule.vessel_schedule_status.upper()

        allowed_next = self.VALID_TRANSITIONS.get(current_status, [])

        if new_status not in allowed_next:
            readable_current = current_status.replace('_', ' ')
            readable_new = new_status.replace('_', ' ')
            return Response(
                {
                    "status": "error",
                    "message": f"Invalid status transition from '{readable_current}' to '{readable_new}'. Allowed sequence is SCHEDULED -> ARRIVED -> AT BERTH -> DEPARTED."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()

        # Update schedule status and operational timestamps
        schedule.vessel_schedule_status = new_status
        if new_status == 'ARRIVED':
            if not schedule.vessel_schedule_actual_arrival_at:
                schedule.vessel_schedule_actual_arrival_at = now
        elif new_status == 'AT_BERTH':
            if not schedule.vessel_schedule_actual_at_berth_at:
                schedule.vessel_schedule_actual_at_berth_at = now
        elif new_status == 'DEPARTED':
            if not schedule.vessel_schedule_actual_departure_at:
                schedule.vessel_schedule_actual_departure_at = now

        remarks = request.data.get('operational_remarks') or request.data.get('remarks')
        if remarks:
            schedule.vessel_schedule_operational_remarks = str(remarks).strip()

        schedule.save()

        # Berth status management:
        berth = schedule.vessel_schedule_berth_id
        if new_status == 'ARRIVED':
            if berth.berth_status not in ['MAINTENANCE', 'OCCUPIED']:
                berth.berth_status = 'RESERVED'
                berth.save()
        elif new_status == 'AT_BERTH':
            berth.berth_status = 'OCCUPIED'
            berth.save()
        elif new_status == 'DEPARTED':
            has_at_berth = VesselSchedule.objects.filter(
                vessel_schedule_berth_id=berth,
                vessel_schedule_status='AT_BERTH'
            ).exclude(pk=schedule.pk).exists()

            if has_at_berth:
                berth.berth_status = 'OCCUPIED'
            else:
                has_reserved = VesselSchedule.objects.filter(
                    vessel_schedule_berth_id=berth,
                    vessel_schedule_status__in=['SCHEDULED', 'ARRIVED']
                ).exclude(pk=schedule.pk).exists()

                if has_reserved:
                    berth.berth_status = 'RESERVED'
                elif berth.berth_status != 'MAINTENANCE':
                    berth.berth_status = 'AVAILABLE'
            berth.save()

        vessel_name = schedule.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id.vessel_name

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Operations Officer',
            role='Port Operations Officer',
            action='STATUS_CHANGE',
            category='BERTH',
            target_type='VesselSchedule',
            target_id=schedule.vessel_schedule_id,
            description=f"Operational status for vessel '{vessel_name}' schedule #{schedule.vessel_schedule_id} updated to {new_status}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Operational status for vessel '{vessel_name}' updated to {new_status.replace('_', ' ')}.",
                "data": VesselScheduleSerializer(schedule).data
            },
            status=status.HTTP_200_OK
        )


class PortSettingsAPIView(APIView):
    """
    Port Settings API:
    - GET: Retrieves public system settings including minimum advance arrival booking days and port timezone.
    - PATCH: Allows Port Administrator to update settings.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        min_days = get_min_arrival_advance_days()
        now_local = timezone.localtime(timezone.now())
        return Response(
            {
                "status": "success",
                "data": {
                    "min_arrival_advance_days": min_days,
                    "port_timezone": str(timezone.get_current_timezone_name()),
                    "server_current_time": now_local.isoformat(),
                    "server_today_date": now_local.date().isoformat()
                }
            },
            status=status.HTTP_200_OK
        )

    def patch(self, request):
        role = request.headers.get('X-User-Role')
        if role != 'port_administrator':
            return Response(
                {
                    "status": "error",
                    "message": "Only Port Administrators are authorized to update system settings."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        min_days = request.data.get('min_arrival_advance_days')
        if min_days is not None:
            try:
                min_days_val = int(min_days)
                if min_days_val < 0:
                    return Response(
                        {
                            "status": "error",
                            "message": "min_arrival_advance_days must be a non-negative integer."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                setting, _ = SystemSetting.objects.get_or_create(
                    system_setting_key='MIN_ARRIVAL_ADVANCE_DAYS',
                    defaults={'system_setting_description': 'Minimum advance days required for vessel arrival requests.'}
                )
                setting.system_setting_value = str(min_days_val)
                setting.save()
            except (ValueError, TypeError):
                return Response(
                    {
                        "status": "error",
                        "message": "Invalid integer value for min_arrival_advance_days."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        return self.get(request)


class AuditLogListAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to View, Search, Filter, and Paginate System Audit Logs.
    Endpoint: GET /api/audit-logs/
    """
    permission_classes = [IsPortAdministrator]

    def get(self, request):
        search_query = request.query_params.get('search', '').strip()
        category_filter = request.query_params.get('category', '').strip()
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 15)

        try:
            page = max(1, int(page))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = max(1, min(100, int(page_size)))
        except (ValueError, TypeError):
            page_size = 15

        queryset = AuditLog.objects.select_related(
            'audit_log_user_id',
            'audit_log_user_id__login_id'
        ).all().order_by('-audit_log_timestamp', '-audit_log_id')

        # Category filtering
        if category_filter and category_filter.lower() != 'all':
            category_mapping = {
                'auth': 'AUTHENTICATION',
                'authentication': 'AUTHENTICATION',
                'user': 'USER_MANAGEMENT',
                'user_management': 'USER_MANAGEMENT',
                'shipping': 'SHIPPING_COMPANY',
                'shipping_company': 'SHIPPING_COMPANY',
                'vessel': 'VESSEL',
                'arrival_request': 'ARRIVAL_REQUEST',
                'arrival': 'ARRIVAL_REQUEST',
                'berth': 'BERTH',
                'customs': 'CUSTOMS',
                'gate': 'GATE_OPERATIONS',
                'gate_operations': 'GATE_OPERATIONS',
                'system': 'SYSTEM'
            }
            normalized_cat = category_mapping.get(category_filter.lower(), category_filter.upper())
            queryset = queryset.filter(audit_log_category__iexact=normalized_cat)

        # Search filtering
        if search_query:
            from django.db.models import Q
            q_filter = (
                Q(audit_log_actor_name__icontains=search_query) |
                Q(audit_log_user_id__user_full_name__icontains=search_query) |
                Q(audit_log_user_id__login_id__login_email__icontains=search_query) |
                Q(audit_log_role__icontains=search_query) |
                Q(audit_log_action__icontains=search_query) |
                Q(audit_log_category__icontains=search_query) |
                Q(audit_log_target_type__icontains=search_query) |
                Q(audit_log_target_id__icontains=search_query) |
                Q(audit_log_description__icontains=search_query) |
                Q(audit_log_status__icontains=search_query) |
                Q(audit_log_ip_address__icontains=search_query)
            )
            queryset = queryset.filter(q_filter)

        total_count = queryset.count()
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

        offset = (page - 1) * page_size
        paged_records = queryset[offset:offset + page_size]

        serializer = AuditLogSerializer(paged_records, many=True)

        return Response(
            {
                "status": "success",
                "data": {
                    "total_count": total_count,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_previous": page > 1,
                    "results": serializer.data
                }
            },
            status=status.HTTP_200_OK
        )









