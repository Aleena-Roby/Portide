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
from django.http import FileResponse, Http404

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
    Cargo,
    Port,
    Container,
    CustomsInspection,
    CustomsDocument,
    GateRelease,
    Truck,
    Driver,
    Gate,
    GatePass,
    GatePassContainer,
    ContainerTrackingEvent,
    Yard,
    YardBlock,
    YardSlot,
    YardAllocation,
    YardMovementHistory,
    Crane,
    CraneAllocation,
    PreArrivalCustomsDeclaration,
    DeliveryOrder,
    DirectShipToTruckTransfer,
    get_min_arrival_advance_days
)
from authentication.serializers import (
    LoginSerializer, 
    RegistrationRequestSerializer, 
    RegistrationRequestDetailSerializer,
    RegistrationResubmissionSerializer,
    ForgotPasswordSerializer, 
    ResetPasswordSerializer,
    CreateStaffSerializer,
    UserDetailSerializer,
    UpdateStaffUserSerializer,
    ChangePasswordSerializer,
    FirstLoginChangePasswordSerializer,
    VesselSerializer,
    VesselCreateSerializer,
    VesselUpdateSerializer,
    VesselArrivalRequestSerializer,
    VesselArrivalRequestCreateSerializer,
    BerthSerializer,
    AdminBerthCreateUpdateSerializer,
    VesselScheduleSerializer,
    SystemSettingSerializer,
    AuditLogSerializer,
    CargoSerializer,
    CargoCreateUpdateSerializer,
    PortSerializer,
    ContainerSerializer,
    ContainerCreateUpdateSerializer,
    ContainerStatusTransitionSerializer,
    CustomsInspectionSerializer,
    CustomsInspectionSubmitSerializer,
    GateReleaseSerializer,
    GateReleaseSubmitSerializer,
    TruckSerializer,
    DriverSerializer,
    GateSerializer,
    GatePassSerializer,
    GatePassGenerateSerializer,
    GatePassVerifySerializer,
    GatePassReleaseSerializer,
    ContainerTrackingEventSerializer,
    ContainerDeliveryListSerializer,
    ContainerDeliveryDetailSerializer,
    DeliveryConfirmDepartureSerializer,
    DeliveryUpdateStatusSerializer,
    DeliveryConfirmDeliverySerializer,
    DeliveryReportExceptionSerializer,
    VALID_CONTAINER_TRANSITIONS,
    YardSlotSerializer,
    YardSlotCreateUpdateSerializer,
    YardBlockSerializer,
    YardBlockDetailSerializer,
    YardBlockCreateUpdateSerializer,
    YardSerializer,
    YardDetailSerializer,
    YardCreateUpdateSerializer,
    PendingContainerSerializer,
    AvailableSlotSerializer,
    YardAllocationSerializer,
    YardAllocationCreateSerializer,
    YardAllocationReleaseSerializer,
    YardMovementHistorySerializer,
    ContainerRelocationSerializer,
    YardOperationContainerItemSerializer,
    CraneSerializer,
    CraneAllocationSerializer,
    EligibleVesselScheduleSerializer,
    UnloadContainerExecuteSerializer,
    EligibleUnloadingVesselSerializer,
    ActiveUnloadingCraneSerializer,
    ManifestUnloadingContainerSerializer,
    PreArrivalCustomsDeclarationSerializer,
    PreArrivalCustomsSubmitSerializer,
    PreArrivalCustomsReviewSerializer,
    CustomsDocumentSerializer,
    CustomsDocumentUploadSerializer,
    CustomsDocumentReviewSerializer,
    DeliveryOrderSerializer,
    DeliveryOrderCreateSerializer,
    DirectShipToTruckTransferSerializer,
    DirectShipToTruckExecuteSerializer,
    EligibleDirectTransferContainerSerializer,
)
from authentication.email_service import (
    send_registration_submitted_email,
    send_registration_action_required_email,
    send_registration_resubmitted_email,
    send_registration_approved_email,
    send_registration_rejected_email,
    send_staff_account_created_email,
    send_customs_cleared_notification,
    send_customs_hold_notification,
    send_container_released_notification,
    send_gate_pass_driver_email
)
from authentication.qr_service import generate_verification_payload, generate_qr_svg
from authentication.permissions import (
    IsPortAdministrator,
    IsPortAdministratorOrCustomsOfficer,
    IsActiveShippingCompany, 
    IsPortOperationsOfficer,
    IsPortOperationsOfficerOnly,
    IsCustomsOfficer,
    IsCustomsOfficerOnly,
    IsGateTruckOfficer,
    IsTerminalLogisticsOperator,
    IsDeliveryTrackingViewer,
    IsYardMasterAuthorized,
    IsYardAllocationAuthorized,
    IsYardOperationsAuthorized,
    IsCraneManagementAuthorized,
    IsUnloadingOperationsAuthorized,
    get_authenticated_user_and_company
)
from authentication.validators import generate_unique_employee_id
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
        reg_req = None
        if company:
            reg_req = RegistrationRequest.objects.filter(shipping_company_id=company).order_by('-registration_request_submitted_at').first()

        # Status check rules:
        # Check ACTION_REQUIRED first
        if (login_obj.login_status == 'ACTION_REQUIRED' or 
            (user_profile and user_profile.user_status == 'ACTION_REQUIRED') or 
            (company and company.shipping_company_status == 'ACTION_REQUIRED') or 
            (reg_req and reg_req.registration_request_status == 'ACTION_REQUIRED')):
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login attempt blocked for {login_obj.login_email} (Additional documentation required)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "registration_status": "ACTION_REQUIRED",
                    "registration_request_id": reg_req.registration_request_id if reg_req else None,
                    "message": "Additional documentation is required for your registration before access can be granted. Please check your registration status to upload the required documents."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'REJECTED' or (user_profile and user_profile.user_status == 'REJECTED') or (company and company.shipping_company_status == 'REJECTED') or (reg_req and reg_req.registration_request_status == 'REJECTED'):
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
            rejection_reason = reg_req.registration_request_rejection_reason if reg_req else "Compliance requirements not met."
            return Response(
                {
                    "status": "error",
                    "registration_status": "REJECTED",
                    "registration_request_id": reg_req.registration_request_id if reg_req else None,
                    "message": f"Your registration request has been rejected. Reason: {rejection_reason}"
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'SUSPENDED' or (user_profile and user_profile.user_status == 'SUSPENDED') or (company and company.shipping_company_status == 'SUSPENDED'):
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
                    "registration_status": "SUSPENDED",
                    "registration_request_id": reg_req.registration_request_id if reg_req else None,
                    "message": "Your account has been suspended. Please contact the Port Administrator."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if login_obj.login_status == 'PENDING' or (user_profile and user_profile.user_status == 'PENDING') or (company and company.shipping_company_status == 'PENDING'):
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
                    "registration_status": "PENDING",
                    "registration_request_id": reg_req.registration_request_id if reg_req else None,
                    "message": "Your registration is awaiting Port Administrator approval."
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
                    "company_id": user_profile.shipping_company_id_id if user_profile else None,
                    "must_change_password": user_profile.user_must_change_password if user_profile else False
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
                    "status": user_obj.user_status if user_obj else login_obj.login_status,
                    "must_change_password": user_obj.user_must_change_password if user_obj else False
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

        # Send confirmation email
        send_registration_submitted_email(registration_obj)

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

        # Send approval notification email
        send_registration_approved_email(req_obj)

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

        rejection_reason = (request.data.get('rejection_reason') or request.data.get('review_remarks') or request.data.get('admin_remarks') or '').strip()
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
            req_obj.registration_request_admin_remarks = rejection_reason
            req_obj.registration_request_reviewed_at = timezone.now()
            if admin_user:
                req_obj.user_id = admin_user
            req_obj.save()

            # 2. Shipping company status updated to REJECTED
            company = req_obj.shipping_company_id
            if company:
                company.shipping_company_status = 'REJECTED'
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

        # Send rejection notification email
        send_registration_rejected_email(req_obj, rejection_reason)

        return Response({
            "status": "success",
            "message": "Shipping Company registration rejected."
        }, status=status.HTTP_200_OK)


class AdminActionRequiredRegistrationRequestAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to mark a Registration Request as ACTION_REQUIRED.
    Endpoint: POST /api/admin/registration-requests/<id>/action-required/
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

        raw_docs = request.data.get('action_required_docs') or request.data.get('actionRequiredDocs') or ''
        if isinstance(raw_docs, list):
            action_required_docs = ', '.join(str(d).strip() for d in raw_docs if str(d).strip())
        else:
            action_required_docs = str(raw_docs).strip()
        admin_remarks = (request.data.get('admin_remarks') or request.data.get('adminRemarks') or request.data.get('review_remarks') or '').strip()

        if not admin_remarks:
            return Response({
                "status": "error",
                "message": "Admin remarks / instructions are required when requesting document corrections."
            }, status=status.HTTP_400_BAD_REQUEST)

        admin_user = None
        user_id_header = request.headers.get('X-User-Id')
        if user_id_header:
            try:
                admin_user = User.objects.get(user_id=user_id_header)
            except (User.DoesNotExist, ValueError):
                pass

        with transaction.atomic():
            req_obj.registration_request_status = 'ACTION_REQUIRED'
            req_obj.registration_request_action_required_docs = action_required_docs
            req_obj.registration_request_admin_remarks = admin_remarks
            req_obj.registration_request_reviewed_at = timezone.now()
            if admin_user:
                req_obj.user_id = admin_user
            req_obj.save()

            company = req_obj.shipping_company_id
            if company:
                company.shipping_company_status = 'ACTION_REQUIRED'
                company.save()

                for user in company.users.all():
                    user.user_status = 'ACTION_REQUIRED'
                    user.save()
                    if user.login_id:
                        user.login_id.login_status = 'ACTION_REQUIRED'
                        user.login_id.login_is_active = False
                        user.login_id.save()

        create_audit_log(
            user=admin_user,
            actor_name=admin_user.user_full_name if admin_user else 'Port Administrator',
            role='Port Administrator',
            action='ACTION_REQUIRED',
            category='SHIPPING_COMPANY',
            target_type='ShippingCompany',
            target_id=company.shipping_company_id if company else req_obj.registration_request_id,
            description=f"Marked registration request #{req_obj.registration_request_id} for '{company.shipping_company_name if company else 'Unknown'}' as ACTION REQUIRED. Required docs: '{action_required_docs}'. Remarks: {admin_remarks}",
            status='SUCCESS',
            request=request
        )

        send_registration_action_required_email(req_obj, action_required_docs, admin_remarks)

        return Response({
            "status": "success",
            "message": "Registration request marked as Action Required and notification email sent.",
            "data": RegistrationRequestDetailSerializer(req_obj).data
        }, status=status.HTTP_200_OK)


class PublicRegistrationStatusAPIView(APIView):
    """
    Public API Endpoint to check Shipping Company Registration Status.
    Endpoint: GET /api/auth/registration-status/?request_id=... or ?email=...
    """
    permission_classes = [AllowAny]

    def get(self, request):
        request_id_param = request.query_params.get('request_id') or request.query_params.get('id')
        email_param = request.query_params.get('email')

        if not request_id_param and not email_param:
            return Response({
                "status": "error",
                "message": "Please provide a registration request ID or company email address."
            }, status=status.HTTP_400_BAD_REQUEST)

        queryset = RegistrationRequest.objects.select_related('shipping_company_id', 'user_id').all()
        reg_obj = None

        if request_id_param:
            req_id_str = str(request_id_param).strip()
            # Support REG-2026-001 or raw numeric ID
            if '-' in req_id_str:
                parts = req_id_str.split('-')
                try:
                    numeric_id = int(parts[-1])
                    reg_obj = queryset.filter(registration_request_id=numeric_id).first()
                except ValueError:
                    reg_obj = None
            else:
                try:
                    numeric_id = int(req_id_str)
                    reg_obj = queryset.filter(registration_request_id=numeric_id).first()
                except ValueError:
                    reg_obj = None
        elif email_param:
            reg_obj = queryset.filter(
                shipping_company_id__shipping_company_email__iexact=email_param.strip()
            ).order_by('-registration_request_submitted_at').first()

        if not reg_obj:
            return Response({
                "status": "error",
                "message": "No registration request found with the provided details. Please verify your Request ID or Email address."
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = RegistrationRequestDetailSerializer(reg_obj)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class ShippingCompanyResubmitAPIView(APIView):
    """
    Public API Endpoint for Shipping Companies to Resubmit Corrected Documents.
    Endpoint: POST /api/auth/registration-resubmit/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistrationResubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        reg_id = data['registration_request_id']

        try:
            req_obj = RegistrationRequest.objects.select_related('shipping_company_id').get(registration_request_id=reg_id)
        except RegistrationRequest.DoesNotExist:
            return Response({
                "status": "error",
                "message": "Registration request not found."
            }, status=status.HTTP_404_NOT_FOUND)

        if req_obj.registration_request_status not in ['ACTION_REQUIRED', 'PENDING']:
            return Response({
                "status": "error",
                "message": f"Cannot resubmit documents for registration request in '{req_obj.registration_request_status}' status."
            }, status=status.HTTP_400_BAD_REQUEST)

        license_file = data.get('request_license_file')
        id_file = data.get('request_id_file')
        applicant_notes = data.get('applicant_notes')

        with transaction.atomic():
            # If new license file provided, preserve existing one in previous_license_file
            if license_file:
                if req_obj.registration_request_license_file:
                    req_obj.registration_request_previous_license_file = req_obj.registration_request_license_file
                req_obj.registration_request_license_file = license_file

            # If new ID file provided, preserve existing one in previous_id_file
            if id_file:
                if req_obj.registration_request_id_file:
                    req_obj.registration_request_previous_id_file = req_obj.registration_request_id_file
                req_obj.registration_request_id_file = id_file

            req_obj.registration_request_status = 'PENDING'
            req_obj.registration_request_resubmitted_at = timezone.now()
            req_obj.save()

            company = req_obj.shipping_company_id
            if company:
                company.shipping_company_status = 'PENDING'
                company.save()

                for user in company.users.all():
                    user.user_status = 'PENDING'
                    user.save()
                    if user.login_id:
                        user.login_id.login_status = 'PENDING'
                        user.login_id.login_is_active = False
                        user.login_id.save()

        create_audit_log(
            user=None,
            actor_name=req_obj.registration_request_applicant_name,
            role='Shipping Company',
            action='RESUBMIT',
            category='SHIPPING_COMPANY',
            target_type='ShippingCompany',
            target_id=company.shipping_company_id if company else req_obj.registration_request_id,
            description=f"Resubmitted corrected documents for registration request #{req_obj.registration_request_id} ('{company.shipping_company_name if company else 'Unknown'}'). Notes: {applicant_notes or 'None'}",
            status='SUCCESS',
            request=request
        )

        send_registration_resubmitted_email(req_obj)

        return Response({
            "status": "success",
            "message": "Corrected documents submitted successfully! Your application is now pending Port Administrator review.",
            "data": RegistrationRequestDetailSerializer(req_obj).data
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
        temp_password = getattr(user_obj, '_temp_password', None)
        email_sent = False
        if temp_password:
            email_sent = send_staff_account_created_email(user_obj, temp_password)
            user_obj._temp_password = None
            if hasattr(user_obj, '_temp_password'):
                delattr(user_obj, '_temp_password')
            temp_password = None

        create_audit_log(
            user=None,
            actor_name=request.headers.get('X-User-Email') or 'Port Administrator',
            role='Port Administrator',
            action='CREATE',
            category='USER_MANAGEMENT',
            target_type='User',
            target_id=user_obj.user_id,
            description=f"Created internal staff account for {user_obj.user_full_name} ({user_obj.login_id.login_email}) with role '{user_obj.login_id.login_role}'. Temporary password generated and email notification dispatched.",
            status='SUCCESS',
            request=request
        )

        if email_sent:
            resp_message = f"Staff account created successfully. Temporary login credentials have been sent to {user_obj.login_id.login_email}."
        else:
            resp_message = "Staff account created successfully, but the notification email could not be sent."

        return Response(
            {
                "status": "success",
                "email_sent": email_sent,
                "message": resp_message,
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


class AdminNextEmployeeIdAPIView(APIView):
    """
    Protected API Endpoint for Port Administrator to Fetch the Next Unique Employee ID.
    Endpoint: GET /api/admin/users/next-employee-id/?role=<role>
    """
    permission_classes = [IsPortAdministrator]

    def get(self, request):
        role = request.query_params.get('role', 'port_operations_officer')
        next_id = generate_unique_employee_id(role)
        return Response({
            "status": "success",
            "role": role,
            "employee_id": next_id
        }, status=status.HTTP_200_OK)


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

        user_profile = getattr(login_obj, 'profile', None)
        if user_profile and getattr(user_profile, 'user_must_change_password', False):
            user_profile.user_must_change_password = False
            user_profile.save()

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


class FirstLoginChangePasswordAPIView(APIView):
    """
    Mandatory API Endpoint for Authenticated Users with Temporary Passwords to set their New Password.
    Endpoint: POST /api/auth/first-login-change-password/
    Does NOT require current/temporary password, as user is already authenticated.
    Applies existing strong password validation, hashes new password with PBKDF2,
    and sets user_must_change_password = False.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)

        if not login_obj and hasattr(request, 'session') and 'login_id' in request.session:
            try:
                login_obj = Login.objects.get(login_id=request.session['login_id'])
                user_obj = getattr(login_obj, 'profile', None)
            except Login.DoesNotExist:
                pass

        if not login_obj or not login_obj.login_is_active:
            return Response(
                {
                    "status": "error",
                    "message": "Authentication required. Please log in with your temporary credentials first."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = FirstLoginChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Password validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        new_password = serializer.validated_data['new_password']

        # 1. Securely hash the new password using Django PBKDF2
        login_obj.login_password = make_password(new_password)
        login_obj.save()

        # 2. Update first-login state to False
        if user_obj:
            user_obj.user_must_change_password = False
            user_obj.save()

        # 3. Create Audit Log (never logs password or hash)
        actor_name = (user_obj.user_full_name if user_obj else None) or login_obj.login_email
        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role=login_obj.login_role,
            action='PASSWORD_CHANGE',
            category='AUTHENTICATION',
            target_type='User',
            target_id=login_obj.login_id,
            description=f"Mandatory first-login password changed successfully for user {login_obj.login_email}.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Password changed successfully. You may now continue to your dashboard.",
                "data": {
                    "must_change_password": False
                }
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
        eligible_for_cargo = request.query_params.get('eligible_for_cargo')

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

        if eligible_for_cargo and eligible_for_cargo.lower() in ['true', '1']:
            now = timezone.now()
            queryset = queryset.filter(
                vessel_arrival_request_status='APPROVED',
                vessel_arrival_request_requested_departure_at__gt=now
            )
        elif status_filter and status_filter.lower() != 'all':
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
    Protected API Endpoint for Port Administrator and Customs Officers to View, Search, Filter, and Paginate System Audit Logs.
    Customs Officers are restricted to viewing Customs category audit logs.
    Endpoint: GET /api/audit-logs/
    """
    permission_classes = [IsPortAdministratorOrCustomsOfficer]

    def get(self, request):
        search_query = request.query_params.get('search', '').strip()
        category_filter = request.query_params.get('category', '').strip()
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 15)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        user_role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

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

        # Customs officers strictly restricted to customs category logs
        if user_role in ['customs_officer']:
            category_filter = 'customs'

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


class PortListAPIView(APIView):
    """
    List master ports for origin and destination selection.
    Publicly accessible or authenticated.
    Supports ?search= query.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        search_query = request.query_params.get('search')
        queryset = Port.objects.filter(port_is_active=True).order_by('port_country', 'port_name')
        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                models.Q(port_name__icontains=q) |
                models.Q(port_code__icontains=q) |
                models.Q(port_country__icontains=q) |
                models.Q(port_country_code__icontains=q)
            )
        serializer = PortSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "count": queryset.count(),
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class CargoListCreateAPIView(APIView):
    """
    Cargo List & Registration API View.
    GET: List cargoes according to user role.
         - Shipping Company: only sees cargo for its own arrival requests.
         - Port Operations / Port Admin / Customs / Terminal: sees all / operational cargo.
         Query params: status, search, arrival_request_id.
    POST: Register new Cargo linked to an existing Arrival Request.
         - Strictly verifies arrival request belongs to authenticated shipping company.
         - Strictly verifies arrival request status is APPROVED.
         - Validates positive quantity and weight, valid cargo type and unit.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search')
        arrival_request_id = request.query_params.get('arrival_request_id')

        queryset = Cargo.objects.select_related(
            'cargo_arrival_request_id',
            'cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'cargo_origin_port_id',
            'cargo_destination_port_id'
        ).all().order_by('-cargo_created_at', '-cargo_id')

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
            queryset = queryset.filter(
                cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id=company_obj
            )
        elif normalized_role in ['terminal_logistics_operator', 'terminal_operator']:
            # Terminal Operator only operates on eligible cargo consignments (APPROVED arrival requests)
            queryset = queryset.filter(
                cargo_arrival_request_id__vessel_arrival_request_status='APPROVED'
            )


        if arrival_request_id:
            queryset = queryset.filter(cargo_arrival_request_id_id=arrival_request_id)

        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(cargo_status__iexact=status_filter.strip())

        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                models.Q(cargo_description__icontains=q) |
                models.Q(cargo_origin_port_id__port_name__icontains=q) |
                models.Q(cargo_origin_port_id__port_code__icontains=q) |
                models.Q(cargo_destination_port_id__port_name__icontains=q) |
                models.Q(cargo_destination_port_id__port_code__icontains=q) |
                models.Q(cargo_type__icontains=q) |
                models.Q(cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=q) |
                models.Q(cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_imo_number__icontains=q)
            )

        serializer = CargoSerializer(queryset, many=True)
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
                    "message": "Only active shipping companies are authorized to register cargo."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not company_obj or company_obj.shipping_company_status != 'ACTIVE':
            return Response(
                {
                    "status": "error",
                    "message": "Your Shipping Company account must be ACTIVE to register cargo."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CargoCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Cargo registration validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        arrival_req = serializer.validated_data['cargo_arrival_request_id']
        vessel_obj = arrival_req.vessel_arrival_request_vessel_id
        if vessel_obj.vessel_shipping_company_id_id != company_obj.shipping_company_id:
            return Response(
                {
                    "status": "error",
                    "message": "You are not authorized to register cargo for an arrival request belonging to another company."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce that arrival request must be APPROVED
        if arrival_req.vessel_arrival_request_status != 'APPROVED':
            return Response(
                {
                    "status": "error",
                    "message": "Cargo can only be registered for an APPROVED arrival request."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce server-time departure expiration
        now = timezone.now()
        departure_time = arrival_req.vessel_arrival_request_requested_departure_at
        if departure_time and now >= departure_time:
            return Response(
                {
                    "status": "error",
                    "message": "This Arrival Request is no longer active for cargo registration because its scheduled departure time has passed. Please select another active approved request."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        cargo = serializer.save(cargo_status='REGISTERED')
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='CREATE',
            category='CARGO',
            target_type='Cargo',
            target_id=cargo.cargo_id,
            description=f"Registered cargo #{cargo.cargo_id} ('{cargo.cargo_description}', {cargo.cargo_quantity} {cargo.cargo_unit}) for Arrival Request #{arrival_req.vessel_arrival_request_id} ({vessel_obj.vessel_name}).",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Cargo registered successfully.",
                "data": CargoSerializer(cargo).data
            },
            status=status.HTTP_201_CREATED
        )


class CargoDetailAPIView(APIView):
    """
    Cargo Detail, Update & View API View.
    GET: Retrieve specific cargo by ID.
    PUT/PATCH: Update cargo details.
    """
    permission_classes = [AllowAny]

    def get_object(self, pk):
        try:
            return Cargo.objects.select_related(
                'cargo_arrival_request_id',
                'cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
                'cargo_origin_port_id',
                'cargo_destination_port_id'
            ).get(cargo_id=pk)
        except Cargo.DoesNotExist:
            return None

    def get(self, request, pk):
        cargo = self.get_object(pk)
        if not cargo:
            return Response(
                {
                    "status": "error",
                    "message": f"Cargo #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to view this cargo record."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        return Response(
            {
                "status": "success",
                "data": CargoSerializer(cargo).data
            },
            status=status.HTTP_200_OK
        )

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        cargo = self.get_object(pk)
        if not cargo:
            return Response(
                {
                    "status": "error",
                    "message": f"Cargo #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to edit this cargo record."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Workflow check: Shipping company can only edit registered cargo
            if cargo.cargo_status != 'REGISTERED':
                return Response(
                    {
                        "status": "error",
                        "message": f"Cargo #{pk} cannot be edited because its status is '{cargo.cargo_status}'."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Shipping companies cannot mark cargo as customs cleared or change status arbitrarily
        mutable_data = request.data.copy()
        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            if 'cargo_status' in mutable_data:
                mutable_data.pop('cargo_status')

        # Cannot change arrival_request foreign key once created
        if 'cargo_arrival_request_id' in mutable_data:
            mutable_data.pop('cargo_arrival_request_id')

        serializer = CargoCreateUpdateSerializer(cargo, data=mutable_data, partial=True)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Cargo update validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_cargo = serializer.save()
        actor_name = user_obj.user_full_name if user_obj else (company_obj.shipping_company_name if company_obj else 'User')

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role=normalized_role.title(),
            action='UPDATE',
            category='CARGO',
            target_type='Cargo',
            target_id=updated_cargo.cargo_id,
            description=f"Updated cargo #{updated_cargo.cargo_id} details.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": "Cargo updated successfully.",
                "data": CargoSerializer(updated_cargo).data
            },
            status=status.HTTP_200_OK
        )


class ContainerListCreateAPIView(APIView):
    """
    Container List & Registration API View.
    GET: List containers with search, status, type, and cargo filters.
         Shipping company sees only containers for its own cargo.
         Operational roles (Operations, Admin, Customs, Terminal) see operational containers.
    POST: Register a new Container for an existing Containerized Cargo.
         - Enforces unique ISO 6346 format (4 letters + 7 digits, e.g. MSCU1234567).
         - Rejects non-containerized cargo (General Cargo, Bulk Cargo).
         - Rejects gross weight <= 0.
         - Initializes status to REGISTERED.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        cargo_id = request.query_params.get('cargo_id')
        status_filter = request.query_params.get('status')
        type_filter = request.query_params.get('container_type')
        search_query = request.query_params.get('search')

        queryset = Container.objects.select_related(
            'container_cargo_id',
            'container_cargo_id__cargo_arrival_request_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'container_cargo_id__cargo_origin_port_id',
            'container_cargo_id__cargo_destination_port_id'
        ).all().order_by('-container_created_at', '-container_id')

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
            queryset = queryset.filter(
                container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id=company_obj
            )

        if cargo_id:
            queryset = queryset.filter(container_cargo_id_id=cargo_id)

        if status_filter and status_filter.lower() != 'all':
            s_clean = status_filter.strip().upper().replace(' ', '_')
            queryset = queryset.filter(container_status__iexact=s_clean)

        if type_filter and type_filter.lower() != 'all':
            t_clean = type_filter.strip().upper().replace(' ', '')
            if t_clean in ['20FT', '40FT', '40FTHC', '40FT_HC']:
                queryset = queryset.filter(container_type__iexact=t_clean if t_clean != '40FTHC' else '40FT_HC')
            else:
                queryset = queryset.filter(container_type__iexact=type_filter.strip())

        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                models.Q(container_number__icontains=q) |
                models.Q(container_cargo_id__cargo_description__icontains=q) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=q) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_imo_number__icontains=q)
            )

        serializer = ContainerSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "count": queryset.count(),
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
                    "message": "Only active shipping companies are authorized to register containers."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not company_obj or company_obj.shipping_company_status != 'ACTIVE':
            return Response(
                {
                    "status": "error",
                    "message": "Your Shipping Company account must be ACTIVE to register containers."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ContainerCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Container registration validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        cargo_obj = serializer.validated_data['container_cargo_id']

        # Enforce that Cargo must belong to the authenticated shipping company
        arrival_req = cargo_obj.cargo_arrival_request_id
        vessel_obj = arrival_req.vessel_arrival_request_vessel_id
        if vessel_obj.vessel_shipping_company_id_id != company_obj.shipping_company_id:
            return Response(
                {
                    "status": "error",
                    "message": "You are not authorized to register containers for cargo belonging to another company."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Enforce that cargo must be CONTAINERIZED
        if cargo_obj.cargo_type != 'CONTAINERIZED':
            return Response(
                {
                    "status": "error",
                    "message": "Containers can only be registered for containerized cargo."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        container = serializer.save(container_status='REGISTERED')
        actor_name = user_obj.user_full_name if user_obj else company_obj.shipping_company_name

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role='Shipping Company',
            action='CREATE',
            category='CONTAINER',
            target_type='Container',
            target_id=container.container_id,
            description=f"Registered container {container.container_number} ({container.container_type}, {container.container_gross_weight} MT) for Cargo #{cargo_obj.cargo_id} ('{cargo_obj.cargo_description}').",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Container {container.container_number} registered successfully.",
                "data": ContainerSerializer(container).data
            },
            status=status.HTTP_201_CREATED
        )


class PublicContainerTrackingAPIView(APIView):
    """
    Public Read-Only Container Tracking API View.
    Allows unauthenticated public users to track cargo status by container number.
    Returns only safe public information (no driver, officer, gate pass, or internal audit info).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query_param = (
            request.query_params.get('container_number')
            or request.query_params.get('number')
            or request.query_params.get('q')
            or request.query_params.get('id')
            or request.query_params.get('container_id')
        )

        if not query_param or not str(query_param).strip():
            return Response(
                {
                    "status": "error",
                    "message": "Please enter a container number to track."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        raw_str = str(query_param).strip()
        cleaned_str = raw_str.replace('-', '').replace(' ', '').upper()

        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id'
            ).filter(
                models.Q(container_number__iexact=cleaned_str) |
                models.Q(container_number__iexact=raw_str)
            ).first()

            if not container:
                return Response(
                    {
                        "status": "not_found",
                        "message": "Container not found. Please check the container number and try again."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            cargo = container.container_cargo_id
            arrival_req = cargo.cargo_arrival_request_id if cargo else None
            vessel = arrival_req.vessel_arrival_request_vessel_id if arrival_req else None
            ar_display = f"AR-{str(arrival_req.vessel_arrival_request_id).zfill(4)}" if arrival_req else "N/A"
            last_updated_dt = container.container_updated_at or container.container_created_at
            formatted_last_updated = f"{last_updated_dt.day} {last_updated_dt.strftime('%B %Y')}, {last_updated_dt.strftime('%I:%M %p').lstrip('0')}" if last_updated_dt else "N/A"

            # Check if container has reached delivery tracking lifecycle
            delivery_events = list(container.tracking_events.select_related('tracking_event_updated_by').order_by('tracking_event_timestamp', 'tracking_event_id'))
            is_delivery_stage = bool(
                delivery_events or 
                container.container_status == 'RELEASED' or 
                (container.container_delivery_status and container.container_delivery_status != 'NOT_APPLICABLE')
            )

            if is_delivery_stage:
                delivery_status = container.container_delivery_status
                if not delivery_status or delivery_status == 'NOT_APPLICABLE':
                    delivery_status = delivery_events[-1].tracking_event_status if delivery_events else 'RELEASED'

                delivery_status_display_map = {
                    'RELEASED': 'Container Released',
                    'GATE_PASS_GENERATED': 'Gate Pass Generated',
                    'PICKED_UP': 'Picked Up',
                    'DEPARTED_PORT': 'Departed Port',
                    'IN_TRANSIT': 'In Transit',
                    'OUT_FOR_DELIVERY': 'Out for Delivery',
                    'DELIVERED': 'Delivered',
                    'DELIVERY_EXCEPTION': 'Delivery Exception',
                }

                status_messages = {
                    'RELEASED': 'Your container has been cleared and authorized for release.',
                    'GATE_PASS_GENERATED': 'Digital gate pass generated for transport vehicle pickup.',
                    'PICKED_UP': 'Your container has been verified and picked up at the port gate.',
                    'DEPARTED_PORT': 'Your container has departed the port terminal.',
                    'IN_TRANSIT': 'Your container is currently in transit to the distribution facility.',
                    'OUT_FOR_DELIVERY': 'Your container is currently out for delivery.',
                    'DELIVERED': 'Your container has been safely delivered to its destination.',
                    'DELIVERY_EXCEPTION': 'A temporary delivery exception has been recorded; resolution is in progress.',
                }

                milestones = [
                    ('RELEASED', 'Container Released'),
                    ('GATE_PASS_GENERATED', 'Gate Pass Generated'),
                    ('PICKED_UP', 'Picked Up'),
                    ('DEPARTED_PORT', 'Departed Port'),
                    ('IN_TRANSIT', 'In Transit'),
                    ('OUT_FOR_DELIVERY', 'Out for Delivery'),
                    ('DELIVERED', 'Delivered'),
                ]
                status_order = [m[0] for m in milestones]
                event_by_status = {ev.tracking_event_status: ev for ev in delivery_events}

                current_idx = status_order.index(delivery_status) if delivery_status in status_order else 0
                if delivery_status == 'DELIVERY_EXCEPTION':
                    current_idx = 0
                    for idx, m_code in enumerate(status_order):
                        if m_code in event_by_status:
                            current_idx = idx

                timeline = []
                for idx, (m_code, label) in enumerate(milestones):
                    ev = event_by_status.get(m_code)
                    if delivery_status == 'DELIVERED':
                        node_status = 'completed'
                    elif delivery_status == 'DELIVERY_EXCEPTION':
                        node_status = 'completed' if idx < current_idx else ('current' if idx == current_idx else 'pending')
                    else:
                        node_status = 'completed' if idx < current_idx else ('current' if idx == current_idx else 'pending')

                    dt = ev.tracking_event_timestamp if ev else None
                    if dt:
                        formatted_time = f"{dt.strftime('%d %b %Y')}, {dt.strftime('%I:%M %p')}"
                    else:
                        formatted_time = 'Pending' if node_status == 'pending' else '—'

                    timeline.append({
                        'step': m_code,
                        'key': m_code,
                        'label': label,
                        'status': node_status,
                        'is_completed': node_status == 'completed',
                        'is_current': node_status == 'current',
                        'is_pending': node_status == 'pending',
                        'timestamp': formatted_time,
                        'timestamp_iso': dt.isoformat() if dt else None,
                        'location': ev.tracking_event_location if ev else None,
                    })

                origin_name = cargo.cargo_origin_port_id.port_name if (cargo and cargo.cargo_origin_port_id) else "Port of Origin"
                dest_port_name = cargo.cargo_destination_port_id.port_name if (cargo and cargo.cargo_destination_port_id) else "Port of Cochin"
                delivery_dest = container.container_delivery_destination or f"{dest_port_name} -> Kochi Distribution Facility"

                last_event = delivery_events[-1] if delivery_events else None
                last_dt = last_event.tracking_event_timestamp if last_event else last_updated_dt
                if last_dt:
                    formatted_last_updated = f"{last_dt.strftime('%d %b %Y')}, {last_dt.strftime('%I:%M %p')}"

                return Response({
                    "status": "success",
                    "data": {
                        "is_delivery_stage": True,
                        "container_number": container.container_number,
                        "cargo_description": cargo.cargo_description if cargo else "N/A",
                        "cargo_type": cargo.get_cargo_type_display() if cargo else "Containerized",
                        "vessel_name": vessel.vessel_name if vessel else "N/A",
                        "arrival_request_id": ar_display,
                        "current_status": delivery_status,
                        "current_status_display": delivery_status_display_map.get(delivery_status, delivery_status.replace('_', ' ').title()),
                        "status_message": status_messages.get(delivery_status, "Operational delivery tracking active."),
                        "destination": delivery_dest,
                        "origin_port": origin_name,
                        "destination_port": dest_port_name,
                        "last_known_location": last_event.tracking_event_location if last_event else (container.container_delivery_location or "Port Terminal"),
                        "last_updated": formatted_last_updated,
                        "last_updated_iso": last_dt.isoformat() if last_dt else None,
                        "expected_delivery_date": container.container_expected_delivery_date.strftime('%d %b %Y, %I:%M %p') if container.container_expected_delivery_date else None,
                        "timeline": timeline,
                    }
                }, status=status.HTTP_200_OK)

            # Pre-release standard response
            inspections = list(container.customs_inspections.all())
            latest_insp = inspections[0] if inspections else None
            is_hold = bool(latest_insp and latest_insp.customs_inspection_result == 'HOLD')

            if is_hold or container.container_status == 'CUSTOMS_HOLD':
                status_key = 'CUSTOMS_HOLD'
                status_display = 'Customs Hold'
            elif container.container_status == 'CLEARED':
                status_key = 'CLEARED'
                status_display = 'Customs Cleared'
            elif container.container_status == 'UNDER_INSPECTION':
                status_key = 'UNDER_INSPECTION'
                status_display = 'Under Inspection'
            elif container.container_status == 'AWAITING_CUSTOMS':
                status_key = 'AWAITING_CUSTOMS'
                status_display = 'Awaiting Customs'
            elif container.container_status == 'AT_TERMINAL':
                status_key = 'AT_TERMINAL'
                status_display = 'At Terminal'
            elif container.container_status == 'ARRIVED':
                status_key = 'ARRIVED'
                status_display = 'Arrived'
            else:
                status_key = container.container_status
                status_display = container.get_container_status_display()

            return Response(
                {
                    "status": "success",
                    "data": {
                        "is_delivery_stage": False,
                        "container_number": container.container_number,
                        "cargo_description": cargo.cargo_description if cargo else "N/A",
                        "cargo_type": cargo.get_cargo_type_display() if cargo else "Containerized",
                        "vessel_name": vessel.vessel_name if vessel else "N/A",
                        "arrival_request_id": ar_display,
                        "current_status": status_key,
                        "current_status_display": status_display,
                        "last_updated": formatted_last_updated,
                        "last_updated_iso": last_updated_dt.isoformat() if last_updated_dt else None,
                    }
                },
                status=status.HTTP_200_OK
            )
        except Exception:
            return Response(
                {
                    "status": "error",
                    "message": "Container not found. Please check the container number and try again."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



class ContainerDetailAPIView(APIView):
    """
    Container Detail & Update API View.
    GET: Retrieve container technical specifications, cargo relationship, and port routing.
    PATCH/PUT: Update container specifications (only permitted when container is in REGISTERED status).
    """
    permission_classes = [AllowAny]

    def get_object(self, pk):
        try:
            return Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
                'container_cargo_id__cargo_origin_port_id',
                'container_cargo_id__cargo_destination_port_id'
            ).get(container_id=pk)
        except Container.DoesNotExist:
            return None

    def get(self, request, pk):
        container = self.get_object(pk)
        if not container:
            return Response(
                {
                    "status": "error",
                    "message": f"Container #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = container.container_cargo_id.cargo_arrival_request_id.vessel_arrival_request_vessel_id
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to view this container record."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
        elif normalized_role in ['terminal_logistics_operator', 'terminal_operator']:
            arr_req = container.container_cargo_id.cargo_arrival_request_id
            if not arr_req or arr_req.vessel_arrival_request_status != 'APPROVED':
                return Response(
                    {
                        "status": "error",
                        "message": "Terminal Operators can only access containers belonging to an APPROVED arrival request."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = ContainerSerializer(container)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def patch(self, request, pk):
        container = self.get_object(pk)
        if not container:
            return Response(
                {
                    "status": "error",
                    "message": f"Container #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['terminal_logistics_operator', 'terminal_operator']:
            return Response(
                {
                    "status": "error",
                    "message": "Terminal Operators are not authorized to modify container technical specifications."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = container.container_cargo_id.cargo_arrival_request_id.vessel_arrival_request_vessel_id
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to edit this container."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        # Once a container has moved past REGISTERED, technical edits are restricted
        if container.container_status != 'REGISTERED':
            return Response(
                {
                    "status": "error",
                    "message": f"Container cannot be modified while in '{container.container_status}' status. Only REGISTERED containers may be updated."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ContainerCreateUpdateSerializer(container, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Container update validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        updated_container = serializer.save()
        actor_name = user_obj.user_full_name if user_obj else (company_obj.shipping_company_name if company_obj else 'User')

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=actor_name,
            role=normalized_role.title(),
            action='UPDATE',
            category='CONTAINER',
            target_type='Container',
            target_id=updated_container.container_id,
            description=f"Updated container #{updated_container.container_id} ({updated_container.container_number}) specifications.",
            status='SUCCESS',
            request=request
        )

        return Response(
            {
                "status": "success",
                "message": f"Container {updated_container.container_number} updated successfully.",
                "data": ContainerSerializer(updated_container).data
            },
            status=status.HTTP_200_OK
        )


class ContainerStatusTransitionAPIView(APIView):
    """
    Controlled Container Status Transition API View.
    Enforces sequential progression:
      REGISTERED -> ARRIVED -> AT_TERMINAL -> UNDER_INSPECTION -> CLEARED -> RELEASED.
    Role-based transition control:
      - Shipping Company: CANNOT set operational/customs statuses (CLEARED, RELEASED, ARRIVED, AT_TERMINAL).
      - Terminal Operator: Can ONLY advance:
          REGISTERED -> ARRIVED
          ARRIVED -> AT_TERMINAL
      - Customs & Gate transitions (UNDER_INSPECTION, CLEARED, RELEASED) are not implemented yet.
    Concurrency protection:
      - Uses transaction.atomic() and select_for_update() to guarantee ACID isolation.
    """
    permission_classes = [AllowAny]

    def post(self, request, pk):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response(
                {
                    "status": "error",
                    "message": "Password change required before accessing platform features."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        serializer = ContainerStatusTransitionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Status transition validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = serializer.validated_data['status']

        # 1. RBAC check: Shipping company is strictly blocked from operational/customs transitions
        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            return Response(
                {
                    "status": "error",
                    "message": f"Shipping companies are not authorized to transition container operational or customs status to '{new_status}'."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. RBAC check: Terminal Operator allowed transitions: REGISTERED->ARRIVED, ARRIVED->AT_TERMINAL, AT_TERMINAL->AWAITING_CUSTOMS
        is_terminal_operator = normalized_role in ['terminal_logistics_operator', 'terminal_operator']
        if is_terminal_operator:
            if new_status not in ['ARRIVED', 'AT_TERMINAL', 'AWAITING_CUSTOMS']:
                return Response(
                    {
                        "status": "error",
                        "message": (
                            f"Terminal & Logistics Operators are only authorized to advance containers from "
                            f"REGISTERED to ARRIVED, ARRIVED to AT_TERMINAL, and AT_TERMINAL to AWAITING_CUSTOMS. "
                            f"Transition to '{new_status}' is not permitted for this role."
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        # 3. Atomic row-lock and state validation for concurrent safety
        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().select_related(
                    'container_cargo_id',
                    'container_cargo_id__cargo_arrival_request_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
                ).get(container_id=pk)
            except Container.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": f"Container #{pk} not found."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            current_status = container.container_status

            # Enforce strict sequential status transitions
            allowed_next = VALID_CONTAINER_TRANSITIONS.get(current_status, [])
            if new_status not in allowed_next:
                progression_guide = "REGISTERED → ARRIVED → AT TERMINAL → AWAITING CUSTOMS → UNDER INSPECTION → CLEARED → RELEASED"
                return Response(
                    {
                        "status": "error",
                        "message": f"Invalid status transition from '{current_status}' to '{new_status}'. Allowed next status: {allowed_next}. Full lifecycle progression: {progression_guide}."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # RBAC check: Customs status transitions (UNDER_INSPECTION, CUSTOMS_HOLD, CLEARED)
            if new_status in ['UNDER_INSPECTION', 'CUSTOMS_HOLD', 'CLEARED']:
                if normalized_role not in ['customs_officer', 'port_administrator', 'admin', 'port administrator']:
                    return Response(
                        {
                            "status": "error",
                            "message": f"Only Customs Officers are authorized to transition container status to '{new_status}'."
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )

            # RBAC check: Gate release transition (RELEASED)
            if new_status == 'RELEASED':
                if normalized_role not in ['gate_truck_officer', 'gate_truck_operations_officer', 'gate_officer', 'port_administrator', 'admin', 'port administrator']:
                    return Response(
                        {
                            "status": "error",
                            "message": "Only Gate & Truck Operations Officers are authorized to release containers."
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )

            # Enforce Section 18: Container cannot be Released until Customs Clearance = Cleared
            if new_status == 'RELEASED' and current_status != 'CLEARED':
                return Response(
                    {
                        "status": "error",
                        "message": "A container cannot be Released until customs clearance is completed and status is CLEARED."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            cargo = container.container_cargo_id
            if cargo.cargo_type != 'CONTAINERIZED':
                return Response(
                    {
                        "status": "error",
                        "message": "Containers can only be processed for containerized cargo consignments."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            arrival_req = cargo.cargo_arrival_request_id
            if not arrival_req or arrival_req.vessel_arrival_request_status != 'APPROVED':
                return Response(
                    {
                        "status": "error",
                        "message": "Container status cannot be changed because the linked vessel arrival request is not APPROVED."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Operational stage check for REGISTERED -> ARRIVED
            if current_status == 'REGISTERED' and new_status == 'ARRIVED':
                schedule = getattr(arrival_req, 'schedule', None)
                if schedule:
                    if schedule.vessel_schedule_status not in ['ARRIVED', 'AT_BERTH']:
                        vessel_name = arrival_req.vessel_arrival_request_vessel_id.vessel_name
                        return Response(
                            {
                                "status": "error",
                                "message": (
                                    f"Cannot receive container. Carrier vessel '{vessel_name}' has not reached the "
                                    f"operational stage for container handling (current vessel schedule status: '{schedule.get_vessel_schedule_status_display()}'). "
                                    f"Vessel must be ARRIVED or AT BERTH."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

            # Apply transition to database
            container.container_status = new_status
            if new_status == 'AWAITING_CUSTOMS':
                if container.container_customs_status == 'NOT_SUBMITTED':
                    container.container_customs_status = 'PENDING_REVIEW'
            elif new_status == 'UNDER_INSPECTION':
                container.container_customs_status = 'UNDER_INSPECTION'
            elif new_status == 'CLEARED':
                container.container_customs_status = 'CLEARED'
            elif new_status == 'CUSTOMS_HOLD':
                container.container_customs_status = 'CUSTOMS_HOLD'
            container.save(update_fields=['container_status', 'container_customs_status', 'container_updated_at'])

            actor_name = user_obj.user_full_name if user_obj else (login_obj.login_email if login_obj else 'System Officer')
            role_display = (
                'Terminal & Logistics Operator'
                if is_terminal_operator
                else ('Customs Officer' if normalized_role in ['customs_officer'] else (normalized_role.title() if normalized_role else 'Port Operations'))
            )
            remarks = serializer.validated_data.get('remarks')
            remarks_text = f" Remarks: {remarks}" if remarks else ""

            # If transition affects customs inspection records
            if new_status == 'UNDER_INSPECTION':
                CustomsInspection.objects.create(
                    customs_inspection_container_id=container,
                    customs_inspection_officer_id=user_obj,
                    customs_inspection_status='IN_PROGRESS',
                    customs_inspection_document_status='PENDING',
                    customs_inspection_started_at=timezone.now(),
                    customs_inspection_remarks=remarks or ''
                )
            elif new_status == 'CLEARED':
                inspection = container.latest_customs_inspection
                if inspection:
                    inspection.customs_inspection_status = 'COMPLETED'
                    inspection.customs_inspection_result = 'CLEARED'
                    inspection.customs_inspection_document_status = 'VERIFIED'
                    inspection.customs_inspection_clearance_date = timezone.now()
                    inspection.customs_inspection_completed_at = timezone.now()
                    inspection.customs_inspection_officer_id = user_obj or inspection.customs_inspection_officer_id
                    inspection.save()
                send_customs_cleared_notification(container, actor_name)
            elif new_status == 'CUSTOMS_HOLD':
                inspection = container.latest_customs_inspection
                if inspection:
                    inspection.customs_inspection_status = 'ON_HOLD'
                    inspection.customs_inspection_result = 'HOLD'
                    inspection.customs_inspection_completed_at = timezone.now()
                    inspection.customs_inspection_officer_id = user_obj or inspection.customs_inspection_officer_id
                    inspection.save()
                send_customs_hold_notification(container, remarks or 'Inspection issue', actor_name)
            elif new_status == 'RELEASED':
                if not container.latest_gate_release:
                    GateRelease.objects.create(
                        gate_release_container_id=container,
                        gate_release_officer_id=user_obj,
                        gate_release_previous_status=current_status,
                        gate_release_new_status='RELEASED',
                        gate_release_truck_number=request.data.get('truck_number', 'TRUCK-DEFAULT'),
                        gate_release_driver_name=request.data.get('driver_name', 'Gate Carrier Driver'),
                        gate_release_driver_license=request.data.get('driver_license', 'LIC-VERIFIED'),
                        gate_release_exit_point=request.data.get('exit_point', 'Main Gate Exit'),
                        gate_release_remarks=remarks or '',
                        gate_release_time=timezone.now()
                    )
                send_container_released_notification(container, request.data.get('truck_number', ''), actor_name)

            audit_category = (
                'CUSTOMS' if new_status in ['AWAITING_CUSTOMS', 'UNDER_INSPECTION', 'CLEARED', 'CUSTOMS_HOLD']
                else ('GATE_OPERATIONS' if new_status == 'RELEASED' else 'CONTAINER')
            )

            create_audit_log(
                user=user_obj or login_obj,
                actor_name=actor_name,
                role=role_display,
                action='STATUS_CHANGE',
                category=audit_category,
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Transitioned container {container.container_number} status from {current_status} to {new_status}.{remarks_text}",
                status='SUCCESS',
                request=request
            )

            return Response(
                {
                    "status": "success",
                    "message": f"Container {container.container_number} status transitioned to {new_status}.",
                    "data": ContainerSerializer(container).data
                },
                status=status.HTTP_200_OK
            )


class CargoContainersSummaryAPIView(APIView):
    """
    Cargo Container Manifest & Summary Statistics API View.
    GET: Retrieve all containers for a specific Cargo, including total containers count,
         calculated TEU capacity, and status breakdown.
    """
    permission_classes = [AllowAny]

    def get(self, request, cargo_id):
        try:
            cargo = Cargo.objects.select_related(
                'cargo_arrival_request_id',
                'cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(cargo_id=cargo_id)
        except Cargo.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Cargo #{cargo_id} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        if normalized_role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id
            if not company_obj or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to access container data for this cargo."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
        elif normalized_role in ['terminal_logistics_operator', 'terminal_operator']:
            # Verify Terminal Operator is accessing eligible cargo
            arrival_req = cargo.cargo_arrival_request_id
            if not arrival_req or arrival_req.vessel_arrival_request_status != 'APPROVED':
                return Response(
                    {
                        "status": "error",
                        "message": "Terminal Operator can only access container data for cargo with an APPROVED arrival request."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )


        containers = Container.objects.filter(container_cargo_id=cargo).order_by('-container_created_at', '-container_id')

        total_teu = 0.0
        status_breakdown = {
            'REGISTERED': 0,
            'ARRIVED': 0,
            'AT_TERMINAL': 0,
            'AWAITING_CUSTOMS': 0,
            'UNDER_INSPECTION': 0,
            'CUSTOMS_HOLD': 0,
            'CLEARED': 0,
            'RELEASED': 0
        }

        for c in containers:
            total_teu += c.teu_equivalent
            if c.container_status in status_breakdown:
                status_breakdown[c.container_status] += 1

        declared_qty = float(cargo.cargo_quantity) if cargo.cargo_quantity is not None else 0.0
        capacity_mismatch = False
        if cargo.cargo_unit == 'TEU':
            capacity_mismatch = round(total_teu, 2) != round(declared_qty, 2)
        elif cargo.cargo_unit == 'FEU':
            capacity_mismatch = round(total_teu / 2.0, 2) != round(declared_qty, 2)

        return Response(
            {
                "status": "success",
                "cargo": {
                    "cargo_id": cargo.cargo_id,
                    "cargo_description": cargo.cargo_description,
                    "cargo_type": cargo.cargo_type,
                    "cargo_type_display": cargo.get_cargo_type_display(),
                    "cargo_quantity": str(cargo.cargo_quantity),
                    "cargo_unit": cargo.cargo_unit,
                    "cargo_weight": str(cargo.cargo_weight),
                    "cargo_origin": cargo.cargo_origin,
                    "cargo_destination": cargo.cargo_destination,
                    "vessel_name": cargo.arrival_request.vessel_arrival_request_vessel_id.vessel_name if cargo.arrival_request else '',
                    "vessel_imo_number": cargo.arrival_request.vessel_arrival_request_vessel_id.vessel_imo_number if cargo.arrival_request else '',
                    "arrival_request_id": cargo.arrival_request.vessel_arrival_request_id if cargo.arrival_request else None
                },
                "summary": {
                    "total_containers": containers.count(),
                    "total_teu": round(total_teu, 2),
                    "status_breakdown": status_breakdown,
                    "declared_cargo_quantity": declared_qty,
                    "declared_cargo_unit": cargo.cargo_unit,
                    "capacity_mismatch": capacity_mismatch,
                    "mismatch_message": (
                        f"Declared cargo quantity ({declared_qty} {cargo.cargo_unit}) and currently registered container capacity ({round(total_teu, 2)} TEU) do not match."
                        if capacity_mismatch else None
                    )
                },
                "data": ContainerSerializer(containers, many=True).data
            },
            status=status.HTTP_200_OK
        )


class CustomsContainersListAPIView(APIView):
    """
    Customs Officer Worklist and Overview Statistics API View.
    GET: Retrieve containers eligible for customs clearance (AWAITING_CUSTOMS, UNDER_INSPECTION, CUSTOMS_HOLD, CLEARED).
         Computes summary counts for Customs Dashboard cards.
    """
    permission_classes = [IsCustomsOfficer]

    def get(self, request):
        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search')
        cargo_id = request.query_params.get('cargo_id')

        # Eligible customs stages only (registered, arrived, at_terminal are terminal/shipping stages)
        eligible_statuses = ['AWAITING_CUSTOMS', 'UNDER_INSPECTION', 'CUSTOMS_HOLD', 'CLEARED']
        base_queryset = Container.objects.filter(
            container_status__in=eligible_statuses
        ).select_related(
            'container_cargo_id',
            'container_cargo_id__cargo_arrival_request_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'container_cargo_id__cargo_arrival_request_id__schedule',
            'container_cargo_id__cargo_origin_port_id',
            'container_cargo_id__cargo_destination_port_id'
        ).prefetch_related('customs_inspections').order_by('-container_updated_at', '-container_id')

        # Compute summary counts
        pending_count = base_queryset.filter(container_status='AWAITING_CUSTOMS').count()
        inspecting_count = base_queryset.filter(container_status='UNDER_INSPECTION').count()
        cleared_count = base_queryset.filter(container_status='CLEARED').count()
        hold_count = base_queryset.filter(container_status='CUSTOMS_HOLD').count()
        info_req_count = base_queryset.filter(container_customs_status='ADDITIONAL_INFORMATION_REQUIRED').count()

        summary = {
            'pending_customs': pending_count,
            'under_inspection': inspecting_count,
            'cleared': cleared_count,
            'on_hold': hold_count,
            'info_required': info_req_count,
            'total_customs': base_queryset.count(),
            'total_customs_containers': base_queryset.count()
        }

        queryset = base_queryset

        if cargo_id:
            queryset = queryset.filter(container_cargo_id_id=cargo_id)

        if status_filter and status_filter.lower() != 'all':
            s_clean = status_filter.strip().upper().replace(' ', '_')
            if s_clean in ['PENDING', 'AWAITING_CUSTOMS', 'PENDING_CUSTOMS']:
                queryset = queryset.filter(container_status='AWAITING_CUSTOMS')
            elif s_clean in ['UNDER_INSPECTION', 'INSPECTION', 'INSPECTING']:
                queryset = queryset.filter(container_status='UNDER_INSPECTION')
            elif s_clean in ['CLEARED']:
                queryset = queryset.filter(container_status='CLEARED')
            elif s_clean in ['HOLD', 'CUSTOMS_HOLD', 'ON_HOLD']:
                queryset = queryset.filter(container_status='CUSTOMS_HOLD')
            elif s_clean in ['ADDITIONAL_INFO', 'ADDITIONAL_INFORMATION_REQUIRED', 'INFO_REQUIRED']:
                queryset = queryset.filter(container_customs_status='ADDITIONAL_INFORMATION_REQUIRED')
            else:
                queryset = queryset.filter(container_status__iexact=s_clean)

        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                models.Q(container_number__icontains=q) |
                models.Q(container_cargo_id__cargo_description__icontains=q) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=q) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_imo_number__icontains=q)
            )

        serializer = ContainerSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "counts": summary,
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class CustomsContainerDetailAPIView(APIView):
    """
    Detailed Container Inspection View for Customs Officers.
    GET: Retrieve full container, cargo, vessel, and customs inspection details.
    """
    permission_classes = [IsCustomsOfficer]

    def get(self, request, pk):
        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
                'container_cargo_id__cargo_arrival_request_id__schedule',
                'container_cargo_id__cargo_origin_port_id',
                'container_cargo_id__cargo_destination_port_id'
            ).prefetch_related('customs_inspections').get(container_id=pk)
        except Container.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Container #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        role = request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else None)
        normalized_role = str(role).strip().lower() if role else ''

        # Ensure non-admin users cannot access containers that haven't reached customs
        eligible_statuses = ['AWAITING_CUSTOMS', 'UNDER_INSPECTION', 'CUSTOMS_HOLD', 'CLEARED', 'RELEASED']
        if normalized_role not in ['port_administrator', 'admin', 'port administrator']:
            if container.container_status not in eligible_statuses:
                return Response(
                    {
                        "status": "error",
                        "message": (
                            f"Container {container.container_number} is in '{container.get_container_status_display()}' status "
                            f"and has not yet reached the Customs stage. Containers must first be received and moved to "
                            f"Awaiting Customs by Terminal Operations."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = ContainerSerializer(container)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class CustomsStartInspectionAPIView(APIView):
    """
    Start Inspection API View.
    POST: Transitions container status from AWAITING_CUSTOMS -> UNDER_INSPECTION.
          Records inspection start date/time, authenticated customs officer, and creates CustomsInspection record.
    """
    permission_classes = [IsCustomsOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response(
                {
                    "status": "error",
                    "message": "Password change required before accessing platform features."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().select_related(
                    'container_cargo_id',
                    'container_cargo_id__cargo_arrival_request_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
                ).get(container_id=pk)
            except Container.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": f"Container #{pk} not found."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            # Container must be in AWAITING_CUSTOMS or CUSTOMS_HOLD (re-inspection)
            if container.container_status not in ['AWAITING_CUSTOMS', 'CUSTOMS_HOLD']:
                return Response(
                    {
                        "status": "error",
                        "message": (
                            f"Cannot start inspection. Container {container.container_number} is in '{container.get_container_status_display()}' status. "
                            f"Only containers in 'Awaiting Customs' (or resuming from 'Customs Hold') can enter inspection."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            prev_status = container.container_status
            container.container_status = 'UNDER_INSPECTION'
            container.save(update_fields=['container_status', 'container_updated_at'])

            officer_name = user_obj.user_full_name if user_obj else (login_obj.login_email if login_obj else 'Customs Officer')

            # Create or update CustomsInspection record
            inspection = CustomsInspection.objects.create(
                customs_inspection_container_id=container,
                customs_inspection_officer_id=user_obj,
                customs_inspection_status='IN_PROGRESS',
                customs_inspection_document_status='PENDING',
                customs_inspection_started_at=timezone.now(),
                customs_inspection_remarks=request.data.get('remarks', '')
            )

            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Customs Officer',
                action='START_INSPECTION',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Customs Officer {officer_name} started physical/document inspection on container {container.container_number} (Transition: {prev_status} -> UNDER_INSPECTION).",
                status='SUCCESS',
                request=request
            )

            return Response(
                {
                    "status": "success",
                    "message": f"Inspection started for container {container.container_number}.",
                    "data": ContainerSerializer(container).data,
                    "inspection": CustomsInspectionSerializer(inspection).data
                },
                status=status.HTTP_200_OK
            )


class CustomsSubmitInspectionAPIView(APIView):
    """
    Submit Inspection API View (Clearance or Customs Hold).
    POST: Processes inspection result (CLEARED or HOLD).
          - If CLEARED: Requires document verification status == VERIFIED. Updates container status to CLEARED. Dispatches clearance notification.
          - If HOLD: Requires hold_reason and remarks. Updates container status to CUSTOMS_HOLD. Dispatches hold notification.
    """
    permission_classes = [IsCustomsOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response(
                {
                    "status": "error",
                    "message": "Password change required before accessing platform features."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CustomsInspectionSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Inspection submission validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        inspection_result = serializer.validated_data['inspection_result']
        doc_status = serializer.validated_data.get('document_verification_status', 'VERIFIED')
        remarks = serializer.validated_data.get('remarks', '')
        hold_reason = serializer.validated_data.get('hold_reason', '')

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().select_related(
                    'container_cargo_id',
                    'container_cargo_id__cargo_arrival_request_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
                ).get(container_id=pk)
            except Container.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": f"Container #{pk} not found."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            # Container must be awaiting customs review, under inspection, or on customs hold
            if container.container_status not in ['UNDER_INSPECTION', 'AWAITING_CUSTOMS', 'CUSTOMS_HOLD']:
                return Response(
                    {
                        "status": "error",
                        "message": (
                            f"Container {container.container_number} is in '{container.get_container_status_display()}' status. "
                            f"Inspection result can only be submitted for containers currently awaiting customs review or under inspection."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            officer_name = user_obj.user_full_name if user_obj else (login_obj.login_email if login_obj else 'Customs Officer')

            # Retrieve or create active inspection record
            inspection = container.customs_inspections.filter(customs_inspection_status='IN_PROGRESS').order_by('-customs_inspection_started_at').first()
            if not inspection:
                inspection = CustomsInspection(
                    customs_inspection_container_id=container,
                    customs_inspection_officer_id=user_obj,
                    customs_inspection_started_at=timezone.now()
                )

            if inspection_result == 'CLEARED':
                # Document verification status must be VERIFIED
                if doc_status != 'VERIFIED':
                    return Response(
                        {
                            "status": "error",
                            "message": "Cannot clear container: Document verification status must be 'VERIFIED' to complete clearance."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                container.container_status = 'CLEARED'
                container.container_customs_status = 'CLEARED'
                container.save(update_fields=['container_status', 'container_customs_status', 'container_updated_at'])

                inspection.customs_inspection_officer_id = user_obj or inspection.customs_inspection_officer_id
                inspection.customs_inspection_status = 'COMPLETED'
                inspection.customs_inspection_result = 'CLEARED'
                inspection.customs_inspection_document_status = 'VERIFIED'
                inspection.customs_inspection_remarks = remarks
                inspection.customs_inspection_clearance_date = timezone.now()
                inspection.customs_inspection_completed_at = timezone.now()
                inspection.save()

                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=officer_name,
                    role='Customs Officer',
                    action='CLEAR_CONTAINER',
                    category='CUSTOMS',
                    target_type='Container',
                    target_id=str(container.container_id),
                    description=f"Container {container.container_number} cleared by Customs Officer {officer_name}. Verification: Verified.{' Remarks: ' + remarks if remarks else ''}",
                    status='SUCCESS',
                    request=request
                )

                # Send email notification
                send_customs_cleared_notification(container, officer_name)

                return Response(
                    {
                        "status": "success",
                        "message": f"Container {container.container_number} has been cleared by Customs and is ready for the next operational stage.",
                        "data": ContainerSerializer(container).data,
                        "inspection": CustomsInspectionSerializer(inspection).data
                    },
                    status=status.HTTP_200_OK
                )

            elif inspection_result in ['HOLD', 'CUSTOMS_HOLD']:
                container.container_status = 'CUSTOMS_HOLD'
                container.container_customs_status = 'CUSTOMS_HOLD'
                container.save(update_fields=['container_status', 'container_customs_status', 'container_updated_at'])

                inspection.customs_inspection_officer_id = user_obj or inspection.customs_inspection_officer_id
                inspection.customs_inspection_status = 'ON_HOLD'
                inspection.customs_inspection_result = 'HOLD'
                inspection.customs_inspection_document_status = doc_status
                inspection.customs_inspection_hold_reason = hold_reason
                inspection.customs_inspection_remarks = remarks
                inspection.customs_inspection_completed_at = timezone.now()
                inspection.save()

                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=officer_name,
                    role='Customs Officer',
                    action='CUSTOMS_HOLD',
                    category='CUSTOMS',
                    target_type='Container',
                    target_id=str(container.container_id),
                    description=f"Container {container.container_number} placed on Customs Hold by {officer_name}. Reason: {inspection.get_customs_inspection_hold_reason_display()}. Remarks: {remarks}",
                    status='SUCCESS',
                    request=request
                )

                # Send email notification
                send_customs_hold_notification(container, inspection.get_customs_inspection_hold_reason_display(), officer_name)

                return Response(
                    {
                        "status": "success",
                        "message": f"Container {container.container_number} has been placed on Customs Hold.",
                        "data": ContainerSerializer(container).data,
                        "inspection": CustomsInspectionSerializer(inspection).data
                    },
                    status=status.HTTP_200_OK
                )

            elif inspection_result == 'ADDITIONAL_INFORMATION_REQUIRED':
                container.container_customs_status = 'ADDITIONAL_INFORMATION_REQUIRED'
                container.save(update_fields=['container_customs_status', 'container_updated_at'])

                inspection.customs_inspection_officer_id = user_obj or inspection.customs_inspection_officer_id
                inspection.customs_inspection_status = 'IN_PROGRESS'
                inspection.customs_inspection_document_status = 'ISSUE_FOUND'
                inspection.customs_inspection_remarks = remarks
                inspection.save()

                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=officer_name,
                    role='Customs Officer',
                    action='REQUEST_ADDITIONAL_INFO',
                    category='CUSTOMS',
                    target_type='Container',
                    target_id=str(container.container_id),
                    description=f"Additional information requested for container {container.container_number} by Customs Officer {officer_name}. Remarks: {remarks}",
                    status='SUCCESS',
                    request=request
                )

                return Response(
                    {
                        "status": "success",
                        "message": f"Additional information requested for container {container.container_number}.",
                        "data": ContainerSerializer(container).data,
                        "inspection": CustomsInspectionSerializer(inspection).data
                    },
                    status=status.HTTP_200_OK
                )

            elif inspection_result == 'UNDER_INSPECTION':
                container.container_status = 'UNDER_INSPECTION'
                container.container_customs_status = 'UNDER_INSPECTION'
                container.save(update_fields=['container_status', 'container_customs_status', 'container_updated_at'])

                inspection.customs_inspection_officer_id = user_obj or inspection.customs_inspection_officer_id
                inspection.customs_inspection_status = 'IN_PROGRESS'
                inspection.customs_inspection_remarks = remarks
                inspection.save()

                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=officer_name,
                    role='Customs Officer',
                    action='UNDER_INSPECTION',
                    category='CUSTOMS',
                    target_type='Container',
                    target_id=str(container.container_id),
                    description=f"Container {container.container_number} flagged for physical customs examination by Customs Officer {officer_name}. Remarks: {remarks or 'Physical inspection required.'}",
                    status='SUCCESS',
                    request=request
                )

                return Response(
                    {
                        "status": "success",
                        "message": f"Container {container.container_number} marked for physical inspection.",
                        "data": ContainerSerializer(container).data,
                        "inspection": CustomsInspectionSerializer(inspection).data
                    },
                    status=status.HTTP_200_OK
                )


class CustomsDocumentUploadAPIView(APIView):
    """
    Customs Document Upload API View (Normal Post-Arrival & Pre-Arrival Workflow).
    POST: Uploads one or more supporting customs documents (Bill of Lading, Commercial Invoice,
          Packing List, Certificate of Origin, Import Declaration, etc.) for a container.
    Endpoints:
      - /api/customs/containers/<int:container_id>/documents/
      - /api/customs/documents/upload/
    Authorized: Shipping Company (ownership enforced), Customs Officer, Port Administrator, Port Operations Officer.
    Safety: Uploading documents does NOT automatically mark customs as CLEARED.
    """
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'doc', 'docx'}
    MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

    def get(self, request, container_id=None):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        target_container_id = container_id or request.query_params.get('container_id')
        if not target_container_id:
            return Response({"status": "error", "message": "container_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(container_id=target_container_id)
        except Container.DoesNotExist:
            return Response(
                {"status": "error", "message": f"Container #{target_container_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if role in ['shipping_company']:
            cargo = container.container_cargo_id
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id if (cargo and cargo.cargo_arrival_request_id) else None
            container_company = vessel.vessel_shipping_company_id if vessel else None
            if not user_company or not container_company or user_company.shipping_company_id != container_company.shipping_company_id:
                return Response(
                    {"status": "error", "message": "Access denied to customs documents for another shipping company's container."},
                    status=status.HTTP_403_FORBIDDEN
                )

        docs = container.customs_documents.select_related('document_uploaded_by', 'document_reviewed_by').all()
        return Response(
            {
                "status": "success",
                "container_id": container.container_id,
                "container_number": container.container_number,
                "data": CustomsDocumentSerializer(docs, many=True).data
            },
            status=status.HTTP_200_OK
        )

    def post(self, request, container_id=None):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response(
                {
                    "status": "error",
                    "message": "Password change required before accessing platform features."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        # Validate request payload
        data = request.data
        target_container_id = container_id or data.get('container_id')
        if not target_container_id and data.get('container_number'):
            try:
                target_container = Container.objects.get(container_number__iexact=str(data.get('container_number')).strip())
                target_container_id = target_container.container_id
            except Container.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": f"Container with number '{data.get('container_number')}' not found."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

        if not target_container_id:
            return Response(
                {
                    "status": "error",
                    "message": "container_id or container_number is required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Retrieve container
        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(container_id=target_container_id)
        except (Container.DoesNotExist, ValueError):
            return Response(
                {
                    "status": "error",
                    "message": f"Container #{target_container_id} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Company ownership check for shipping companies
        if role in ['shipping_company']:
            cargo = container.container_cargo_id
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id if (cargo and cargo.cargo_arrival_request_id) else None
            container_company = vessel.vessel_shipping_company_id if vessel else None
            if not user_company or not container_company or user_company.shipping_company_id != container_company.shipping_company_id:
                return Response(
                    {
                        "status": "error",
                        "message": "You are not authorized to submit customs documents for another shipping company's container."
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        # Extract files: support 'files', 'file', 'document', 'documents'
        upload_files = []
        for key in ['files', 'file', 'document', 'documents']:
            if key in request.FILES:
                upload_files.extend(request.FILES.getlist(key))

        if not upload_files:
            return Response(
                {
                    "status": "error",
                    "message": "No document file was provided. Please choose a valid file from your computer to submit."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file extensions & sizes
        for f in upload_files:
            ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
            if ext not in self.ALLOWED_EXTENSIONS:
                allowed_str = ", ".join(sorted(self.ALLOWED_EXTENSIONS)).upper()
                return Response(
                    {
                        "status": "error",
                        "message": f"File '{f.name}' has an unsupported extension (.{ext}). Supported formats: {allowed_str}."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            if f.size > self.MAX_FILE_SIZE:
                return Response(
                    {
                        "status": "error",
                        "message": f"File '{f.name}' exceeds the maximum allowed upload limit of 15 MB ({f.size / (1024 * 1024):.1f} MB)."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Resolve manifest or per-file document types
        manifest_raw = data.get('document_manifest')
        manifest_dict = {}
        manifest_list = []
        if manifest_raw:
            try:
                import json
                parsed_manifest = json.loads(manifest_raw) if isinstance(manifest_raw, str) else manifest_raw
                if isinstance(parsed_manifest, list):
                    manifest_list = parsed_manifest
                    for item in parsed_manifest:
                        if isinstance(item, dict):
                            fn = item.get('filename') or item.get('name')
                            if fn:
                                manifest_dict[fn] = item
            except Exception:
                pass

        types_list = request.POST.getlist('document_types') if hasattr(request, 'POST') else []
        default_doc_type = data.get('document_type')
        valid_types = [c[0] for c in CustomsDocument.DOCUMENT_TYPE_CHOICES]

        workflow_type = data.get('workflow_type', 'NORMAL')
        valid_workflows = [w[0] for w in CustomsDocument.WORKFLOW_TYPE_CHOICES]
        if workflow_type not in valid_workflows:
            workflow_type = 'NORMAL'

        notes = (data.get('notes') or data.get('document_notes') or data.get('remarks') or '').strip()
        has_per_file_metadata = bool(manifest_list or manifest_dict or types_list)

        # Validate that EVERY file has a valid document type
        resolved_types = []
        resolved_notes = []
        for idx, f in enumerate(upload_files):
            f_type = None
            f_notes = notes
            # 1. Match by index in manifest list
            if idx < len(manifest_list) and isinstance(manifest_list[idx], dict):
                f_type = manifest_list[idx].get('document_type')
                if manifest_list[idx].get('notes'):
                    f_notes = manifest_list[idx].get('notes')
            # 2. Match by filename in manifest dict
            if not f_type and f.name in manifest_dict:
                f_type = manifest_dict[f.name].get('document_type')
                if manifest_dict[f.name].get('notes'):
                    f_notes = manifest_dict[f.name].get('notes')
            # 3. Match by index in parallel types_list
            if not f_type and idx < len(types_list) and types_list[idx]:
                f_type = types_list[idx]
            # 4. Match by indexed post keys
            if not f_type and data.get(f'document_type_{idx}'):
                f_type = data.get(f'document_type_{idx}')
            if not f_type and data.get(f'document_type_{f.name}'):
                f_type = data.get(f'document_type_{f.name}')
            # 5. Backward compatibility: if no per-file metadata was sent, allow default_doc_type
            if not f_type and not has_per_file_metadata and default_doc_type:
                f_type = default_doc_type

            if not f_type or not str(f_type).strip():
                return Response(
                    {
                        "status": "error",
                        "message": f"Document type is required for file '{f.name}'. Please assign a valid document category."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            clean_type = str(f_type).strip().upper()
            if clean_type in ['CUSTOMS_IMPORT_DECLARATION', 'IMPORT_DECLARATION', 'BILL_OF_ENTRY']:
                clean_type = 'CUSTOMS_IMPORT_DECLARATION' if 'CUSTOMS_IMPORT_DECLARATION' in valid_types else 'IMPORT_DECLARATION'
            elif clean_type not in valid_types:
                allowed_str = ", ".join(valid_types)
                return Response(
                    {
                        "status": "error",
                        "message": f"Invalid document type '{f_type}' for file '{f.name}'. Allowed document categories: {allowed_str}."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            resolved_types.append(clean_type)
            resolved_notes.append(f_notes)

        # Atomic creation of documents
        with transaction.atomic():
            created_docs = []
            active_inspection = container.customs_inspections.filter(
                customs_inspection_status__in=['IN_PROGRESS', 'ON_HOLD', 'PENDING']
            ).order_by('-customs_inspection_started_at').first()

            for idx, f in enumerate(upload_files):
                doc = CustomsDocument.objects.create(
                    document_container_id=container,
                    document_inspection_id=active_inspection,
                    document_type=resolved_types[idx],
                    workflow_type=workflow_type,
                    document_file=f,
                    document_name=f.name,
                    file_size=f.size,
                    file_type=getattr(f, 'content_type', '') or '',
                    document_notes=resolved_notes[idx],
                    document_version=1,
                    document_is_active=True,
                    document_uploaded_by=user_obj,
                    document_uploaded_at=timezone.now(),
                    document_review_status='PENDING'
                )
                created_docs.append(doc)

            # Advance customs status if unsubmitted (DO NOT mark as cleared!)
            if container.container_customs_status in ['NOT_SUBMITTED', 'ADDITIONAL_INFORMATION_REQUIRED']:
                container.container_customs_status = 'PENDING_REVIEW'
                container.save(update_fields=['container_customs_status', 'container_updated_at'])

            actor_name = user_obj.user_full_name if user_obj else (login_obj.login_email if login_obj else 'User')
            actor_role = role.replace('_', ' ').title() if role else 'User'

            type_summary = ", ".join([d.get_document_type_display() for d in created_docs])
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=actor_name,
                role=actor_role,
                action='UPLOAD_CUSTOMS_DOCUMENTS',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=(
                    f"{actor_name} ({actor_role}) submitted {len(created_docs)} customs document(s) "
                    f"[{type_summary}] for container {container.container_number} "
                    f"in {dict(CustomsDocument.WORKFLOW_TYPE_CHOICES).get(workflow_type, workflow_type)} workflow."
                ),
                status='SUCCESS',
                request=request
            )

            serialized_docs = CustomsDocumentSerializer(created_docs, many=True).data
            return Response(
                {
                    "status": "success",
                    "message": f"Successfully submitted {len(created_docs)} customs document(s) for container {container.container_number}.",
                    "documents": serialized_docs,
                    "container": ContainerSerializer(container).data
                },
                status=status.HTTP_201_CREATED
            )


class CustomsDocumentListAPIView(APIView):
    """
    List Customs Supporting Documents for a container.
    GET /api/customs/containers/<int:container_id>/documents/
    """
    def get(self, request, container_id):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(container_id=container_id)
        except Container.DoesNotExist:
            return Response(
                {"status": "error", "message": f"Container #{container_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if role in ['shipping_company']:
            cargo = container.container_cargo_id
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id if (cargo and cargo.cargo_arrival_request_id) else None
            container_company = vessel.vessel_shipping_company_id if vessel else None
            if not user_company or not container_company or user_company.shipping_company_id != container_company.shipping_company_id:
                return Response(
                    {"status": "error", "message": "Access denied to customs documents for another shipping company's container."},
                    status=status.HTTP_403_FORBIDDEN
                )

        docs = container.customs_documents.select_related('document_uploaded_by', 'document_reviewed_by').all()
        return Response(
            {
                "status": "success",
                "container_id": container.container_id,
                "container_number": container.container_number,
                "data": CustomsDocumentSerializer(docs, many=True).data
            },
            status=status.HTTP_200_OK
        )


class CustomsDocumentReviewAPIView(APIView):
    """
    Customs Officer Document Verification Decision.
    POST /api/customs/documents/<int:pk>/review/
    Authorized: Customs Officer, Port Administrator.
    Strictly blocked for Shipping Company and Terminal Operators.
    """
    permission_classes = [IsCustomsOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        if role in ['shipping_company', 'terminal_logistics_operator', 'terminal_operator']:
            return Response(
                {"status": "error", "message": "Only authorized Customs Officers can review or verify customs documents."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CustomsDocumentReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "message": "Validation failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        review_status = serializer.validated_data['review_status']
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            try:
                doc = CustomsDocument.objects.select_for_update().select_related('document_container_id').get(document_id=pk)
            except CustomsDocument.DoesNotExist:
                return Response(
                    {"status": "error", "message": f"Document #{pk} not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            now = timezone.now()
            doc.document_review_status = review_status
            doc.document_review_remarks = remarks
            doc.document_reviewed_by = user_obj
            doc.document_reviewed_at = now
            doc.save()

            container = doc.document_container_id
            officer_name = user_obj.user_full_name if user_obj else 'Customs Officer'

            # If there's an active inspection, update its document_status
            inspection = doc.document_inspection_id or container.latest_customs_inspection
            if inspection:
                if review_status == 'REJECTED':
                    inspection.customs_inspection_document_status = 'ISSUE_FOUND'
                    inspection.save(update_fields=['customs_inspection_document_status', 'customs_inspection_updated_at'])
                elif review_status == 'VERIFIED':
                    # Check if all documents for this container are now verified
                    has_unverified = container.customs_documents.exclude(document_review_status='VERIFIED').exists()
                    if not has_unverified:
                        inspection.customs_inspection_document_status = 'VERIFIED'
                        inspection.save(update_fields=['customs_inspection_document_status', 'customs_inspection_updated_at'])

            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Customs Officer',
                action='REVIEW_CUSTOMS_DOCUMENT',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Customs Officer {officer_name} reviewed document '{doc.document_name}' ({doc.get_document_type_display()}) as {review_status}. Remarks: {remarks or 'None'}",
                status='SUCCESS',
                request=request
            )

            return Response(
                {
                    "status": "success",
                    "message": f"Document '{doc.document_name}' marked as {doc.get_document_review_status_display()}.",
                    "data": CustomsDocumentSerializer(doc).data
                },
                status=status.HTTP_200_OK
            )


class CustomsDecisionHistoryAPIView(APIView):
    """
    Dedicated Customs Decision & Inspection History View.
    Endpoint: GET /api/customs/history/
    Authorized: Customs Officer, Port Administrator.
    Queries existing audit log infrastructure for all customs decisions and inspection actions.
    """
    permission_classes = [IsCustomsOfficer]

    def get(self, request):
        search_query = request.query_params.get('search', '').strip()
        action_filter = request.query_params.get('action', '').strip()
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 20)

        try:
            page = max(1, int(page))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = max(1, min(100, int(page_size)))
        except (ValueError, TypeError):
            page_size = 20

        # Query audit logs for customs category or customs actions
        queryset = AuditLog.objects.select_related(
            'audit_log_user_id',
            'audit_log_user_id__login_id'
        ).filter(
            models.Q(audit_log_category='CUSTOMS') |
            models.Q(audit_log_action__in=[
                'CLEAR_CONTAINER', 'CUSTOMS_HOLD', 'START_INSPECTION',
                'REVIEW_PRE_ARRIVAL_DECLARATION', 'REVIEW_CUSTOMS_DOCUMENT',
                'REQUEST_ADDITIONAL_INFO', 'UNDER_INSPECTION'
            ])
        ).order_by('-audit_log_timestamp', '-audit_log_id')

        if action_filter and action_filter.lower() != 'all':
            a_clean = action_filter.strip().upper()
            if a_clean in ['CLEARED', 'CLEAR_CONTAINER']:
                queryset = queryset.filter(models.Q(audit_log_action='CLEAR_CONTAINER') | models.Q(audit_log_description__icontains='cleared'))
            elif a_clean in ['HOLD', 'CUSTOMS_HOLD']:
                queryset = queryset.filter(models.Q(audit_log_action='CUSTOMS_HOLD') | models.Q(audit_log_description__icontains='hold'))
            elif a_clean in ['ADDITIONAL_INFO', 'INFO_REQUIRED', 'REQUEST_ADDITIONAL_INFO']:
                queryset = queryset.filter(models.Q(audit_log_action='REQUEST_ADDITIONAL_INFO') | models.Q(audit_log_description__icontains='additional information'))
            elif a_clean in ['INSPECTION', 'START_INSPECTION', 'UNDER_INSPECTION']:
                queryset = queryset.filter(models.Q(audit_log_action__in=['START_INSPECTION', 'UNDER_INSPECTION']) | models.Q(audit_log_description__icontains='inspection'))
            elif a_clean in ['DOCUMENT', 'REVIEW_CUSTOMS_DOCUMENT']:
                queryset = queryset.filter(audit_log_action='REVIEW_CUSTOMS_DOCUMENT')
            elif a_clean in ['PRE_ARRIVAL', 'REVIEW_PRE_ARRIVAL_DECLARATION']:
                queryset = queryset.filter(audit_log_action='REVIEW_PRE_ARRIVAL_DECLARATION')
            else:
                queryset = queryset.filter(audit_log_action__iexact=a_clean)

        if search_query:
            queryset = queryset.filter(
                models.Q(audit_log_actor_name__icontains=search_query) |
                models.Q(audit_log_user_id__user_full_name__icontains=search_query) |
                models.Q(audit_log_target_id__icontains=search_query) |
                models.Q(audit_log_description__icontains=search_query) |
                models.Q(audit_log_action__icontains=search_query)
            )

        total_count = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        page_records = queryset[start:end]

        serializer = AuditLogSerializer(page_records, many=True)
        return Response({
            "status": "success",
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if total_count > 0 else 1,
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class CustomsDocumentDownloadAPIView(APIView):
    """
    Secure Customs Document Download and Preview API View.
    GET /api/customs/documents/<int:pk>/download/
    Restricted to authorized Customs Officers, Port Admin, Operations, or the owning Shipping Line.
    """
    def get(self, request, pk):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        # Synthetic negative IDs from pre-arrival declarations
        if pk < 0:
            decl_id = abs(pk)
            try:
                decl = PreArrivalCustomsDeclaration.objects.select_related(
                    'declaration_container_id',
                    'declaration_shipping_company_id'
                ).get(declaration_id=decl_id)
            except PreArrivalCustomsDeclaration.DoesNotExist:
                return Response({"status": "error", "message": "Pre-arrival document not found."}, status=status.HTTP_404_NOT_FOUND)

            if role in ['shipping_company']:
                if not user_company or user_company.shipping_company_id != decl.declaration_shipping_company_id_id:
                    return Response({"status": "error", "message": "Access denied to another shipping company's documents."}, status=status.HTTP_403_FORBIDDEN)

            if not decl.declaration_document:
                return Response({"status": "error", "message": "Document file not found."}, status=status.HTTP_404_NOT_FOUND)

            try:
                import os
                f_path = decl.declaration_document.path
                if not os.path.exists(f_path):
                    return Response({"status": "error", "message": "Physical file does not exist on storage."}, status=status.HTTP_404_NOT_FOUND)
                is_inline = request.query_params.get('inline') == '1' or request.query_params.get('preview') == '1'
                content_type = 'application/pdf' if f_path.endswith('.pdf') else 'application/octet-stream'
                response = FileResponse(open(f_path, 'rb'), content_type=content_type)
                disp = 'inline' if is_inline else 'attachment'
                filename = decl.declaration_document_name or os.path.basename(f_path)
                response['Content-Disposition'] = f'{disp}; filename="{filename}"'
                return response
            except Exception as e:
                return Response({"status": "error", "message": f"Error accessing file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            doc = CustomsDocument.objects.select_related(
                'document_container_id',
                'document_container_id__container_cargo_id',
                'document_container_id__container_cargo_id__cargo_arrival_request_id',
                'document_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'document_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(document_id=pk)
        except CustomsDocument.DoesNotExist:
            return Response(
                {"status": "error", "message": f"Document #{pk} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        container = doc.document_container_id
        if role in ['shipping_company']:
            cargo = container.container_cargo_id
            vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id if (cargo and cargo.cargo_arrival_request_id) else None
            container_company = vessel.vessel_shipping_company_id if vessel else None
            if not user_company or not container_company or user_company.shipping_company_id != container_company.shipping_company_id:
                return Response(
                    {"status": "error", "message": "Access denied to another shipping company's documents."},
                    status=status.HTTP_403_FORBIDDEN
                )

        if not doc.document_file:
            return Response({"status": "error", "message": "Document has no associated file."}, status=status.HTTP_404_NOT_FOUND)

        try:
            import os
            f_path = doc.document_file.path
            if not os.path.exists(f_path):
                return Response({"status": "error", "message": "Physical file does not exist on storage."}, status=status.HTTP_404_NOT_FOUND)

            is_inline = request.query_params.get('inline') == '1' or request.query_params.get('preview') == '1'
            content_type = doc.file_type or ('application/pdf' if f_path.endswith('.pdf') else 'application/octet-stream')
            response = FileResponse(open(f_path, 'rb'), content_type=content_type)
            disp = 'inline' if is_inline else 'attachment'
            filename = doc.document_name or os.path.basename(f_path)
            response['Content-Disposition'] = f'{disp}; filename="{filename}"'
            return response
        except Exception as e:
            return Response({"status": "error", "message": f"Error accessing file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomsDocumentDeleteAPIView(APIView):
    """
    Delete Customs Supporting Document.
    DELETE /api/customs/documents/<int:pk>/
    POST /api/customs/documents/<int:pk>/delete/
    Authorized: Submitting Shipping Line (owner), Customs Officer, Port Administrator.
    Rules:
    - PENDING documents can be safely removed/withdrawn before official customs review.
    - VERIFIED documents or documents belonging to CLEARED containers CANNOT be silently deleted.
    - Cleans up storage file safely when physical deletion is permitted.
    """
    def _handle_delete(self, request, pk):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        try:
            doc = CustomsDocument.objects.select_related(
                'document_container_id',
                'document_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(document_id=pk)
        except CustomsDocument.DoesNotExist:
            return Response({"status": "error", "message": f"Document #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

        container = doc.document_container_id
        cargo = container.container_cargo_id
        vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id if (cargo and cargo.cargo_arrival_request_id) else None
        container_company = vessel.vessel_shipping_company_id if vessel else None

        # Ownership check
        if role in ['shipping_company']:
            if not user_company or not container_company or user_company.shipping_company_id != container_company.shipping_company_id:
                return Response(
                    {"status": "error", "message": "You are not authorized to delete another shipping company's documents."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Disallow deletion of verified or cleared documents
        if doc.document_review_status == 'VERIFIED':
            return Response(
                {
                    "status": "error",
                    "message": "Documents already verified by Customs cannot be deleted. Please use the authorized amendment/replacement workflow."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if container.is_customs_cleared:
            return Response(
                {
                    "status": "error",
                    "message": "Customs documents cannot be deleted for a container that has already received official clearance."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        doc_name = doc.document_name
        doc_type_disp = doc.get_document_type_display()
        file_path = doc.document_file.path if (doc.document_file and hasattr(doc.document_file, 'path')) else None

        with transaction.atomic():
            # Delete document record
            doc.delete()

            # Physical file cleanup if no other record references it
            if file_path:
                try:
                    import os
                    still_referenced = CustomsDocument.objects.filter(document_file=doc.document_file.name).exists()
                    if not still_referenced and os.path.exists(file_path):
                        os.remove(file_path)
                except Exception:
                    pass

            actor_name = user_obj.user_full_name if user_obj else 'User'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=actor_name,
                role=role.replace('_', ' ').title() if role else 'User',
                action='DELETE_CUSTOMS_DOCUMENT',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"{actor_name} deleted customs document '{doc_name}' ({doc_type_disp}) for container {container.container_number}.",
                status='SUCCESS',
                request=request
            )

        return Response(
            {
                "status": "success",
                "message": f"Document '{doc_name}' has been successfully deleted.",
                "remaining_count": container.customs_documents.count()
            },
            status=status.HTTP_200_OK
        )

    def delete(self, request, pk):
        return self._handle_delete(request, pk)

    def post(self, request, pk):
        return self._handle_delete(request, pk)


class CustomsDocumentReplaceAPIView(APIView):
    """
    Replace or Amend an existing Customs Supporting Document.
    POST /api/customs/documents/<int:pk>/replace/
    Authorized: Submitting Shipping Line (owner), Customs Officer, Port Administrator.
    Rules:
    - Retains version history: marks old document as SUPERSEDED with replacement link and amendment reason.
    - Creates new document version with incremented version number.
    - Mandatory amendment reason if the document was previously VERIFIED or container is CLEARED.
    - If container was CLEARED, resets customs status to PENDING_REVIEW (does not preserve clearance blindly).
    - If replacement fails, leaves previous valid file completely intact.
    """
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'doc', 'docx'}
    MAX_FILE_SIZE = 15 * 1024 * 1024

    def post(self, request, pk):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        try:
            old_doc = CustomsDocument.objects.select_related(
                'document_container_id',
                'document_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
            ).get(document_id=pk)
        except CustomsDocument.DoesNotExist:
            return Response({"status": "error", "message": f"Document #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

        container = old_doc.document_container_id
        cargo = container.container_cargo_id
        vessel = cargo.cargo_arrival_request_id.vessel_arrival_request_vessel_id if (cargo and cargo.cargo_arrival_request_id) else None
        container_company = vessel.vessel_shipping_company_id if vessel else None

        # Ownership check
        if role in ['shipping_company']:
            if not user_company or not container_company or user_company.shipping_company_id != container_company.shipping_company_id:
                return Response(
                    {"status": "error", "message": "You are not authorized to amend another shipping company's documents."},
                    status=status.HTTP_403_FORBIDDEN
                )

        new_file = request.FILES.get('file') or request.FILES.get('document')
        if not new_file:
            return Response(
                {"status": "error", "message": "Replacement file is required. Please choose a valid file to upload."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extension and size validation
        ext = new_file.name.split('.')[-1].lower() if '.' in new_file.name else ''
        if ext not in self.ALLOWED_EXTENSIONS:
            allowed_str = ", ".join(sorted(self.ALLOWED_EXTENSIONS)).upper()
            return Response(
                {"status": "error", "message": f"File '{new_file.name}' has an unsupported extension (.{ext}). Supported formats: {allowed_str}."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if new_file.size > self.MAX_FILE_SIZE:
            return Response(
                {"status": "error", "message": f"File '{new_file.name}' exceeds the maximum allowed upload limit of 15 MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = (request.data.get('amendment_reason') or request.data.get('reason') or '').strip()
        is_verified_or_cleared = (old_doc.document_review_status == 'VERIFIED' or container.is_customs_cleared)
        if is_verified_or_cleared and not reason:
            return Response(
                {
                    "status": "error",
                    "message": "Amendment reason is strictly required when replacing a verified document or a document on a cleared shipment."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        doc_type = request.data.get('document_type') or old_doc.document_type
        valid_types = [c[0] for c in CustomsDocument.DOCUMENT_TYPE_CHOICES]
        if doc_type not in valid_types:
            doc_type = old_doc.document_type

        notes = (request.data.get('notes') or old_doc.document_notes or '').strip()

        with transaction.atomic():
            now = timezone.now()
            # 1. Create new replacement document
            new_doc = CustomsDocument.objects.create(
                document_container_id=container,
                document_inspection_id=old_doc.document_inspection_id,
                document_declaration_id=old_doc.document_declaration_id,
                document_type=doc_type,
                workflow_type=old_doc.workflow_type,
                document_file=new_file,
                document_name=new_file.name,
                file_size=new_file.size,
                file_type=getattr(new_file, 'content_type', '') or '',
                document_notes=notes,
                document_version=old_doc.document_version + 1,
                document_is_active=True,
                document_amendment_reason=reason,
                document_uploaded_by=user_obj,
                document_uploaded_at=now,
                document_review_status='PENDING'
            )

            # 2. Mark old document as superseded
            old_doc.document_is_active = False
            old_doc.document_review_status = 'SUPERSEDED'
            old_doc.document_replaced_by = new_doc
            if reason:
                old_doc.document_amendment_reason = reason
            old_doc.save(update_fields=['document_is_active', 'document_review_status', 'document_replaced_by', 'document_amendment_reason', 'document_updated_at'])

            # 3. If pre-arrival declaration had info required or was linked, update
            decl = old_doc.document_declaration_id
            if decl:
                decl.declaration_document = new_file
                decl.declaration_document_name = new_file.name
                if decl.declaration_status in ['ADDITIONAL_INFORMATION_REQUIRED', 'CUSTOMS_HOLD']:
                    history = decl.declaration_review_history or []
                    history.append({
                        'action': 'CORRECTION_RESUBMITTED',
                        'replaced_doc_id': old_doc.document_id,
                        'new_doc_id': new_doc.document_id,
                        'reason': reason,
                        'submitted_by': user_obj.user_full_name if user_obj else 'Shipping Agent',
                        'submitted_at': now.isoformat()
                    })
                    decl.declaration_review_history = history
                    decl.declaration_status = 'PENDING_REVIEW'
                decl.save()

            # 4. Re-evaluate customs status if cleared or info required
            if container.is_customs_cleared:
                container.container_customs_status = 'PENDING_REVIEW'
                container.container_status = 'UNDER_INSPECTION'
                container.save(update_fields=['container_customs_status', 'container_status', 'container_updated_at'])
                insp = container.latest_customs_inspection
                if insp and insp.customs_inspection_result == 'CLEARED':
                    insp.customs_inspection_result = 'PENDING'
                    insp.customs_inspection_status = 'IN_PROGRESS'
                    insp.save(update_fields=['customs_inspection_result', 'customs_inspection_status', 'customs_inspection_updated_at'])
            elif container.container_customs_status in ['NOT_SUBMITTED', 'ADDITIONAL_INFORMATION_REQUIRED']:
                container.container_customs_status = 'PENDING_REVIEW'
                container.save(update_fields=['container_customs_status', 'container_updated_at'])

            actor_name = user_obj.user_full_name if user_obj else 'User'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=actor_name,
                role=role.replace('_', ' ').title() if role else 'User',
                action='REPLACE_CUSTOMS_DOCUMENT',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=(
                    f"{actor_name} replaced document #{old_doc.document_id} ({old_doc.document_name}) "
                    f"with new version {new_doc.document_version} ('{new_doc.document_name}'). Reason: {reason or 'Not specified'}"
                ),
                status='SUCCESS',
                request=request
            )

            return Response(
                {
                    "status": "success",
                    "message": f"Successfully uploaded replacement document (v{new_doc.document_version}) for '{old_doc.document_name}'.",
                    "data": CustomsDocumentSerializer(new_doc).data,
                    "superseded_document_id": old_doc.document_id
                },
                status=status.HTTP_201_CREATED
            )


class GateContainersListAPIView(APIView):
    """
    Gate & Truck Operations Worklist API View.
    GET: Retrieves containers in the gate release pipeline with summary counts.
         Default worklist shows ONLY CLEARED containers eligible for gate release.
    """
    permission_classes = [IsGateTruckOfficer]

    def get(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response(
                {
                    "status": "error",
                    "message": "Password change required before accessing platform features."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search', '').strip()

        # Gate pipeline includes containers that have reached customs and gate stages
        eligible_statuses = ['CLEARED', 'RELEASED', 'CUSTOMS_HOLD', 'UNDER_INSPECTION', 'AWAITING_CUSTOMS']
        base_queryset = Container.objects.filter(
            container_status__in=eligible_statuses
        ).select_related(
            'container_cargo_id',
            'container_cargo_id__cargo_arrival_request_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'container_cargo_id__cargo_arrival_request_id__schedule',
            'container_cargo_id__cargo_origin_port_id',
            'container_cargo_id__cargo_destination_port_id'
        ).prefetch_related('customs_inspections', 'gate_releases').order_by('-container_updated_at', '-container_id')

        cleared_count = base_queryset.filter(container_status='CLEARED').count()
        pending_count = base_queryset.filter(container_status__in=['AWAITING_CUSTOMS', 'UNDER_INSPECTION']).count()
        released_count = base_queryset.filter(container_status='RELEASED').count()
        hold_count = base_queryset.filter(container_status='CUSTOMS_HOLD').count()

        summary = {
            'cleared_for_release': cleared_count,
            'pending_gate_verification': pending_count,
            'released': released_count,
            'on_hold': hold_count,
            'total': base_queryset.count()
        }

        # Filtering logic: By default, worklist contains ONLY containers that are CLEARED
        if not status_filter or status_filter.upper() == 'CLEARED':
            queryset = base_queryset.filter(container_status='CLEARED')
        elif status_filter.upper() == 'RELEASED':
            queryset = base_queryset.filter(container_status='RELEASED')
        elif status_filter.upper() in ['HOLD', 'CUSTOMS_HOLD']:
            queryset = base_queryset.filter(container_status='CUSTOMS_HOLD')
        elif status_filter.upper() in ['PENDING', 'CUSTOMS_PENDING']:
            queryset = base_queryset.filter(container_status__in=['AWAITING_CUSTOMS', 'UNDER_INSPECTION'])
        elif status_filter.lower() == 'all':
            queryset = base_queryset
        else:
            queryset = base_queryset.filter(container_status__iexact=status_filter)

        if search_query:
            q = search_query
            queryset = queryset.filter(
                models.Q(container_number__icontains=q) |
                models.Q(container_cargo_id__cargo_description__icontains=q) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=q) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_imo_number__icontains=q) |
                models.Q(gate_releases__gate_release_truck_number__icontains=q) |
                models.Q(gate_releases__gate_release_driver_name__icontains=q)
            ).distinct()

        serializer = ContainerSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "counts": summary,
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class GateContainerDetailAPIView(APIView):
    """
    Detailed Container Gate Verification View.
    GET: Retrieve full container, cargo, vessel, customs inspection, and gate release details.
    """
    permission_classes = [IsGateTruckOfficer]

    def get(self, request, pk):
        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
                'container_cargo_id__cargo_arrival_request_id__schedule',
                'container_cargo_id__cargo_origin_port_id',
                'container_cargo_id__cargo_destination_port_id'
            ).prefetch_related('customs_inspections', 'gate_releases').get(container_id=pk)
        except Container.DoesNotExist:
            return Response(
                {
                    "status": "error",
                    "message": f"Container #{pk} not found."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ContainerSerializer(container)
        return Response(
            {
                "status": "success",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class ContainerReleaseAPIView(APIView):
    """
    Gate Container Release API View.
    POST: Processes final gate release verification (CLEARED -> RELEASED).
          Records truck number, driver name, driver license, exit point, remarks,
          authenticated gate officer, and timestamp.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response(
                {
                    "status": "error",
                    "message": "Password change required before accessing platform features."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = GateReleaseSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "status": "error",
                    "message": "Gate release validation failed.",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().select_related(
                    'container_cargo_id',
                    'container_cargo_id__cargo_arrival_request_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
                ).get(container_id=pk)
            except Container.DoesNotExist:
                return Response(
                    {
                        "status": "error",
                        "message": f"Container #{pk} not found."
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

            current_status = container.container_status

            # Strict check: Cannot release if on Customs Hold
            if current_status == 'CUSTOMS_HOLD':
                return Response(
                    {
                        "status": "error",
                        "message": f"Cannot release container {container.container_number}: Container is on Customs Hold and release is strictly blocked until hold is resolved and customs clearance is granted."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Strict check: Container must be in CLEARED status
            if current_status != 'CLEARED':
                return Response(
                    {
                        "status": "error",
                        "message": (
                            f"Cannot release container {container.container_number}: Container is currently in '{container.get_container_status_display()}' status. "
                            f"A container can be released only when its status is 'CLEARED'."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Strict check: Customs Inspection record verification
            inspection = container.latest_customs_inspection
            if not inspection or inspection.customs_inspection_result != 'CLEARED':
                return Response(
                    {
                        "status": "error",
                        "message": f"Cannot release container {container.container_number}: Active customs inspection has not been completed with 'CLEARED' result."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if inspection.customs_inspection_document_status != 'VERIFIED':
                return Response(
                    {
                        "status": "error",
                        "message": f"Cannot release container {container.container_number}: Customs document verification status must be 'VERIFIED' to grant gate release."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            prev_status = container.container_status
            container.container_status = 'RELEASED'
            container.container_delivery_status = 'RELEASED'
            container.container_delivery_location = serializer.validated_data['exit_point']
            container.save(update_fields=['container_status', 'container_delivery_status', 'container_delivery_location', 'container_updated_at'])

            officer_name = user_obj.user_full_name if user_obj else (login_obj.login_email if login_obj else 'Gate & Truck Operations Officer')

            release_record = GateRelease.objects.create(
                gate_release_container_id=container,
                gate_release_officer_id=user_obj,
                gate_release_previous_status=prev_status,
                gate_release_new_status='RELEASED',
                gate_release_truck_number=serializer.validated_data['truck_number'],
                gate_release_driver_name=serializer.validated_data['driver_name'],
                gate_release_driver_license=serializer.validated_data['driver_license'],
                gate_release_exit_point=serializer.validated_data['exit_point'],
                gate_release_remarks=serializer.validated_data.get('remarks', ''),
                gate_release_time=timezone.now()
            )

            # Ensure baseline RELEASED tracking event exists
            if not container.tracking_events.filter(tracking_event_status='RELEASED').exists():
                ContainerTrackingEvent.objects.create(
                    tracking_event_container_id=container,
                    tracking_event_gate_pass_id=container.latest_gate_pass,
                    tracking_event_status='RELEASED',
                    tracking_event_location=serializer.validated_data['exit_point'],
                    tracking_event_description=f"Physical gate exit completed ({serializer.validated_data['exit_point']}). Container officially released for delivery tracking.",
                    tracking_event_updated_by=user_obj,
                    tracking_event_timestamp=timezone.now()
                )

            remarks = serializer.validated_data.get('remarks', '').strip()
            remarks_text = f" Remarks: {remarks}" if remarks else ""

            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Gate & Truck Operations Officer',
                action='RELEASE_CONTAINER',
                category='GATE_OPERATIONS',
                target_type='Container',
                target_id=str(container.container_id),
                description=(
                    f"Container {container.container_number} verified and released through gate by Officer {officer_name}. "
                    f"Truck: {release_record.gate_release_truck_number}, Driver: {release_record.gate_release_driver_name} "
                    f"(License: {release_record.gate_release_driver_license}), Exit Point: {release_record.gate_release_exit_point}. "
                    f"Transition: {prev_status} -> RELEASED.{remarks_text}"
                ),
                status='SUCCESS',
                request=request
            )

            send_container_released_notification(container, release_record.gate_release_truck_number, officer_name)

            return Response(
                {
                    "status": "success",
                    "message": f"Container {container.container_number} has been verified and successfully released through {release_record.gate_release_exit_point}.",
                    "data": ContainerSerializer(container).data,
                    "release": GateReleaseSerializer(release_record).data
                },
                status=status.HTTP_200_OK
            )


# =============================================================================
# DIGITAL GATE PASS & QR VERIFICATION WORKFLOW API VIEWS
# =============================================================================

class GateTruckListCreateAPIView(APIView):
    """
    Truck Directory API View.
    GET: List registered trucks (supports ?search= and ?status=).
    POST: Register a new truck in the system.
    """
    permission_classes = [IsGateTruckOfficer]

    def get(self, request):
        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search', '').strip()

        qs = Truck.objects.all().order_by('truck_number')
        if status_filter and status_filter.upper() != 'ALL':
            qs = qs.filter(truck_status=status_filter.upper())
        if search_query:
            qs = qs.filter(
                models.Q(truck_number__icontains=search_query) |
                models.Q(truck_company_name__icontains=search_query)
            )

        serializer = TruckSerializer(qs, many=True)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = TruckSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Truck registration validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        truck = serializer.save()
        create_audit_log(
            user=get_authenticated_user_and_company(request)[1],
            action='REGISTER_TRUCK',
            category='GATE_OPERATIONS',
            target_type='Truck',
            target_id=str(truck.truck_id),
            description=f"Truck {truck.truck_number} ({truck.truck_company_name or 'Independent'}) registered in fleet.",
            request=request
        )
        return Response({
            "status": "success",
            "message": f"Truck {truck.truck_number} registered successfully.",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)


class GateDriverListCreateAPIView(APIView):
    """
    Driver Directory API View.
    GET: List registered drivers (supports ?search= and ?status=).
    POST: Register a new driver with verified identification, license, and registered email.
    """
    permission_classes = [IsGateTruckOfficer]

    def get(self, request):
        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search', '').strip()

        qs = Driver.objects.all().order_by('driver_name')
        if status_filter and status_filter.upper() != 'ALL':
            qs = qs.filter(driver_status=status_filter.upper())
        if search_query:
            qs = qs.filter(
                models.Q(driver_name__icontains=search_query) |
                models.Q(driver_license_number__icontains=search_query) |
                models.Q(driver_email__icontains=search_query) |
                models.Q(driver_phone__icontains=search_query)
            )

        serializer = DriverSerializer(qs, many=True)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DriverSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Driver registration validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        driver = serializer.save()
        create_audit_log(
            user=get_authenticated_user_and_company(request)[1],
            action='REGISTER_DRIVER',
            category='GATE_OPERATIONS',
            target_type='Driver',
            target_id=str(driver.driver_id),
            description=f"Driver {driver.driver_name} (License: {driver.driver_license_number}, Email: {driver.driver_email}) registered.",
            request=request
        )
        return Response({
            "status": "success",
            "message": f"Driver {driver.driver_name} registered successfully.",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)


class GateListAPIView(APIView):
    """
    Port Gates Directory API View.
    GET: List designated port entry/exit gates.
    """
    permission_classes = [IsGateTruckOfficer]

    def get(self, request):
        gates = Gate.objects.filter(gate_is_active=True).order_by('gate_name')
        serializer = GateSerializer(gates, many=True)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class GatePassListAPIView(APIView):
    """
    Digital Gate Pass List API View.
    GET: List Digital Gate Passes.
    Accessible to Gate & Truck Officers and Port Administrators (all records),
    and Shipping Companies (filtered strictly to their own containers).
    """
    def get_permissions(self):
        return [AllowAny()]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not login_obj and not user_obj:
            return Response({"status": "error", "message": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()
        allowed_roles = [
            'gate_truck_officer', 'gate_truck_operations_officer', 'gate_officer',
            'port_administrator', 'admin', 'port administrator', 'shipping_company'
        ]
        if role not in allowed_roles:
            return Response({"status": "error", "message": "You do not have permission to view Digital Gate Passes."}, status=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get('status')
        search_query = request.query_params.get('search', '').strip()

        qs = GatePass.objects.select_related(
            'gate_pass_truck_id', 'gate_pass_driver_id', 'gate_pass_gate_id', 'gate_pass_issued_by'
        ).prefetch_related(
            'containers__gate_pass_container_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
        ).order_by('-gate_pass_created_at', '-gate_pass_id')

        # RBAC scoping for Shipping Company
        if role == 'shipping_company':
            if not company_obj:
                return Response({"status": "success", "data": []}, status=status.HTTP_200_OK)
            qs = qs.filter(
                containers__gate_pass_container_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id=company_obj
            ).distinct()

        # Update any expired passes dynamically
        now = timezone.now()
        expired_passes = qs.filter(gate_pass_status='ACTIVE', gate_pass_valid_until__lt=now)
        if expired_passes.exists():
            expired_passes.update(gate_pass_status='EXPIRED')

        if status_filter and status_filter.upper() != 'ALL':
            qs = qs.filter(gate_pass_status=status_filter.upper())

        if search_query:
            qs = qs.filter(
                models.Q(gate_pass_pass_number__icontains=search_query) |
                models.Q(gate_pass_movement_number__icontains=search_query) |
                models.Q(gate_pass_truck_id__truck_number__icontains=search_query) |
                models.Q(gate_pass_driver_id__driver_name__icontains=search_query) |
                models.Q(containers__gate_pass_container_container_id__container_number__icontains=search_query)
            ).distinct()

        serializer = GatePassSerializer(qs, many=True)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class GatePassDetailAPIView(APIView):
    """
    Retrieve single Digital Gate Pass details.
    """
    def get(self, request, pk):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        if not login_obj and not user_obj:
            return Response({"status": "error", "message": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        try:
            gate_pass = GatePass.objects.select_related(
                'gate_pass_truck_id', 'gate_pass_driver_id', 'gate_pass_gate_id', 'gate_pass_issued_by'
            ).prefetch_related('containers__gate_pass_container_container_id').get(gate_pass_id=pk)
        except GatePass.DoesNotExist:
            return Response({"status": "error", "message": f"Digital Gate Pass #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

        # Scoping check for Shipping Company
        if role == 'shipping_company':
            linked = gate_pass.containers.filter(
                gate_pass_container_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id=company_obj
            ).exists()
            if not linked:
                return Response({"status": "error", "message": "Unauthorized access to this gate pass."}, status=status.HTTP_403_FORBIDDEN)

        # Dynamic expiry check
        if gate_pass.gate_pass_status == 'ACTIVE' and timezone.now() > gate_pass.gate_pass_valid_until:
            gate_pass.gate_pass_status = 'EXPIRED'
            gate_pass.save(update_fields=['gate_pass_status'])

        serializer = GatePassSerializer(gate_pass)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class GatePassGenerateAPIView(APIView):
    """
    Generate Digital Gate Pass API View.
    Strictly restricted to Gate & Truck Operations Officer.
    Validates truck, driver (with registered email), gate, and individually validates every container.
    Generates QR code reference and automatically dispatches pass email to driver's registered email.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response({"status": "error", "message": "Password change required before accessing platform features."}, status=status.HTTP_403_FORBIDDEN)

        # Role enforcement: Shipping Company, Customs Officer, Terminal Operator strictly denied
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()
        if role in ['shipping_company', 'customs_officer', 'terminal_operator', 'terminal_logistics_operator']:
            return Response({"status": "error", "message": f"Role '{role}' is not authorized to generate a Digital Gate Pass."}, status=status.HTTP_403_FORBIDDEN)

        serializer = GatePassGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Gate pass generation validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        truck_id = serializer.validated_data['truck_id']
        driver_id = serializer.validated_data['driver_id']
        gate_id = serializer.validated_data['gate_id']
        container_ids = serializer.validated_data['container_ids']
        valid_hours = serializer.validated_data.get('valid_hours', 24)
        remarks = serializer.validated_data.get('remarks', '').strip()

        # 1. Validate Truck
        try:
            truck = Truck.objects.get(truck_id=truck_id)
        except Truck.DoesNotExist:
            return Response({"status": "error", "message": f"Truck #{truck_id} not found."}, status=status.HTTP_400_BAD_REQUEST)
        if truck.truck_status != 'ACTIVE':
            return Response({"status": "error", "message": f"Truck {truck.truck_number} is not active (current status: {truck.get_truck_status_display()})."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Validate Driver
        try:
            driver = Driver.objects.get(driver_id=driver_id)
        except Driver.DoesNotExist:
            return Response({"status": "error", "message": f"Driver #{driver_id} not found."}, status=status.HTTP_400_BAD_REQUEST)
        if driver.driver_status != 'ACTIVE':
            return Response({"status": "error", "message": f"Driver {driver.driver_name} is suspended or inactive."}, status=status.HTTP_400_BAD_REQUEST)
        if not driver.driver_email or not driver.driver_email.strip():
            return Response({"status": "error", "message": f"Driver {driver.driver_name} does not have a registered email address. A valid driver email is required for automatic gate pass dispatch."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Validate Gate
        try:
            gate = Gate.objects.get(gate_id=gate_id)
        except Gate.DoesNotExist:
            return Response({"status": "error", "message": f"Port Gate #{gate_id} not found."}, status=status.HTTP_400_BAD_REQUEST)
        if not gate.gate_is_active:
            return Response({"status": "error", "message": f"Port Gate {gate.gate_name} is currently inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Validate Each Container Individually (Partial Eligibility check)
        containers = []
        for cid in container_ids:
            try:
                container = Container.objects.get(container_id=cid)
            except Container.DoesNotExist:
                return Response({"status": "error", "message": f"Container #{cid} not found."}, status=status.HTTP_400_BAD_REQUEST)

            c_num = container.container_number

            # Status check
            if container.container_status == 'CUSTOMS_HOLD':
                return Response({
                    "status": "error",
                    "message": f"Container {c_num} is on Customs Hold and release authorization is strictly blocked until hold is resolved and customs clearance is granted."
                }, status=status.HTTP_400_BAD_REQUEST)

            if container.container_status != 'CLEARED':
                return Response({
                    "status": "error",
                    "message": f"Container {c_num} is currently in '{container.get_container_status_display()}' status. A container can be included in a Digital Gate Pass only when its status is 'CLEARED'."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Customs Inspection check
            inspection = container.latest_customs_inspection
            if not inspection or inspection.customs_inspection_result != 'CLEARED':
                return Response({
                    "status": "error",
                    "message": f"Container {c_num} cannot be authorized: Active customs inspection has not been completed with 'CLEARED' result."
                }, status=status.HTTP_400_BAD_REQUEST)

            if inspection.customs_inspection_document_status != 'VERIFIED':
                return Response({
                    "status": "error",
                    "message": f"Container {c_num} cannot be authorized: Customs document verification status must be 'VERIFIED' to grant gate release."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Duplicate active pass check
            active_assoc = GatePassContainer.objects.filter(
                gate_pass_container_container_id=container,
                gate_pass_container_gate_pass_id__gate_pass_status='ACTIVE'
            ).select_related('gate_pass_container_gate_pass_id').first()
            if active_assoc:
                existing_gp = active_assoc.gate_pass_container_gate_pass_id
                return Response({
                    "status": "error",
                    "message": f"Container {c_num} already has an active Digital Gate Pass ({existing_gp.gate_pass_pass_number}). Duplicate active passes are strictly disallowed."
                }, status=status.HTTP_400_BAD_REQUEST)

            containers.append(container)

        with transaction.atomic():
            current_year = timezone.now().year
            last_gp = GatePass.objects.order_by('-gate_pass_id').first()
            seq = (last_gp.gate_pass_id + 1) if last_gp else 1
            pass_number = f"GP-{current_year}-{seq:05d}"
            movement_number = f"GM-{current_year}-{seq:05d}"

            verification_code = f"VREF-{secrets.token_hex(6).upper()}"
            qr_payload = generate_verification_payload(pass_number, verification_code)
            valid_until = timezone.now() + timezone.timedelta(hours=valid_hours)

            gate_pass = GatePass.objects.create(
                gate_pass_pass_number=pass_number,
                gate_pass_movement_number=movement_number,
                gate_pass_truck_id=truck,
                gate_pass_driver_id=driver,
                gate_pass_gate_id=gate,
                gate_pass_issued_by=user_obj,
                gate_pass_status='ACTIVE',
                gate_pass_verification_code=verification_code,
                gate_pass_qr_code=qr_payload,
                gate_pass_valid_until=valid_until,
                gate_pass_remarks=remarks,
                gate_pass_email_status='PENDING'
            )

            for container in containers:
                GatePassContainer.objects.create(
                    gate_pass_container_gate_pass_id=gate_pass,
                    gate_pass_container_container_id=container
                )

                # Ensure baseline RELEASED tracking event exists
                if not container.tracking_events.filter(tracking_event_status='RELEASED').exists():
                    ContainerTrackingEvent.objects.create(
                        tracking_event_container_id=container,
                        tracking_event_status='RELEASED',
                        tracking_event_location='Port Terminal Yard',
                        tracking_event_description='Container cleared customs and authorized for gate logistics.',
                        tracking_event_updated_by=user_obj,
                        tracking_event_timestamp=timezone.now()
                    )

                # Record GATE_PASS_GENERATED tracking event
                ContainerTrackingEvent.objects.create(
                    tracking_event_container_id=container,
                    tracking_event_gate_pass_id=gate_pass,
                    tracking_event_status='GATE_PASS_GENERATED',
                    tracking_event_location=gate.gate_name,
                    tracking_event_description=f"Digital Gate Pass {pass_number} generated for truck pickup (Truck: {truck.truck_number}, Driver: {driver.driver_name}).",
                    tracking_event_updated_by=user_obj,
                    tracking_event_timestamp=timezone.now()
                )

                container.container_delivery_status = 'GATE_PASS_GENERATED'
                if not container.container_delivery_destination:
                    container.container_delivery_destination = f"{gate.gate_name} -> Regional Distribution Facility"
                container.save(update_fields=['container_delivery_status', 'container_delivery_destination', 'container_updated_at'])

        officer_name = user_obj.user_full_name if user_obj else 'Gate & Truck Operations Officer'

        create_audit_log(
            user=user_obj or login_obj,
            actor_name=officer_name,
            role='Gate & Truck Operations Officer',
            action='GENERATE_GATE_PASS',
            category='GATE_OPERATIONS',
            target_type='GatePass',
            target_id=str(gate_pass.gate_pass_id),
            description=(
                f"Digital Gate Pass {pass_number} (Movement: {movement_number}) generated. "
                f"Truck: {truck.truck_number}, Driver: {driver.driver_name} (Email: {driver.driver_email}), "
                f"Gate: {gate.gate_name}, Authorized Containers: {', '.join([c.container_number for c in containers])}. "
                f"Valid Until: {valid_until.strftime('%Y-%m-%d %H:%M UTC')}."
            ),
            status='SUCCESS',
            request=request
        )

        email_sent, email_err = send_gate_pass_driver_email(gate_pass)
        if email_sent:
            gate_pass.gate_pass_email_status = 'SENT'
            gate_pass.gate_pass_email_sent_at = timezone.now()
            gate_pass.save(update_fields=['gate_pass_email_status', 'gate_pass_email_sent_at', 'gate_pass_updated_at'])
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Gate & Truck Operations Officer',
                action='EMAIL_GATE_PASS_SENT',
                category='GATE_OPERATIONS',
                target_type='GatePass',
                target_id=str(gate_pass.gate_pass_id),
                description=f"Digital Gate Pass {pass_number} automatically emailed to driver {driver.driver_name} ({driver.driver_email}).",
                status='SUCCESS',
                request=request
            )
        else:
            gate_pass.gate_pass_email_status = 'FAILED'
            gate_pass.gate_pass_email_error = email_err
            gate_pass.save(update_fields=['gate_pass_email_status', 'gate_pass_email_error', 'gate_pass_updated_at'])
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Gate & Truck Operations Officer',
                action='EMAIL_GATE_PASS_FAILED',
                category='GATE_OPERATIONS',
                target_type='GatePass',
                target_id=str(gate_pass.gate_pass_id),
                description=f"Failed to email Digital Gate Pass {pass_number} to {driver.driver_email}: {email_err}",
                status='FAILED',
                request=request
            )

        serialized = GatePassSerializer(gate_pass).data
        return Response({
            "status": "success",
            "message": f"Digital Gate Pass {pass_number} successfully generated.",
            "data": serialized,
            "email_dispatched": email_sent,
            "email_warning": None if email_sent else f"Driver email could not be sent: {email_err}. Gate pass is saved; you can retry sending the email."
        }, status=status.HTTP_201_CREATED)


class GatePassVerifyAPIView(APIView):
    """
    QR Code & Digital Gate Pass Verification API View.
    Strictly verifies existence, ACTIVE status, non-expired, truck/driver validity,
    and ensures all associated containers remain in CLEARED customs status.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request):
        serializer = GatePassVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Verification input required.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        verification_code = serializer.validated_data.get('verification_code', '').strip()
        pass_number = serializer.validated_data.get('pass_number', '').strip()
        qr_data = serializer.validated_data.get('qr_data', '').strip()
        verification_input = serializer.validated_data.get('verification_input', '').strip()

        if verification_input and not qr_data and not pass_number and not verification_code:
            qr_data = verification_input

        if qr_data:
            if qr_data.startswith('PORTIDE-GP:'):
                parts = qr_data.split(':')
                if len(parts) >= 3:
                    pass_number = parts[1]
                    verification_code = parts[2]
                elif len(parts) == 2:
                    pass_number = parts[1]
            else:
                if qr_data.startswith('GP-'):
                    pass_number = qr_data
                elif qr_data.startswith('VREF-'):
                    verification_code = qr_data
                else:
                    verification_code = qr_data

        query = models.Q()
        if pass_number and verification_code:
            query = models.Q(gate_pass_pass_number__iexact=pass_number) | models.Q(gate_pass_verification_code__iexact=verification_code)
        elif pass_number:
            query = models.Q(gate_pass_pass_number__iexact=pass_number)
        elif verification_code:
            query = models.Q(gate_pass_verification_code__iexact=verification_code)

        raw_ref = (qr_data or pass_number or verification_code or verification_input).strip()
        if raw_ref:
            if raw_ref.isdigit():
                query = query | models.Q(gate_pass_id=int(raw_ref))
            query = query | models.Q(gate_pass_pass_number__iexact=raw_ref) | models.Q(gate_pass_verification_code__iexact=raw_ref) | models.Q(gate_pass_qr_code__iexact=raw_ref)

        try:
            gate_pass = GatePass.objects.select_related(
                'gate_pass_truck_id', 'gate_pass_driver_id', 'gate_pass_gate_id', 'gate_pass_issued_by'
            ).prefetch_related('containers__gate_pass_container_container_id').get(query)
        except GatePass.DoesNotExist:
            create_audit_log(
                user=get_authenticated_user_and_company(request)[1],
                action='VERIFICATION_FAILED',
                category='GATE_OPERATIONS',
                target_type='GatePass',
                description=f"QR verification failed: Gate Pass not found for reference '{pass_number or verification_code or qr_data}'.",
                status='FAILED',
                request=request
            )
            return Response({
                "status": "error",
                "message": "Gate Pass not found. Please verify the QR code or pass number."
            }, status=status.HTTP_404_NOT_FOUND)
        except GatePass.MultipleObjectsReturned:
            gate_pass = GatePass.objects.filter(query).first()

        pass_id_display = gate_pass.gate_pass_pass_number

        if gate_pass.gate_pass_status == 'USED':
            return Response({
                "status": "error",
                "message": f"Gate Pass already used. Pass {pass_id_display} was already consumed for gate release and cannot be reused."
            }, status=status.HTTP_400_BAD_REQUEST)

        if gate_pass.gate_pass_status == 'CANCELLED':
            return Response({
                "status": "error",
                "message": f"Gate Pass cancelled. Pass {pass_id_display} has been invalidated and cannot authorize terminal exit."
            }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if gate_pass.gate_pass_status == 'EXPIRED' or now > gate_pass.gate_pass_valid_until:
            if gate_pass.gate_pass_status != 'EXPIRED':
                gate_pass.gate_pass_status = 'EXPIRED'
                gate_pass.save(update_fields=['gate_pass_status'])
            return Response({
                "status": "error",
                "message": f"Gate Pass expired. Validity expired on {gate_pass.gate_pass_valid_until.strftime('%Y-%m-%d %H:%M UTC')}."
            }, status=status.HTTP_400_BAD_REQUEST)

        if gate_pass.gate_pass_truck_id.truck_status != 'ACTIVE':
            return Response({
                "status": "error",
                "message": f"Associated truck {gate_pass.gate_pass_truck_id.truck_number} is currently {gate_pass.gate_pass_truck_id.get_truck_status_display()}."
            }, status=status.HTTP_400_BAD_REQUEST)

        if gate_pass.gate_pass_driver_id.driver_status != 'ACTIVE':
            return Response({
                "status": "error",
                "message": f"Associated driver {gate_pass.gate_pass_driver_id.driver_name} is currently suspended or inactive."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not gate_pass.gate_pass_gate_id.gate_is_active:
            return Response({
                "status": "error",
                "message": f"Designated exit gate {gate_pass.gate_pass_gate_id.gate_name} is currently closed."
            }, status=status.HTTP_400_BAD_REQUEST)

        req_gate_id = serializer.validated_data.get('gate_id')
        if req_gate_id and gate_pass.gate_pass_gate_id:
            if gate_pass.gate_pass_gate_id.gate_id != req_gate_id:
                return Response({
                    "status": "error",
                    "message": f"Designated gate mismatch: Pass {pass_id_display} is assigned to '{gate_pass.gate_pass_gate_id.gate_name}'."
                }, status=status.HTTP_400_BAD_REQUEST)

        assoc_containers = [
            assoc.gate_pass_container_container_id
            for assoc in gate_pass.containers.select_related('gate_pass_container_container_id').all()
        ]
        if not assoc_containers:
            return Response({
                "status": "error",
                "message": f"Gate Pass {pass_id_display} does not contain any authorized containers."
            }, status=status.HTTP_400_BAD_REQUEST)

        for c in assoc_containers:
            if c.container_status == 'CUSTOMS_HOLD' or getattr(c, 'container_customs_status', None) == 'CUSTOMS_HOLD':
                return Response({
                    "status": "error",
                    "message": f"Container {c.container_number} is no longer eligible for release: Container is on Customs Hold."
                }, status=status.HTTP_400_BAD_REQUEST)

            if not c.is_customs_cleared:
                return Response({
                    "status": "error",
                    "message": f"Container {c.container_number} is no longer eligible for release: Current status is '{c.get_container_status_display()}'."
                }, status=status.HTTP_400_BAD_REQUEST)

            inspection = c.latest_customs_inspection
            if not inspection or inspection.customs_inspection_result != 'CLEARED':
                return Response({
                    "status": "error",
                    "message": f"Container {c.container_number} customs clearance is no longer valid."
                }, status=status.HTTP_400_BAD_REQUEST)

            if inspection.customs_inspection_document_status != 'VERIFIED':
                return Response({
                    "status": "error",
                    "message": f"Container {c.container_number} customs documents are not verified."
                }, status=status.HTTP_400_BAD_REQUEST)

        # Direct Transfer checks if applicable
        direct_transfer = getattr(gate_pass, 'direct_transfer_operation', None)
        if direct_transfer:
            if direct_transfer.transfer_status == 'COMPLETED':
                return Response({
                    "status": "error",
                    "message": f"Direct Transfer {direct_transfer.transfer_reference} has already completed gate exit."
                }, status=status.HTTP_400_BAD_REQUEST)
            if direct_transfer.transfer_status == 'CANCELLED':
                return Response({
                    "status": "error",
                    "message": f"Direct Transfer {direct_transfer.transfer_reference} is CANCELLED."
                }, status=status.HTTP_400_BAD_REQUEST)
            if direct_transfer.transfer_status != 'AWAITING_GATE_EXIT':
                return Response({
                    "status": "error",
                    "message": f"Direct Transfer {direct_transfer.transfer_reference} is in '{direct_transfer.get_transfer_status_display()}' status and not awaiting gate exit."
                }, status=status.HTTP_400_BAD_REQUEST)

        gate_pass.gate_pass_verified_at = timezone.now()
        gate_pass.save(update_fields=['gate_pass_verified_at', 'gate_pass_updated_at'])

        officer = get_authenticated_user_and_company(request)[1]
        officer_name = officer.user_full_name if officer else 'Gate & Truck Operations Officer'

        create_audit_log(
            user=officer,
            actor_name=officer_name,
            role='Gate & Truck Operations Officer',
            action='QR_VERIFIED',
            category='GATE_OPERATIONS',
            target_type='GatePass',
            target_id=str(gate_pass.gate_pass_id),
            description=(
                f"Digital Gate Pass {pass_id_display} verified successfully. "
                f"Truck: {gate_pass.gate_pass_truck_id.truck_number}, Driver: {gate_pass.gate_pass_driver_id.driver_name}, "
                f"Gate: {gate_pass.gate_pass_gate_id.gate_name}, Containers: {len(assoc_containers)} verified."
            ),
            status='SUCCESS',
            request=request
        )

        serialized = GatePassSerializer(gate_pass).data
        serialized["checks"] = {
            "pass_exists": True,
            "pass_status": gate_pass.gate_pass_status,
            "is_active": gate_pass.gate_pass_status == 'ACTIVE',
            "not_expired": True,
            "truck_matched": True,
            "driver_matched": True,
            "containers_valid": True,
            "customs_cleared": True,
            "gate_valid": True,
            "reasons": []
        }
        return Response({
            "status": "success",
            "message": "VALID DIGITAL GATE PASS",
            "data": serialized
        }, status=status.HTTP_200_OK)


class GatePassReleaseAPIView(APIView):
    """
    Authorize Final Gate Release API View.
    Processes release of all containers associated with the verified Digital Gate Pass.
    Ensures:
    1. Valid ACTIVE gate pass (not expired, cancelled, or already used).
    2. Physical vehicle & driver match pass records.
    3. Container status transitions: CLEARED -> RELEASED.
    4. Gate Pass status transitions: ACTIVE -> USED.
    5. GateRelease records created and notifications sent.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response({"status": "error", "message": "Password change required before accessing platform features."}, status=status.HTTP_403_FORBIDDEN)

        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()
        if role in ['shipping_company', 'customs_officer', 'terminal_operator', 'terminal_logistics_operator']:
            return Response({"status": "error", "message": f"Role '{role}' is not authorized to release containers."}, status=status.HTTP_403_FORBIDDEN)

        serializer = GatePassReleaseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Release validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        req_truck = serializer.validated_data.get('truck_number', '').strip().upper()
        req_driver = serializer.validated_data.get('driver_name', '').strip()
        req_gate = serializer.validated_data.get('gate_name', '').strip()
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            try:
                gate_pass = GatePass.objects.select_for_update().select_related(
                    'gate_pass_truck_id', 'gate_pass_driver_id', 'gate_pass_gate_id'
                ).get(gate_pass_id=pk)
            except GatePass.DoesNotExist:
                return Response({"status": "error", "message": f"Digital Gate Pass #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

            pass_num = gate_pass.gate_pass_pass_number

            if gate_pass.gate_pass_status == 'USED':
                return Response({"status": "error", "message": f"Gate Pass {pass_num} has already been USED and cannot authorize release again."}, status=status.HTTP_400_BAD_REQUEST)

            if gate_pass.gate_pass_status == 'CANCELLED':
                return Response({"status": "error", "message": f"Gate Pass {pass_num} is CANCELLED and cannot authorize release."}, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            if gate_pass.gate_pass_status == 'EXPIRED' or now > gate_pass.gate_pass_valid_until:
                if gate_pass.gate_pass_status != 'EXPIRED':
                    gate_pass.gate_pass_status = 'EXPIRED'
                    gate_pass.save(update_fields=['gate_pass_status'])
                return Response({"status": "error", "message": f"Gate Pass {pass_num} has EXPIRED and cannot authorize release."}, status=status.HTTP_400_BAD_REQUEST)

            if req_truck and req_truck != gate_pass.gate_pass_truck_id.truck_number.upper():
                return Response({"status": "error", "message": f"Truck mismatch: Physical truck '{req_truck}' does not match authorized gate pass truck '{gate_pass.gate_pass_truck_id.truck_number}'."}, status=status.HTTP_400_BAD_REQUEST)

            if req_driver and req_driver.lower() != gate_pass.gate_pass_driver_id.driver_name.lower():
                return Response({"status": "error", "message": f"Driver mismatch: Physical driver '{req_driver}' does not match authorized gate pass driver '{gate_pass.gate_pass_driver_id.driver_name}'."}, status=status.HTTP_400_BAD_REQUEST)

            if req_gate and req_gate.lower() not in gate_pass.gate_pass_gate_id.gate_name.lower():
                return Response({"status": "error", "message": f"Gate mismatch: Attempted exit at '{req_gate}', expected designated gate '{gate_pass.gate_pass_gate_id.gate_name}'."}, status=status.HTTP_400_BAD_REQUEST)

            assoc_records = gate_pass.containers.select_related('gate_pass_container_container_id').all()
            if not assoc_records:
                return Response({"status": "error", "message": "No containers attached to this gate pass."}, status=status.HTTP_400_BAD_REQUEST)

            c_ids = [a.gate_pass_container_container_id_id for a in assoc_records]
            containers = list(Container.objects.select_for_update().filter(container_id__in=c_ids))

            direct_transfer = getattr(gate_pass, 'direct_transfer_operation', None)
            if direct_transfer:
                if direct_transfer.transfer_status == 'COMPLETED':
                    return Response({"status": "error", "message": f"Direct Transfer {direct_transfer.transfer_reference} has already completed gate exit."}, status=status.HTTP_400_BAD_REQUEST)
                if direct_transfer.transfer_status != 'AWAITING_GATE_EXIT':
                    return Response({"status": "error", "message": f"Direct Transfer {direct_transfer.transfer_reference} is not awaiting gate exit."}, status=status.HTTP_400_BAD_REQUEST)

            for c in containers:
                if c.container_status == 'CUSTOMS_HOLD' or getattr(c, 'container_customs_status', None) == 'CUSTOMS_HOLD':
                    return Response({"status": "error", "message": f"Cannot release: Container {c.container_number} is on Customs Hold."}, status=status.HTTP_400_BAD_REQUEST)
                if not c.is_customs_cleared:
                    return Response({"status": "error", "message": f"Cannot release: Container {c.container_number} does not have CLEARED customs clearance."}, status=status.HTTP_400_BAD_REQUEST)
                inspection = c.latest_customs_inspection
                if inspection and (inspection.customs_inspection_result == 'HOLD' or inspection.customs_inspection_status == 'ON_HOLD'):
                    return Response({"status": "error", "message": f"Cannot release: Container {c.container_number} is on Customs Hold."}, status=status.HTTP_400_BAD_REQUEST)

            if direct_transfer:
                direct_transfer.transfer_status = 'COMPLETED'
                direct_transfer.transfer_completed_at = now
                direct_transfer.transfer_gate_verified_by = user_obj
                direct_transfer.save(update_fields=['transfer_status', 'transfer_completed_at', 'transfer_gate_verified_by', 'transfer_updated_at'])

            officer_name = user_obj.user_full_name if user_obj else 'Gate & Truck Operations Officer'

            release_records = []
            for c in containers:
                prev_status = c.container_status
                c.container_status = 'RELEASED'
                c.container_delivery_status = 'RELEASED'
                c.container_delivery_location = gate_pass.gate_pass_gate_id.gate_name
                c.save(update_fields=['container_status', 'container_delivery_status', 'container_delivery_location', 'container_updated_at'])

                release_rec = GateRelease.objects.create(
                    gate_release_container_id=c,
                    gate_release_gate_pass_id=gate_pass,
                    gate_release_officer_id=user_obj,
                    gate_release_previous_status=prev_status,
                    gate_release_new_status='RELEASED',
                    gate_release_truck_number=gate_pass.gate_pass_truck_id.truck_number,
                    gate_release_driver_name=gate_pass.gate_pass_driver_id.driver_name,
                    gate_release_driver_license=gate_pass.gate_pass_driver_id.driver_license_number,
                    gate_release_exit_point=gate_pass.gate_pass_gate_id.gate_name,
                    gate_release_remarks=remarks or gate_pass.gate_pass_remarks or '',
                    gate_release_time=timezone.now()
                )
                release_records.append(release_rec)

                # Ensure baseline RELEASED tracking event exists
                if not c.tracking_events.filter(tracking_event_status='RELEASED').exists():
                    ContainerTrackingEvent.objects.create(
                        tracking_event_container_id=c,
                        tracking_event_gate_pass_id=gate_pass,
                        tracking_event_status='RELEASED',
                        tracking_event_location=gate_pass.gate_pass_gate_id.gate_name,
                        tracking_event_description=f"Gate exit completed at {gate_pass.gate_pass_gate_id.gate_name}. Container officially released for delivery tracking.",
                        tracking_event_updated_by=user_obj,
                        tracking_event_timestamp=timezone.now()
                    )

                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=officer_name,
                    role='Gate & Truck Operations Officer',
                    action='RELEASE_CONTAINER',
                    category='GATE_OPERATIONS',
                    target_type='Container',
                    target_id=str(c.container_id),
                    description=(
                        f"Container {c.container_number} verified and released through gate via Pass {pass_num}. "
                        f"Truck: {gate_pass.gate_pass_truck_id.truck_number}, Driver: {gate_pass.gate_pass_driver_id.driver_name}, "
                        f"Exit: {gate_pass.gate_pass_gate_id.gate_name}."
                    ),
                    status='SUCCESS',
                    request=request
                )

                send_container_released_notification(c, gate_pass.gate_pass_truck_id.truck_number, officer_name)

            gate_pass.gate_pass_status = 'USED'
            gate_pass.gate_pass_used_at = timezone.now()
            if remarks:
                gate_pass.gate_pass_remarks = (gate_pass.gate_pass_remarks or '') + f" [Release Note: {remarks}]"
            gate_pass.save(update_fields=['gate_pass_status', 'gate_pass_used_at', 'gate_pass_remarks', 'gate_pass_updated_at'])

            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Gate & Truck Operations Officer',
                action='USE_GATE_PASS',
                category='GATE_OPERATIONS',
                target_type='GatePass',
                target_id=str(gate_pass.gate_pass_id),
                description=f"Digital Gate Pass {pass_num} consumed and marked USED. {len(containers)} container(s) released through {gate_pass.gate_pass_gate_id.gate_name}.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Gate Release authorized. {len(containers)} container(s) successfully released through {gate_pass.gate_pass_gate_id.gate_name}.",
            "gate_pass": GatePassSerializer(gate_pass).data,
            "released_containers": [c.container_number for c in containers]
        }, status=status.HTTP_200_OK)


class GatePassCancelAPIView(APIView):
    """
    Cancel an ACTIVE Digital Gate Pass.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request, pk):
        try:
            gate_pass = GatePass.objects.get(gate_pass_id=pk)
        except GatePass.DoesNotExist:
            return Response({"status": "error", "message": f"Gate Pass #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

        if gate_pass.gate_pass_status == 'USED':
            return Response({"status": "error", "message": "Cannot cancel an already USED gate pass."}, status=status.HTTP_400_BAD_REQUEST)

        gate_pass.gate_pass_status = 'CANCELLED'
        gate_pass.gate_pass_cancelled_at = timezone.now()
        gate_pass.save(update_fields=['gate_pass_status', 'gate_pass_cancelled_at', 'gate_pass_updated_at'])

        officer = get_authenticated_user_and_company(request)[1]
        create_audit_log(
            user=officer,
            action='CANCEL_GATE_PASS',
            category='GATE_OPERATIONS',
            target_type='GatePass',
            target_id=str(gate_pass.gate_pass_id),
            description=f"Digital Gate Pass {gate_pass.gate_pass_pass_number} cancelled by officer.",
            status='SUCCESS',
            request=request
        )

        return Response({
            "status": "success",
            "message": f"Gate Pass {gate_pass.gate_pass_pass_number} has been cancelled.",
            "data": GatePassSerializer(gate_pass).data
        }, status=status.HTTP_200_OK)


class GatePassResendEmailAPIView(APIView):
    """
    Resend Digital Gate Pass email to driver's registered email address.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request, pk):
        try:
            gate_pass = GatePass.objects.get(gate_pass_id=pk)
        except GatePass.DoesNotExist:
            return Response({"status": "error", "message": f"Gate Pass #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

        success, err = send_gate_pass_driver_email(gate_pass)
        if success:
            gate_pass.gate_pass_email_status = 'SENT'
            gate_pass.gate_pass_email_sent_at = timezone.now()
            gate_pass.gate_pass_email_error = None
            gate_pass.save(update_fields=['gate_pass_email_status', 'gate_pass_email_sent_at', 'gate_pass_email_error', 'gate_pass_updated_at'])
            return Response({
                "status": "success",
                "message": f"Gate Pass email resent successfully to {gate_pass.gate_pass_driver_id.driver_email}."
            }, status=status.HTTP_200_OK)
        else:
            gate_pass.gate_pass_email_status = 'FAILED'
            gate_pass.gate_pass_email_error = err
            gate_pass.save(update_fields=['gate_pass_email_status', 'gate_pass_email_error', 'gate_pass_updated_at'])
            return Response({
                "status": "error",
                "message": f"Failed to send email to {gate_pass.gate_pass_driver_id.driver_email}: {err}"
            }, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# CONTAINER DELIVERY TRACKING WORKFLOW API VIEWS
# =============================================================================

class DeliveryContainerListAPIView(APIView):
    """
    List Released Containers for Delivery Tracking.
    Accessible to: Terminal & Logistics Operator, Port Administrator, Gate & Truck Officer, Shipping Company.
    Shipping Companies are strictly scoped to their own containers.
    Supports query parameters:
    - status: 'ALL', 'RELEASED', 'GATE_PASS_GENERATED', 'PICKED_UP', 'DEPARTED_PORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'
    - search: container number, gate pass id/number, cargo id/description, vessel name, arrival request id
    """
    permission_classes = [IsDeliveryTrackingViewer]

    def get(self, request):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        # Query all containers that have reached the release / delivery lifecycle
        qs = Container.objects.filter(
            models.Q(container_status='RELEASED') |
            models.Q(gate_releases__isnull=False) |
            models.Q(tracking_events__isnull=False) |
            ~models.Q(container_delivery_status='NOT_APPLICABLE')
        ).distinct().select_related(
            'container_cargo_id',
            'container_cargo_id__cargo_arrival_request_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'container_cargo_id__cargo_destination_port_id'
        ).prefetch_related(
            'gate_releases',
            'gate_pass_associations__gate_pass_container_gate_pass_id__gate_pass_truck_id',
            'gate_pass_associations__gate_pass_container_gate_pass_id__gate_pass_driver_id',
            'gate_pass_associations__gate_pass_container_gate_pass_id__gate_pass_gate_id',
            'tracking_events__tracking_event_updated_by'
        )

        # Shipping company scoping
        if role in ['shipping_company', 'shipping company / shipping agent']:
            if not company_obj:
                return Response({"status": "success", "data": {"containers": [], "summary": {}}, "summary": {}, "results": []}, status=status.HTTP_200_OK)
            qs = qs.filter(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id=company_obj)

        containers_all = list(qs)

        # Ensure every released container has a baseline tracking event and initial delivery status
        for c in containers_all:
            if c.container_status == 'RELEASED' or c.gate_releases.all():
                if not c.tracking_events.filter(tracking_event_status='RELEASED').exists():
                    ContainerTrackingEvent.objects.create(
                        tracking_event_container_id=c,
                        tracking_event_gate_pass_id=c.latest_gate_pass,
                        tracking_event_status='RELEASED',
                        tracking_event_location=c.container_delivery_location or 'Port Gate Exit',
                        tracking_event_description='Container completed gate release and officially released for delivery tracking.',
                        tracking_event_timestamp=c.container_updated_at or timezone.now()
                    )
                if not c.container_delivery_status or c.container_delivery_status == 'NOT_APPLICABLE':
                    c.container_delivery_status = 'RELEASED'
                    c.save(update_fields=['container_delivery_status', 'container_updated_at'])

        # Compute summary counts for dashboard
        summary = {
            'total': len(containers_all),
            'all': len(containers_all),
            'released': 0,
            'gate_pass_generated': 0,
            'picked_up': 0,
            'departed_port': 0,
            'in_transit': 0,
            'out_for_delivery': 0,
            'delivered': 0,
            'exceptions': 0,
            'delivery_exception': 0,
        }

        def get_status(c):
            if c.container_delivery_status and c.container_delivery_status != 'NOT_APPLICABLE':
                return c.container_delivery_status
            ev = c.latest_tracking_event
            if ev:
                return ev.tracking_event_status
            return 'RELEASED' if c.container_status == 'RELEASED' else 'NOT_APPLICABLE'

        for c in containers_all:
            st = get_status(c)
            if st in ['RELEASED', 'GATE_PASS_GENERATED']:
                summary['released'] += 1
                if st == 'GATE_PASS_GENERATED':
                    summary['gate_pass_generated'] += 1
            elif st in ['PICKED_UP', 'DEPARTED_PORT']:
                summary['picked_up'] += 1
                if st == 'DEPARTED_PORT':
                    summary['departed_port'] += 1
            elif st == 'IN_TRANSIT':
                summary['in_transit'] += 1
            elif st == 'OUT_FOR_DELIVERY':
                summary['out_for_delivery'] += 1
            elif st == 'DELIVERED':
                summary['delivered'] += 1
            elif st == 'DELIVERY_EXCEPTION':
                summary['exceptions'] += 1
                summary['delivery_exception'] += 1

        # Apply status filter
        status_filter = request.query_params.get('status', 'ALL').strip().upper()
        filtered = containers_all
        if status_filter and status_filter != 'ALL':
            if status_filter in ['EXCEPTION', 'DELIVERY_EXCEPTION']:
                filtered = [c for c in filtered if get_status(c) == 'DELIVERY_EXCEPTION']
            elif status_filter in ['GATE_PASS', 'GATE_PASS_GENERATED']:
                filtered = [c for c in filtered if get_status(c) == 'GATE_PASS_GENERATED']
            elif status_filter in ['DEPARTED', 'DEPARTED_PORT']:
                filtered = [c for c in filtered if get_status(c) == 'DEPARTED_PORT']
            elif status_filter in ['PICKED_UP', 'PICKED UP']:
                filtered = [c for c in filtered if get_status(c) == 'PICKED_UP']
            elif status_filter in ['IN_TRANSIT', 'IN TRANSIT']:
                filtered = [c for c in filtered if get_status(c) == 'IN_TRANSIT']
            elif status_filter in ['OUT_FOR_DELIVERY', 'OUT FOR DELIVERY']:
                filtered = [c for c in filtered if get_status(c) == 'OUT_FOR_DELIVERY']
            elif status_filter in ['DELIVERED']:
                filtered = [c for c in filtered if get_status(c) == 'DELIVERED']
            elif status_filter in ['RELEASED']:
                filtered = [c for c in filtered if get_status(c) == 'RELEASED']
            else:
                filtered = [c for c in filtered if get_status(c) == status_filter]

        # Apply search filter
        search_query = request.query_params.get('search', '').strip().lower()
        if search_query:
            filtered_by_search = []
            for c in filtered:
                c_num = c.container_number.lower()
                cargo_desc = (c.container_cargo_id.cargo_description or '').lower()
                vessel_name = (c.vessel.vessel_name if c.vessel else '').lower()
                gp = c.latest_gate_pass
                gp_num = (gp.gate_pass_pass_number if gp else '').lower()
                gp_id = str(gp.gate_pass_id) if gp else ''
                cargo_id = str(c.container_cargo_id.cargo_id)
                ar_id = str(c.arrival_request.vessel_arrival_request_id) if c.arrival_request else ''
                ar_display = f"ar-{ar_id.zfill(4)}"

                if (search_query in c_num or
                    search_query in cargo_desc or
                    search_query in vessel_name or
                    search_query in gp_num or
                    search_query == gp_id or
                    search_query in gp_id or
                    search_query == cargo_id or
                    search_query in cargo_id or
                    search_query == ar_id or
                    search_query in ar_display):
                    filtered_by_search.append(c)
            filtered = filtered_by_search

        serializer = ContainerDeliveryListSerializer(filtered, many=True, context={'request': request})
        return Response({
            "status": "success",
            "count": len(filtered),
            "next": None,
            "previous": None,
            "data": {
                "containers": serializer.data,
                "summary": summary
            },
            "summary": summary,
            "results": serializer.data
        }, status=status.HTTP_200_OK)


class DeliveryContainerDetailAPIView(APIView):
    """
    Retrieve Container Delivery Details, Amazon-Style Timeline, and Full Event History.
    Accessible to: Terminal & Logistics Operator, Port Administrator, Gate & Truck Officer, Shipping Company.
    """
    permission_classes = [IsDeliveryTrackingViewer]

    def get(self, request, pk):
        login_obj, user_obj, company_obj = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        try:
            container = Container.objects.select_related(
                'container_cargo_id',
                'container_cargo_id__cargo_arrival_request_id',
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'container_cargo_id__cargo_destination_port_id',
                'container_delivered_by'
            ).prefetch_related(
                'gate_releases',
                'gate_pass_associations__gate_pass_container_gate_pass_id__gate_pass_truck_id',
                'gate_pass_associations__gate_pass_container_gate_pass_id__gate_pass_driver_id',
                'gate_pass_associations__gate_pass_container_gate_pass_id__gate_pass_gate_id',
                'tracking_events__tracking_event_updated_by',
                'tracking_events__tracking_event_gate_pass_id'
            ).get(container_id=pk)
        except Container.DoesNotExist:
            return Response({"status": "error", "message": f"Container #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

        if role in ['shipping_company', 'shipping company / shipping agent']:
            vessel = container.vessel
            if not company_obj or not vessel or vessel.vessel_shipping_company_id_id != company_obj.shipping_company_id:
                return Response({"status": "error", "message": "You are not authorized to view tracking for this container."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ContainerDeliveryDetailSerializer(container, context={'request': request})
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class DeliveryConfirmDepartureAPIView(APIView):
    """
    Gate Operations Officer confirms vehicle departure from port.
    Transition: PICKED_UP -> DEPARTED_PORT.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response({"status": "error", "message": "Password change required."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DeliveryConfirmDepartureSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "message": "Validation error.", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().get(container_id=pk)
            except Container.DoesNotExist:
                return Response({"status": "error", "message": f"Container #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

            current_status = container.container_delivery_status
            if not current_status or current_status == 'NOT_APPLICABLE':
                latest_ev = container.latest_tracking_event
                current_status = latest_ev.tracking_event_status if latest_ev else 'RELEASED'

            if current_status == 'DEPARTED_PORT':
                return Response({"status": "error", "message": f"Container {container.container_number} has already departed the port."}, status=status.HTTP_400_BAD_REQUEST)

            if current_status != 'PICKED_UP':
                return Response({
                    "status": "error",
                    "message": f"Cannot confirm departure: Container {container.container_number} is currently in '{current_status}' status. Container must be 'PICKED_UP' to confirm departure."
                }, status=status.HTTP_400_BAD_REQUEST)

            location = serializer.validated_data.get('location', '').strip() or 'Port Exit Checkpoint'
            remarks = serializer.validated_data.get('remarks', '').strip()
            gp = container.latest_gate_pass

            desc = f"Container vehicle confirmed departed from port facility at {location}."
            if remarks:
                desc += f" Remarks: {remarks}"

            prev_status = current_status
            container.container_delivery_status = 'DEPARTED_PORT'
            container.container_delivery_location = location
            container.save(update_fields=['container_delivery_status', 'container_delivery_location', 'container_updated_at'])

            ContainerTrackingEvent.objects.create(
                tracking_event_container_id=container,
                tracking_event_gate_pass_id=gp,
                tracking_event_status='DEPARTED_PORT',
                tracking_event_location=location,
                tracking_event_description=desc,
                tracking_event_updated_by=user_obj,
                tracking_event_timestamp=timezone.now()
            )

            officer_name = user_obj.user_full_name if user_obj else 'Gate Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Gate & Truck Operations Officer',
                action='CONFIRM_PORT_DEPARTURE',
                category='DELIVERY_TRACKING',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Port departure confirmed for Container {container.container_number} ({prev_status} -> DEPARTED_PORT) at {location}.",
                status='SUCCESS',
                request=request
            )

        detail_serializer = ContainerDeliveryDetailSerializer(container, context={'request': request})
        return Response({
            "status": "success",
            "message": f"Container {container.container_number} departure confirmed.",
            "data": detail_serializer.data
        }, status=status.HTTP_200_OK)


class DeliveryUpdateStatusAPIView(APIView):
    """
    Terminal & Logistics Operator updates delivery tracking progress:
    - DEPARTED_PORT -> IN_TRANSIT
    - IN_TRANSIT -> OUT_FOR_DELIVERY
    - DELIVERY_EXCEPTION -> IN_TRANSIT or OUT_FOR_DELIVERY (resuming delivery)
    Strict validation prevents invalid jumps (e.g. RELEASED -> IN_TRANSIT, IN_TRANSIT -> PICKED_UP).
    """
    permission_classes = [IsTerminalLogisticsOperator]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response({"status": "error", "message": "Password change required."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DeliveryUpdateStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "message": "Validation error.", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        target_status = serializer.validated_data['target_status']
        location = serializer.validated_data.get('location', '').strip()
        destination = serializer.validated_data.get('destination', '').strip()
        expected_delivery_date = serializer.validated_data.get('expected_delivery_date')
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().get(container_id=pk)
            except Container.DoesNotExist:
                return Response({"status": "error", "message": f"Container #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

            current_status = container.container_delivery_status
            if not current_status or current_status == 'NOT_APPLICABLE':
                latest_ev = container.latest_tracking_event
                current_status = latest_ev.tracking_event_status if latest_ev else 'RELEASED'

            if current_status == 'DELIVERED':
                return Response({"status": "error", "message": f"Container {container.container_number} is already DELIVERED and its status cannot be changed."}, status=status.HTTP_400_BAD_REQUEST)

            if current_status == target_status:
                return Response({"status": "error", "message": f"Container {container.container_number} is already in '{target_status}' status."}, status=status.HTTP_400_BAD_REQUEST)

            # Strict Allowed Transitions
            # Released / Gate Pass Generated -> Picked Up
            # Picked Up -> In Transit
            # Departed Port -> In Transit (also supported)
            # In Transit -> Out for Delivery
            # Out for Delivery -> Delivered
            # Exception -> Picked Up / In Transit / Out for Delivery / Delivered
            valid_transition = False
            if current_status in ['RELEASED', 'GATE_PASS_GENERATED'] and target_status == 'PICKED_UP':
                valid_transition = True
            elif current_status == 'PICKED_UP' and target_status == 'IN_TRANSIT':
                valid_transition = True
            elif current_status == 'DEPARTED_PORT' and target_status == 'IN_TRANSIT':
                valid_transition = True
            elif current_status == 'IN_TRANSIT' and target_status == 'OUT_FOR_DELIVERY':
                valid_transition = True
            elif current_status == 'OUT_FOR_DELIVERY' and target_status == 'DELIVERED':
                valid_transition = True
            elif current_status == 'DELIVERY_EXCEPTION' and target_status in ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']:
                valid_transition = True

            if not valid_transition:
                return Response({
                    "status": "error",
                    "message": f"Invalid transition: Cannot change status from '{current_status}' to '{target_status}'. Containers must follow the operational delivery sequence: Released -> Picked Up -> In Transit -> Out for Delivery -> Delivered."
                }, status=status.HTTP_400_BAD_REQUEST)

            if not location:
                if target_status == 'PICKED_UP':
                    location = 'Port Exit Terminal'
                elif target_status == 'IN_TRANSIT':
                    location = 'Transit Route / Highway Corridor'
                elif target_status == 'OUT_FOR_DELIVERY':
                    location = 'Regional Distribution Facility'
                elif target_status == 'DELIVERED':
                    location = destination or 'Consignee Delivery Facility'

            desc = f"Delivery progress updated to {target_status.replace('_', ' ').title()}."
            if remarks:
                desc += f" Note: {remarks}"

            prev_status = current_status
            container.container_delivery_status = target_status
            container.container_delivery_location = location
            if destination:
                container.container_delivery_destination = destination
            if expected_delivery_date:
                container.container_expected_delivery_date = expected_delivery_date

            update_fields = [
                'container_delivery_status',
                'container_delivery_location',
                'container_delivery_destination',
                'container_expected_delivery_date',
                'container_updated_at'
            ]

            now = timezone.now()
            if target_status == 'DELIVERED':
                container.container_delivered_at = now
                container.container_delivered_by = user_obj
                container.container_delivery_location = location
                if remarks:
                    container.container_delivery_remarks = remarks
                update_fields.extend(['container_delivered_at', 'container_delivered_by', 'container_delivery_remarks'])

            container.save(update_fields=list(set(update_fields)))

            gp = container.latest_gate_pass
            ContainerTrackingEvent.objects.create(
                tracking_event_container_id=container,
                tracking_event_gate_pass_id=gp,
                tracking_event_status=target_status,
                tracking_event_location=location,
                tracking_event_description=desc,
                tracking_event_updated_by=user_obj,
                tracking_event_timestamp=now
            )

            operator_name = user_obj.user_full_name if user_obj else 'Terminal & Logistics Operator'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='UPDATE_DELIVERY_STATUS',
                category='DELIVERY_TRACKING',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Container {container.container_number} updated: {prev_status} -> {target_status} at {location}. {desc}",
                status='SUCCESS',
                request=request
            )

        detail_serializer = ContainerDeliveryDetailSerializer(container, context={'request': request})
        return Response({
            "status": "success",
            "message": f"Container {container.container_number} status updated to {target_status.replace('_', ' ').title()}.",
            "data": detail_serializer.data
        }, status=status.HTTP_200_OK)


class DeliveryConfirmDeliveryAPIView(APIView):
    """
    Terminal & Logistics Operator confirms final delivery:
    Transition: OUT_FOR_DELIVERY (or DELIVERY_EXCEPTION) -> DELIVERED.
    Requires delivery location, records recipient, remarks, timestamp, and user.
    DELIVERED is terminal and cannot be casually changed.
    """
    permission_classes = [IsTerminalLogisticsOperator]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response({"status": "error", "message": "Password change required."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DeliveryConfirmDeliverySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "message": "Validation error.", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        delivery_location = serializer.validated_data['delivery_location'].strip()
        recipient_name = serializer.validated_data.get('recipient_name', '').strip()
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().get(container_id=pk)
            except Container.DoesNotExist:
                return Response({"status": "error", "message": f"Container #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

            current_status = container.container_delivery_status
            if not current_status or current_status == 'NOT_APPLICABLE':
                latest_ev = container.latest_tracking_event
                current_status = latest_ev.tracking_event_status if latest_ev else 'RELEASED'

            if current_status == 'DELIVERED':
                return Response({"status": "error", "message": f"Container {container.container_number} is already marked as DELIVERED."}, status=status.HTTP_400_BAD_REQUEST)

            # Strict check: Must be in OUT_FOR_DELIVERY or DELIVERY_EXCEPTION
            if current_status not in ['OUT_FOR_DELIVERY', 'DELIVERY_EXCEPTION']:
                return Response({
                    "status": "error",
                    "message": f"Cannot confirm delivery: Container {container.container_number} is currently in '{current_status}' status. Container must be 'OUT_FOR_DELIVERY' before final delivery confirmation."
                }, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            prev_status = current_status
            container.container_delivery_status = 'DELIVERED'
            container.container_delivered_at = now
            container.container_delivered_by = user_obj
            container.container_delivery_location = delivery_location
            if not container.container_delivery_destination and delivery_location:
                container.container_delivery_destination = delivery_location
            container.container_delivery_recipient = recipient_name
            container.container_delivery_remarks = remarks
            container.save(update_fields=[
                'container_delivery_status',
                'container_delivered_at',
                'container_delivered_by',
                'container_delivery_location',
                'container_delivery_destination',
                'container_delivery_recipient',
                'container_delivery_remarks',
                'container_updated_at'
            ])

            gp = container.latest_gate_pass
            desc = f"Container successfully delivered at {delivery_location}."
            if recipient_name:
                desc += f" Received by: {recipient_name}."
            if remarks:
                desc += f" Remarks: {remarks}"

            ContainerTrackingEvent.objects.create(
                tracking_event_container_id=container,
                tracking_event_gate_pass_id=gp,
                tracking_event_status='DELIVERED',
                tracking_event_location=delivery_location,
                tracking_event_description=desc,
                tracking_event_updated_by=user_obj,
                tracking_event_timestamp=now
            )

            operator_name = user_obj.user_full_name if user_obj else 'Terminal & Logistics Operator'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='CONFIRM_DELIVERY',
                category='DELIVERY_TRACKING',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Container {container.container_number} final delivery confirmed ({prev_status} -> DELIVERED) at {delivery_location}. Recipient: {recipient_name or 'N/A'}.",
                status='SUCCESS',
                request=request
            )

        detail_serializer = ContainerDeliveryDetailSerializer(container, context={'request': request})
        return Response({
            "status": "success",
            "message": f"Container {container.container_number} successfully marked as DELIVERED.",
            "data": detail_serializer.data
        }, status=status.HTTP_200_OK)


class DeliveryReportExceptionAPIView(APIView):
    """
    Record an operational Delivery Exception for an active shipment.
    Preserves all previous tracking history.
    """
    permission_classes = [IsTerminalLogisticsOperator]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        if user_obj and getattr(user_obj, 'user_must_change_password', False):
            return Response({"status": "error", "message": "Password change required."}, status=status.HTTP_403_FORBIDDEN)

        serializer = DeliveryReportExceptionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "message": "Validation error.", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data['exception_reason'].strip()
        location = serializer.validated_data.get('location', '').strip() or 'Transit Route'
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().get(container_id=pk)
            except Container.DoesNotExist:
                return Response({"status": "error", "message": f"Container #{pk} not found."}, status=status.HTTP_404_NOT_FOUND)

            current_status = container.container_delivery_status
            if not current_status or current_status == 'NOT_APPLICABLE':
                latest_ev = container.latest_tracking_event
                current_status = latest_ev.tracking_event_status if latest_ev else 'RELEASED'

            if current_status == 'DELIVERED':
                return Response({"status": "error", "message": "Cannot report exception on a DELIVERED container."}, status=status.HTTP_400_BAD_REQUEST)

            desc = f"Delivery Exception: {reason} at {location}."
            if remarks:
                desc += f" Details: {remarks}"

            prev_status = current_status
            container.container_delivery_status = 'DELIVERY_EXCEPTION'
            container.container_delivery_location = location
            container.save(update_fields=['container_delivery_status', 'container_delivery_location', 'container_updated_at'])

            gp = container.latest_gate_pass
            ContainerTrackingEvent.objects.create(
                tracking_event_container_id=container,
                tracking_event_gate_pass_id=gp,
                tracking_event_status='DELIVERY_EXCEPTION',
                tracking_event_location=location,
                tracking_event_exception_reason=reason,
                tracking_event_description=desc,
                tracking_event_updated_by=user_obj,
                tracking_event_timestamp=timezone.now()
            )

            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='REPORT_DELIVERY_EXCEPTION',
                category='DELIVERY_TRACKING',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Delivery Exception reported for Container {container.container_number} ({prev_status} -> DELIVERY_EXCEPTION). Reason: {reason}. {remarks}",
                status='SUCCESS',
                request=request
            )

        detail_serializer = ContainerDeliveryDetailSerializer(container, context={'request': request})
        return Response({
            "status": "success",
            "message": f"Delivery exception recorded for Container {container.container_number}.",
            "data": detail_serializer.data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T1 — YARD MASTER MANAGEMENT API VIEWS
# ==============================================================================

class YardListCreateAPIView(APIView):
    """
    API Endpoint to List all Yards or Create a New Yard.
    Endpoints: GET  /api/terminal/yards/
               POST /api/terminal/yards/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def get(self, request):
        yards = Yard.objects.all().prefetch_related('blocks')

        # Filters
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip().upper()
        type_filter = request.query_params.get('type', '').strip().upper()

        if search:
            yards = yards.filter(
                models.Q(yard_name__icontains=search) | 
                models.Q(yard_code__icontains=search)
            )
        if status_filter in ['ACTIVE', 'INACTIVE']:
            yards = yards.filter(yard_status=status_filter)
        if type_filter:
            yards = yards.filter(yard_type=type_filter)

        yards = yards.order_by('yard_code', 'yard_id')
        serializer = YardSerializer(yards, many=True)
        return Response({
            "status": "success",
            "data": serializer.data,
            "total": yards.count()
        }, status=status.HTTP_200_OK)

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = YardCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Yard creation validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            yard = serializer.save()
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='CREATE_YARD',
                category='YARD_MANAGEMENT',
                target_type='Yard',
                target_id=str(yard.yard_id),
                description=f"Created Yard '{yard.yard_name}' ({yard.yard_code}) with capacity {yard.yard_capacity}.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard '{yard.yard_name}' ({yard.yard_code}) created successfully.",
            "data": YardSerializer(yard).data
        }, status=status.HTTP_201_CREATED)


class YardDetailAPIView(APIView):
    """
    API Endpoint to Retrieve, Update, or Delete a Yard.
    Endpoints: GET    /api/terminal/yards/<int:pk>/
               PUT    /api/terminal/yards/<int:pk>/
               PATCH  /api/terminal/yards/<int:pk>/
               DELETE /api/terminal/yards/<int:pk>/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def get_object(self, pk):
        try:
            return Yard.objects.prefetch_related('blocks__slots').get(pk=pk)
        except Yard.DoesNotExist:
            return None

    def get(self, request, pk):
        yard = self.get_object(pk)
        if not yard:
            return Response({
                "status": "error",
                "message": f"Yard #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = YardDetailSerializer(yard)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        yard = self.get_object(pk)
        if not yard:
            return Response({
                "status": "error",
                "message": f"Yard #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = YardCreateUpdateSerializer(yard, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Yard update validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        if request.data.get('yard_status') == 'INACTIVE':
            has_active = YardAllocation.objects.filter(
                yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id=yard,
                yard_allocation_status='ACTIVE'
            ).exists()
            if has_active:
                return Response({
                    "status": "error",
                    "message": f"Cannot deactivate Yard '{yard.yard_name}' ({yard.yard_code}) while active container allocations exist in its slots. Relocate or release containers first."
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            updated_yard = serializer.save()
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='UPDATE_YARD',
                category='YARD_MANAGEMENT',
                target_type='Yard',
                target_id=str(updated_yard.yard_id),
                description=f"Updated Yard '{updated_yard.yard_name}' ({updated_yard.yard_code}).",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard '{updated_yard.yard_name}' updated successfully.",
            "data": YardDetailSerializer(updated_yard).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        yard = self.get_object(pk)
        if not yard:
            return Response({
                "status": "error",
                "message": f"Yard #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        has_active = YardAllocation.objects.filter(
            yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id=yard,
            yard_allocation_status='ACTIVE'
        ).exists()
        if yard.yard_occupied > 0 or has_active:
            return Response({
                "status": "error",
                "message": f"Cannot delete Yard '{yard.yard_name}' because it currently has active container allocations or occupied capacity."
            }, status=status.HTTP_400_BAD_REQUEST)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        yard_name = yard.yard_name
        yard_code = yard.yard_code

        try:
            with transaction.atomic():
                yard.delete()
                operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=operator_name,
                    role='Terminal & Logistics Operator',
                    action='DELETE_YARD',
                    category='YARD_MANAGEMENT',
                    target_type='Yard',
                    target_id=str(pk),
                    description=f"Deleted Yard '{yard_name}' ({yard_code}).",
                    status='SUCCESS',
                    request=request
                )
        except models.ProtectedError:
            return Response({
                "status": "error",
                "message": f"Cannot delete Yard '{yard_name}' ({yard_code}) because operational allocation or movement history records depend on its slots. Please deactivate the yard instead."
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "status": "success",
            "message": f"Yard '{yard_name}' ({yard_code}) deleted successfully."
        }, status=status.HTTP_200_OK)


class YardToggleStatusAPIView(APIView):
    """
    API Endpoint to Activate or Deactivate a Yard.
    Endpoint: POST /api/terminal/yards/<int:pk>/toggle-status/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                yard = Yard.objects.select_for_update().get(pk=pk)
            except Yard.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Yard #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            target_status = request.data.get('yard_status')
            will_deactivate = (target_status == 'INACTIVE') or (not target_status and yard.yard_status == 'ACTIVE')

            if will_deactivate:
                has_active = YardAllocation.objects.filter(
                    yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id=yard,
                    yard_allocation_status='ACTIVE'
                ).exists()
                if has_active:
                    return Response({
                        "status": "error",
                        "message": f"Cannot deactivate Yard '{yard.yard_name}' ({yard.yard_code}) while active container allocations exist in its slots. Relocate or release containers first."
                    }, status=status.HTTP_400_BAD_REQUEST)

            if target_status and target_status in ['ACTIVE', 'INACTIVE']:
                yard.yard_status = target_status
            else:
                yard.yard_status = 'INACTIVE' if yard.yard_status == 'ACTIVE' else 'ACTIVE'

            yard.save(update_fields=['yard_status', 'yard_updated_at'])

            login_obj, user_obj, _ = get_authenticated_user_and_company(request)
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='TOGGLE_YARD_STATUS',
                category='YARD_MANAGEMENT',
                target_type='Yard',
                target_id=str(yard.yard_id),
                description=f"Toggled Yard '{yard.yard_name}' status to {yard.yard_status}.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard '{yard.yard_name}' status updated to {yard.yard_status}.",
            "data": YardSerializer(yard).data
        }, status=status.HTTP_200_OK)


class YardBlockListCreateAPIView(APIView):
    """
    API Endpoint to List Blocks or Create a Block within a Yard.
    Endpoints: GET  /api/terminal/yards/<int:yard_id>/blocks/
               POST /api/terminal/yards/<int:yard_id>/blocks/
               GET  /api/terminal/blocks/
               POST /api/terminal/blocks/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def get(self, request, yard_id=None):
        target_yard_id = yard_id or request.query_params.get('yard_id')
        blocks = YardBlock.objects.select_related('yard_block_yard_id').prefetch_related('slots')

        if target_yard_id:
            blocks = blocks.filter(yard_block_yard_id_id=target_yard_id)

        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip().upper()
        type_filter = request.query_params.get('type', '').strip().upper()

        if search:
            blocks = blocks.filter(
                models.Q(yard_block_name__icontains=search) | 
                models.Q(yard_block_code__icontains=search)
            )
        if status_filter in ['ACTIVE', 'INACTIVE']:
            blocks = blocks.filter(yard_block_status=status_filter)
        if type_filter:
            blocks = blocks.filter(yard_block_type=type_filter)

        blocks = blocks.order_by('yard_block_code', 'yard_block_id')
        serializer = YardBlockSerializer(blocks, many=True)
        return Response({
            "status": "success",
            "data": serializer.data,
            "total": blocks.count()
        }, status=status.HTTP_200_OK)

    def post(self, request, yard_id=None):
        target_yard_id = yard_id or request.data.get('yard_block_yard_id') or request.data.get('yard_id')
        if not target_yard_id:
            return Response({
                "status": "error",
                "message": "Yard identifier is required to create a block."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            yard = Yard.objects.get(pk=target_yard_id)
        except Yard.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Yard #{target_yard_id} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['yard_block_yard_id'] = yard.yard_id

        serializer = YardBlockCreateUpdateSerializer(data=data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Yard Block creation validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        with transaction.atomic():
            block = serializer.save()
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='CREATE_YARD_BLOCK',
                category='YARD_MANAGEMENT',
                target_type='YardBlock',
                target_id=str(block.yard_block_id),
                description=f"Created Yard Block '{block.yard_block_code}' in Yard '{yard.yard_code}'.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard Block '{block.yard_block_code}' created successfully.",
            "data": YardBlockSerializer(block).data
        }, status=status.HTTP_201_CREATED)


class YardBlockDetailAPIView(APIView):
    """
    API Endpoint to Retrieve, Update, or Delete a Yard Block.
    Endpoints: GET    /api/terminal/blocks/<int:pk>/
               PUT    /api/terminal/blocks/<int:pk>/
               PATCH  /api/terminal/blocks/<int:pk>/
               DELETE /api/terminal/blocks/<int:pk>/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def get_object(self, pk):
        try:
            return YardBlock.objects.select_related('yard_block_yard_id').prefetch_related('slots').get(pk=pk)
        except YardBlock.DoesNotExist:
            return None

    def get(self, request, pk):
        block = self.get_object(pk)
        if not block:
            return Response({
                "status": "error",
                "message": f"Yard Block #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = YardBlockDetailSerializer(block)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        block = self.get_object(pk)
        if not block:
            return Response({
                "status": "error",
                "message": f"Yard Block #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = YardBlockCreateUpdateSerializer(block, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Yard Block update validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        if request.data.get('yard_block_status') == 'INACTIVE':
            has_active = YardAllocation.objects.filter(
                yard_allocation_slot_id__yard_slot_block_id=block,
                yard_allocation_status='ACTIVE'
            ).exists()
            if has_active:
                return Response({
                    "status": "error",
                    "message": f"Cannot deactivate Block '{block.yard_block_code}' while active container allocations exist in its slots. Relocate or release containers first."
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            updated_block = serializer.save()
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='UPDATE_YARD_BLOCK',
                category='YARD_MANAGEMENT',
                target_type='YardBlock',
                target_id=str(updated_block.yard_block_id),
                description=f"Updated Yard Block '{updated_block.yard_block_code}'.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard Block '{updated_block.yard_block_code}' updated successfully.",
            "data": YardBlockDetailSerializer(updated_block).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        block = self.get_object(pk)
        if not block:
            return Response({
                "status": "error",
                "message": f"Yard Block #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        has_active = YardAllocation.objects.filter(
            yard_allocation_slot_id__yard_slot_block_id=block,
            yard_allocation_status='ACTIVE'
        ).exists()
        if block.yard_block_occupied > 0 or has_active:
            return Response({
                "status": "error",
                "message": f"Cannot delete Block '{block.yard_block_code}' because it currently has active container allocations or occupied capacity."
            }, status=status.HTTP_400_BAD_REQUEST)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        code = block.yard_block_code

        try:
            with transaction.atomic():
                block.delete()
                operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=operator_name,
                    role='Terminal & Logistics Operator',
                    action='DELETE_YARD_BLOCK',
                    category='YARD_MANAGEMENT',
                    target_type='YardBlock',
                    target_id=str(pk),
                    description=f"Deleted Yard Block '{code}'.",
                    status='SUCCESS',
                    request=request
                )
        except models.ProtectedError:
            return Response({
                "status": "error",
                "message": f"Cannot delete Block '{code}' because operational allocation or movement history records depend on its slots. Please deactivate the block instead."
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "status": "success",
            "message": f"Yard Block '{code}' deleted successfully."
        }, status=status.HTTP_200_OK)


class YardBlockToggleStatusAPIView(APIView):
    """
    API Endpoint to Activate or Deactivate a Yard Block.
    Endpoint: POST /api/terminal/blocks/<int:pk>/toggle-status/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                block = YardBlock.objects.select_for_update().get(pk=pk)
            except YardBlock.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Yard Block #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            target_status = request.data.get('yard_block_status')
            will_deactivate = (target_status == 'INACTIVE') or (not target_status and block.yard_block_status == 'ACTIVE')

            if will_deactivate:
                has_active = YardAllocation.objects.filter(
                    yard_allocation_slot_id__yard_slot_block_id=block,
                    yard_allocation_status='ACTIVE'
                ).exists()
                if has_active:
                    return Response({
                        "status": "error",
                        "message": f"Cannot deactivate Block '{block.yard_block_code}' while active container allocations exist in its slots. Relocate or release containers first."
                    }, status=status.HTTP_400_BAD_REQUEST)

            if target_status and target_status in ['ACTIVE', 'INACTIVE']:
                block.yard_block_status = target_status
            else:
                block.yard_block_status = 'INACTIVE' if block.yard_block_status == 'ACTIVE' else 'ACTIVE'

            block.save(update_fields=['yard_block_status', 'yard_block_updated_at'])

            login_obj, user_obj, _ = get_authenticated_user_and_company(request)
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='TOGGLE_YARD_BLOCK_STATUS',
                category='YARD_MANAGEMENT',
                target_type='YardBlock',
                target_id=str(block.yard_block_id),
                description=f"Toggled Yard Block '{block.yard_block_code}' status to {block.yard_block_status}.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard Block '{block.yard_block_code}' status updated to {block.yard_block_status}.",
            "data": YardBlockSerializer(block).data
        }, status=status.HTTP_200_OK)


class YardSlotListCreateAPIView(APIView):
    """
    API Endpoint to List Slots or Create a Slot within a Block.
    Endpoints: GET  /api/terminal/blocks/<int:block_id>/slots/
               POST /api/terminal/blocks/<int:block_id>/slots/
               GET  /api/terminal/slots/
               POST /api/terminal/slots/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def get(self, request, block_id=None):
        target_block_id = block_id or request.query_params.get('block_id')
        slots = YardSlot.objects.select_related('yard_slot_block_id__yard_block_yard_id')

        if target_block_id:
            slots = slots.filter(yard_slot_block_id_id=target_block_id)

        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip().upper()
        row = request.query_params.get('row')
        bay = request.query_params.get('bay')
        tier = request.query_params.get('tier')

        if search:
            slots = slots.filter(yard_slot_code__icontains=search)
        if status_filter:
            slots = slots.filter(yard_slot_status=status_filter)
        if row:
            slots = slots.filter(yard_slot_row=row)
        if bay:
            slots = slots.filter(yard_slot_bay=bay)
        if tier:
            slots = slots.filter(yard_slot_tier=tier)

        slots = slots.order_by('yard_slot_row', 'yard_slot_bay', 'yard_slot_tier', 'yard_slot_id')
        serializer = YardSlotSerializer(slots, many=True)
        return Response({
            "status": "success",
            "data": serializer.data,
            "total": slots.count()
        }, status=status.HTTP_200_OK)

    def post(self, request, block_id=None):
        target_block_id = block_id or request.data.get('yard_slot_block_id') or request.data.get('block_id')
        if not target_block_id:
            return Response({
                "status": "error",
                "message": "Block identifier is required to create a slot."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            block = YardBlock.objects.get(pk=target_block_id)
        except YardBlock.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Yard Block #{target_block_id} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['yard_slot_block_id'] = block.yard_block_id

        serializer = YardSlotCreateUpdateSerializer(data=data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Yard Slot creation validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        with transaction.atomic():
            slot = serializer.save()
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='CREATE_YARD_SLOT',
                category='YARD_MANAGEMENT',
                target_type='YardSlot',
                target_id=str(slot.yard_slot_id),
                description=f"Created Yard Slot '{slot.yard_slot_code}' (R{slot.yard_slot_row}-B{slot.yard_slot_bay}-T{slot.yard_slot_tier}) in Block '{block.yard_block_code}'.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard Slot '{slot.yard_slot_code}' created successfully.",
            "data": YardSlotSerializer(slot).data
        }, status=status.HTTP_201_CREATED)


class YardSlotDetailAPIView(APIView):
    """
    API Endpoint to Retrieve, Update, or Delete a Yard Slot.
    Endpoints: GET    /api/terminal/slots/<int:pk>/
               PUT    /api/terminal/slots/<int:pk>/
               PATCH  /api/terminal/slots/<int:pk>/
               DELETE /api/terminal/slots/<int:pk>/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def get_object(self, pk):
        try:
            return YardSlot.objects.select_related('yard_slot_block_id__yard_block_yard_id').get(pk=pk)
        except YardSlot.DoesNotExist:
            return None

    def get(self, request, pk):
        slot = self.get_object(pk)
        if not slot:
            return Response({
                "status": "error",
                "message": f"Yard Slot #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = YardSlotSerializer(slot)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        slot = self.get_object(pk)
        if not slot:
            return Response({
                "status": "error",
                "message": f"Yard Slot #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = YardSlotCreateUpdateSerializer(slot, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Yard Slot update validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            updated_slot = serializer.save()
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='UPDATE_YARD_SLOT',
                category='YARD_MANAGEMENT',
                target_type='YardSlot',
                target_id=str(updated_slot.yard_slot_id),
                description=f"Updated Yard Slot '{updated_slot.yard_slot_code}'.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard Slot '{updated_slot.yard_slot_code}' updated successfully.",
            "data": YardSlotSerializer(updated_slot).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        slot = self.get_object(pk)
        if not slot:
            return Response({
                "status": "error",
                "message": f"Yard Slot #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        has_active = YardAllocation.objects.filter(
            yard_allocation_slot_id=slot,
            yard_allocation_status='ACTIVE'
        ).exists()
        if slot.yard_slot_status == 'OCCUPIED' or has_active:
            return Response({
                "status": "error",
                "message": f"Cannot delete Slot '{slot.yard_slot_code}' while its status is OCCUPIED or active allocations exist."
            }, status=status.HTTP_400_BAD_REQUEST)

        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        code = slot.yard_slot_code

        try:
            with transaction.atomic():
                slot.delete()
                operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
                create_audit_log(
                    user=user_obj or login_obj,
                    actor_name=operator_name,
                    role='Terminal & Logistics Operator',
                    action='DELETE_YARD_SLOT',
                    category='YARD_MANAGEMENT',
                    target_type='YardSlot',
                    target_id=str(pk),
                    description=f"Deleted Yard Slot '{code}'.",
                    status='SUCCESS',
                    request=request
                )
        except models.ProtectedError:
            return Response({
                "status": "error",
                "message": f"Cannot delete Slot '{code}' because operational allocation or movement history records depend on it. Please deactivate or block the slot instead."
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "status": "success",
            "message": f"Yard Slot '{code}' deleted successfully."
        }, status=status.HTTP_200_OK)


class YardSlotToggleStatusAPIView(APIView):
    """
    API Endpoint to Update Yard Slot Status (AVAILABLE, OCCUPIED, RESERVED, BLOCKED, INACTIVE).
    Endpoint: POST /api/terminal/slots/<int:pk>/toggle-status/
    Permissions: IsYardMasterAuthorized
    """
    permission_classes = [IsYardMasterAuthorized]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                slot = YardSlot.objects.select_for_update().select_related('yard_slot_block_id__yard_block_yard_id').get(pk=pk)
            except YardSlot.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Yard Slot #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            has_active = YardAllocation.objects.filter(
                yard_allocation_slot_id=slot,
                yard_allocation_status='ACTIVE'
            ).exists()

            target_status = request.data.get('yard_slot_status')
            valid_statuses = [s[0] for s in YardSlot.SLOT_STATUS_CHOICES]

            if has_active:
                if target_status and target_status != 'OCCUPIED':
                    return Response({
                        "status": "error",
                        "message": (
                            f"Cannot change status of Slot '{slot.yard_slot_code}' to {target_status} "
                            f"while an active container allocation exists. The container must be relocated or released first."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)
                elif not target_status:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Cannot toggle status of Slot '{slot.yard_slot_code}'. "
                            f"Slot is currently OCCUPIED by an active container. Relocate or release the container first."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                if target_status == 'OCCUPIED':
                    return Response({
                        "status": "error",
                        "message": (
                            f"Cannot manually set Slot '{slot.yard_slot_code}' to OCCUPIED. "
                            f"Slots become OCCUPIED only via authorized container allocation or discharge operations."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

                if target_status and target_status in valid_statuses:
                    slot.yard_slot_status = target_status
                else:
                    slot.yard_slot_status = 'BLOCKED' if slot.yard_slot_status == 'AVAILABLE' else 'AVAILABLE'

            slot.save(update_fields=['yard_slot_status', 'yard_slot_updated_at'])

            login_obj, user_obj, _ = get_authenticated_user_and_company(request)
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='TOGGLE_YARD_SLOT_STATUS',
                category='YARD_MANAGEMENT',
                target_type='YardSlot',
                target_id=str(slot.yard_slot_id),
                description=f"Updated Yard Slot '{slot.yard_slot_code}' status to {slot.yard_slot_status}.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Yard Slot '{slot.yard_slot_code}' status updated to {slot.yard_slot_status}.",
            "data": YardSlotSerializer(slot).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T2 — CONTAINER YARD ALLOCATION & STORAGE API VIEWS
# ==============================================================================

class YardAllocationPendingListAPIView(APIView):
    """
    API Endpoint to List Containers Pending Physical Yard Slot Allocation.
    Endpoint: GET /api/terminal/yard-allocations/pending/
    Permissions: IsYardAllocationAuthorized
    """
    permission_classes = [IsYardAllocationAuthorized]

    def get(self, request):
        active_alloc_container_ids = YardAllocation.objects.filter(
            yard_allocation_status='ACTIVE'
        ).values_list('yard_allocation_container_id', flat=True)

        queryset = Container.objects.filter(
            container_cargo_id__cargo_type='CONTAINERIZED'
        ).exclude(
            container_status='RELEASED'
        ).exclude(
            container_delivery_status__in=['PICKED_UP', 'DEPARTED_PORT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']
        ).exclude(
            container_id__in=active_alloc_container_ids
        ).select_related(
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'container_cargo_id__cargo_arrival_request_id'
        ).prefetch_related(
            'customs_inspections'
        )

        # Validate actual physical status and vessel/terminal eligibility:
        # Containers in terminal/customs statuses are physically present at terminal.
        # Containers in REGISTERED or ARRIVED must have an arrived/berthed vessel schedule (not SCHEDULED at sea).
        eligible_vessel_statuses = ['ARRIVED', 'AT_BERTH', 'DEPARTED']
        queryset = queryset.filter(
            models.Q(container_status__in=['AT_TERMINAL', 'AWAITING_CUSTOMS', 'UNDER_INSPECTION', 'CUSTOMS_HOLD', 'CLEARED']) |
            models.Q(
                container_status__in=['REGISTERED', 'ARRIVED'],
                container_cargo_id__cargo_arrival_request_id__schedule__vessel_schedule_status__in=eligible_vessel_statuses
            ) |
            models.Q(
                container_status__in=['REGISTERED', 'ARRIVED'],
                container_cargo_id__cargo_arrival_request_id__schedule__isnull=True,
                container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_status__in=['APPROVED', 'ARRIVED', 'BERTHED', 'COMPLETED']
            )
        )

        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip().upper()

        if search:
            queryset = queryset.filter(
                models.Q(container_number__icontains=search) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=search)
            )
        if status_filter and status_filter != 'ALL':
            queryset = queryset.filter(container_status=status_filter)

        queryset = queryset.order_by('-container_created_at', '-container_id')
        total_count = queryset.count()
        serializer = PendingContainerSerializer(queryset, many=True)

        return Response({
            "status": "success",
            "data": serializer.data,
            "total": total_count
        }, status=status.HTTP_200_OK)


class YardAllocationAvailableSlotsAPIView(APIView):
    """
    API Endpoint to List Available Operational Yard Slots for Allocation.
    Endpoint: GET /api/terminal/yard-allocations/available-slots/
    Permissions: IsYardAllocationAuthorized
    """
    permission_classes = [IsYardAllocationAuthorized]

    def get(self, request):
        active_alloc_slot_ids = YardAllocation.objects.filter(
            yard_allocation_status='ACTIVE'
        ).values_list('yard_allocation_slot_id', flat=True)

        slots = YardSlot.objects.filter(
            yard_slot_status='AVAILABLE',
            yard_slot_block_id__yard_block_status='ACTIVE',
            yard_slot_block_id__yard_block_yard_id__yard_status='ACTIVE'
        ).exclude(
            yard_slot_id__in=active_alloc_slot_ids
        ).select_related(
            'yard_slot_block_id__yard_block_yard_id',
            'yard_slot_block_id'
        )

        yard_id = request.query_params.get('yard_id')
        block_id = request.query_params.get('block_id')
        search = request.query_params.get('search', '').strip()

        if yard_id and str(yard_id).isdigit():
            slots = slots.filter(yard_slot_block_id__yard_block_yard_id__yard_id=int(yard_id))
        if block_id and str(block_id).isdigit():
            slots = slots.filter(yard_slot_block_id__yard_block_id=int(block_id))
        if search:
            slots = slots.filter(
                models.Q(yard_slot_code__icontains=search) |
                models.Q(yard_slot_block_id__yard_block_code__icontains=search) |
                models.Q(yard_slot_block_id__yard_block_yard_id__yard_code__icontains=search)
            )

        slots = slots.order_by(
            'yard_slot_block_id__yard_block_yard_id__yard_code',
            'yard_slot_block_id__yard_block_code',
            'yard_slot_row',
            'yard_slot_bay',
            'yard_slot_tier',
            'yard_slot_id'
        )

        total_count = slots.count()
        serializer = AvailableSlotSerializer(slots, many=True)

        return Response({
            "status": "success",
            "data": serializer.data,
            "total": total_count
        }, status=status.HTTP_200_OK)


class YardAllocationListCreateAPIView(APIView):
    """
    API Endpoint to List Yard Allocations or Create a New Container Yard Allocation.
    Endpoints: GET  /api/terminal/yard-allocations/
               POST /api/terminal/yard-allocations/
    Permissions: IsYardAllocationAuthorized
    """
    permission_classes = [IsYardAllocationAuthorized]

    def get(self, request):
        allocations = YardAllocation.objects.all().select_related(
            'yard_allocation_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
            'yard_allocation_container_id',
            'yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id',
            'yard_allocation_slot_id__yard_slot_block_id',
            'yard_allocation_slot_id',
            'yard_allocation_allocated_by_id',
            'yard_allocation_released_by_id'
        )

        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip().upper()
        yard_id = request.query_params.get('yard_id')
        block_id = request.query_params.get('block_id')

        if search:
            allocations = allocations.filter(
                models.Q(yard_allocation_container_id__container_number__icontains=search) |
                models.Q(yard_allocation_slot_id__yard_slot_code__icontains=search)
            )
        if status_filter in ['ACTIVE', 'RELEASED']:
            allocations = allocations.filter(yard_allocation_status=status_filter)
        if yard_id and str(yard_id).isdigit():
            allocations = allocations.filter(
                yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id__yard_id=int(yard_id)
            )
        if block_id and str(block_id).isdigit():
            allocations = allocations.filter(
                yard_allocation_slot_id__yard_slot_block_id__yard_block_id=int(block_id)
            )

        allocations = allocations.order_by('-yard_allocation_allocated_at', '-yard_allocation_id')
        total_count = allocations.count()
        serializer = YardAllocationSerializer(allocations, many=True)

        return Response({
            "status": "success",
            "data": serializer.data,
            "total": total_count
        }, status=status.HTTP_200_OK)

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = YardAllocationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = ""
            for field, errs in serializer.errors.items():
                if isinstance(errs, list) and len(errs) > 0:
                    first_err = str(errs[0])
                    break
                elif isinstance(errs, str):
                    first_err = errs
                    break
            err_msg = first_err if first_err else "Yard allocation validation failed."
            return Response({
                "status": "error",
                "message": err_msg,
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        container_id = serializer.validated_data['container_id']
        slot_id = serializer.validated_data['slot_id']
        remarks = serializer.validated_data.get('remarks', '')

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().get(pk=container_id)
            except Container.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Container #{container_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            try:
                slot = YardSlot.objects.select_for_update().select_related(
                    'yard_slot_block_id__yard_block_yard_id'
                ).get(pk=slot_id)
            except YardSlot.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Yard slot #{slot_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if YardAllocation.objects.filter(yard_allocation_container_id=container, yard_allocation_status='ACTIVE').exists():
                return Response({
                    "status": "error",
                    "message": f"Container {container.container_number} already has an active yard allocation."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate container eligibility: carrier vessel must have arrived at port if container is in pre-arrival status
            if container.container_status in ['REGISTERED', 'ARRIVED']:
                cargo = container.container_cargo_id
                arr_req = cargo.cargo_arrival_request_id if cargo else None
                schedule = getattr(arr_req, 'schedule', None) if arr_req else None
                if schedule:
                    if schedule.vessel_schedule_status not in ['ARRIVED', 'AT_BERTH', 'DEPARTED']:
                        return Response({
                            "status": "error",
                            "message": f"Container '{container.container_number}' cannot be allocated to a yard slot because carrier vessel has not arrived at the port terminal yet (Schedule Status: {schedule.vessel_schedule_status})."
                        }, status=status.HTTP_400_BAD_REQUEST)
                elif arr_req:
                    if arr_req.vessel_arrival_request_status in ['SCHEDULED', 'PENDING', 'CANCELLED', 'REJECTED']:
                        return Response({
                            "status": "error",
                            "message": f"Container '{container.container_number}' cannot be allocated to a yard slot because carrier vessel has not arrived at the port terminal yet (Arrival Status: {arr_req.vessel_arrival_request_status})."
                        }, status=status.HTTP_400_BAD_REQUEST)

            if slot.yard_slot_status != 'AVAILABLE':
                return Response({
                    "status": "error",
                    "message": f"Slot {slot.yard_slot_code} is {slot.yard_slot_status} and no longer available."
                }, status=status.HTTP_400_BAD_REQUEST)

            if YardAllocation.objects.filter(yard_allocation_slot_id=slot, yard_allocation_status='ACTIVE').exists():
                return Response({
                    "status": "error",
                    "message": f"Slot {slot.yard_slot_code} is already allocated to another active container."
                }, status=status.HTTP_400_BAD_REQUEST)

            block = YardBlock.objects.select_for_update().get(pk=slot.yard_slot_block_id.pk)
            yard = Yard.objects.select_for_update().get(pk=block.yard_block_yard_id.pk)

            if yard.yard_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Yard '{yard.yard_name}' ({yard.yard_code}) is inactive."
                }, status=status.HTTP_400_BAD_REQUEST)

            if block.yard_block_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Block '{block.yard_block_name}' ({block.yard_block_code}) is inactive."
                }, status=status.HTTP_400_BAD_REQUEST)

            if block.yard_block_occupied >= block.yard_block_capacity:
                return Response({
                    "status": "error",
                    "message": f"Block '{block.yard_block_code}' capacity limit reached."
                }, status=status.HTTP_400_BAD_REQUEST)

            if yard.yard_occupied >= yard.yard_capacity:
                return Response({
                    "status": "error",
                    "message": f"Yard '{yard.yard_code}' capacity limit reached."
                }, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            allocation = YardAllocation.objects.create(
                yard_allocation_container_id=container,
                yard_allocation_slot_id=slot,
                yard_allocation_status='ACTIVE',
                yard_allocation_allocated_at=now,
                yard_allocation_allocated_by_id=user_obj,
                yard_allocation_remarks=remarks
            )

            slot.yard_slot_status = 'OCCUPIED'
            slot.save(update_fields=['yard_slot_status', 'yard_slot_updated_at'])

            # Advance container physical status to AT_TERMINAL if it was REGISTERED or ARRIVED
            if container.container_status in ['REGISTERED', 'ARRIVED']:
                container.container_status = 'AT_TERMINAL'
                container.save(update_fields=['container_status', 'container_updated_at'])

            block.yard_block_occupied = min(block.yard_block_capacity, block.yard_block_occupied + 1)
            block.save(update_fields=['yard_block_occupied', 'yard_block_updated_at'])

            yard.yard_occupied = min(yard.yard_capacity, yard.yard_occupied + 1)
            yard.save(update_fields=['yard_occupied', 'yard_updated_at'])

            # Record append-only YardMovementHistory for initial yard allocation
            YardMovementHistory.objects.create(
                yard_movement_container_id=container,
                yard_movement_from_slot_id=None,
                yard_movement_to_slot_id=slot,
                yard_movement_movement_type='DISCHARGE',
                yard_movement_moved_by_id=user_obj,
                yard_movement_timestamp=now,
                yard_movement_remarks=remarks or f"Initial yard allocation to slot {slot.yard_slot_code}."
            )

            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='ALLOCATE_CONTAINER_YARD',
                category='YARD_ALLOCATION',
                target_type='YardAllocation',
                target_id=str(allocation.yard_allocation_id),
                description=(
                    f"Allocated Container '{container.container_number}' to slot '{slot.yard_slot_code}' "
                    f"in Yard '{yard.yard_code}', Block '{block.yard_block_code}'."
                ),
                status='SUCCESS',
                request=request
            )

        allocation.refresh_from_db()
        return Response({
            "status": "success",
            "message": f"Container '{container.container_number}' allocated to slot '{slot.yard_slot_code}' successfully.",
            "data": YardAllocationSerializer(allocation).data
        }, status=status.HTTP_201_CREATED)


class YardAllocationDetailAPIView(APIView):
    """
    API Endpoint to Retrieve a Single Yard Allocation Record.
    Endpoint: GET /api/terminal/yard-allocations/<int:pk>/
    Permissions: IsYardAllocationAuthorized
    """
    permission_classes = [IsYardAllocationAuthorized]

    def get(self, request, pk):
        try:
            allocation = YardAllocation.objects.select_related(
                'yard_allocation_container_id__container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id',
                'yard_allocation_container_id',
                'yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id',
                'yard_allocation_slot_id__yard_slot_block_id',
                'yard_allocation_slot_id',
                'yard_allocation_allocated_by_id',
                'yard_allocation_released_by_id'
            ).get(pk=pk)
        except YardAllocation.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Yard allocation #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "success",
            "data": YardAllocationSerializer(allocation).data
        }, status=status.HTTP_200_OK)


class YardAllocationReleaseAPIView(APIView):
    """
    API Endpoint to Release a Container from its Current Yard Slot Allocation.
    Endpoint: POST /api/terminal/yard-allocations/<int:pk>/release/
    Permissions: IsYardAllocationAuthorized
    """
    permission_classes = [IsYardAllocationAuthorized]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = YardAllocationReleaseSerializer(data=request.data)
        serializer.is_valid()
        remarks = serializer.validated_data.get('remarks', '')

        with transaction.atomic():
            try:
                allocation = YardAllocation.objects.select_for_update().select_related(
                    'yard_allocation_container_id',
                    'yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id'
                ).get(pk=pk)
            except YardAllocation.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Yard allocation #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if allocation.yard_allocation_status == 'RELEASED':
                return Response({
                    "status": "error",
                    "message": f"Yard allocation #{pk} has already been released."
                }, status=status.HTTP_400_BAD_REQUEST)

            slot = YardSlot.objects.select_for_update().get(pk=allocation.yard_allocation_slot_id.pk)
            block = YardBlock.objects.select_for_update().get(pk=slot.yard_slot_block_id.pk)
            yard = Yard.objects.select_for_update().get(pk=block.yard_block_yard_id.pk)

            allocation.yard_allocation_status = 'RELEASED'
            allocation.yard_allocation_released_at = timezone.now()
            allocation.yard_allocation_released_by_id = user_obj
            if remarks:
                if allocation.yard_allocation_remarks:
                    allocation.yard_allocation_remarks += f" | Release note: {remarks}"
                else:
                    allocation.yard_allocation_remarks = f"Release note: {remarks}"
            allocation.save(update_fields=[
                'yard_allocation_status',
                'yard_allocation_released_at',
                'yard_allocation_released_by_id',
                'yard_allocation_remarks',
                'yard_allocation_updated_at'
            ])

            slot.yard_slot_status = 'AVAILABLE'
            slot.save(update_fields=['yard_slot_status', 'yard_slot_updated_at'])

            block.yard_block_occupied = max(0, block.yard_block_occupied - 1)
            block.save(update_fields=['yard_block_occupied', 'yard_block_updated_at'])

            yard.yard_occupied = max(0, yard.yard_occupied - 1)
            yard.save(update_fields=['yard_occupied', 'yard_updated_at'])

            container_num = allocation.container.container_number
            operator_name = user_obj.user_full_name if user_obj else 'Operations Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='RELEASE_CONTAINER_YARD',
                category='YARD_ALLOCATION',
                target_type='YardAllocation',
                target_id=str(allocation.yard_allocation_id),
                description=(
                    f"Released Container '{container_num}' from slot '{slot.yard_slot_code}' "
                    f"in Yard '{yard.yard_code}', Block '{block.yard_block_code}'."
                ),
                status='SUCCESS',
                request=request
            )

        allocation.refresh_from_db()
        return Response({
            "status": "success",
            "message": f"Yard allocation #{pk} released successfully. Slot '{slot.yard_slot_code}' is now available.",
            "data": YardAllocationSerializer(allocation).data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T3 — YARD OPERATIONS MANAGEMENT VIEWS
# ==============================================================================

class ContainerRelocationAPIView(APIView):
    """
    API Endpoint to Relocate an Allocated Container from its Current Slot to a New Slot.
    Endpoint: POST /api/terminal/yard-operations/relocate/
              POST /api/yard-operations/relocate/
    Permissions: IsYardOperationsAuthorized
    """
    permission_classes = [IsYardOperationsAuthorized]

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = ContainerRelocationSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = ""
            for field, errs in serializer.errors.items():
                if isinstance(errs, list) and len(errs) > 0:
                    first_err = str(errs[0])
                    break
                elif isinstance(errs, str):
                    first_err = errs
                    break
            err_msg = first_err if first_err else "Relocation validation failed."
            return Response({
                "status": "error",
                "message": err_msg,
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        container_id = serializer.validated_data['container_id']
        destination_slot_id = serializer.validated_data['destination_slot_id']
        crane_id = serializer.validated_data.get('crane_id')
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            # 1. Lock Container
            try:
                container = Container.objects.select_for_update().get(pk=container_id)
            except Container.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Container #{container_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            # 2. Lock and retrieve current active allocation
            current_alloc = YardAllocation.objects.select_for_update().select_related(
                'yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id'
            ).filter(
                yard_allocation_container_id=container,
                yard_allocation_status='ACTIVE'
            ).first()

            if not current_alloc:
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' does not have an active yard allocation. Only stored containers can be relocated."
                }, status=status.HTTP_400_BAD_REQUEST)

            from_slot = current_alloc.yard_allocation_slot_id

            # 3. Lock destination slot
            try:
                to_slot = YardSlot.objects.select_for_update().select_related(
                    'yard_slot_block_id__yard_block_yard_id'
                ).get(pk=destination_slot_id)
            except YardSlot.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Destination yard slot #{destination_slot_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            # 4. Reject if destination is the same slot
            if from_slot.pk == to_slot.pk:
                return Response({
                    "status": "error",
                    "message": f"Destination slot '{to_slot.yard_slot_code}' is the same as the container's current slot. Relocation requires a different destination slot."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 5. Reject if destination slot is not available or inactive/blocked/reserved
            if to_slot.yard_slot_status != 'AVAILABLE':
                return Response({
                    "status": "error",
                    "message": f"Destination slot '{to_slot.yard_slot_code}' is {to_slot.yard_slot_status} and not allocatable."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 6. Reject if destination slot is already actively allocated
            if YardAllocation.objects.filter(yard_allocation_slot_id=to_slot, yard_allocation_status='ACTIVE').exists():
                return Response({
                    "status": "error",
                    "message": f"Destination slot '{to_slot.yard_slot_code}' has already been occupied by another active container."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 6b. Lock and validate handling equipment/crane if specified
            locked_crane = None
            if crane_id:
                try:
                    locked_crane = Crane.objects.select_for_update().get(pk=crane_id)
                except Crane.DoesNotExist:
                    return Response({
                        "status": "error",
                        "message": f"Handling equipment #{crane_id} not found."
                    }, status=status.HTTP_404_NOT_FOUND)

                if not locked_crane.crane_is_active:
                    return Response({
                        "status": "error",
                        "message": f"Equipment '{locked_crane.crane_code}' is deactivated/archived."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if locked_crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
                    return Response({
                        "status": "error",
                        "message": f"Equipment '{locked_crane.crane_code}' is currently in {locked_crane.get_crane_status_display()} status and cannot be used for relocation."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if locked_crane.crane_type == 'STS':
                    return Response({
                        "status": "error",
                        "message": f"STS Crane '{locked_crane.crane_code}' cannot be used for yard relocation operations. Please select suitable yard equipment (RTG, RMG, or MHC)."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if locked_crane.crane_type not in ['RTG', 'RMG', 'MHC']:
                    return Response({
                        "status": "error",
                        "message": f"Equipment '{locked_crane.crane_code}' of type '{locked_crane.get_crane_type_display()}' is not suitable for yard relocation operations."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if locked_crane.allocations.filter(crane_allocation_status='ACTIVE').exists():
                    return Response({
                        "status": "error",
                        "message": f"Equipment '{locked_crane.crane_code}' is currently actively allocated to a vessel operation and unavailable for yard relocation."
                    }, status=status.HTTP_409_CONFLICT)

                if locked_crane.crane_status == 'IN_USE':
                    return Response({
                        "status": "error",
                        "message": f"Equipment '{locked_crane.crane_code}' is currently in use and unavailable for relocation."
                    }, status=status.HTTP_409_CONFLICT)

            # 7. Lock blocks and yards in deterministic PK order to avoid deadlocks
            from_block_pk = from_slot.yard_slot_block_id_id
            to_block_pk = to_slot.yard_slot_block_id_id
            block_pks = sorted(list(set([from_block_pk, to_block_pk])))
            blocks_by_pk = {b.pk: b for b in YardBlock.objects.select_for_update().filter(pk__in=block_pks)}
            from_block = blocks_by_pk[from_block_pk]
            to_block = blocks_by_pk[to_block_pk]

            from_yard_pk = from_block.yard_block_yard_id_id
            to_yard_pk = to_block.yard_block_yard_id_id
            yard_pks = sorted(list(set([from_yard_pk, to_yard_pk])))
            yards_by_pk = {y.pk: y for y in Yard.objects.select_for_update().filter(pk__in=yard_pks)}
            from_yard = yards_by_pk[from_yard_pk]
            to_yard = yards_by_pk[to_yard_pk]

            # 8. Operational checks
            if to_yard.yard_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Destination yard '{to_yard.yard_name}' ({to_yard.yard_code}) is inactive."
                }, status=status.HTTP_400_BAD_REQUEST)

            if to_block.yard_block_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Destination block '{to_block.yard_block_name}' ({to_block.yard_block_code}) is inactive."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 9. Capacity checks (only if changing block or yard)
            if from_block.pk != to_block.pk and to_block.yard_block_occupied >= to_block.yard_block_capacity:
                return Response({
                    "status": "error",
                    "message": f"Destination block '{to_block.yard_block_code}' capacity limit ({to_block.yard_block_capacity}) reached."
                }, status=status.HTTP_400_BAD_REQUEST)

            if from_yard.pk != to_yard.pk and to_yard.yard_occupied >= to_yard.yard_capacity:
                return Response({
                    "status": "error",
                    "message": f"Destination yard '{to_yard.yard_code}' capacity limit ({to_yard.yard_capacity}) reached."
                }, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()

            # 10. Mark old allocation as RELEASED with relocation reason
            current_alloc.yard_allocation_status = 'RELEASED'
            current_alloc.yard_allocation_released_at = now
            current_alloc.yard_allocation_released_by_id = user_obj
            relocation_note = f"Relocated to slot {to_slot.yard_slot_code}"
            if locked_crane:
                relocation_note += f" via equipment {locked_crane.crane_code}"
            if remarks:
                relocation_note += f" | {remarks}"
            if current_alloc.yard_allocation_remarks:
                current_alloc.yard_allocation_remarks += f" | {relocation_note}"
            else:
                current_alloc.yard_allocation_remarks = relocation_note
            current_alloc.save(update_fields=[
                'yard_allocation_status',
                'yard_allocation_released_at',
                'yard_allocation_released_by_id',
                'yard_allocation_remarks',
                'yard_allocation_updated_at'
            ])

            # 11. Create new ACTIVE allocation at destination slot
            new_alloc = YardAllocation.objects.create(
                yard_allocation_container_id=container,
                yard_allocation_slot_id=to_slot,
                yard_allocation_status='ACTIVE',
                yard_allocation_allocated_at=now,
                yard_allocation_allocated_by_id=user_obj,
                yard_allocation_remarks=remarks or (f"Relocated from {from_slot.yard_slot_code}" + (f" via {locked_crane.crane_code}" if locked_crane else ""))
            )

            # 12. Release old slot and mark destination slot OCCUPIED
            from_slot.yard_slot_status = 'AVAILABLE'
            from_slot.save(update_fields=['yard_slot_status', 'yard_slot_updated_at'])

            to_slot.yard_slot_status = 'OCCUPIED'
            to_slot.save(update_fields=['yard_slot_status', 'yard_slot_updated_at'])

            # 13. Update block occupancy (same block => no change; cross-block => update both)
            if from_block.pk != to_block.pk:
                from_block.yard_block_occupied = max(0, from_block.yard_block_occupied - 1)
                from_block.save(update_fields=['yard_block_occupied', 'yard_block_updated_at'])

                to_block.yard_block_occupied = min(to_block.yard_block_capacity, to_block.yard_block_occupied + 1)
                to_block.save(update_fields=['yard_block_occupied', 'yard_block_updated_at'])

            # 14. Update yard occupancy (same yard => no change; cross-yard => update both)
            if from_yard.pk != to_yard.pk:
                from_yard.yard_occupied = max(0, from_yard.yard_occupied - 1)
                from_yard.save(update_fields=['yard_occupied', 'yard_updated_at'])

                to_yard.yard_occupied = min(to_yard.yard_capacity, to_yard.yard_occupied + 1)
                to_yard.save(update_fields=['yard_occupied', 'yard_updated_at'])

            # 15. Record append-only YardMovementHistory with selected equipment
            movement = YardMovementHistory.objects.create(
                yard_movement_container_id=container,
                yard_movement_from_slot_id=from_slot,
                yard_movement_to_slot_id=to_slot,
                yard_movement_movement_type='RELOCATION',
                yard_movement_crane_id=locked_crane,
                yard_movement_moved_by_id=user_obj,
                yard_movement_timestamp=now,
                yard_movement_remarks=remarks
            )

            # 16. Record Audit Log event
            operator_name = user_obj.user_full_name if user_obj else 'Terminal Operator'
            crane_desc = f" using equipment '{locked_crane.crane_code}' ({locked_crane.crane_name})" if locked_crane else ""
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='RELOCATE_CONTAINER_YARD',
                category='YARD_OPERATIONS',
                target_type='YardMovementHistory',
                target_id=str(movement.yard_movement_id),
                description=(
                    f"Relocated Container '{container.container_number}' from slot '{from_slot.yard_slot_code}' "
                    f"({from_yard.yard_code} / {from_block.yard_block_code}) to slot '{to_slot.yard_slot_code}' "
                    f"({to_yard.yard_code} / {to_block.yard_block_code}){crane_desc}."
                ),
                status='SUCCESS',
                request=request
            )

        container.refresh_from_db()
        return Response({
            "status": "success",
            "message": f"Container '{container.container_number}' relocated to slot '{to_slot.yard_slot_code}' successfully.",
            "data": {
                "movement": YardMovementHistorySerializer(movement).data,
                "current_location": container.current_yard_location,
                "allocation": YardAllocationSerializer(new_alloc).data
            }
        }, status=status.HTTP_200_OK)


class YardOperationsContainersAPIView(APIView):
    """
    API Endpoint to List Containers with Yard Storage Status and Current Coordinates.
    Endpoint: GET /api/terminal/yard-operations/containers/
              GET /api/yard-operations/containers/
    Permissions: IsYardOperationsAuthorized
    """
    permission_classes = [IsYardOperationsAuthorized]

    def get(self, request):
        containers = Container.objects.select_related(
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id'
        ).prefetch_related(
            'yard_allocations__yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id',
            'yard_movements'
        ).all()

        search = request.query_params.get('search', '').strip()
        yard_id = request.query_params.get('yard_id')
        block_id = request.query_params.get('block_id')
        storage_status = request.query_params.get('storage_status', '').strip().upper()

        if search:
            containers = containers.filter(
                models.Q(container_number__icontains=search) |
                models.Q(container_cargo_id__cargo_description__icontains=search) |
                models.Q(container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=search)
            )

        if yard_id and str(yard_id).isdigit():
            containers = containers.filter(
                yard_allocations__yard_allocation_status='ACTIVE',
                yard_allocations__yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id__yard_id=int(yard_id)
            )

        if block_id and str(block_id).isdigit():
            containers = containers.filter(
                yard_allocations__yard_allocation_status='ACTIVE',
                yard_allocations__yard_allocation_slot_id__yard_slot_block_id__yard_block_id=int(block_id)
            )

        # Storage status filter
        if storage_status == 'STORED':
            containers = containers.filter(
                yard_allocations__yard_allocation_status='ACTIVE'
            ).distinct()
        elif storage_status == 'RELEASED':
            containers = containers.exclude(
                yard_allocations__yard_allocation_status='ACTIVE'
            ).filter(
                yard_allocations__yard_allocation_status='RELEASED'
            ).distinct()
        elif storage_status == 'NOT_ALLOCATED':
            containers = containers.exclude(
                yard_allocations__yard_allocation_status='ACTIVE'
            ).exclude(
                yard_allocations__yard_allocation_status='RELEASED'
            ).distinct()

        containers = containers.order_by('-container_created_at', '-container_id')
        total_count = containers.count()

        serializer = YardOperationContainerItemSerializer(containers, many=True)
        return Response({
            "status": "success",
            "data": serializer.data,
            "total": total_count
        }, status=status.HTTP_200_OK)


class YardOperationsContainerLocationAPIView(APIView):
    """
    API Endpoint to Retrieve Reliable Current Location and Movement History for a Container.
    Endpoint: GET /api/terminal/yard-operations/containers/<int:pk>/location/
              GET /api/yard-operations/containers/<int:pk>/location/
    Permissions: IsYardOperationsAuthorized
    """
    permission_classes = [IsYardOperationsAuthorized]

    def get(self, request, pk):
        try:
            container = Container.objects.select_related(
                'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id'
            ).prefetch_related(
                'yard_allocations__yard_allocation_slot_id__yard_slot_block_id__yard_block_yard_id',
                'yard_movements__yard_movement_from_slot_id__yard_slot_block_id__yard_block_yard_id',
                'yard_movements__yard_movement_to_slot_id__yard_slot_block_id__yard_block_yard_id',
                'yard_movements__yard_movement_moved_by_id'
            ).get(pk=pk)
        except Container.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Container #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        active_alloc = container.active_yard_allocation
        movements = container.yard_movements.all().order_by('-yard_movement_timestamp', '-yard_movement_id')
        movements_data = YardMovementHistorySerializer(movements, many=True).data

        if active_alloc and active_alloc.yard_allocation_slot_id:
            slot = active_alloc.yard_allocation_slot_id
            block = slot.yard_slot_block_id
            yard = block.yard_block_yard_id
            location_info = {
                "container_id": container.container_id,
                "container_number": container.container_number,
                "container_type": container.container_type,
                "container_type_display": container.get_container_type_display(),
                "container_gross_weight": str(container.container_gross_weight),
                "container_status": container.container_status,
                "container_status_display": container.get_container_status_display(),
                "storage_status": "STORED",
                "storage_status_display": "Currently Stored",
                "has_active_allocation": True,
                "yard_id": yard.yard_id,
                "yard_name": yard.yard_name,
                "yard_code": yard.yard_code,
                "block_id": block.yard_block_id,
                "block_name": block.yard_block_name,
                "block_code": block.yard_block_code,
                "slot_id": slot.yard_slot_id,
                "slot_code": slot.yard_slot_code,
                "slot_row": slot.yard_slot_row,
                "slot_bay": slot.yard_slot_bay,
                "slot_tier": slot.yard_slot_tier,
                "location_display": f"{yard.yard_code} / {block.yard_block_code} / {slot.yard_slot_code}",
                "allocated_at": active_alloc.yard_allocation_allocated_at.isoformat() if active_alloc.yard_allocation_allocated_at else None,
                "allocated_by_name": active_alloc.allocated_by.user_full_name if active_alloc.allocated_by else "Terminal Operator",
                "allocation_id": active_alloc.yard_allocation_id,
                "movement_count": len(movements_data),
                "movements": movements_data
            }
        else:
            has_released = container.yard_allocations.filter(yard_allocation_status='RELEASED').exists()
            storage_stat = "RELEASED" if has_released else "NOT_ALLOCATED"
            storage_disp = "Released from Yard" if has_released else "Not allocated"
            location_info = {
                "container_id": container.container_id,
                "container_number": container.container_number,
                "container_type": container.container_type,
                "container_type_display": container.get_container_type_display(),
                "container_gross_weight": str(container.container_gross_weight),
                "container_status": container.container_status,
                "container_status_display": container.get_container_status_display(),
                "storage_status": storage_stat,
                "storage_status_display": storage_disp,
                "has_active_allocation": False,
                "yard_id": None,
                "yard_name": None,
                "yard_code": None,
                "block_id": None,
                "block_name": None,
                "block_code": None,
                "slot_id": None,
                "slot_code": None,
                "slot_row": None,
                "slot_bay": None,
                "slot_tier": None,
                "location_display": "Not allocated",
                "allocated_at": None,
                "allocated_by_name": None,
                "allocation_id": None,
                "movement_count": len(movements_data),
                "movements": movements_data
            }

        return Response({
            "status": "success",
            "data": location_info
        }, status=status.HTTP_200_OK)


class YardMovementHistoryListAPIView(APIView):
    """
    API Endpoint to Retrieve Append-Only Movement History Records.
    Endpoint: GET /api/terminal/yard-operations/movements/
              GET /api/yard-operations/movements/
    Permissions: IsYardOperationsAuthorized
    """
    permission_classes = [IsYardOperationsAuthorized]

    def get(self, request):
        movements = YardMovementHistory.objects.select_related(
            'yard_movement_container_id',
            'yard_movement_from_slot_id__yard_slot_block_id__yard_block_yard_id',
            'yard_movement_to_slot_id__yard_slot_block_id__yard_block_yard_id',
            'yard_movement_crane_id',
            'yard_movement_moved_by_id'
        ).all()

        container_id = request.query_params.get('container_id')
        search = request.query_params.get('search', '').strip()
        yard_id = request.query_params.get('yard_id')
        block_id = request.query_params.get('block_id')

        if container_id and str(container_id).isdigit():
            movements = movements.filter(yard_movement_container_id__container_id=int(container_id))

        if search:
            movements = movements.filter(
                models.Q(yard_movement_container_id__container_number__icontains=search) |
                models.Q(yard_movement_from_slot_id__yard_slot_code__icontains=search) |
                models.Q(yard_movement_to_slot_id__yard_slot_code__icontains=search) |
                models.Q(yard_movement_remarks__icontains=search)
            )

        if yard_id and str(yard_id).isdigit():
            movements = movements.filter(
                models.Q(yard_movement_from_slot_id__yard_slot_block_id__yard_block_yard_id__yard_id=int(yard_id)) |
                models.Q(yard_movement_to_slot_id__yard_slot_block_id__yard_block_yard_id__yard_id=int(yard_id))
            )

        if block_id and str(block_id).isdigit():
            movements = movements.filter(
                models.Q(yard_movement_from_slot_id__yard_slot_block_id__yard_block_id=int(block_id)) |
                models.Q(yard_movement_to_slot_id__yard_slot_block_id__yard_block_id=int(block_id))
            )

        movements = movements.order_by('-yard_movement_timestamp', '-yard_movement_id')
        total_count = movements.count()
        serializer = YardMovementHistorySerializer(movements, many=True)

        return Response({
            "status": "success",
            "data": serializer.data,
            "total": total_count
        }, status=status.HTTP_200_OK)


class YardUtilizationSummaryAPIView(APIView):
    """
    API Endpoint to Retrieve Real-Time Yard and Block Capacity and Occupancy Utilization.
    Endpoint: GET /api/terminal/yard-operations/utilization/
              GET /api/yard-operations/utilization/
    Permissions: IsYardOperationsAuthorized
    """
    permission_classes = [IsYardOperationsAuthorized]

    def get(self, request):
        yards = Yard.objects.prefetch_related('blocks__slots').all().order_by('yard_code')

        total_capacity = 0
        total_occupied = 0
        yards_data = []

        for y in yards:
            total_capacity += y.yard_capacity
            total_occupied += y.yard_occupied

            blocks_data = []
            for b in y.blocks.all().order_by('yard_block_code'):
                blocks_data.append({
                    "block_id": b.yard_block_id,
                    "block_name": b.yard_block_name,
                    "block_code": b.yard_block_code,
                    "block_type": b.yard_block_type,
                    "block_type_display": b.get_yard_block_type_display(),
                    "block_status": b.yard_block_status,
                    "block_capacity": b.yard_block_capacity,
                    "block_occupied": b.yard_block_occupied,
                    "available_capacity": b.available_capacity,
                    "occupancy_percentage": b.occupancy_percentage,
                    "is_operational": b.is_operational
                })

            yards_data.append({
                "yard_id": y.yard_id,
                "yard_name": y.yard_name,
                "yard_code": y.yard_code,
                "yard_type": y.yard_type,
                "yard_type_display": y.get_yard_type_display(),
                "yard_status": y.yard_status,
                "yard_capacity": y.yard_capacity,
                "yard_occupied": y.yard_occupied,
                "available_capacity": y.available_capacity,
                "occupancy_percentage": y.occupancy_percentage,
                "is_operational": y.is_operational,
                "blocks": blocks_data
            })

        total_available = max(0, total_capacity - total_occupied)
        overall_percentage = round((total_occupied / total_capacity * 100.0), 2) if total_capacity > 0 else 0.0

        return Response({
            "status": "success",
            "data": {
                "overall": {
                    "total_capacity": total_capacity,
                    "total_occupied": total_occupied,
                    "total_available": total_available,
                    "occupancy_percentage": overall_percentage,
                    "total_yards": len(yards_data)
                },
                "yards": yards_data
            }
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T4 — CRANE MANAGEMENT & ALLOCATION API VIEWS
# ==============================================================================

class CraneListCreateAPIView(APIView):
    """
    API Endpoint for Crane Master Listing and Creation (Phase T4.1).
    Endpoints:
      GET  /api/terminal/cranes/
      POST /api/terminal/cranes/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        status_param = request.query_params.get('status', '').strip().upper()
        type_param = request.query_params.get('type', '').strip().upper()
        is_active_param = request.query_params.get('is_active', '').strip().lower()

        cranes = Crane.objects.select_related('crane_assigned_berth_id', 'crane_created_by').prefetch_related('allocations').all()

        if query:
            cranes = cranes.filter(
                models.Q(crane_code__icontains=query) |
                models.Q(crane_name__icontains=query)
            )

        if status_param:
            cranes = cranes.filter(crane_status=status_param)

        if type_param:
            types = [t.strip().upper() for t in type_param.split(',') if t.strip()]
            if len(types) == 1:
                cranes = cranes.filter(crane_type=types[0])
            elif len(types) > 1:
                cranes = cranes.filter(crane_type__in=types)

        if is_active_param in ['true', '1']:
            cranes = cranes.filter(crane_is_active=True)
        elif is_active_param in ['false', '0']:
            cranes = cranes.filter(crane_is_active=False)

        serializer = CraneSerializer(cranes, many=True)
        return Response({
            "status": "success",
            "count": cranes.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CraneSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Crane validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        _, user_obj, _ = get_authenticated_user_and_company(request)
        crane = serializer.save(crane_created_by=user_obj)

        create_audit_log(
            user=user_obj,
            actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
            role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
            action='CREATE',
            category='CRANE_MANAGEMENT',
            target_type='Crane',
            target_id=str(crane.crane_id),
            description=f"Created crane '{crane.crane_code}' ({crane.crane_name}) with capacity {crane.crane_max_lifting_capacity_mt} {crane.crane_capacity_unit}.",
            status='SUCCESS',
            request=request
        )

        return Response({
            "status": "success",
            "message": f"Crane '{crane.crane_code}' created successfully.",
            "data": CraneSerializer(crane).data
        }, status=status.HTTP_201_CREATED)


class CraneDetailAPIView(APIView):
    """
    API Endpoint for Crane Master Detail, Update, and Safe Archival (Phase T4.1).
    Endpoints:
      GET    /api/terminal/cranes/<pk>/
      PUT    /api/terminal/cranes/<pk>/
      PATCH  /api/terminal/cranes/<pk>/
      DELETE /api/terminal/cranes/<pk>/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def get_object(self, pk):
        try:
            return Crane.objects.select_related('crane_assigned_berth_id', 'crane_created_by').prefetch_related('allocations').get(pk=pk)
        except Crane.DoesNotExist:
            return None

    def get(self, request, pk):
        crane = self.get_object(pk)
        if not crane:
            return Response({
                "status": "error",
                "message": f"Crane #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = CraneSerializer(crane)
        return Response({
            "status": "success",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        return self.put(request, pk, partial=True)

    def put(self, request, pk, partial=False):
        crane = self.get_object(pk)
        if not crane:
            return Response({
                "status": "error",
                "message": f"Crane #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = CraneSerializer(crane, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Crane update validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        updated_crane = serializer.save()
        _, user_obj, _ = get_authenticated_user_and_company(request)

        create_audit_log(
            user=user_obj,
            actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
            role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
            action='UPDATE',
            category='CRANE_MANAGEMENT',
            target_type='Crane',
            target_id=str(updated_crane.crane_id),
            description=f"Updated crane '{updated_crane.crane_code}' details and status to {updated_crane.crane_status}.",
            status='SUCCESS',
            request=request
        )

        return Response({
            "status": "success",
            "message": f"Crane '{updated_crane.crane_code}' updated successfully.",
            "data": CraneSerializer(updated_crane).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        crane = self.get_object(pk)
        if not crane:
            return Response({
                "status": "error",
                "message": f"Crane #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if crane has active allocations
        if crane.allocations.filter(crane_allocation_status='ACTIVE').exists():
            return Response({
                "status": "error",
                "message": f"Cannot delete or deactivate crane '{crane.crane_code}' while it has an ongoing active allocation."
            }, status=status.HTTP_400_BAD_REQUEST)

        _, user_obj, _ = get_authenticated_user_and_company(request)

        # If it has historical allocations, archive it safely rather than hard deleting
        if crane.allocations.exists():
            crane.crane_is_active = False
            crane.crane_status = 'INACTIVE'
            crane.save()

            create_audit_log(
                user=user_obj,
                actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
                role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
                action='ARCHIVE',
                category='CRANE_MANAGEMENT',
                target_type='Crane',
                target_id=str(crane.crane_id),
                description=f"Archived crane '{crane.crane_code}' with allocation history (marked INACTIVE).",
                status='SUCCESS',
                request=request
            )

            return Response({
                "status": "success",
                "message": f"Crane '{crane.crane_code}' has assignment history and was safely archived as INACTIVE."
            }, status=status.HTTP_200_OK)
        else:
            code = crane.crane_code
            crane.delete()

            create_audit_log(
                user=user_obj,
                actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
                role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
                action='DELETE',
                category='CRANE_MANAGEMENT',
                target_type='Crane',
                target_id=str(pk),
                description=f"Deleted unallocated crane '{code}'.",
                status='SUCCESS',
                request=request
            )

            return Response({
                "status": "success",
                "message": f"Crane '{code}' deleted successfully."
            }, status=status.HTTP_200_OK)


class CraneAllocationListCreateAPIView(APIView):
    """
    API Endpoint for Crane Allocation Listing and Creation (Phase T4.2).
    Includes server-side filters and concurrency protection.
    Endpoints:
      GET  /api/terminal/crane-allocations/
      POST /api/terminal/crane-allocations/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def get(self, request):
        allocations = CraneAllocation.objects.select_related(
            'crane_allocation_crane_id',
            'crane_allocation_vessel_schedule_id__vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
            'crane_allocation_vessel_schedule_id__vessel_schedule_berth_id',
            'crane_allocation_berth_id',
            'crane_allocation_assigned_by_id'
        ).all()

        crane_id = request.query_params.get('crane_id')
        schedule_id = request.query_params.get('vessel_schedule_id')
        status_param = request.query_params.get('status', '').strip().upper()
        op_type = request.query_params.get('operation_type', '').strip().upper()
        query = request.query_params.get('q', '').strip()

        if crane_id:
            allocations = allocations.filter(crane_allocation_crane_id_id=crane_id)

        if schedule_id:
            allocations = allocations.filter(crane_allocation_vessel_schedule_id_id=schedule_id)

        if status_param:
            allocations = allocations.filter(crane_allocation_status=status_param)

        if op_type:
            allocations = allocations.filter(crane_allocation_operation_type=op_type)

        if query:
            allocations = allocations.filter(
                models.Q(crane_allocation_crane_id__crane_code__icontains=query) |
                models.Q(crane_allocation_crane_id__crane_name__icontains=query) |
                models.Q(crane_allocation_vessel_schedule_id__vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id__vessel_name__icontains=query)
            )

        serializer = CraneAllocationSerializer(allocations, many=True)
        return Response({
            "status": "success",
            "count": allocations.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CraneAllocationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Crane allocation validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        crane_id = serializer.validated_data['crane_allocation_crane_id'].pk
        planned_start = serializer.validated_data['crane_allocation_planned_start_at']
        planned_end = serializer.validated_data['crane_allocation_planned_end_at']
        _, user_obj, _ = get_authenticated_user_and_company(request)

        # Atomic transaction with row locking on Crane to prevent concurrent conflicting allocations
        with transaction.atomic():
            try:
                locked_crane = Crane.objects.select_for_update().get(pk=crane_id)
            except Crane.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": "Selected crane does not exist."
                }, status=status.HTTP_400_BAD_REQUEST)

            if not locked_crane.crane_is_active or locked_crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
                return Response({
                    "status": "error",
                    "message": f"Crane '{locked_crane.crane_code}' is currently in {locked_crane.get_crane_status_display()} status and cannot be allocated."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate Crane type suitability for quayside vessel operations
            if locked_crane.crane_type in ['RTG', 'RMG']:
                return Response({
                    "status": "error",
                    "message": f"Incompatible crane type '{locked_crane.get_crane_type_display()}'. Yard gantry cranes (RTG and RMG) cannot be allocated to vessel schedules. Only quayside cranes (STS and MHC) are permitted."
                }, status=status.HTTP_400_BAD_REQUEST)

            if locked_crane.crane_type not in ['STS', 'MHC']:
                return Response({
                    "status": "error",
                    "message": f"Incompatible crane type '{locked_crane.get_crane_type_display()}'. Only quayside cranes (STS and MHC) can be allocated to vessel schedules."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate STS fixed-berth match
            schedule = serializer.validated_data['crane_allocation_vessel_schedule_id']
            if locked_crane.crane_type == 'STS' and locked_crane.crane_assigned_berth_id:
                if schedule.vessel_schedule_berth_id and locked_crane.crane_assigned_berth_id_id != schedule.vessel_schedule_berth_id_id:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Berth mismatch: STS Crane '{locked_crane.crane_code}' is fixed to berth "
                            f"'{locked_crane.crane_assigned_berth_id.berth_name}', which does not match vessel schedule berth "
                            f"'{schedule.vessel_schedule_berth_id.berth_name}'."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Re-check overlapping windows under lock
            has_conflict = CraneAllocation.objects.filter(
                crane_allocation_crane_id=locked_crane,
                crane_allocation_status__in=['SCHEDULED', 'ACTIVE'],
                crane_allocation_planned_start_at__lt=planned_end,
                crane_allocation_planned_end_at__gt=planned_start
            ).exists()

            if has_conflict:
                return Response({
                    "status": "error",
                    "message": f"Concurrent conflict: Crane '{locked_crane.crane_code}' already has an overlapping active or scheduled allocation during this time window."
                }, status=status.HTTP_409_CONFLICT)

            allocation = serializer.save(crane_allocation_assigned_by_id=user_obj)

            create_audit_log(
                user=user_obj,
                actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
                role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
                action='CREATE',
                category='CRANE_MANAGEMENT',
                target_type='CraneAllocation',
                target_id=str(allocation.crane_allocation_id),
                description=f"Created crane allocation #{allocation.crane_allocation_id} for crane '{locked_crane.crane_code}' on schedule #{allocation.crane_allocation_vessel_schedule_id_id} ({allocation.crane_allocation_operation_type}).",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Crane allocation #{allocation.crane_allocation_id} created successfully.",
            "data": CraneAllocationSerializer(allocation).data
        }, status=status.HTTP_201_CREATED)


class CraneAllocationDetailAPIView(APIView):
    """
    API Endpoint for Crane Allocation Detail (Phase T4.2).
    Endpoint: GET /api/terminal/crane-allocations/<pk>/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def get(self, request, pk):
        try:
            alloc = CraneAllocation.objects.select_related(
                'crane_allocation_crane_id',
                'crane_allocation_vessel_schedule_id__vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
                'crane_allocation_vessel_schedule_id__vessel_schedule_berth_id',
                'crane_allocation_berth_id',
                'crane_allocation_assigned_by_id'
            ).get(pk=pk)
        except CraneAllocation.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Crane allocation #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "success",
            "data": CraneAllocationSerializer(alloc).data
        }, status=status.HTTP_200_OK)


class CraneAllocationStartAPIView(APIView):
    """
    API Endpoint to start a scheduled crane allocation (Phase T4.2).
    Sets allocation status to ACTIVE, records actual_start_at,
    and updates crane status to IN_USE.
    Endpoint: POST /api/terminal/crane-allocations/<pk>/start/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                alloc = CraneAllocation.objects.select_for_update().select_related('crane_allocation_crane_id').get(pk=pk)
            except CraneAllocation.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if alloc.crane_allocation_status != 'SCHEDULED':
                return Response({
                    "status": "error",
                    "message": f"Cannot start allocation #{pk} with status '{alloc.get_crane_allocation_status_display()}'. Only SCHEDULED allocations can be started."
                }, status=status.HTTP_400_BAD_REQUEST)

            crane = Crane.objects.select_for_update().get(pk=alloc.crane_allocation_crane_id_id)

            if not crane.crane_is_active or crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
                return Response({
                    "status": "error",
                    "message": f"Cannot start allocation because crane '{crane.crane_code}' is currently in {crane.get_crane_status_display()} status."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate crane type compatibility for vessel operation
            if crane.crane_type not in ['STS', 'MHC']:
                return Response({
                    "status": "error",
                    "message": f"Cannot start allocation: Crane '{crane.crane_code}' of type '{crane.get_crane_type_display()}' is not a compatible quayside crane."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate schedule eligibility and berth compatibility
            schedule = alloc.crane_allocation_vessel_schedule_id
            if schedule.vessel_schedule_status == 'DEPARTED':
                return Response({
                    "status": "error",
                    "message": "Cannot start allocation for a vessel schedule that has departed."
                }, status=status.HTTP_400_BAD_REQUEST)

            if crane.crane_type == 'STS' and crane.crane_assigned_berth_id and schedule.vessel_schedule_berth_id:
                if crane.crane_assigned_berth_id_id != schedule.vessel_schedule_berth_id_id:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Cannot start allocation: STS Crane '{crane.crane_code}' fixed berth "
                            f"'{crane.crane_assigned_berth_id.berth_name}' does not match vessel schedule berth "
                            f"'{schedule.vessel_schedule_berth_id.berth_name}'."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

            alloc.crane_allocation_status = 'ACTIVE'
            alloc.crane_allocation_actual_start_at = timezone.now()
            alloc.save()

            crane.crane_status = 'IN_USE'
            crane.save()

            _, user_obj, _ = get_authenticated_user_and_company(request)
            create_audit_log(
                user=user_obj,
                actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
                role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
                action='START_ALLOCATION',
                category='CRANE_MANAGEMENT',
                target_type='CraneAllocation',
                target_id=str(alloc.crane_allocation_id),
                description=f"Started operation for crane '{crane.crane_code}' under allocation #{alloc.crane_allocation_id}.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Allocation #{alloc.crane_allocation_id} started successfully. Crane '{crane.crane_code}' is now IN_USE.",
            "data": CraneAllocationSerializer(alloc).data
        }, status=status.HTTP_200_OK)


class CraneAllocationCompleteAPIView(APIView):
    """
    API Endpoint to complete an active crane allocation (Phase T4.2).
    Sets allocation status to COMPLETED, records actual_end_at,
    and returns crane status to AVAILABLE if no other active allocations exist.
    Endpoint: POST /api/terminal/crane-allocations/<pk>/complete/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                alloc = CraneAllocation.objects.select_for_update().select_related('crane_allocation_crane_id').get(pk=pk)
            except CraneAllocation.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if alloc.crane_allocation_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Cannot complete allocation #{pk} with status '{alloc.get_crane_allocation_status_display()}'. Only ACTIVE allocations can be completed."
                }, status=status.HTTP_400_BAD_REQUEST)

            crane = Crane.objects.select_for_update().get(pk=alloc.crane_allocation_crane_id_id)

            alloc.crane_allocation_status = 'COMPLETED'
            alloc.crane_allocation_actual_end_at = timezone.now()
            alloc.save()

            # Check if crane has other active allocations
            other_active = CraneAllocation.objects.filter(
                crane_allocation_crane_id=crane,
                crane_allocation_status='ACTIVE'
            ).exclude(pk=alloc.pk).exists()

            if not other_active and crane.crane_status == 'IN_USE':
                crane.crane_status = 'AVAILABLE'
                crane.save()

            _, user_obj, _ = get_authenticated_user_and_company(request)
            create_audit_log(
                user=user_obj,
                actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
                role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
                action='COMPLETE_ALLOCATION',
                category='CRANE_MANAGEMENT',
                target_type='CraneAllocation',
                target_id=str(alloc.crane_allocation_id),
                description=f"Completed allocation #{alloc.crane_allocation_id} for crane '{crane.crane_code}'. Crane returned to AVAILABLE.",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Allocation #{alloc.crane_allocation_id} marked COMPLETED.",
            "data": CraneAllocationSerializer(alloc).data
        }, status=status.HTTP_200_OK)


class CraneAllocationCancelAPIView(APIView):
    """
    API Endpoint to cancel a scheduled or active crane allocation (Phase T4.2).
    Sets allocation status to CANCELLED and returns crane status to AVAILABLE if appropriate.
    Endpoint: POST /api/terminal/crane-allocations/<pk>/cancel/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def post(self, request, pk):
        reason = request.data.get('reason', '').strip()
        with transaction.atomic():
            try:
                alloc = CraneAllocation.objects.select_for_update().select_related('crane_allocation_crane_id').get(pk=pk)
            except CraneAllocation.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if alloc.crane_allocation_status in ['COMPLETED', 'CANCELLED']:
                return Response({
                    "status": "error",
                    "message": f"Cannot cancel allocation #{pk} with status '{alloc.get_crane_allocation_status_display()}'."
                }, status=status.HTTP_400_BAD_REQUEST)

            was_active = (alloc.crane_allocation_status == 'ACTIVE')
            crane = Crane.objects.select_for_update().get(pk=alloc.crane_allocation_crane_id_id)

            alloc.crane_allocation_status = 'CANCELLED'
            if reason:
                alloc.crane_allocation_remarks = f"{alloc.crane_allocation_remarks}\n[Cancellation Reason]: {reason}".strip()
            alloc.save()

            if was_active:
                other_active = CraneAllocation.objects.filter(
                    crane_allocation_crane_id=crane,
                    crane_allocation_status='ACTIVE'
                ).exclude(pk=alloc.pk).exists()

                if not other_active and crane.crane_status == 'IN_USE':
                    crane.crane_status = 'AVAILABLE'
                    crane.save()

            _, user_obj, _ = get_authenticated_user_and_company(request)
            create_audit_log(
                user=user_obj,
                actor_name=request.headers.get('X-User-Email') or (user_obj.login_id.login_email if user_obj else 'Operator'),
                role=request.headers.get('X-User-Role') or 'Terminal & Logistics Operator',
                action='CANCEL_ALLOCATION',
                category='CRANE_MANAGEMENT',
                target_type='CraneAllocation',
                target_id=str(alloc.crane_allocation_id),
                description=f"Cancelled allocation #{alloc.crane_allocation_id} for crane '{crane.crane_code}'. Reason: {reason or 'Not specified'}",
                status='SUCCESS',
                request=request
            )

        return Response({
            "status": "success",
            "message": f"Allocation #{alloc.crane_allocation_id} cancelled successfully.",
            "data": CraneAllocationSerializer(alloc).data
        }, status=status.HTTP_200_OK)


class CraneOperationsSummaryAPIView(APIView):
    """
    API Endpoint for Crane Operations Summary and KPI Statistics (Phase T4.3).
    Endpoint: GET /api/terminal/crane-operations/summary/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def get(self, request):
        cranes = Crane.objects.all()
        allocations = CraneAllocation.objects.all()

        total_cranes = cranes.filter(crane_is_active=True).count()
        available_cranes = cranes.filter(crane_is_active=True, crane_status='AVAILABLE').count()
        in_use_cranes = cranes.filter(crane_is_active=True, crane_status='IN_USE').count()
        maintenance_cranes = cranes.filter(crane_is_active=True, crane_status='MAINTENANCE').count()
        inactive_cranes = cranes.filter(crane_status='INACTIVE').count()

        total_allocations = allocations.count()
        scheduled_allocations = allocations.filter(crane_allocation_status='SCHEDULED').count()
        active_allocations = allocations.filter(crane_allocation_status='ACTIVE').count()
        completed_allocations = allocations.filter(crane_allocation_status='COMPLETED').count()
        cancelled_allocations = allocations.filter(crane_allocation_status='CANCELLED').count()

        recent_allocations = CraneAllocation.objects.select_related(
            'crane_allocation_crane_id',
            'crane_allocation_vessel_schedule_id__vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
            'crane_allocation_berth_id'
        ).order_by('-crane_allocation_planned_start_at')[:10]

        return Response({
            "status": "success",
            "data": {
                "kpis": {
                    "total_cranes": total_cranes,
                    "available_cranes": available_cranes,
                    "in_use_cranes": in_use_cranes,
                    "maintenance_cranes": maintenance_cranes,
                    "inactive_cranes": inactive_cranes,
                    "total_allocations": total_allocations,
                    "scheduled_allocations": scheduled_allocations,
                    "active_allocations": active_allocations,
                    "completed_allocations": completed_allocations,
                    "cancelled_allocations": cancelled_allocations
                },
                "recent_allocations": CraneAllocationSerializer(recent_allocations, many=True).data
            }
        }, status=status.HTTP_200_OK)


class EligibleVesselSchedulesAPIView(APIView):
    """
    API Endpoint to list vessel schedules eligible for crane allocation (Phase T4).
    Filters out schedules where the vessel has already departed, and includes berth assignment.
    Endpoint: GET /api/terminal/crane-allocations/eligible-schedules/
    """
    permission_classes = [IsCraneManagementAuthorized]

    def get(self, request):
        schedules = VesselSchedule.objects.select_related(
            'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
            'vessel_schedule_berth_id'
        ).exclude(
            vessel_schedule_status='DEPARTED'
        ).order_by('vessel_schedule_scheduled_arrival_at')

        serializer = EligibleVesselScheduleSerializer(schedules, many=True)
        return Response({
            "status": "success",
            "count": schedules.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T4 / UNLOADING OPERATIONS INTEGRATION VIEWS
# ==============================================================================

class UnloadingExecuteAPIView(APIView):
    """
    API Endpoint for Atomic Vessel Container Discharge (Unloading Operation).
    Coordinates Vessel Schedule (AT_BERTH) -> Active Crane Allocation -> Container -> Destination Yard Slot.
    Executes within transaction.atomic() with select_for_update() row locks:
    1. Validates crane allocation exists, is ACTIVE, and permits UNLOADING or BOTH.
    2. Validates crane is operational and active (not MAINTENANCE or INACTIVE).
    3. Validates vessel schedule is AT_BERTH and consistent with crane allocation and berth.
    4. Validates container belongs to the vessel through Cargo -> VesselArrivalRequest (APPROVED).
    5. Validates container has no active yard allocation and is in valid pre-discharge status (ARRIVED or REGISTERED).
    6. Validates destination yard slot is AVAILABLE, not occupied/reserved, and belongs to active block/yard within capacity.
    7. Atomically transitions container to AT_TERMINAL.
    8. Creates YardAllocation (ACTIVE) linked to the destination slot and crane allocation.
    9. Marks destination slot OCCUPIED.
    10. Updates yard and block occupancy TEU atomically.
    11. Records append-only YardMovementHistory with movement_type='DISCHARGE', from_slot=None, to_slot=slot, crane=crane, operator=user.
    12. Writes AuditLog event (action='DISCHARGE_CONTAINER_UNLOAD').
    Endpoint: POST /api/terminal/unloading/discharge/
    Permissions: IsUnloadingOperationsAuthorized
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = UnloadContainerExecuteSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = ""
            for field, errs in serializer.errors.items():
                if isinstance(errs, list) and len(errs) > 0:
                    first_err = str(errs[0])
                    break
                elif isinstance(errs, str):
                    first_err = errs
                    break
            return Response({
                "status": "error",
                "message": first_err or "Unloading validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        vessel_schedule_id = serializer.validated_data['vessel_schedule_id']
        crane_allocation_id = serializer.validated_data['crane_allocation_id']
        container_id = serializer.validated_data['container_id']
        slot_id = serializer.validated_data['slot_id']
        remarks = serializer.validated_data.get('remarks', '')

        with transaction.atomic():
            # 1. Fetch & lock vessel schedule
            try:
                vessel_schedule = VesselSchedule.objects.select_for_update().get(pk=vessel_schedule_id)
            except VesselSchedule.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Vessel schedule #{vessel_schedule_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            vessel = vessel_schedule.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id if vessel_schedule.vessel_schedule_arrival_request_id else None
            vessel_name = vessel.vessel_name if vessel else 'Unknown Vessel'
            berth = vessel_schedule.vessel_schedule_berth_id

            # Validate vessel schedule status
            if vessel_schedule.vessel_schedule_status != 'AT_BERTH':
                return Response({
                    "status": "error",
                    "message": (
                        f"Cannot unload container. Carrier vessel '{vessel_name}' is currently in "
                        f"'{vessel_schedule.get_vessel_schedule_status_display()}' status. "
                        f"Vessel must be 'At Berth' for container discharge operations."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # 2. Fetch & lock crane allocation
            try:
                crane_alloc = CraneAllocation.objects.select_for_update().get(pk=crane_allocation_id)
            except CraneAllocation.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{crane_allocation_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            # Validate crane allocation belongs to vessel schedule
            if crane_alloc.crane_allocation_vessel_schedule_id_id != vessel_schedule.vessel_schedule_id:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{crane_allocation_id} does not belong to vessel schedule #{vessel_schedule_id} ('{vessel_name}')."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate crane allocation status is ACTIVE
            if crane_alloc.crane_allocation_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": (
                        f"Crane allocation #{crane_allocation_id} is '{crane_alloc.get_crane_allocation_status_display()}'. "
                        f"Allocation must be in 'ACTIVE' status for physical container discharge."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate operation type permits unloading
            if crane_alloc.crane_allocation_operation_type not in ['UNLOADING', 'BOTH']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Crane allocation #{crane_allocation_id} operation type is "
                        f"'{crane_alloc.get_crane_allocation_operation_type_display()}'. "
                        f"Operation type must permit Unloading (Discharge)."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate berth consistency
            if crane_alloc.crane_allocation_berth_id and berth:
                if crane_alloc.crane_allocation_berth_id_id != berth.berth_id:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Crane allocation berth '{crane_alloc.crane_allocation_berth_id.berth_name}' does not match "
                            f"vessel schedule berth '{berth.berth_name}'."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Validate crane equipment operational status
            crane = Crane.objects.select_for_update().get(pk=crane_alloc.crane_allocation_crane_id_id)
            if not crane.crane_is_active or crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Assigned crane '{crane.crane_code}' ({crane.crane_name}) is currently in "
                        f"'{crane.get_crane_status_display()}' status and is not operational."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate crane type compatibility for quayside discharge
            if crane.crane_type not in ['STS', 'MHC']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Assigned crane '{crane.crane_code}' ({crane.crane_name}) of type '{crane.get_crane_type_display()}' "
                        f"is not a compatible quayside crane for vessel discharge."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate STS fixed berth consistency
            if crane.crane_type == 'STS' and crane.crane_assigned_berth_id and berth:
                if crane.crane_assigned_berth_id_id != berth.berth_id:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Assigned STS crane '{crane.crane_code}' fixed berth '{crane.crane_assigned_berth_id.berth_name}' "
                            f"does not match vessel schedule berth '{berth.berth_name}'."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 3. Fetch & lock container
            try:
                container = Container.objects.select_for_update().get(pk=container_id)
            except Container.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Container #{container_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            cargo = container.container_cargo_id
            if not cargo or cargo.cargo_type != 'CONTAINERIZED':
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' is not associated with containerized cargo."
                }, status=status.HTTP_400_BAD_REQUEST)

            arrival_req = cargo.cargo_arrival_request_id
            if not arrival_req or arrival_req.vessel_arrival_request_status != 'APPROVED':
                return Response({
                    "status": "error",
                    "message": "Container arrival request is not APPROVED."
                }, status=status.HTTP_400_BAD_REQUEST)

            if arrival_req.vessel_arrival_request_id != vessel_schedule.vessel_schedule_arrival_request_id_id:
                return Response({
                    "status": "error",
                    "message": (
                        f"Container '{container.container_number}' belongs to vessel arrival request "
                        f"#{arrival_req.vessel_arrival_request_id}, not the selected vessel schedule #{vessel_schedule_id}."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate container is not already allocated to yard
            if YardAllocation.objects.filter(yard_allocation_container_id=container, yard_allocation_status='ACTIVE').exists():
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' already has an active yard allocation."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Prevent discharge if container is committed to active direct transfer
            if DirectShipToTruckTransfer.objects.filter(
                transfer_container_id=container,
                transfer_status__in=['INITIATED', 'IN_PROGRESS', 'TRANSFERRED_TO_TRUCK', 'AWAITING_GATE_EXIT']
            ).exists():
                return Response({
                    "status": "error",
                    "message": (
                        f"Container '{container.container_number}' is committed to an active Direct Ship-to-Truck "
                        f"transfer and cannot be discharged to a yard slot."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Prevent duplicate discharge submissions
            if YardMovementHistory.objects.filter(yard_movement_container_id=container, yard_movement_movement_type='DISCHARGE').exists():
                return Response({
                    "status": "error",
                    "message": (
                        f"Container '{container.container_number}' has already been discharged from vessel "
                        f"and cannot be discharged again."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate container lifecycle status
            if container.container_status in ['AT_TERMINAL', 'AWAITING_CUSTOMS', 'UNDER_INSPECTION', 'CUSTOMS_HOLD', 'CLEARED', 'RELEASED']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Container '{container.container_number}' is already in '{container.get_container_status_display()}' "
                        f"status and cannot be discharged from vessel again."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            if container.container_status not in ['ARRIVED', 'REGISTERED']:
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' is in invalid lifecycle status '{container.container_status}' for discharge."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 4. Fetch & lock destination yard slot
            try:
                slot = YardSlot.objects.select_for_update().get(pk=slot_id)
            except YardSlot.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Destination yard slot #{slot_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if slot.yard_slot_status != 'AVAILABLE':
                return Response({
                    "status": "error",
                    "message": f"Destination slot '{slot.yard_slot_code}' is {slot.get_yard_slot_status_display()} and not available for discharge."
                }, status=status.HTTP_400_BAD_REQUEST)

            if YardAllocation.objects.filter(yard_allocation_slot_id=slot, yard_allocation_status='ACTIVE').exists():
                return Response({
                    "status": "error",
                    "message": f"Destination slot '{slot.yard_slot_code}' already has an active container allocated."
                }, status=status.HTTP_400_BAD_REQUEST)

            block = YardBlock.objects.select_for_update().get(pk=slot.yard_slot_block_id.pk)
            yard = Yard.objects.select_for_update().get(pk=block.yard_block_yard_id.pk)

            if yard.yard_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Destination Yard '{yard.yard_name}' ({yard.yard_code}) is inactive."
                }, status=status.HTTP_400_BAD_REQUEST)

            if block.yard_block_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": f"Destination Block '{block.yard_block_name}' ({block.yard_block_code}) is inactive."
                }, status=status.HTTP_400_BAD_REQUEST)

            if block.yard_block_occupied >= block.yard_block_capacity:
                return Response({
                    "status": "error",
                    "message": f"Destination Block '{block.yard_block_code}' capacity limit reached."
                }, status=status.HTTP_400_BAD_REQUEST)

            if yard.yard_occupied >= yard.yard_capacity:
                return Response({
                    "status": "error",
                    "message": f"Destination Yard '{yard.yard_code}' capacity limit reached."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 5. ATOMIC EXECUTION
            now = timezone.now()

            # Advance container lifecycle to AT_TERMINAL
            container.container_status = 'AT_TERMINAL'
            container.save(update_fields=['container_status', 'container_updated_at'])

            # Create YardAllocation record
            discharge_remarks = remarks or f"Discharged from vessel '{vessel_name}' at berth '{berth.berth_name if berth else 'N/A'}' via crane '{crane.crane_code}'."
            allocation = YardAllocation.objects.create(
                yard_allocation_container_id=container,
                yard_allocation_slot_id=slot,
                yard_allocation_crane_allocation_id=crane_alloc,
                yard_allocation_status='ACTIVE',
                yard_allocation_allocated_at=now,
                yard_allocation_allocated_by_id=user_obj,
                yard_allocation_remarks=discharge_remarks
            )

            # Update Slot to OCCUPIED
            slot.yard_slot_status = 'OCCUPIED'
            slot.save(update_fields=['yard_slot_status', 'yard_slot_updated_at'])

            # Recalculate block and yard occupancy TEU
            block.yard_block_occupied = min(block.yard_block_capacity, block.yard_block_occupied + 1)
            block.save(update_fields=['yard_block_occupied', 'yard_block_updated_at'])

            yard.yard_occupied = min(yard.yard_capacity, yard.yard_occupied + 1)
            yard.save(update_fields=['yard_occupied', 'yard_updated_at'])

            # Record append-only YardMovementHistory for vessel discharge
            movement = YardMovementHistory.objects.create(
                yard_movement_container_id=container,
                yard_movement_from_slot_id=None,
                yard_movement_to_slot_id=slot,
                yard_movement_movement_type='DISCHARGE',
                yard_movement_crane_id=crane,
                yard_movement_moved_by_id=user_obj,
                yard_movement_timestamp=now,
                yard_movement_remarks=discharge_remarks
            )

            # Write AuditLog event
            operator_name = user_obj.user_full_name if user_obj else 'Terminal Operator'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='DISCHARGE_CONTAINER_UNLOAD',
                category='UNLOADING_OPERATIONS',
                target_type='Container',
                target_id=str(container.container_id),
                description=(
                    f"Discharged Container '{container.container_number}' ({container.get_container_type_display()}) "
                    f"from vessel '{vessel_name}' at berth '{berth.berth_name if berth else 'N/A'}' "
                    f"using crane '{crane.crane_code}' into yard slot '{slot.yard_slot_code}' "
                    f"({yard.yard_code} / {block.yard_block_code})."
                ),
                status='SUCCESS',
                request=request
            )

            allocation.refresh_from_db()
            container.refresh_from_db()

            return Response({
                "status": "success",
                "message": f"Container '{container.container_number}' successfully discharged from vessel '{vessel_name}' into yard slot '{slot.yard_slot_code}'.",
                "data": {
                    "container_id": container.container_id,
                    "container_number": container.container_number,
                    "container_status": container.container_status,
                    "container_status_display": container.get_container_status_display(),
                    "vessel_name": vessel_name,
                    "berth_name": berth.berth_name if berth else 'N/A',
                    "crane_code": crane.crane_code,
                    "yard_code": yard.yard_code,
                    "block_code": block.yard_block_code,
                    "slot_code": slot.yard_slot_code,
                    "location_display": f"{yard.yard_code} / {block.yard_block_code} / {slot.yard_slot_code}",
                    "allocation_id": allocation.yard_allocation_id,
                    "movement_id": movement.yard_movement_id,
                    "discharged_at": now.isoformat()
                }
            }, status=status.HTTP_201_CREATED)


class UnloadingEligibleVesselsAPIView(APIView):
    """
    API Endpoint to list vessel schedules currently eligible for unloading at berth.
    Requires vessel_schedule_status='AT_BERTH'.
    Endpoint: GET /api/terminal/unloading/eligible-vessels/
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request):
        schedules = VesselSchedule.objects.select_related(
            'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id',
            'vessel_schedule_berth_id'
        ).filter(
            vessel_schedule_status='AT_BERTH'
        ).order_by('vessel_schedule_scheduled_arrival_at')

        serializer = EligibleUnloadingVesselSerializer(schedules, many=True)
        return Response({
            "status": "success",
            "count": schedules.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class UnloadingActiveCranesAPIView(APIView):
    """
    API Endpoint to list active crane allocations for a specific vessel schedule.
    Endpoint: GET /api/terminal/unloading/active-cranes/?vessel_schedule_id=<id>
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request):
        schedule_id = request.query_params.get('vessel_schedule_id')
        queryset = CraneAllocation.objects.select_related(
            'crane_allocation_crane_id',
            'crane_allocation_berth_id',
            'crane_allocation_vessel_schedule_id'
        ).filter(
            crane_allocation_status='ACTIVE',
            crane_allocation_operation_type__in=['UNLOADING', 'BOTH'],
            crane_allocation_crane_id__crane_is_active=True,
            crane_allocation_crane_id__crane_type__in=['STS', 'MHC']
        ).exclude(
            crane_allocation_crane_id__crane_status__in=['MAINTENANCE', 'INACTIVE']
        )

        if schedule_id and str(schedule_id).isdigit():
            queryset = queryset.filter(crane_allocation_vessel_schedule_id_id=int(schedule_id))

        queryset = queryset.order_by('crane_allocation_crane_id__crane_code')
        serializer = ActiveUnloadingCraneSerializer(queryset, many=True)
        return Response({
            "status": "success",
            "count": queryset.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class UnloadingManifestContainersAPIView(APIView):
    """
    API Endpoint to list manifested containers aboard a vessel awaiting discharge.
    Excludes containers that already have an active yard allocation.
    Endpoint: GET /api/terminal/unloading/manifest-containers/?vessel_schedule_id=<id>
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request):
        schedule_id = request.query_params.get('vessel_schedule_id')
        if not schedule_id or not str(schedule_id).isdigit():
            return Response({
                "status": "error",
                "message": "Parameter 'vessel_schedule_id' is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            schedule = VesselSchedule.objects.get(pk=int(schedule_id))
        except VesselSchedule.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Vessel schedule #{schedule_id} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        arrival_req = schedule.vessel_schedule_arrival_request_id
        if not arrival_req:
            return Response({
                "status": "success",
                "count": 0,
                "data": []
            }, status=status.HTTP_200_OK)

        active_alloc_container_ids = YardAllocation.objects.filter(
            yard_allocation_status='ACTIVE'
        ).values_list('yard_allocation_container_id', flat=True)

        queryset = Container.objects.filter(
            container_cargo_id__cargo_arrival_request_id=arrival_req,
            container_cargo_id__cargo_type='CONTAINERIZED',
            container_status__in=['ARRIVED', 'REGISTERED']
        ).exclude(
            container_id__in=active_alloc_container_ids
        ).select_related(
            'container_cargo_id'
        ).prefetch_related(
            'customs_inspections'
        ).order_by('container_number')

        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(container_number__icontains=search)

        serializer = ManifestUnloadingContainerSerializer(queryset, many=True)
        return Response({
            "status": "success",
            "count": queryset.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class UnloadingHistoryAPIView(APIView):
    """
    API Endpoint to list completed vessel container discharge events.
    Endpoint: GET /api/terminal/unloading/history/
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request):
        movements = YardMovementHistory.objects.select_related(
            'yard_movement_container_id',
            'yard_movement_to_slot_id__yard_slot_block_id__yard_block_yard_id',
            'yard_movement_to_slot_id__yard_slot_block_id',
            'yard_movement_to_slot_id',
            'yard_movement_crane_id',
            'yard_movement_moved_by_id'
        ).filter(
            yard_movement_movement_type='DISCHARGE'
        ).order_by('-yard_movement_timestamp', '-yard_movement_id')[:100]

        serializer = YardMovementHistorySerializer(movements, many=True)
        return Response({
            "status": "success",
            "count": movements.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T5 — PRE-ARRIVAL CUSTOMS CLEARANCE VIEWS (PART A)
# ==============================================================================

class PreArrivalCustomsSubmitAPIView(APIView):
    """
    Advance Customs Declaration and Document Submission API View (Part A1).
    Endpoint: POST /api/customs/pre-arrival/submit/
    Authorized: Shipping Company / Agent, Port Administrator.
    """
    def post(self, request):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        # Strict authorization: Terminal Operator and Customs Officer cannot submit declarations for shipping line
        if role in ['customs_officer', 'terminal_logistics_operator', 'terminal_operator']:
            return Response({
                "status": "error",
                "message": f"Role '{role}' is not authorized to submit pre-arrival customs declarations."
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = PreArrivalCustomsSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Pre-arrival submission validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        container_id = serializer.validated_data['container_id']
        ref = serializer.validated_data.get('declaration_reference', '').strip()
        decl_type = serializer.validated_data.get('declaration_type', 'IMPORT_PRE_ARRIVAL')
        notes = serializer.validated_data.get('notes', '').strip()

        # Extract all uploaded files
        upload_files = []
        for key in ['files', 'file', 'document', 'documents']:
            if key in request.FILES:
                upload_files.extend(request.FILES.getlist(key))
        if not upload_files and serializer.validated_data.get('document'):
            upload_files.append(serializer.validated_data.get('document'))

        ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'doc', 'docx'}
        MAX_FILE_SIZE = 15 * 1024 * 1024

        for f in upload_files:
            ext = f.name.split('.')[-1].lower() if '.' in f.name else ''
            if ext not in ALLOWED_EXTENSIONS:
                allowed_str = ", ".join(sorted(ALLOWED_EXTENSIONS)).upper()
                return Response(
                    {"status": "error", "message": f"File '{f.name}' has an unsupported extension (.{ext}). Supported formats: {allowed_str}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if f.size > MAX_FILE_SIZE:
                return Response(
                    {"status": "error", "message": f"File '{f.name}' exceeds the maximum allowed upload limit of 15 MB ({f.size / (1024 * 1024):.1f} MB)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Resolve manifest or per-file document types
        manifest_raw = request.data.get('document_manifest')
        manifest_dict = {}
        manifest_list = []
        if manifest_raw:
            try:
                import json
                parsed_manifest = json.loads(manifest_raw) if isinstance(manifest_raw, str) else manifest_raw
                if isinstance(parsed_manifest, list):
                    manifest_list = parsed_manifest
                    for item in parsed_manifest:
                        if isinstance(item, dict):
                            fn = item.get('filename') or item.get('name')
                            if fn:
                                manifest_dict[fn] = item
            except Exception:
                pass

        types_list = request.POST.getlist('document_types') if hasattr(request, 'POST') else []
        default_doc_type = serializer.validated_data.get('declaration_document_type') or request.data.get('document_type')
        valid_types = [c[0] for c in CustomsDocument.DOCUMENT_TYPE_CHOICES]

        has_per_file_metadata = bool(manifest_list or manifest_dict or types_list)

        # Pre-validate per-file document types
        resolved_types = []
        resolved_notes = []
        for idx, f in enumerate(upload_files):
            f_type = None
            f_notes = notes
            # 1. Match by index in manifest list
            if idx < len(manifest_list) and isinstance(manifest_list[idx], dict):
                f_type = manifest_list[idx].get('document_type')
                if manifest_list[idx].get('notes'):
                    f_notes = manifest_list[idx].get('notes')
            # 2. Match by filename in manifest dict
            if not f_type and f.name in manifest_dict:
                f_type = manifest_dict[f.name].get('document_type')
                if manifest_dict[f.name].get('notes'):
                    f_notes = manifest_dict[f.name].get('notes')
            # 3. Match by index in parallel types_list
            if not f_type and idx < len(types_list) and types_list[idx]:
                f_type = types_list[idx]
            # 4. Match by indexed post keys
            if not f_type and request.data.get(f'document_type_{idx}'):
                f_type = request.data.get(f'document_type_{idx}')
            if not f_type and request.data.get(f'document_type_{f.name}'):
                f_type = request.data.get(f'document_type_{f.name}')
            # 5. Backward compatibility: if no per-file metadata was sent, allow default_doc_type
            if not f_type and not has_per_file_metadata and default_doc_type:
                f_type = default_doc_type

            if not f_type or not str(f_type).strip():
                return Response(
                    {
                        "status": "error",
                        "message": f"Document type is required for file '{f.name}'. Please assign a valid document category."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            clean_type = str(f_type).strip().upper()
            if clean_type in ['CUSTOMS_IMPORT_DECLARATION', 'IMPORT_DECLARATION', 'BILL_OF_ENTRY']:
                clean_type = 'CUSTOMS_IMPORT_DECLARATION' if 'CUSTOMS_IMPORT_DECLARATION' in valid_types else 'IMPORT_DECLARATION'
            elif clean_type not in valid_types:
                allowed_str = ", ".join(valid_types)
                return Response(
                    {
                        "status": "error",
                        "message": f"Invalid document type '{f_type}' for file '{f.name}'. Allowed document categories: {allowed_str}."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            resolved_types.append(clean_type)
            resolved_notes.append(f_notes)

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().get(container_id=container_id)
            except Container.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Container #{container_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            cargo = container.container_cargo_id
            if not cargo:
                return Response({
                    "status": "error",
                    "message": f"Container {container.container_number} is not linked to cargo manifest."
                }, status=status.HTTP_400_BAD_REQUEST)

            arrival_req = cargo.cargo_arrival_request_id
            vessel = arrival_req.vessel_arrival_request_vessel_id if arrival_req else None
            company = vessel.vessel_shipping_company_id if vessel else None
            schedule = getattr(arrival_req, 'schedule', None) if arrival_req else None

            # Ownership check: If caller is a shipping company, verify they own the vessel/cargo
            if role in ['shipping_company']:
                if not user_company or not company or user_company.shipping_company_id != company.shipping_company_id:
                    return Response({
                        "status": "error",
                        "message": "You are not authorized to submit customs declarations for another shipping line's shipment."
                    }, status=status.HTTP_403_FORBIDDEN)

            # Prevent submission if already cleared
            if container.is_customs_cleared:
                return Response({
                    "status": "error",
                    "message": f"Container {container.container_number} is already customs CLEARED."
                }, status=status.HTTP_400_BAD_REQUEST)

            now = timezone.now()
            current_year = now.year

            # Retrieve existing declaration if resubmitting
            existing_decl = container.customs_declarations.order_by('-declaration_submitted_at').first()
            review_history = existing_decl.declaration_review_history if existing_decl else []
            if existing_decl and existing_decl.declaration_status == 'ADDITIONAL_INFORMATION_REQUIRED':
                review_history.append({
                    'status': existing_decl.declaration_status,
                    'reviewed_by': existing_decl.declaration_reviewed_by.user_full_name if existing_decl.declaration_reviewed_by else None,
                    'reviewed_at': existing_decl.declaration_reviewed_at.isoformat() if existing_decl.declaration_reviewed_at else None,
                    'remarks': existing_decl.declaration_review_remarks,
                    'resubmitted_at': now.isoformat()
                })

            if not ref:
                last_decl = PreArrivalCustomsDeclaration.objects.order_by('-declaration_id').first()
                seq = (last_decl.declaration_id + 1) if last_decl else 1
                ref = f"DEC-CUST-{current_year}-{seq:05d}"

            primary_file = upload_files[0] if upload_files else None
            decl = PreArrivalCustomsDeclaration.objects.create(
                declaration_reference=ref,
                declaration_container_id=container,
                declaration_vessel_schedule_id=schedule,
                declaration_cargo_id=cargo,
                declaration_shipping_company_id=company or user_company,
                declaration_status='PENDING_REVIEW',
                declaration_type=decl_type,
                declaration_document=primary_file,
                declaration_document_name=primary_file.name if primary_file else (existing_decl.declaration_document_name if existing_decl else ''),
                declaration_notes=notes,
                declaration_submitted_by=user_obj,
                declaration_submitted_at=now,
                declaration_review_history=review_history
            )

            created_docs = []
            for idx, f in enumerate(upload_files):
                doc = CustomsDocument.objects.create(
                    document_container_id=container,
                    document_declaration_id=decl,
                    document_type=resolved_types[idx],
                    workflow_type='PRE_ARRIVAL',
                    document_file=f,
                    document_name=f.name,
                    file_size=f.size,
                    file_type=getattr(f, 'content_type', '') or '',
                    document_notes=resolved_notes[idx],
                    document_version=1,
                    document_is_active=True,
                    document_uploaded_by=user_obj,
                    document_uploaded_at=timezone.now(),
                    document_review_status='PENDING'
                )
                created_docs.append(doc)

            # Update container customs status
            container.container_customs_status = 'PENDING_REVIEW'
            container.save(update_fields=['container_customs_status', 'container_updated_at'])

            actor_name = user_obj.user_full_name if user_obj else 'Shipping Agent'
            type_summary = ", ".join([d.get_document_type_display() for d in created_docs]) if created_docs else decl_type
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=actor_name,
                role='Shipping Company / Shipping Agent',
                action='SUBMIT_PRE_ARRIVAL_DECLARATION',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Submitted advance customs declaration {ref} for container {container.container_number} ({type_summary}) with {len(created_docs)} document(s).",
                status='SUCCESS',
                request=request
            )

            return Response({
                "status": "success",
                "message": f"Pre-arrival customs declaration {ref} submitted successfully with {len(created_docs)} document(s).",
                "data": PreArrivalCustomsDeclarationSerializer(decl).data
            }, status=status.HTTP_201_CREATED)


class PreArrivalCustomsListAPIView(APIView):
    """
    List Pre-Arrival Customs Declarations with overview counts.
    Endpoint: GET /api/customs/pre-arrival/declarations/
    """
    def get(self, request):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        queryset = PreArrivalCustomsDeclaration.objects.select_related(
            'declaration_container_id',
            'declaration_vessel_schedule_id',
            'declaration_cargo_id',
            'declaration_shipping_company_id',
            'declaration_submitted_by',
            'declaration_reviewed_by'
        ).order_by('-declaration_submitted_at', '-declaration_id')

        # Filter by shipping company if caller is shipping company
        if role in ['shipping_company'] and user_company:
            queryset = queryset.filter(declaration_shipping_company_id=user_company)

        # Filters
        status_filter = request.query_params.get('status')
        if status_filter and status_filter.lower() != 'all':
            s_clean = status_filter.strip().upper().replace(' ', '_')
            queryset = queryset.filter(declaration_status=s_clean)

        vessel_schedule_id = request.query_params.get('vessel_schedule_id')
        if vessel_schedule_id:
            queryset = queryset.filter(declaration_vessel_schedule_id_id=vessel_schedule_id)

        search = request.query_params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                models.Q(declaration_reference__icontains=q) |
                models.Q(declaration_container_id__container_number__icontains=q) |
                models.Q(declaration_cargo_id__cargo_description__icontains=q) |
                models.Q(declaration_shipping_company_id__shipping_company_name__icontains=q)
            )

        # Counts
        all_qs = PreArrivalCustomsDeclaration.objects.all()
        if role in ['shipping_company'] and user_company:
            all_qs = all_qs.filter(declaration_shipping_company_id=user_company)

        counts = {
            'pending_review': all_qs.filter(declaration_status='PENDING_REVIEW').count(),
            'info_required': all_qs.filter(declaration_status='ADDITIONAL_INFORMATION_REQUIRED').count(),
            'under_inspection': all_qs.filter(declaration_status='UNDER_INSPECTION').count(),
            'on_hold': all_qs.filter(declaration_status='CUSTOMS_HOLD').count(),
            'cleared': all_qs.filter(declaration_status='CLEARED').count(),
            'total': all_qs.count()
        }

        serializer = PreArrivalCustomsDeclarationSerializer(queryset, many=True)
        return Response({
            "status": "success",
            "counts": counts,
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class PreArrivalCustomsDetailAPIView(APIView):
    """
    Retrieve single Pre-Arrival Customs Declaration detail.
    Endpoint: GET /api/customs/pre-arrival/declarations/<int:pk>/
    """
    def get(self, request, pk):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        try:
            decl = PreArrivalCustomsDeclaration.objects.select_related(
                'declaration_container_id',
                'declaration_vessel_schedule_id',
                'declaration_cargo_id',
                'declaration_shipping_company_id',
                'declaration_submitted_by',
                'declaration_reviewed_by'
            ).get(pk=pk)
        except PreArrivalCustomsDeclaration.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Declaration #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        if role in ['shipping_company'] and user_company:
            if decl.declaration_shipping_company_id_id != user_company.shipping_company_id:
                return Response({
                    "status": "error",
                    "message": "Unauthorized to access declaration for another shipping line."
                }, status=status.HTTP_403_FORBIDDEN)

        return Response({
            "status": "success",
            "data": PreArrivalCustomsDeclarationSerializer(decl).data
        }, status=status.HTTP_200_OK)


class PreArrivalCustomsReviewAPIView(APIView):
    """
    Customs Officer Review and Decision for Pre-Arrival Declarations (Part A2).
    Endpoint: POST /api/customs/pre-arrival/declarations/<int:pk>/review/
    Authorized: Customs Officer, Port Administrator.
    Strictly rejected for Shipping Company and Terminal Operator.
    """
    permission_classes = [IsCustomsOfficer]

    def post(self, request, pk):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        if role in ['shipping_company', 'terminal_logistics_operator', 'terminal_operator']:
            return Response({
                "status": "error",
                "message": "Shipping Company and Terminal Operator are strictly prohibited from approving customs clearance."
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = PreArrivalCustomsReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Review decision validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        decision = serializer.validated_data['decision']
        remarks = serializer.validated_data.get('remarks', '').strip()
        hold_reason = serializer.validated_data.get('hold_reason')

        with transaction.atomic():
            try:
                decl = PreArrivalCustomsDeclaration.objects.select_for_update().select_related(
                    'declaration_container_id'
                ).get(pk=pk)
            except PreArrivalCustomsDeclaration.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Declaration #{pk} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            container = Container.objects.select_for_update().get(pk=decl.declaration_container_id_id)
            now = timezone.now()

            # Record review history
            history = decl.declaration_review_history or []
            history.append({
                'previous_status': decl.declaration_status,
                'decision': decision,
                'reviewed_by': user_obj.user_full_name if user_obj else 'Customs Officer',
                'reviewed_at': now.isoformat(),
                'remarks': remarks,
                'hold_reason': hold_reason
            })

            decl.declaration_status = decision
            decl.declaration_reviewed_by = user_obj
            decl.declaration_reviewed_at = now
            decl.declaration_review_remarks = remarks
            decl.declaration_hold_reason = hold_reason if decision == 'CUSTOMS_HOLD' else None
            decl.declaration_review_history = history
            decl.save(update_fields=[
                'declaration_status', 'declaration_reviewed_by', 'declaration_reviewed_at',
                'declaration_review_remarks', 'declaration_hold_reason', 'declaration_review_history',
                'declaration_updated_at'
            ])

            # Sync review status to child customs document records
            doc_review_status = 'VERIFIED' if decision == 'CLEARED' else ('REJECTED' if decision == 'CUSTOMS_HOLD' else 'PENDING')
            decl.documents.update(
                document_review_status=doc_review_status,
                document_review_remarks=remarks,
                document_reviewed_by=user_obj,
                document_reviewed_at=now
            )

            # Update container customs status
            container.container_customs_status = decision

            officer_name = user_obj.user_full_name if user_obj else 'Customs Officer'

            if decision == 'CLEARED':
                # Create/update formal CustomsInspection record marking CLEARED
                CustomsInspection.objects.create(
                    customs_inspection_container_id=container,
                    customs_inspection_officer_id=user_obj,
                    customs_inspection_status='COMPLETED',
                    customs_inspection_result='CLEARED',
                    customs_inspection_document_status='VERIFIED',
                    customs_inspection_started_at=now,
                    customs_inspection_completed_at=now,
                    customs_inspection_clearance_date=now,
                    customs_inspection_remarks=f"Advance pre-arrival declaration {decl.declaration_reference} approved and verified: {remarks or 'All regulatory documents approved.'}"
                )
                try:
                    send_customs_cleared_notification(container, officer_name)
                except Exception:
                    pass

            elif decision == 'CUSTOMS_HOLD':
                CustomsInspection.objects.create(
                    customs_inspection_container_id=container,
                    customs_inspection_officer_id=user_obj,
                    customs_inspection_status='ON_HOLD',
                    customs_inspection_result='HOLD',
                    customs_inspection_document_status='ISSUE_FOUND',
                    customs_inspection_hold_reason=hold_reason or 'DOCUMENTATION_ISSUE',
                    customs_inspection_started_at=now,
                    customs_inspection_remarks=f"Advance pre-arrival declaration hold: {remarks}"
                )
                try:
                    send_customs_hold_notification(container, hold_reason or 'DOCUMENTATION_ISSUE', remarks, officer_name)
                except Exception:
                    pass

            elif decision == 'UNDER_INSPECTION':
                CustomsInspection.objects.create(
                    customs_inspection_container_id=container,
                    customs_inspection_officer_id=user_obj,
                    customs_inspection_status='IN_PROGRESS',
                    customs_inspection_document_status='PENDING',
                    customs_inspection_started_at=now,
                    customs_inspection_remarks=f"Pre-arrival physical/security inspection flagged: {remarks}"
                )

            container.save(update_fields=['container_customs_status', 'container_updated_at'])

            create_audit_log(
                user=user_obj or login_obj,
                actor_name=officer_name,
                role='Customs Officer',
                action='REVIEW_PRE_ARRIVAL_DECLARATION',
                category='CUSTOMS',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Customs Officer {officer_name} reviewed declaration {decl.declaration_reference} for container {container.container_number}. Decision: {decision}. Remarks: {remarks}",
                status='SUCCESS',
                request=request
            )

            return Response({
                "status": "success",
                "message": f"Declaration {decl.declaration_reference} updated to '{decl.get_declaration_status_display()}'.",
                "data": PreArrivalCustomsDeclarationSerializer(decl).data
            }, status=status.HTTP_200_OK)


# ==============================================================================
# PHASE T5 — DELIVERY ORDER VIEWS
# ==============================================================================

class DeliveryOrderListCreateAPIView(APIView):
    """
    List and Issue Delivery Orders (DO) / Delivery Authorizations.
    Endpoint: GET, POST /api/delivery-orders/
    """
    def get(self, request):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        queryset = DeliveryOrder.objects.select_related(
            'delivery_order_container_id',
            'delivery_order_shipping_company_id',
            'delivery_order_issued_by'
        ).order_by('-delivery_order_issue_date', '-delivery_order_id')

        container_id = request.query_params.get('container_id')
        if container_id:
            queryset = queryset.filter(delivery_order_container_id_id=container_id)

        container_number = request.query_params.get('container_number')
        if container_number:
            queryset = queryset.filter(delivery_order_container_id__container_number__iexact=container_number.strip())

        if role in ['shipping_company'] and user_company:
            queryset = queryset.filter(delivery_order_shipping_company_id=user_company)

        serializer = DeliveryOrderSerializer(queryset, many=True)
        return Response({
            "status": "success",
            "count": queryset.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        login_obj, user_obj, user_company = get_authenticated_user_and_company(request)
        role = (request.headers.get('X-User-Role') or (login_obj.login_role if login_obj else '')).strip().lower()

        allowed_roles = ['shipping_company', 'terminal_logistics_operator', 'terminal_operator', 'port_administrator', 'admin', 'port administrator']
        if role not in allowed_roles:
            return Response({
                "status": "error",
                "message": f"Role '{role}' is not authorized to issue delivery orders."
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = DeliveryOrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "status": "error",
                "message": "Delivery order issuance validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        container_id = serializer.validated_data['container_id']
        do_num = serializer.validated_data.get('delivery_order_number', '').strip()
        consignee = serializer.validated_data['consignee_name'].strip()
        valid_hours = serializer.validated_data.get('valid_hours', 72)
        transporter = serializer.validated_data.get('authorized_transporter', '').strip()
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            try:
                container = Container.objects.select_for_update().select_related(
                    'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
                ).get(container_id=container_id)
            except Container.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Container #{container_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            cargo = container.container_cargo_id
            vessel = cargo.vessel if cargo else None
            company = vessel.vessel_shipping_company_id if vessel else None

            if role in ['shipping_company'] and user_company:
                if not company or company.shipping_company_id != user_company.shipping_company_id:
                    return Response({
                        "status": "error",
                        "message": "Unauthorized to issue delivery order for another shipping line's container."
                    }, status=status.HTTP_403_FORBIDDEN)

            now = timezone.now()
            if not do_num:
                last_do = DeliveryOrder.objects.order_by('-delivery_order_id').first()
                seq = (last_do.delivery_order_id + 1) if last_do else 1
                do_num = f"DO-{now.year}-{seq:05d}"

            do = DeliveryOrder.objects.create(
                delivery_order_number=do_num,
                delivery_order_container_id=container,
                delivery_order_shipping_company_id=company or user_company,
                delivery_order_consignee_name=consignee,
                delivery_order_status='ISSUED',
                delivery_order_issue_date=now,
                delivery_order_valid_until=now + timezone.timedelta(hours=valid_hours),
                delivery_order_authorized_transporter=transporter,
                delivery_order_remarks=remarks,
                delivery_order_issued_by=user_obj
            )

            # Update recipient on container if not set
            if not container.container_delivery_recipient:
                container.container_delivery_recipient = consignee
                container.save(update_fields=['container_delivery_recipient', 'container_updated_at'])

            actor_name = user_obj.user_full_name if user_obj else 'Shipping Officer'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=actor_name,
                role='Shipping Company / Shipping Agent',
                action='ISSUE_DELIVERY_ORDER',
                category='DELIVERY_TRACKING',
                target_type='Container',
                target_id=str(container.container_id),
                description=f"Issued Delivery Order {do_num} for container {container.container_number} to consignee '{consignee}'. Valid for {valid_hours} hours.",
                status='SUCCESS',
                request=request
            )

            return Response({
                "status": "success",
                "message": f"Delivery Order {do_num} issued successfully.",
                "data": DeliveryOrderSerializer(do).data
            }, status=status.HTTP_201_CREATED)


# ==============================================================================
# PHASE T5 — DIRECT SHIP-TO-TRUCK TRANSFER VIEWS (PARTS B & C)
# ==============================================================================

class DirectTransferEligibleContainersAPIView(APIView):
    """
    List manifested containers on a berthed vessel schedule with
    comprehensive pre-qualification checklist for Direct Ship-to-Truck transfer.
    Endpoint: GET /api/terminal/direct-transfer/eligible-containers/?vessel_schedule_id=<id>
    Authorized: Terminal & Logistics Operator, Port Administrator, Port Operations Officer.
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request):
        vessel_schedule_id = request.query_params.get('vessel_schedule_id')
        if not vessel_schedule_id:
            return Response({
                "status": "error",
                "message": "Query parameter 'vessel_schedule_id' is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            vessel_schedule = VesselSchedule.objects.select_related(
                'vessel_schedule_berth_id',
                'vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id'
            ).get(pk=vessel_schedule_id)
        except VesselSchedule.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Vessel schedule #{vessel_schedule_id} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        arrival_req = vessel_schedule.vessel_schedule_arrival_request_id

        # Manifested containers belonging to this vessel's cargo arrival request
        containers = Container.objects.filter(
            container_cargo_id__cargo_arrival_request_id=arrival_req
        ).select_related(
            'container_cargo_id',
            'container_cargo_id__cargo_arrival_request_id__vessel_arrival_request_vessel_id__vessel_shipping_company_id'
        ).prefetch_related(
            'yard_allocations',
            'customs_inspections',
            'customs_declarations',
            'delivery_orders',
            'direct_transfers'
        ).order_by('container_number')

        search = request.query_params.get('search')
        if search:
            containers = containers.filter(container_number__icontains=search.strip())

        serializer = EligibleDirectTransferContainerSerializer(containers, many=True)
        return Response({
            "status": "success",
            "vessel_schedule_id": vessel_schedule.vessel_schedule_id,
            "vessel_status": vessel_schedule.vessel_schedule_status,
            "is_at_berth": vessel_schedule.vessel_schedule_status == 'AT_BERTH',
            "count": len(serializer.data),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class DirectTransferExecuteAPIView(APIView):
    """
    Atomic Direct Ship-to-Truck Transfer Execution (Part C3).
    Transfers container directly from vessel quayside to an authorized waiting truck,
    bypassing yard allocation entirely, generating a digital gate pass,
    and recording audit logs.
    Endpoint: POST /api/terminal/direct-transfer/execute/
    Authorized: Terminal & Logistics Operator, Port Administrator.
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def post(self, request):
        login_obj, user_obj, _ = get_authenticated_user_and_company(request)
        serializer = DirectShipToTruckExecuteSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = ""
            for field, errs in serializer.errors.items():
                if isinstance(errs, list) and len(errs) > 0:
                    first_err = str(errs[0])
                    break
                elif isinstance(errs, str):
                    first_err = errs
                    break
            return Response({
                "status": "error",
                "message": first_err or "Direct transfer execution validation failed.",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        vessel_schedule_id = serializer.validated_data['vessel_schedule_id']
        container_id = serializer.validated_data['container_id']
        crane_allocation_id = serializer.validated_data['crane_allocation_id']
        truck_id = serializer.validated_data['truck_id']
        driver_id = serializer.validated_data['driver_id']
        gate_id = serializer.validated_data['gate_id']
        delivery_order_id = serializer.validated_data.get('delivery_order_id')
        consignee_name = serializer.validated_data.get('consignee_name', '').strip()
        valid_hours = serializer.validated_data.get('valid_hours', 24)
        remarks = serializer.validated_data.get('remarks', '').strip()

        with transaction.atomic():
            # 1. Lock & Validate Vessel Schedule
            try:
                vessel_schedule = VesselSchedule.objects.select_for_update().get(pk=vessel_schedule_id)
            except VesselSchedule.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Vessel schedule #{vessel_schedule_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            vessel = vessel_schedule.vessel_schedule_arrival_request_id.vessel_arrival_request_vessel_id if vessel_schedule.vessel_schedule_arrival_request_id else None
            vessel_name = vessel.vessel_name if vessel else 'Unknown Vessel'
            berth = vessel_schedule.vessel_schedule_berth_id

            if vessel_schedule.vessel_schedule_status != 'AT_BERTH':
                return Response({
                    "status": "error",
                    "message": (
                        f"Cannot execute direct transfer. Carrier vessel '{vessel_name}' is currently in "
                        f"'{vessel_schedule.get_vessel_schedule_status_display()}' status. "
                        f"Vessel must be 'At Berth' for physical container discharge."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # 2. Lock & Validate Crane Allocation
            try:
                crane_alloc = CraneAllocation.objects.select_for_update().get(pk=crane_allocation_id)
            except CraneAllocation.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{crane_allocation_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            if crane_alloc.crane_allocation_vessel_schedule_id_id != vessel_schedule.vessel_schedule_id:
                return Response({
                    "status": "error",
                    "message": f"Crane allocation #{crane_allocation_id} does not belong to vessel schedule #{vessel_schedule_id} ('{vessel_name}')."
                }, status=status.HTTP_400_BAD_REQUEST)

            if crane_alloc.crane_allocation_status != 'ACTIVE':
                return Response({
                    "status": "error",
                    "message": (
                        f"Crane allocation #{crane_allocation_id} is '{crane_alloc.get_crane_allocation_status_display()}'. "
                        f"Allocation must be in 'ACTIVE' status for physical container discharge."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            if crane_alloc.crane_allocation_operation_type not in ['UNLOADING', 'BOTH']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Crane allocation #{crane_allocation_id} operation type is "
                        f"'{crane_alloc.get_crane_allocation_operation_type_display()}'. "
                        f"Operation type must permit Unloading (Discharge)."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            if crane_alloc.crane_allocation_berth_id and berth:
                if crane_alloc.crane_allocation_berth_id_id != berth.berth_id:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Crane allocation berth '{crane_alloc.crane_allocation_berth_id.berth_name}' does not match "
                            f"vessel schedule berth '{berth.berth_name}'."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 3. Lock & Validate Crane Equipment
            crane = Crane.objects.select_for_update().get(pk=crane_alloc.crane_allocation_crane_id_id)
            if not crane.crane_is_active or crane.crane_status in ['MAINTENANCE', 'INACTIVE']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Assigned crane '{crane.crane_code}' ({crane.crane_name}) is currently in "
                        f"'{crane.get_crane_status_display()}' status and is not operational."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Quayside crane compatibility: STS or MHC only
            if crane.crane_type not in ['STS', 'MHC']:
                return Response({
                    "status": "error",
                    "message": (
                        f"Assigned crane '{crane.crane_code}' of type '{crane.get_crane_type_display()}' "
                        f"is not a compatible quayside crane for direct vessel discharge. "
                        f"RTG and RMG yard cranes are strictly rejected for quayside vessel operations."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # STS fixed berth consistency
            if crane.crane_type == 'STS' and crane.crane_assigned_berth_id and berth:
                if crane.crane_assigned_berth_id_id != berth.berth_id:
                    return Response({
                        "status": "error",
                        "message": (
                            f"Assigned STS crane '{crane.crane_code}' fixed berth '{crane.crane_assigned_berth_id.berth_name}' "
                            f"does not match vessel schedule berth '{berth.berth_name}'."
                        )
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 4. Lock & Validate Container
            try:
                container = Container.objects.select_for_update().get(pk=container_id)
            except Container.DoesNotExist:
                return Response({
                    "status": "error",
                    "message": f"Container #{container_id} not found."
                }, status=status.HTTP_404_NOT_FOUND)

            cargo = container.container_cargo_id
            if not cargo:
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' is not associated with cargo manifest."
                }, status=status.HTTP_400_BAD_REQUEST)

            arrival_req = cargo.cargo_arrival_request_id
            if not arrival_req or arrival_req.vessel_arrival_request_status != 'APPROVED':
                return Response({
                    "status": "error",
                    "message": "Container arrival request is not APPROVED."
                }, status=status.HTTP_400_BAD_REQUEST)

            if arrival_req.vessel_arrival_request_id != vessel_schedule.vessel_schedule_arrival_request_id_id:
                return Response({
                    "status": "error",
                    "message": (
                        f"Container '{container.container_number}' belongs to vessel arrival request "
                        f"#{arrival_req.vessel_arrival_request_id}, not the selected vessel schedule #{vessel_schedule_id}."
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            # Prevent discharge if container is already in yard
            if YardAllocation.objects.filter(yard_allocation_container_id=container, yard_allocation_status='ACTIVE').exists():
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' has already been discharged into a terminal yard slot and cannot undergo Direct Ship-to-Truck transfer."
                }, status=status.HTTP_400_BAD_REQUEST)

            if YardMovementHistory.objects.filter(yard_movement_container_id=container, yard_movement_movement_type='DISCHARGE').exists():
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' has already been discharged into yard storage."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Prevent duplicate direct transfer
            if DirectShipToTruckTransfer.objects.filter(
                transfer_container_id=container,
                transfer_status__in=['INITIATED', 'IN_PROGRESS', 'TRANSFERRED_TO_TRUCK', 'AWAITING_GATE_EXIT']
            ).exists():
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' is already engaged in an active Direct Ship-to-Truck transfer."
                }, status=status.HTTP_400_BAD_REQUEST)

            if container.container_status == 'RELEASED':
                return Response({
                    "status": "error",
                    "message": f"Container '{container.container_number}' has already been released from the terminal."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 5. Customs Clearance Validation (Part A & C2)
            if container.container_customs_status == 'CUSTOMS_HOLD' or container.container_status == 'CUSTOMS_HOLD':
                return Response({
                    "status": "error",
                    "message": f"Direct transfer rejected: Container '{container.container_number}' is placed on Customs Hold."
                }, status=status.HTTP_400_BAD_REQUEST)

            if container.container_customs_status == 'UNDER_INSPECTION' or container.container_status == 'UNDER_INSPECTION':
                return Response({
                    "status": "error",
                    "message": f"Direct transfer rejected: Container '{container.container_number}' is undergoing mandatory Customs Inspection."
                }, status=status.HTTP_400_BAD_REQUEST)

            if container.container_customs_status in ['PENDING_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED', 'NOT_SUBMITTED'] and container.container_status != 'CLEARED':
                return Response({
                    "status": "error",
                    "message": f"Direct transfer rejected: Container '{container.container_number}' customs clearance has not been granted (Status: {container.get_container_customs_status_display()})."
                }, status=status.HTTP_400_BAD_REQUEST)

            if not container.is_customs_cleared:
                return Response({
                    "status": "error",
                    "message": f"Direct transfer rejected: Container '{container.container_number}' does not have verified customs clearance."
                }, status=status.HTTP_400_BAD_REQUEST)

            # 6. Delivery Order Authorization Validation (C2)
            delivery_order = None
            if delivery_order_id:
                try:
                    delivery_order = DeliveryOrder.objects.select_for_update().get(pk=delivery_order_id)
                except DeliveryOrder.DoesNotExist:
                    return Response({
                        "status": "error",
                        "message": f"Delivery Order #{delivery_order_id} not found."
                    }, status=status.HTTP_404_NOT_FOUND)
                if delivery_order.delivery_order_container_id_id != container.container_id:
                    return Response({
                        "status": "error",
                        "message": f"Delivery Order #{delivery_order_id} does not match container {container.container_number}."
                    }, status=status.HTTP_400_BAD_REQUEST)
                if not delivery_order.is_valid:
                    return Response({
                        "status": "error",
                        "message": f"Delivery Order #{delivery_order.delivery_order_number} is {delivery_order.get_delivery_order_status_display()} or expired."
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                delivery_order = container.delivery_orders.filter(delivery_order_status='ISSUED').order_by('-delivery_order_issue_date').first()
                if not delivery_order or not delivery_order.is_valid:
                    return Response({
                        "status": "error",
                        "message": f"Direct transfer rejected: No valid issued Delivery Order found for container '{container.container_number}'."
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 7. Lock & Validate Truck
            try:
                truck = Truck.objects.select_for_update().get(pk=truck_id)
            except Truck.DoesNotExist:
                return Response({"status": "error", "message": f"Truck #{truck_id} not found."}, status=status.HTTP_404_NOT_FOUND)
            if truck.truck_status != 'ACTIVE':
                return Response({"status": "error", "message": f"Truck {truck.truck_number} is {truck.get_truck_status_display()} and cannot be used for transfer."}, status=status.HTTP_400_BAD_REQUEST)

            # 8. Lock & Validate Driver
            try:
                driver = Driver.objects.select_for_update().get(pk=driver_id)
            except Driver.DoesNotExist:
                return Response({"status": "error", "message": f"Driver #{driver_id} not found."}, status=status.HTTP_404_NOT_FOUND)
            if driver.driver_status != 'ACTIVE':
                return Response({"status": "error", "message": f"Driver {driver.driver_name} is {driver.get_driver_status_display()} and cannot be used for transfer."}, status=status.HTTP_400_BAD_REQUEST)
            if not driver.driver_email or not driver.driver_email.strip():
                return Response({"status": "error", "message": f"Driver {driver.driver_name} does not have a registered email address for gate pass dispatch."}, status=status.HTTP_400_BAD_REQUEST)

            # 9. Lock & Validate Gate
            try:
                gate = Gate.objects.select_for_update().get(pk=gate_id)
            except Gate.DoesNotExist:
                return Response({"status": "error", "message": f"Gate #{gate_id} not found."}, status=status.HTTP_404_NOT_FOUND)
            if not gate.gate_is_active:
                return Response({"status": "error", "message": f"Gate {gate.gate_name} is inactive."}, status=status.HTTP_400_BAD_REQUEST)

            # 10. ATOMIC EXECUTION (C3)
            now = timezone.now()
            current_year = now.year

            # Generate Operation Reference
            last_transfer = DirectShipToTruckTransfer.objects.order_by('-transfer_id').first()
            seq_dt = (last_transfer.transfer_id + 1) if last_transfer else 1
            transfer_ref = f"DST-{current_year}-{seq_dt:05d}"

            # Generate Digital Gate Pass
            last_gp = GatePass.objects.order_by('-gate_pass_id').first()
            seq_gp = (last_gp.gate_pass_id + 1) if last_gp else 1
            pass_num = f"GP-DST-{current_year}-{seq_gp:05d}"
            mov_num = f"MOV-DST-{current_year}-{seq_gp:05d}"
            verif_code = f"VREF-{secrets.token_hex(6).upper()}"
            qr_payload = generate_verification_payload(pass_num, verif_code)
            valid_until = now + timezone.timedelta(hours=valid_hours)

            gate_pass = GatePass.objects.create(
                gate_pass_pass_number=pass_num,
                gate_pass_movement_number=mov_num,
                gate_pass_truck_id=truck,
                gate_pass_driver_id=driver,
                gate_pass_gate_id=gate,
                gate_pass_issued_by=user_obj,
                gate_pass_status='ACTIVE',
                gate_pass_type='DIRECT_TRANSFER',
                gate_pass_verification_code=verif_code,
                gate_pass_qr_code=qr_payload,
                gate_pass_valid_until=valid_until,
                gate_pass_remarks=f"Direct Ship-to-Truck transfer pass for vessel {vessel_name} at berth {berth.berth_name if berth else 'N/A'}.",
                gate_pass_email_status='PENDING'
            )

            GatePassContainer.objects.create(
                gate_pass_container_gate_pass_id=gate_pass,
                gate_pass_container_container_id=container
            )

            # Create Direct Transfer record
            transfer = DirectShipToTruckTransfer.objects.create(
                transfer_reference=transfer_ref,
                transfer_container_id=container,
                transfer_vessel_schedule_id=vessel_schedule,
                transfer_berth_id=berth,
                transfer_crane_allocation_id=crane_alloc,
                transfer_crane_id=crane,
                transfer_truck_id=truck,
                transfer_driver_id=driver,
                transfer_delivery_order_id=delivery_order,
                transfer_gate_pass_id=gate_pass,
                transfer_status='AWAITING_GATE_EXIT',
                transfer_remarks=remarks or f"Direct transfer from vessel '{vessel_name}' to truck '{truck.truck_number}' via crane '{crane.crane_code}'.",
                transfer_initiated_by=user_obj,
                transfer_executed_by=user_obj,
                transfer_initiated_at=now,
                transfer_transferred_at=now
            )

            # Container physical status update (DOES NOT touch YardAllocation or YardSlot)
            container.container_delivery_status = 'GATE_PASS_GENERATED'
            if not container.container_delivery_recipient:
                container.container_delivery_recipient = delivery_order.delivery_order_consignee_name
            if not container.container_delivery_destination:
                container.container_delivery_destination = f"{gate.gate_name} (Direct Quayside Exit)"
            container.save(update_fields=['container_delivery_status', 'container_delivery_recipient', 'container_delivery_destination', 'container_updated_at'])

            # Record tracking event
            ContainerTrackingEvent.objects.create(
                tracking_event_container_id=container,
                tracking_event_gate_pass_id=gate_pass,
                tracking_event_status='GATE_PASS_GENERATED',
                tracking_event_location=f"Berth {berth.berth_name if berth else 'Quayside'} -> Gate {gate.gate_name}",
                tracking_event_description=(
                    f"Direct Ship-to-Truck transfer completed onto truck {truck.truck_number} (Driver: {driver.driver_name}) "
                    f"via crane {crane.crane_code}. Awaiting gate exit verification via Pass {pass_num}."
                ),
                tracking_event_updated_by=user_obj,
                tracking_event_timestamp=now
            )

            # Dispatch Gate Pass email to driver
            try:
                send_gate_pass_driver_email(gate_pass, pass_num, verif_code, driver.driver_email, driver.driver_name, truck.truck_number, gate.gate_name, valid_until.strftime("%Y-%m-%d %H:%M UTC"), [container.container_number])
            except Exception:
                pass

            # Record AuditLog
            operator_name = user_obj.user_full_name if user_obj else 'Terminal Operator'
            create_audit_log(
                user=user_obj or login_obj,
                actor_name=operator_name,
                role='Terminal & Logistics Operator',
                action='DIRECT_SHIP_TO_TRUCK_TRANSFER',
                category='DIRECT_TRANSFER',
                target_type='Container',
                target_id=str(container.container_id),
                description=(
                    f"Direct Ship-to-Truck transfer executed for container '{container.container_number}' "
                    f"from vessel '{vessel_name}' directly onto truck '{truck.truck_number}' (Driver: '{driver.driver_name}') "
                    f"using crane '{crane.crane_code}' at berth '{berth.berth_name if berth else 'N/A'}'. "
                    f"Gate Pass '{pass_num}' issued. No yard allocation created."
                ),
                status='SUCCESS',
                request=request
            )

            return Response({
                "status": "success",
                "message": (
                    f"Container '{container.container_number}' successfully transferred directly from vessel '{vessel_name}' "
                    f"onto truck '{truck.truck_number}'. Gate Pass '{pass_num}' generated."
                ),
                "data": DirectShipToTruckTransferSerializer(transfer).data
            }, status=status.HTTP_201_CREATED)


class DirectTransferListAPIView(APIView):
    """
    List Direct Ship-to-Truck Transfer operations.
    Endpoint: GET /api/terminal/direct-transfer/history/
    Authorized: Terminal & Logistics Operator, Port Administrator, Port Operations Officer.
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request):
        queryset = DirectShipToTruckTransfer.objects.select_related(
            'transfer_container_id',
            'transfer_vessel_schedule_id__vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
            'transfer_berth_id',
            'transfer_crane_allocation_id',
            'transfer_crane_id',
            'transfer_truck_id',
            'transfer_driver_id',
            'transfer_delivery_order_id',
            'transfer_gate_pass_id__gate_pass_gate_id',
            'transfer_initiated_by',
            'transfer_executed_by',
            'transfer_gate_verified_by'
        ).order_by('-transfer_created_at', '-transfer_id')

        vessel_schedule_id = request.query_params.get('vessel_schedule_id')
        if vessel_schedule_id:
            queryset = queryset.filter(transfer_vessel_schedule_id_id=vessel_schedule_id)

        transfer_status = request.query_params.get('status')
        if transfer_status and transfer_status.lower() != 'all':
            queryset = queryset.filter(transfer_status=transfer_status.strip().upper())

        search = request.query_params.get('search')
        if search:
            q = search.strip()
            queryset = queryset.filter(
                models.Q(transfer_reference__icontains=q) |
                models.Q(transfer_container_id__container_number__icontains=q) |
                models.Q(transfer_truck_id__truck_number__icontains=q) |
                models.Q(transfer_driver_id__driver_name__icontains=q) |
                models.Q(transfer_crane_id__crane_code__icontains=q) |
                models.Q(transfer_gate_pass_id__gate_pass_pass_number__icontains=q)
            )

        serializer = DirectShipToTruckTransferSerializer(queryset, many=True)
        return Response({
            "status": "success",
            "count": queryset.count(),
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class DirectTransferDetailAPIView(APIView):
    """
    Retrieve single Direct Ship-to-Truck Transfer operation detail.
    Endpoint: GET /api/terminal/direct-transfer/<int:pk>/
    """
    permission_classes = [IsUnloadingOperationsAuthorized]

    def get(self, request, pk):
        try:
            transfer = DirectShipToTruckTransfer.objects.select_related(
                'transfer_container_id',
                'transfer_vessel_schedule_id__vessel_schedule_arrival_request_id__vessel_arrival_request_vessel_id',
                'transfer_berth_id',
                'transfer_crane_allocation_id',
                'transfer_crane_id',
                'transfer_truck_id',
                'transfer_driver_id',
                'transfer_delivery_order_id',
                'transfer_gate_pass_id__gate_pass_gate_id',
                'transfer_initiated_by',
                'transfer_executed_by',
                'transfer_gate_verified_by'
            ).get(pk=pk)
        except DirectShipToTruckTransfer.DoesNotExist:
            return Response({
                "status": "error",
                "message": f"Direct transfer #{pk} not found."
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "success",
            "data": DirectShipToTruckTransferSerializer(transfer).data
        }, status=status.HTTP_200_OK)




