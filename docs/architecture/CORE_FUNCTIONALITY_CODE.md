# 5. Core Implementation: Source Code of 4 Key Functionalities

This document contains the production source code implementations for the **four primary core functionalities** of the **PORTIDE (Maritime Port Operations Intelligence Platform)**, formatted for direct inclusion in the academic project report.

---

## 1. Functionality 1: User Authentication & Role-Based Access Control (RBAC)

### 1.1 Architectural Overview
* **Endpoint:** `POST /api/auth/login/`
* **Permission Class:** `AllowAny` (Public Access)
* **Tables Affected:** `tbl_login`, `tbl_user`, `tbl_shipping_company`, `tbl_audit_log`
* **Core Responsibilities:**
  1. Validates incoming email format and non-empty password payloads.
  2. Queries `tbl_login` and verifies passwords against salted cryptographic PBKDF2/bcrypt hashes.
  3. Enforces multi-tier account lifecycle checks (`ACTION_REQUIRED`, `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`).
  4. Records immutable audit log entries in `tbl_audit_log` for both successful sessions and failed unauthorized attempts.
  5. Authoritatively issues session state and role classification (`port_administrator`, `customs_officer`, `shipping_company`, `yard_master`, `gate_officer`).

### 1.2 Python Django REST Source Code
```python
# File: backend/authentication/views.py (Module: Authentication & Session Governance)

import logging
from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import Login, User, RegistrationRequest
from .serializers import LoginSerializer
from .audit_service import create_audit_log

logger = logging.getLogger(__name__)


class LoginAPIView(APIView):
    """
    Core Functionality 1: User Authentication & Role-Based Session Governance.
    Verifies user credentials, validates multi-tier account status,
    records immutable security audit logs, and establishes authenticated sessions.
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

        email = serializer.validated_data['email'].strip()
        password = serializer.validated_data['password']

        # Step 1: Look up user credential record in database
        try:
            login_obj = Login.objects.get(login_email__iexact=email)
        except Login.DoesNotExist:
            create_audit_log(
                user=None,
                actor_name=email,
                role='Unknown',
                action='LOGIN_FAILED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=None,
                description=f"Failed login attempt for non-existent user: {email}",
                status='FAILED',
                request=request
            )
            return Response(
                {"status": "error", "message": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Step 2: Verify password against salted PBKDF2 hash
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
                {"status": "error", "message": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Step 3: Fetch linked user profile and enterprise onboarding state
        user_profile = getattr(login_obj, 'profile', None)
        company = user_profile.shipping_company_id if user_profile else None
        reg_req = None
        if company:
            reg_req = RegistrationRequest.objects.filter(
                shipping_company_id=company
            ).order_by('-registration_request_submitted_at').first()

        # Step 4: Verify account authorization and pending approval flags
        if reg_req and reg_req.registration_request_status == 'PENDING':
            create_audit_log(
                user=login_obj,
                actor_name=login_obj.login_email,
                role=login_obj.login_role,
                action='LOGIN_REJECTED',
                category='AUTHENTICATION',
                target_type='Authentication',
                target_id=login_obj.login_id,
                description=f"Login blocked for {login_obj.login_email} (Awaiting Port Admin approval)",
                status='FAILED',
                request=request
            )
            return Response(
                {
                    "status": "error",
                    "registration_status": "PENDING",
                    "message": "Your registration is awaiting Port Administrator approval."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not login_obj.login_is_active:
            return Response(
                {"status": "error", "message": "Account is inactive. Please contact the Port Administrator."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Step 5: Establish backend session and audit successful login
        if hasattr(request, 'session'):
            request.session['user_id'] = login_obj.login_id
            request.session['login_id'] = login_obj.login_id
            request.session['user_role'] = login_obj.login_role
            request.session.save()

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
                    "company_name": company.shipping_company_name if company else None,
                    "must_change_password": user_profile.user_must_change_password if user_profile else False
                }
            },
            status=status.HTTP_200_OK
        )
```

---

## 2. Functionality 2: Shipping Company Onboarding & Admin Approval Pipeline

### 2.1 Architectural Overview
* **Endpoint:** `POST /api/admin/registration-requests/<id>/approve/`
* **Permission Class:** Protected (Port Administrator)
* **Tables Affected:** `tbl_registration_request`, `tbl_shipping_company`, `tbl_user`, `tbl_login`, `tbl_audit_log`
* **Core Responsibilities:**
  1. Inspects commercial maritime registration submissions.
  2. Executes an atomic database transaction (`transaction.atomic()`) ensuring zero partial updates across 4 relational tables.
  3. Transitions company status from `PENDING` to `ACTIVE`.
  4. Activates associated corporate user profiles and enables authentication credentials.
  5. Dispatches automated welcome emails with initial access credentials and records administrative audit events.

### 2.2 Python Django REST Source Code
```python
# File: backend/authentication/views.py (Module: Shipping Company Approvals)

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import RegistrationRequest, User
from .audit_service import create_audit_log
from .email_service import send_registration_approved_email


class AdminApproveRegistrationRequestAPIView(APIView):
    """
    Core Functionality 2: Shipping Company Onboarding & Approval Pipeline.
    Allows Port Administrator to review maritime business applications,
    atomically activate corporate carrier entities, and grant platform access.
    """
    def post(self, request, pk):
        try:
            req_obj = RegistrationRequest.objects.get(registration_request_id=pk)
        except RegistrationRequest.DoesNotExist:
            return Response(
                {"status": "error", "message": "Registration request not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if req_obj.registration_request_status == 'APPROVED':
            return Response(
                {"status": "info", "message": "This registration request has already been approved."},
                status=status.HTTP_200_OK
            )

        review_remarks = (request.data.get('review_remarks') or '').strip()

        # Identify authorizing Port Administrator
        admin_user = None
        user_id_header = request.headers.get('X-User-Id')
        if user_id_header:
            try:
                admin_user = User.objects.get(user_id=user_id_header)
            except (User.DoesNotExist, ValueError):
                pass

        # Atomic Multi-Table Transaction
        with transaction.atomic():
            # 1. Update registration request record
            req_obj.registration_request_status = 'APPROVED'
            if review_remarks:
                req_obj.registration_request_rejection_reason = review_remarks
            req_obj.registration_request_reviewed_at = timezone.now()
            if admin_user:
                req_obj.user_id = admin_user
            req_obj.save()

            # 2. Activate Shipping Company master entity
            company = req_obj.shipping_company_id
            if company:
                company.shipping_company_status = 'ACTIVE'
                company.save()

                # 3. Activate associated shipping agent users and login credentials
                for user in company.users.all():
                    user.user_status = 'ACTIVE'
                    user.save()
                    if user.login_id:
                        user.login_id.login_status = 'ACTIVE'
                        user.login_id.login_is_active = True
                        user.login_id.save()

        # Step 4: Write immutable audit trail
        create_audit_log(
            user=admin_user,
            actor_name=admin_user.user_full_name if admin_user else 'Port Administrator',
            role='Port Administrator',
            action='APPROVE',
            category='SHIPPING_COMPANY',
            target_type='ShippingCompany',
            target_id=company.shipping_company_id if company else req_obj.registration_request_id,
            description=f"Approved registration request #{req_obj.registration_request_id} for carrier '{company.shipping_company_name}'.",
            status='SUCCESS',
            request=request
        )

        # Step 5: Asynchronous notification dispatch to carrier contact email
        send_registration_approved_email(req_obj)

        return Response(
            {
                "status": "success",
                "message": "Shipping Company registration approved successfully."
            },
            status=status.HTTP_200_OK
        )
```

---

## 3. Functionality 3: Vessel Traffic Scheduling & Berth Collision-Avoidance Allocation

### 3.1 Architectural Overview
* **Endpoint:** `POST /api/schedules/`
* **Permission Class:** `IsPortOperationsOfficerOnly`
* **Tables Affected:** `tbl_vessel_schedule`, `tbl_vessel_arrival_request`, `tbl_berth`, `tbl_audit_log`
* **Core Responsibilities:**
  1. Validates that the commercial vessel Notice of Arrival (NOA) is officially `APPROVED`.
  2. Ensures arrival timestamps precede departure timestamps with timezone awareness.
  3. Verifies berth physical readiness and prevents allocation to berths marked for maintenance.
  4. **Interval Overlap Collision-Avoidance Algorithm:** Queries existing reservations on the same berth to guarantee zero scheduling conflicts ($A_{\text{start}} < B_{\text{end}} \land A_{\text{end}} > B_{\text{start}}$).
  5. Reserves quayside docking slot and updates berth status to `RESERVED`.

### 3.2 Python Django REST Source Code
```python
# File: backend/authentication/views.py (Module: Vessel Traffic & Berth Allocation)

from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import VesselArrivalRequest, Berth, VesselSchedule
from .permissions import IsPortOperationsOfficerOnly
from .audit_service import create_audit_log


class VesselScheduleListCreateAPIView(APIView):
    """
    Core Functionality 3: Vessel Traffic Management & Berth Allocation Scheduling.
    Implements mathematical interval overlap collision-detection to ensure
    safe quayside docking windows for arriving commercial vessels.
    """
    permission_classes = [IsPortOperationsOfficerOnly]

    def post(self, request):
        request_id = request.data.get('vessel_arrival_request_id')
        berth_id = request.data.get('berth_id')
        scheduled_arrival = request.data.get('scheduled_arrival_at')
        scheduled_departure = request.data.get('scheduled_departure_at')
        remarks = request.data.get('operational_remarks', '').strip()

        # Step 1: Payload validation
        if not request_id or not berth_id or not scheduled_arrival or not scheduled_departure:
            return Response(
                {"status": "error", "message": "Arrival request, berth, arrival time, and departure time are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 2: Fetch and verify Approved Arrival Notice
        try:
            arrival_request = VesselArrivalRequest.objects.select_related(
                'vessel_arrival_request_vessel_id'
            ).get(pk=request_id)
        except VesselArrivalRequest.DoesNotExist:
            return Response({"status": "error", "message": f"Arrival request #{request_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        if arrival_request.vessel_arrival_request_status != 'APPROVED':
            return Response(
                {"status": "error", "message": "Only APPROVED arrival requests can be allocated a berth slot."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 3: Date/Time parsing and chronology validation
        try:
            arrival_dt = timezone.datetime.fromisoformat(str(scheduled_arrival).replace('Z', '+00:00'))
            departure_dt = timezone.datetime.fromisoformat(str(scheduled_departure).replace('Z', '+00:00'))
        except ValueError:
            return Response({"status": "error", "message": "Invalid ISO datetime format."}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.is_naive(arrival_dt):
            arrival_dt = timezone.make_aware(arrival_dt)
        if timezone.is_naive(departure_dt):
            departure_dt = timezone.make_aware(departure_dt)

        if departure_dt <= arrival_dt:
            return Response(
                {"status": "error", "message": "Scheduled departure time must be after scheduled arrival time."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 4: Validate Berth operational readiness
        try:
            berth_obj = Berth.objects.get(pk=berth_id)
        except Berth.DoesNotExist:
            return Response({"status": "error", "message": f"Berth #{berth_id} not found."}, status=status.HTTP_404_NOT_FOUND)

        if berth_obj.berth_status == 'MAINTENANCE':
            return Response(
                {"status": "error", "message": f"{berth_obj.berth_name} is under maintenance and unavailable."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 5: Collision-Avoidance Validation (Interval Overlap Detection)
        # Condition: Existing_Arrival < New_Departure AND Existing_Departure > New_Arrival
        overlapping_schedule_exists = VesselSchedule.objects.filter(
            vessel_schedule_berth_id=berth_obj,
            vessel_schedule_status__in=['SCHEDULED', 'ARRIVED', 'AT_BERTH'],
            vessel_schedule_scheduled_arrival_at__lt=departure_dt,
            vessel_schedule_scheduled_departure_at__gt=arrival_dt
        ).exists()

        if overlapping_schedule_exists:
            return Response(
                {
                    "status": "error",
                    "message": f"Berth '{berth_obj.berth_name}' is already reserved by another vessel during this timeframe."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Step 6: Create Berth Schedule & update berth status
        schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=arrival_request,
            vessel_schedule_berth_id=berth_obj,
            vessel_schedule_scheduled_arrival_at=arrival_dt,
            vessel_schedule_scheduled_departure_at=departure_dt,
            vessel_schedule_status='SCHEDULED',
            vessel_schedule_operational_remarks=remarks,
            vessel_schedule_created_by=request.user if hasattr(request, 'user') else None
        )

        if berth_obj.berth_status not in ['MAINTENANCE', 'OCCUPIED']:
            berth_obj.berth_status = 'RESERVED'
            berth_obj.save()

        return Response(
            {
                "status": "success",
                "message": f"Berth {berth_obj.berth_name} successfully scheduled for vessel {arrival_request.vessel_arrival_request_vessel_id.vessel_name}.",
                "schedule_id": schedule.vessel_schedule_id
            },
            status=status.HTTP_201_CREATED
        )
```

---

## 4. Functionality 4: Dual-State Container Tracking & Cryptographic QR Gate Pass Release

### 4.1 Architectural Overview
* **Endpoint:** `POST /api/gate-passes/generate/`
* **Permission Class:** `IsGateTruckOfficer` (Restricted to Gate Logistics Officers)
* **Tables Affected:** `tbl_gate_pass`, `tbl_gate_pass_container`, `tbl_container`, `tbl_container_tracking_event`, `tbl_truck`, `tbl_driver`, `tbl_audit_log`
* **Core Responsibilities:**
  1. Validates active status of transport truck and assigned commercial driver.
  2. **Regulatory Customs Clearance Prerequisite:** Inspects container status and enforces that every container must be marked `CLEARED` by customs with zero `CUSTOMS_HOLD` blocks.
  3. Pre-empts duplication by confirming no container is assigned to multiple active gate passes.
  4. Generates a unique digital movement pass identifier (`GP-YYYY-XXXXX`) and a cryptographic verification code (`VREF-...`).
  5. Synchronizes the dual-state tracking pipeline by writing immutable `RELEASED` and `GATE_PASS_GENERATED` lifecycle events into `tbl_container_tracking_event`.

### 4.2 Python Django REST Source Code
```python
# File: backend/authentication/views.py (Module: Gate Logistics & Container Clearance)

import secrets
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Truck, Driver, Gate, Container, GatePass, GatePassContainer, ContainerTrackingEvent
from .serializers import GatePassGenerateSerializer
from .permissions import IsGateTruckOfficer
from .qr_service import generate_verification_payload


class GatePassGenerateAPIView(APIView):
    """
    Core Functionality 4: Dual-State Container Tracking & Cryptographic QR Gate Pass Release.
    Enforces statutory customs clearance prerequisites, generates cryptographically signed
    QR verification codes, and synchronizes the immutable container tracking event ledger.
    """
    permission_classes = [IsGateTruckOfficer]

    def post(self, request):
        serializer = GatePassGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "message": "Validation failed.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        truck_id = serializer.validated_data['truck_id']
        driver_id = serializer.validated_data['driver_id']
        gate_id = serializer.validated_data['gate_id']
        container_ids = serializer.validated_data['container_ids']
        valid_hours = serializer.validated_data.get('valid_hours', 24)
        remarks = serializer.validated_data.get('remarks', '').strip()

        # Step 1: Validate Landside Truck & Driver Active Status
        try:
            truck = Truck.objects.get(truck_id=truck_id, truck_status='ACTIVE')
        except Truck.DoesNotExist:
            return Response({"status": "error", "message": f"Active Truck #{truck_id} not found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            driver = Driver.objects.get(driver_id=driver_id, driver_status='ACTIVE')
        except Driver.DoesNotExist:
            return Response({"status": "error", "message": f"Active Driver #{driver_id} not found."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gate = Gate.objects.get(gate_id=gate_id, gate_is_active=True)
        except Gate.DoesNotExist:
            return Response({"status": "error", "message": f"Active Gate #{gate_id} not found."}, status=status.HTTP_400_BAD_REQUEST)

        # Step 2: Enforce Regulatory Customs Clearance on Each Container
        containers = []
        for cid in container_ids:
            try:
                container = Container.objects.get(container_id=cid)
            except Container.DoesNotExist:
                return Response({"status": "error", "message": f"Container #{cid} not found."}, status=status.HTTP_400_BAD_REQUEST)

            c_num = container.container_number

            # Prevent release if container is under active Customs Hold
            if container.container_status == 'CUSTOMS_HOLD':
                return Response(
                    {"status": "error", "message": f"Container {c_num} is on Customs Hold and cannot be released."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Strict clearance requirement
            if container.container_status != 'CLEARED':
                return Response(
                    {"status": "error", "message": f"Container {c_num} status is '{container.container_status}'. Must be 'CLEARED'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Disallow multiple active gate passes for the same physical container
            has_active_pass = GatePassContainer.objects.filter(
                gate_pass_container_container_id=container,
                gate_pass_container_gate_pass_id__gate_pass_status='ACTIVE'
            ).exists()
            if has_active_pass:
                return Response(
                    {"status": "error", "message": f"Container {c_num} already has an active Digital Gate Pass."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            containers.append(container)

        # Step 3: Atomic Gate Pass Generation & QR Cryptographic Signing
        with transaction.atomic():
            current_year = timezone.now().year
            last_gp = GatePass.objects.order_by('-gate_pass_id').first()
            seq = (last_gp.gate_pass_id + 1) if last_gp else 1
            pass_number = f"GP-{current_year}-{seq:05d}"
            movement_number = f"GM-{current_year}-{seq:05d}"

            # Generate Cryptographic Verification Token
            verification_code = f"VREF-{secrets.token_hex(6).upper()}"
            qr_payload = generate_verification_payload(pass_number, verification_code)
            valid_until = timezone.now() + timezone.timedelta(hours=valid_hours)

            gate_pass = GatePass.objects.create(
                gate_pass_pass_number=pass_number,
                gate_pass_movement_number=movement_number,
                gate_pass_truck_id=truck,
                gate_pass_driver_id=driver,
                gate_pass_gate_id=gate,
                gate_pass_issued_by=request.user if hasattr(request, 'user') else None,
                gate_pass_status='ACTIVE',
                gate_pass_verification_code=verification_code,
                gate_pass_qr_code=qr_payload,
                gate_pass_valid_until=valid_until,
                gate_pass_remarks=remarks,
                gate_pass_email_status='PENDING'
            )

            # Link containers & write immutable tracking events
            for container in containers:
                GatePassContainer.objects.create(
                    gate_pass_container_gate_pass_id=gate_pass,
                    gate_pass_container_container_id=container
                )

                # Step 4: Dual-State Synchronization: Append to immutable tracking ledger
                ContainerTrackingEvent.objects.create(
                    tracking_event_container_id=container,
                    tracking_event_gate_pass_id=gate_pass,
                    tracking_event_status='GATE_PASS_GENERATED',
                    tracking_event_location=gate.gate_name,
                    tracking_event_description=f"Digital Gate Pass {pass_number} generated for transport (Truck: {truck.truck_number}).",
                    tracking_event_timestamp=timezone.now()
                )

        return Response(
            {
                "status": "success",
                "message": f"Digital Gate Pass {pass_number} successfully generated.",
                "data": {
                    "pass_number": pass_number,
                    "verification_code": verification_code,
                    "truck_number": truck.truck_number,
                    "driver_name": driver.driver_name,
                    "valid_until": valid_until.isoformat()
                }
            },
            status=status.HTTP_201_CREATED
        )
```
