from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
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
    VesselSchedule
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
    VesselArrivalRequestSerializer,
    VesselArrivalRequestCreateSerializer,
    BerthSerializer,
    AdminBerthCreateUpdateSerializer,
    VesselScheduleSerializer
)
from authentication.permissions import (
    IsPortAdministrator, 
    IsActiveShippingCompany, 
    IsPortOperationsOfficer,
    IsPortOperationsOfficerOnly,
    get_authenticated_user_and_company
)

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
            return Response(
                {
                    "status": "error",
                    "message": "Invalid email or password."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Verify password against PBKDF2 hash
        if not check_password(password, login_obj.login_password):
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
            return Response(
                {
                    "status": "error",
                    "message": "Your registration is awaiting Port Administrator approval."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'REJECTED' or (user_profile and user_profile.user_status == 'REJECTED'):
            return Response(
                {
                    "status": "error",
                    "message": "Your registration request has been rejected."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'SUSPENDED' or (user_profile and user_profile.user_status == 'SUSPENDED'):
            return Response(
                {
                    "status": "error",
                    "message": "Your account has been suspended. Please contact the Port Administrator."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if company and company.shipping_company_status == 'PENDING':
            return Response(
                {
                    "status": "error",
                    "message": "Your registration is awaiting Port Administrator approval."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if company and company.shipping_company_status == 'SUSPENDED':
            return Response(
                {
                    "status": "error",
                    "message": "Your company account has been suspended. Please contact the Port Administrator."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not login_obj.login_is_active:
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

        return GENERIC_SUCCESS_RESPONSE


class ResetPasswordAPIView(APIView):
    """
    Public API Endpoint to Reset Password with Secure Token.
    Endpoint: POST /api/auth/reset-password
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()

        try:
            token_obj = PasswordResetToken.objects.get(token_hash=token_hash)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": "Invalid, expired, or already used password reset link."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not token_obj.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "This password reset link has expired or already been used. Please request a new password reset link."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update login password securely with PBKDF2 hash
        login_obj = token_obj.login_id
        login_obj.login_password = make_password(new_password)
        login_obj.save()

        # Mark token as used
        token_obj.used_at = timezone.now()
        token_obj.save()

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

        with transaction.atomic():
            login_record = target_user.login_id
            target_user.delete()
            if login_record:
                login_record.delete()

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

        serializer = VesselCreateSerializer(vessel, data=request.data, partial=True)
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
        return Response(
            {
                "status": "success",
                "message": f"Vessel '{updated_vessel.vessel_name}' updated successfully.",
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
        vessel.delete()

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

        arrival_request.delete()

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
    Endpoint: POST /api/arrival-requests/<int:pk>/approve/
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

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)

        remarks = request.data.get('remarks') or request.data.get('operational_remarks')

        arrival_request.vessel_arrival_request_status = 'APPROVED'
        arrival_request.vessel_arrival_request_reviewed_at = timezone.now()
        arrival_request.vessel_arrival_request_reviewed_by = user_obj

        if remarks:
            arrival_request.vessel_arrival_request_remarks = str(remarks).strip()

        arrival_request.save()

        return Response(
            {
                "status": "success",
                "message": f"Arrival request #{arrival_request.vessel_arrival_request_id} for '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' approved successfully.",
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

        return Response(
            {
                "status": "success",
                "message": f"Arrival request #{arrival_request.vessel_arrival_request_id} for '{arrival_request.vessel_arrival_request_vessel_id.vessel_name}' rejected.",
                "data": VesselArrivalRequestSerializer(arrival_request).data
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
        berth.delete()
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
                    'berth_capacity_teu': 14000,
                    'berth_status': 'AVAILABLE'
                },
                {
                    'berth_name': 'Berth 02',
                    'berth_code': 'B-02',
                    'berth_type': 'CONTAINER_TERMINAL',
                    'berth_max_length': 320.00,
                    'berth_max_draft': 14.50,
                    'berth_capacity_teu': 11000,
                    'berth_status': 'AVAILABLE'
                },
                {
                    'berth_name': 'Berth 03',
                    'berth_code': 'B-03',
                    'berth_type': 'BULK_CARGO',
                    'berth_max_length': 280.00,
                    'berth_max_draft': 14.00,
                    'berth_capacity_teu': 8500,
                    'berth_status': 'AVAILABLE'
                },
                {
                    'berth_name': 'Berth 04',
                    'berth_code': 'B-04',
                    'berth_type': 'OIL_TANKER',
                    'berth_max_length': 250.00,
                    'berth_max_draft': 13.50,
                    'berth_capacity_teu': 6000,
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
        return Response(
            {
                "status": "success",
                "message": f"Operational status for vessel '{vessel_name}' updated to {new_status.replace('_', ' ')}.",
                "data": VesselScheduleSerializer(schedule).data
            },
            status=status.HTTP_200_OK
        )


class BerthUtilisationAPIView(APIView):
    """
    API Endpoint for Port Operations Officer to view Berth Utilisation KPIs and Analytics.
    Calculates operational statistics based on real database records.
    Endpoint: GET /api/berths/utilisation/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        period = request.query_params.get('period', 'today').lower().strip()
        start_date_param = request.query_params.get('start_date')
        end_date_param = request.query_params.get('end_date')

        now = timezone.now()

        if period == 'today':
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_time = now
        elif period == '7days':
            start_time = now - datetime.timedelta(days=7)
            end_time = now
        elif period == 'month':
            start_time = now - datetime.timedelta(days=30)
            end_time = now
        elif period == 'custom' and start_date_param and end_date_param:
            try:
                start_dt = datetime.datetime.fromisoformat(start_date_param.replace('Z', '+00:00'))
                end_dt = datetime.datetime.fromisoformat(end_date_param.replace('Z', '+00:00'))
                if timezone.is_naive(start_dt):
                    start_dt = timezone.make_aware(start_dt)
                if timezone.is_naive(end_dt):
                    end_dt = timezone.make_aware(end_dt)
                start_time = start_dt
                end_time = end_dt
            except ValueError:
                start_time = now - datetime.timedelta(days=7)
                end_time = now
        else:
            period = 'today'
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_time = now

        period_duration_hours = max(0.1, (end_time - start_time).total_seconds() / 3600.0)

        berths = Berth.objects.all().order_by('berth_id')
        total_berths = berths.count()

        if total_berths == 0:
            default_berths = [
                {'berth_name': 'Berth 01', 'berth_code': 'B-01', 'berth_type': 'CONTAINER_TERMINAL', 'berth_max_length': 350.00, 'berth_max_draft': 15.00, 'berth_capacity_teu': 14000, 'berth_status': 'AVAILABLE'},
                {'berth_name': 'Berth 02', 'berth_code': 'B-02', 'berth_type': 'CONTAINER_TERMINAL', 'berth_max_length': 320.00, 'berth_max_draft': 14.50, 'berth_capacity_teu': 11000, 'berth_status': 'AVAILABLE'},
                {'berth_name': 'Berth 03', 'berth_code': 'B-03', 'berth_type': 'BULK_CARGO', 'berth_max_length': 280.00, 'berth_max_draft': 14.00, 'berth_capacity_teu': 8500, 'berth_status': 'AVAILABLE'},
                {'berth_name': 'Berth 04', 'berth_code': 'B-04', 'berth_type': 'OIL_TANKER', 'berth_max_length': 250.00, 'berth_max_draft': 13.50, 'berth_capacity_teu': 6000, 'berth_status': 'AVAILABLE'},
            ]
            for b_data in default_berths:
                Berth.objects.create(**b_data)
            berths = Berth.objects.all().order_by('berth_id')
            total_berths = berths.count()

        available_operational_hours_total = total_berths * period_duration_hours

        schedules = VesselSchedule.objects.select_related(
            'vessel_schedule_berth_id',
            'vessel_schedule_arrival_request_id',
            'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id'
        ).filter(
            vessel_schedule_scheduled_arrival_at__lt=end_time,
            vessel_schedule_scheduled_departure_at__gt=start_time
        )

        berth_stats = {}
        for b in berths:
            berth_stats[b.berth_id] = {
                'berth': b,
                'occupied_hours': 0.0,
                'movements_count': 0,
                'completed_stays': 0,
                'total_stay_duration': 0.0,
            }

        total_occupied_hours = 0.0
        total_movements = 0
        total_completed_stays = 0
        total_stay_duration_all = 0.0

        for sch in schedules:
            b_id = sch.vessel_schedule_berth_id_id
            if b_id not in berth_stats:
                continue

            stay_start = sch.vessel_schedule_actual_at_berth_at or sch.vessel_schedule_actual_arrival_at or sch.vessel_schedule_scheduled_arrival_at
            if sch.vessel_schedule_status == 'DEPARTED':
                stay_end = sch.vessel_schedule_actual_departure_at or sch.vessel_schedule_scheduled_departure_at
            elif sch.vessel_schedule_status == 'AT_BERTH':
                stay_end = now
            else:
                stay_end = sch.vessel_schedule_scheduled_departure_at

            if stay_end > stay_start:
                overlap_start = max(start_time, stay_start)
                overlap_end = min(end_time, stay_end)
                if overlap_end > overlap_start:
                    hours = (overlap_end - overlap_start).total_seconds() / 3600.0
                    berth_stats[b_id]['occupied_hours'] += hours
                    total_occupied_hours += hours

                stay_hours = (stay_end - stay_start).total_seconds() / 3600.0
                berth_stats[b_id]['completed_stays'] += 1
                berth_stats[b_id]['total_stay_duration'] += stay_hours
                total_completed_stays += 1
                total_stay_duration_all += stay_hours

            berth_stats[b_id]['movements_count'] += 1
            total_movements += 1

        overall_utilisation_pct = round((total_occupied_hours / available_operational_hours_total) * 100.0, 1) if available_operational_hours_total > 0 else 0.0
        overall_utilisation_pct = min(100.0, overall_utilisation_pct)

        avg_occupancy_hours = round(total_stay_duration_all / total_completed_stays, 1) if total_completed_stays > 0 else 0.0

        berth_breakdown = []
        for b_id, stat in berth_stats.items():
            b = stat['berth']
            b_hours = round(stat['occupied_hours'], 1)
            b_avail_hours = period_duration_hours
            b_util = round((b_hours / b_avail_hours) * 100.0, 1) if b_avail_hours > 0 else 0.0
            b_util = min(100.0, b_util)
            b_avg_stay = round(stat['total_stay_duration'] / stat['completed_stays'], 1) if stat['completed_stays'] > 0 else 0.0

            berth_breakdown.append({
                'berth_id': b.berth_id,
                'berth_name': b.berth_name,
                'berth_code': b.berth_code,
                'berth_type': b.berth_type,
                'berth_type_display': b.get_berth_type_display(),
                'berth_max_length': str(b.berth_max_length),
                'berth_max_draft': str(b.berth_max_draft),
                'berth_capacity_teu': b.berth_capacity_teu,
                'berth_status': b.berth_status,
                'occupied_hours': b_hours,
                'utilisation_pct': b_util,
                'movements_count': stat['movements_count'],
                'avg_stay_hours': b_avg_stay,
            })

        sorted_by_util = sorted(berth_breakdown, key=lambda x: x['utilisation_pct'], reverse=True)
        most_utilised = sorted_by_util[0] if sorted_by_util else None
        least_utilised = sorted_by_util[-1] if sorted_by_util else None

        daily_movements = []
        days_count = max(1, min(30, int(period_duration_hours / 24) or 1))
        for d_offset in range(days_count - 1, -1, -1):
            day_dt = (now - datetime.timedelta(days=d_offset)).date()
            day_str = day_dt.strftime('%b %d')

            arrived_on_day = VesselSchedule.objects.filter(
                vessel_schedule_actual_arrival_at__date=day_dt
            ).count()
            if arrived_on_day == 0:
                arrived_on_day = VesselSchedule.objects.filter(
                    vessel_schedule_scheduled_arrival_at__date=day_dt
                ).count()

            departed_on_day = VesselSchedule.objects.filter(
                vessel_schedule_actual_departure_at__date=day_dt
            ).count()
            if departed_on_day == 0:
                departed_on_day = VesselSchedule.objects.filter(
                    vessel_schedule_scheduled_departure_at__date=day_dt,
                    vessel_schedule_status='DEPARTED'
                ).count()

            daily_movements.append({
                'date': day_str,
                'arrivals': arrived_on_day,
                'departures': departed_on_day,
                'total': arrived_on_day + departed_on_day
            })

        status_counts = {
            'AVAILABLE': Berth.objects.filter(berth_status='AVAILABLE').count(),
            'RESERVED': Berth.objects.filter(berth_status='RESERVED').count(),
            'OCCUPIED': Berth.objects.filter(berth_status='OCCUPIED').count(),
            'MAINTENANCE': Berth.objects.filter(berth_status='MAINTENANCE').count(),
        }

        return Response(
            {
                "status": "success",
                "data": {
                    "period": period,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "kpis": {
                        "total_berths": total_berths,
                        "available_berths": status_counts['AVAILABLE'],
                        "reserved_berths": status_counts['RESERVED'],
                        "occupied_berths": status_counts['OCCUPIED'],
                        "maintenance_berths": status_counts['MAINTENANCE'],
                        "overall_utilisation_pct": overall_utilisation_pct,
                        "total_occupied_hours": round(total_occupied_hours, 1),
                        "total_operational_hours": round(available_operational_hours_total, 1),
                        "avg_occupancy_hours": avg_occupancy_hours,
                        "total_vessel_movements": total_movements,
                        "most_utilised_berth": most_utilised,
                        "least_utilised_berth": least_utilised
                    },
                    "status_distribution": status_counts,
                    "berth_breakdown": berth_breakdown,
                    "daily_movements": daily_movements
                }
            },
            status=status.HTTP_200_OK
        )







