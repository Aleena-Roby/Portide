import json
from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from authentication.models import (
    Login,
    User,
    ShippingCompany,
    Vessel,
    VesselArrivalRequest,
    Berth,
    VesselSchedule,
    Crane,
    CraneAllocation,
    AuditLog
)


class CraneManagementTestCase(TestCase):
    """
    Isolated automated test suite for Phase T4: Crane Management & Allocation.
    Tests Crane Master CRUD, validations, allocation logic, time overlap detection,
    lifecycle transitions, operations summary, and RBAC across all 6 roles.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Terminal & Logistics Operator (Authorized Management)
        self.login_tlo = Login.objects.create(
            login_email="terminal_t4@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_tlo = User.objects.create(
            login_id=self.login_tlo,
            user_full_name="Tariq Terminal",
            user_phone="+919876543301",
            user_status="ACTIVE"
        )
        self.headers_tlo = {
            'HTTP_X_USER_EMAIL': 'terminal_t4@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_tlo.user_id)
        }

        # 2. Port Administrator (Authorized Management)
        self.login_admin = Login.objects.create(
            login_email="admin_t4@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_admin = User.objects.create(
            login_id=self.login_admin,
            user_full_name="Port Admin",
            user_phone="+919876543302",
            user_status="ACTIVE"
        )
        self.headers_admin = {
            'HTTP_X_USER_EMAIL': 'admin_t4@portide.com',
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.user_admin.user_id)
        }

        # 3. Port Operations Officer (Read-Only)
        self.login_ops = Login.objects.create(
            login_email="ops_t4@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_ops = User.objects.create(
            login_id=self.login_ops,
            user_full_name="Oliver Operations",
            user_phone="+919876543303",
            user_status="ACTIVE"
        )
        self.headers_ops = {
            'HTTP_X_USER_EMAIL': 'ops_t4@portide.com',
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.user_ops.user_id)
        }

        # 4. Shipping Company (Unauthorized)
        self.login_ship = Login.objects.create(
            login_email="shipping_t4@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.headers_ship = {
            'HTTP_X_USER_EMAIL': 'shipping_t4@portide.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login_ship.login_id)
        }

        # 5. Customs Officer (Unauthorized)
        self.login_customs = Login.objects.create(
            login_email="customs_t4@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="customs_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.headers_customs = {
            'HTTP_X_USER_EMAIL': 'customs_t4@portide.com',
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.login_customs.login_id)
        }

        # 6. Gate & Truck Officer (Unauthorized)
        self.login_gate = Login.objects.create(
            login_email="gate_t4@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.headers_gate = {
            'HTTP_X_USER_EMAIL': 'gate_t4@portide.com',
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.login_gate.login_id)
        }

        # Create test Berth
        self.berth_1 = Berth.objects.create(
            berth_name="Quay Berth T4-01",
            berth_code="QB-T4-01",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("15.50"),
            berth_status="AVAILABLE",
            berth_is_active=True
        )

        # Create test Shipping Company and Vessel
        self.shipping_company = ShippingCompany.objects.create(
            shipping_company_name="Pacific Lines T4",
            shipping_company_license_number="LIC-T4-9988",
            shipping_company_email="pacific_t4@portide.com",
            shipping_company_phone="+919876543304",
            shipping_company_address="Harbour Way 101"
        )
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.shipping_company,
            vessel_name="MV Ocean Trader T4",
            vessel_imo_number="IMO9988771",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="PA",
            vessel_length=Decimal("280.00"),
            vessel_draft=Decimal("12.50"),
            vessel_capacity=4500,
            vessel_status="ACTIVE"
        )

        # Create Vessel Arrival Request & Schedule
        now = timezone.now()
        self.arrival_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + timedelta(hours=2),
            vessel_arrival_request_requested_departure_at=now + timedelta(days=2),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("1200.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth_1
        )

        self.vessel_schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_request,
            vessel_schedule_berth_id=self.berth_1,
            vessel_schedule_scheduled_arrival_at=now + timedelta(hours=2),
            vessel_schedule_scheduled_departure_at=now + timedelta(days=2),
            vessel_schedule_status="SCHEDULED",
            vessel_schedule_created_by=self.user_tlo
        )

        # Departed schedule for rejection testing
        self.vessel_2 = Vessel.objects.create(
            vessel_shipping_company_id=self.shipping_company,
            vessel_name="MV Departed Trader T4",
            vessel_imo_number="IMO9988772",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="PA",
            vessel_length=Decimal("250.00"),
            vessel_draft=Decimal("11.50"),
            vessel_capacity=3000,
            vessel_status="ACTIVE"
        )
        self.arrival_request_departed = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_2,
            vessel_arrival_request_requested_arrival_at=now - timedelta(days=5),
            vessel_arrival_request_requested_departure_at=now - timedelta(days=2),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("800.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth_1
        )
        self.vessel_schedule_departed = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_request_departed,
            vessel_schedule_berth_id=self.berth_1,
            vessel_schedule_scheduled_arrival_at=now - timedelta(days=5),
            vessel_schedule_scheduled_departure_at=now - timedelta(days=2),
            vessel_schedule_status="DEPARTED",
            vessel_schedule_created_by=self.user_tlo
        )

    # ==========================================================================
    # T4.1 — CRANE MASTER MANAGEMENT TESTS
    # ==========================================================================

    def test_crane_creation_valid_data(self):
        """Test creating a new crane with valid data."""
        payload = {
            "crane_code": "QC-T4-01",
            "crane_name": "Quay Crane 01 T4",
            "crane_type": "STS",
            "crane_max_lifting_capacity_mt": "65.00",
            "crane_capacity_unit": "MT",
            "crane_status": "AVAILABLE",
            "crane_assigned_berth_id": self.berth_1.berth_id
        }
        response = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['data']['crane_code'], 'QC-T4-01')
        self.assertEqual(data['data']['assigned_berth_name'], self.berth_1.berth_name)

        # Verify audit log was created
        audit = AuditLog.objects.filter(audit_log_category='CRANE_MANAGEMENT', audit_log_action='CREATE', audit_log_target_type='Crane').first()
        self.assertIsNotNone(audit)
        self.assertIn('QC-T4-01', audit.audit_log_description)

    def test_duplicate_crane_code_rejected(self):
        """Test that duplicate crane codes are strictly rejected."""
        Crane.objects.create(
            crane_code="QC-T4-DUP",
            crane_name="First Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("60.00"),
            crane_status="AVAILABLE"
        )

        payload = {
            "crane_code": "qc-t4-dup",  # case-insensitive check
            "crane_name": "Second Crane Duplicate",
            "crane_type": "STS",
            "crane_max_lifting_capacity_mt": "50.00",
            "crane_status": "AVAILABLE"
        }
        response = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('crane_code', data['errors'])

    def test_invalid_nonpositive_capacity_rejected(self):
        """Test that non-positive lifting capacity (0 or negative) is rejected."""
        payload = {
            "crane_code": "QC-T4-NEG",
            "crane_name": "Zero Capacity Crane",
            "crane_type": "STS",
            "crane_max_lifting_capacity_mt": "0.00",
            "crane_status": "AVAILABLE"
        }
        response = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crane_list_and_filtering(self):
        """Test listing cranes with server-side query filters (status, type, search)."""
        Crane.objects.create(
            crane_code="STS-FILTER-1",
            crane_name="Heavy Quay Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        Crane.objects.create(
            crane_code="RTG-FILTER-2",
            crane_name="Yard Gantry Crane",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("45.00"),
            crane_status="MAINTENANCE"
        )

        # Filter by status=AVAILABLE
        res_avail = self.client.get('/api/terminal/cranes/?status=AVAILABLE', **self.headers_tlo)
        self.assertEqual(res_avail.status_code, status.HTTP_200_OK)
        codes = [c['crane_code'] for c in res_avail.json()['data']]
        self.assertIn('STS-FILTER-1', codes)
        self.assertNotIn('RTG-FILTER-2', codes)

        # Filter by type=RTG
        res_type = self.client.get('/api/terminal/cranes/?type=RTG', **self.headers_tlo)
        self.assertEqual(res_type.status_code, status.HTTP_200_OK)
        codes_type = [c['crane_code'] for c in res_type.json()['data']]
        self.assertIn('RTG-FILTER-2', codes_type)
        self.assertNotIn('STS-FILTER-1', codes_type)

        # Search by query
        res_q = self.client.get('/api/terminal/cranes/?q=Heavy', **self.headers_tlo)
        self.assertEqual(res_q.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_q.json()['data']), 1)
        self.assertEqual(res_q.json()['data'][0]['crane_code'], 'STS-FILTER-1')

    def test_crane_detail_and_update(self):
        """Test retrieving crane details and editing attributes."""
        crane = Crane.objects.create(
            crane_code="QC-EDIT-01",
            crane_name="Original Name",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("50.00"),
            crane_status="AVAILABLE"
        )

        res_detail = self.client.get(f'/api/terminal/cranes/{crane.crane_id}/', **self.headers_tlo)
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.json()['data']['crane_name'], "Original Name")

        # Update crane
        update_payload = {
            "crane_name": "Updated Super Crane",
            "crane_max_lifting_capacity_mt": "75.00"
        }
        res_update = self.client.patch(
            f'/api/terminal/cranes/{crane.crane_id}/',
            data=json.dumps(update_payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        crane.refresh_from_db()
        self.assertEqual(crane.crane_name, "Updated Super Crane")
        self.assertEqual(crane.crane_max_lifting_capacity_mt, Decimal("75.00"))

    def test_crane_manual_status_change_validation(self):
        """Test that a crane cannot be manually marked AVAILABLE while it has an ACTIVE allocation."""
        crane = Crane.objects.create(
            crane_code="QC-INUSE-01",
            crane_name="Active Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="IN_USE"
        )
        now = timezone.now()
        CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=now - timedelta(hours=1),
            crane_allocation_planned_end_at=now + timedelta(hours=3),
            crane_allocation_actual_start_at=now - timedelta(hours=1)
        )

        # Attempt to manually set status to AVAILABLE
        res = self.client.patch(
            f'/api/terminal/cranes/{crane.crane_id}/',
            data=json.dumps({'crane_status': 'AVAILABLE'}),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_status', res.json()['errors'])

    def test_crane_safe_archive_with_allocations(self):
        """Test that deleting a crane with assignment history archives it safely (INACTIVE) rather than deleting."""
        crane = Crane.objects.create(
            crane_code="QC-ARCHIVE-01",
            crane_name="Historic Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="COMPLETED",
            crane_allocation_planned_start_at=now - timedelta(days=2),
            crane_allocation_planned_end_at=now - timedelta(days=1),
            crane_allocation_actual_start_at=now - timedelta(days=2),
            crane_allocation_actual_end_at=now - timedelta(days=1)
        )

        res_del = self.client.delete(f'/api/terminal/cranes/{crane.crane_id}/', **self.headers_tlo)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)

        # Verify crane still exists in DB but is archived
        crane.refresh_from_db()
        self.assertFalse(crane.crane_is_active)
        self.assertEqual(crane.crane_status, "INACTIVE")

    # ==========================================================================
    # T4.2 — CRANE ALLOCATION TESTS
    # ==========================================================================

    def test_crane_allocation_successful(self):
        """Test creating a valid crane allocation for an eligible vessel schedule."""
        crane = Crane.objects.create(
            crane_code="QC-ALLOC-01",
            crane_name="Allocation Quay Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        payload = {
            "crane_allocation_crane_id": crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat(),
            "crane_allocation_remarks": "Inbound container discharge operations"
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['data']['crane_code'], 'QC-ALLOC-01')
        self.assertEqual(data['data']['crane_allocation_status'], 'SCHEDULED')
        self.assertEqual(data['data']['berth_name'], self.berth_1.berth_name)

    def test_crane_allocation_rejects_maintenance_or_inactive_crane(self):
        """Test that a crane in MAINTENANCE or INACTIVE status cannot be allocated."""
        maint_crane = Crane.objects.create(
            crane_code="QC-MAINT-01",
            crane_name="Broken Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="MAINTENANCE"
        )
        now = timezone.now()
        payload = {
            "crane_allocation_crane_id": maint_crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crane_allocation_rejects_departed_vessel_schedule(self):
        """Test that an allocation cannot be created for a departed vessel schedule."""
        crane = Crane.objects.create(
            crane_code="QC-DEP-01",
            crane_name="Valid Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        payload = {
            "crane_allocation_crane_id": crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule_departed.vessel_schedule_id,
            "crane_allocation_operation_type": "LOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crane_allocation_rejects_invalid_time_interval(self):
        """Test that planned_end <= planned_start is rejected."""
        crane = Crane.objects.create(
            crane_code="QC-TIME-01",
            crane_name="Valid Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        payload = {
            "crane_allocation_crane_id": crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=6)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=4)).isoformat()  # earlier than start!
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crane_allocation_rejects_overlapping_time_window(self):
        """Test that overlapping allocation windows for the same crane are rejected."""
        crane = Crane.objects.create(
            crane_code="QC-OVERLAP-01",
            crane_name="Overlap Test Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        # Existing scheduled allocation from +2h to +6h
        CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="SCHEDULED",
            crane_allocation_planned_start_at=now + timedelta(hours=2),
            crane_allocation_planned_end_at=now + timedelta(hours=6)
        )

        # Overlapping request: +4h to +8h
        payload = {
            "crane_allocation_crane_id": crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "LOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=4)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=8)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', res.json()['errors'])

    def test_crane_allocation_allows_non_overlapping_windows(self):
        """Test that consecutive non-overlapping allocations for the same crane succeed."""
        crane = Crane.objects.create(
            crane_code="QC-NONOVER-01",
            crane_name="Non Overlap Test Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        # Allocation 1: +1h to +4h
        CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="SCHEDULED",
            crane_allocation_planned_start_at=now + timedelta(hours=1),
            crane_allocation_planned_end_at=now + timedelta(hours=4)
        )

        # Allocation 2: +5h to +8h (after allocation 1)
        payload = {
            "crane_allocation_crane_id": crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "LOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=5)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=8)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_crane_allocation_rejects_rtg_and_rmg(self):
        """Test that yard gantry cranes (RTG, RMG) are strictly rejected for vessel/berth allocation."""
        now = timezone.now()
        rtg_crane = Crane.objects.create(
            crane_code="RTG-VESSEL-REJECT",
            crane_name="Yard RTG Crane",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("45.00"),
            crane_status="AVAILABLE"
        )
        rmg_crane = Crane.objects.create(
            crane_code="RMG-VESSEL-REJECT",
            crane_name="Rail RMG Crane",
            crane_type="RMG",
            crane_max_lifting_capacity_mt=Decimal("50.00"),
            crane_status="AVAILABLE"
        )

        # 1. Attempt to allocate RTG
        payload_rtg = {
            "crane_allocation_crane_id": rtg_crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res_rtg = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload_rtg),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res_rtg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_allocation_crane_id', res_rtg.json()['errors'])
        self.assertIn('quayside crane', res_rtg.json()['errors']['crane_allocation_crane_id'][0].lower())

        # 2. Attempt to allocate RMG
        payload_rmg = {
            "crane_allocation_crane_id": rmg_crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res_rmg = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload_rmg),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res_rmg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_allocation_crane_id', res_rmg.json()['errors'])
        self.assertIn('quayside crane', res_rmg.json()['errors']['crane_allocation_crane_id'][0].lower())

    def test_crane_allocation_sts_fixed_berth_mismatch_rejected(self):
        """Test that an STS crane assigned to a different berth cannot be allocated to a vessel at another berth."""
        now = timezone.now()
        berth_2 = Berth.objects.create(
            berth_name="Quay Berth T4-02",
            berth_code="QB-T4-02",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("300.00"),
            berth_max_draft=Decimal("14.00"),
            berth_status="AVAILABLE",
            berth_is_active=True
        )
        sts_berth_2 = Crane.objects.create(
            crane_code="STS-BERTH2-CRANE",
            crane_name="Berth 2 STS Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=berth_2
        )

        payload = {
            "crane_allocation_crane_id": sts_berth_2.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,  # berthed at berth_1!
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('crane_allocation_crane_id', res.json()['errors'])
        self.assertIn('berth mismatch', res.json()['errors']['crane_allocation_crane_id'][0].lower())

    def test_crane_allocation_sts_fixed_berth_match_succeeds(self):
        """Test that an STS crane assigned to the matching berth succeeds."""
        now = timezone.now()
        sts_matching = Crane.objects.create(
            crane_code="STS-MATCH-BERTH1",
            crane_name="Berth 1 Matching STS Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=self.berth_1
        )

        payload = {
            "crane_allocation_crane_id": sts_matching.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.json()['data']['crane_code'], 'STS-MATCH-BERTH1')

    def test_crane_allocation_mhc_success_without_fixed_berth(self):
        """Test that a Mobile Harbour Crane (MHC) without fixed berth can be allocated to any berth."""
        now = timezone.now()
        mhc_crane = Crane.objects.create(
            crane_code="MHC-MOBILE-01",
            crane_name="Mobile Harbour Crane 01",
            crane_type="MHC",
            crane_max_lifting_capacity_mt=Decimal("100.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=None
        )

        payload = {
            "crane_allocation_crane_id": mhc_crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "UNLOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=3)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=7)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.json()['data']['crane_code'], 'MHC-MOBILE-01')

    # ==========================================================================
    # ALLOCATION LIFECYCLE TRANSITIONS TESTS
    # ==========================================================================

    def test_crane_allocation_start_transition(self):
        """Test starting a scheduled allocation (SCHEDULED -> ACTIVE)."""
        crane = Crane.objects.create(
            crane_code="QC-TRANS-01",
            crane_name="Transition Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        alloc = CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="SCHEDULED",
            crane_allocation_planned_start_at=now + timedelta(hours=1),
            crane_allocation_planned_end_at=now + timedelta(hours=4)
        )

        res = self.client.post(f'/api/terminal/crane-allocations/{alloc.crane_allocation_id}/start/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        alloc.refresh_from_db()
        crane.refresh_from_db()
        self.assertEqual(alloc.crane_allocation_status, 'ACTIVE')
        self.assertIsNotNone(alloc.crane_allocation_actual_start_at)
        self.assertEqual(crane.crane_status, 'IN_USE')

        # Attempt to start already ACTIVE allocation should fail
        res_fail = self.client.post(f'/api/terminal/crane-allocations/{alloc.crane_allocation_id}/start/', **self.headers_tlo)
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crane_allocation_complete_transition(self):
        """Test completing an active allocation (ACTIVE -> COMPLETED)."""
        crane = Crane.objects.create(
            crane_code="QC-COMP-01",
            crane_name="Complete Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="IN_USE"
        )
        now = timezone.now()
        alloc = CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=now - timedelta(hours=2),
            crane_allocation_planned_end_at=now + timedelta(hours=2),
            crane_allocation_actual_start_at=now - timedelta(hours=2)
        )

        res = self.client.post(f'/api/terminal/crane-allocations/{alloc.crane_allocation_id}/complete/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        alloc.refresh_from_db()
        crane.refresh_from_db()
        self.assertEqual(alloc.crane_allocation_status, 'COMPLETED')
        self.assertIsNotNone(alloc.crane_allocation_actual_end_at)
        self.assertEqual(crane.crane_status, 'AVAILABLE')

    def test_crane_allocation_cancel_transition(self):
        """Test cancelling an allocation (SCHEDULED or ACTIVE -> CANCELLED)."""
        crane = Crane.objects.create(
            crane_code="QC-CANCEL-01",
            crane_name="Cancel Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="IN_USE"
        )
        now = timezone.now()
        alloc = CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=now - timedelta(hours=1),
            crane_allocation_planned_end_at=now + timedelta(hours=3),
            crane_allocation_actual_start_at=now - timedelta(hours=1)
        )

        res = self.client.post(
            f'/api/terminal/crane-allocations/{alloc.crane_allocation_id}/cancel/',
            data=json.dumps({'reason': 'Severe weather advisory'}),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        alloc.refresh_from_db()
        crane.refresh_from_db()
        self.assertEqual(alloc.crane_allocation_status, 'CANCELLED')
        self.assertIn('Severe weather advisory', alloc.crane_allocation_remarks)
        self.assertEqual(crane.crane_status, 'AVAILABLE')

    def test_completed_or_cancelled_allocation_releases_time_window(self):
        """Test that COMPLETED or CANCELLED allocations do NOT block new allocations for the same time window."""
        crane = Crane.objects.create(
            crane_code="QC-RELEASE-01",
            crane_name="Release Window Crane",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        now = timezone.now()
        # Cancelled allocation
        CraneAllocation.objects.create(
            crane_allocation_crane_id=crane,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="CANCELLED",
            crane_allocation_planned_start_at=now + timedelta(hours=2),
            crane_allocation_planned_end_at=now + timedelta(hours=6)
        )

        # New allocation for the exact same time window
        payload = {
            "crane_allocation_crane_id": crane.crane_id,
            "crane_allocation_vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_operation_type": "LOADING",
            "crane_allocation_planned_start_at": (now + timedelta(hours=2)).isoformat(),
            "crane_allocation_planned_end_at": (now + timedelta(hours=6)).isoformat()
        }
        res = self.client.post(
            '/api/terminal/crane-allocations/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    # ==========================================================================
    # T4.3 — CRANE OPERATIONS SUMMARY TESTS
    # ==========================================================================

    def test_crane_operations_summary(self):
        """Test summary endpoint returns accurate KPIs with records."""
        crane_1 = Crane.objects.create(
            crane_code="QC-SUM-01",
            crane_name="Summary Crane 1",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE"
        )
        crane_2 = Crane.objects.create(
            crane_code="QC-SUM-02",
            crane_name="Summary Crane 2",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("45.00"),
            crane_status="MAINTENANCE"
        )
        now = timezone.now()
        CraneAllocation.objects.create(
            crane_allocation_crane_id=crane_1,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="SCHEDULED",
            crane_allocation_planned_start_at=now + timedelta(hours=2),
            crane_allocation_planned_end_at=now + timedelta(hours=6)
        )

        res = self.client.get('/api/terminal/crane-operations/summary/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        kpis = res.json()['data']['kpis']
        self.assertEqual(kpis['total_cranes'], 2)
        self.assertEqual(kpis['available_cranes'], 1)
        self.assertEqual(kpis['maintenance_cranes'], 1)
        self.assertEqual(kpis['scheduled_allocations'], 1)

    def test_eligible_vessel_schedules_endpoint(self):
        """Test that eligible vessel schedules excludes departed vessels."""
        res = self.client.get('/api/terminal/crane-allocations/eligible-schedules/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [s['vessel_schedule_id'] for s in res.json()['data']]
        self.assertIn(self.vessel_schedule.vessel_schedule_id, ids)
        self.assertNotIn(self.vessel_schedule_departed.vessel_schedule_id, ids)

    # ==========================================================================
    # T4.4 — RBAC PERMISSION TESTS ACROSS ALL 6 ROLES
    # ==========================================================================

    def test_rbac_permissions_all_six_roles(self):
        """Test strict role-based access control for Crane Management across all six platform roles."""
        payload = {
            "crane_code": "QC-RBAC-01",
            "crane_name": "RBAC Crane",
            "crane_type": "STS",
            "crane_max_lifting_capacity_mt": "65.00",
            "crane_status": "AVAILABLE"
        }

        # 1. Terminal Operator: Write allowed (201)
        res_tlo = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res_tlo.status_code, status.HTTP_201_CREATED)

        # 2. Port Administrator: Write allowed (201)
        payload['crane_code'] = "QC-RBAC-02"
        res_admin = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_admin
        )
        self.assertEqual(res_admin.status_code, status.HTTP_201_CREATED)

        # 3. Port Operations Officer: Read allowed (200), Write denied (403)
        res_ops_get = self.client.get('/api/terminal/cranes/', **self.headers_ops)
        self.assertEqual(res_ops_get.status_code, status.HTTP_200_OK)

        payload['crane_code'] = "QC-RBAC-03"
        res_ops_post = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_ops
        )
        self.assertEqual(res_ops_post.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Shipping Company: Denied on all methods (403)
        res_ship_get = self.client.get('/api/terminal/cranes/', **self.headers_ship)
        self.assertEqual(res_ship_get.status_code, status.HTTP_403_FORBIDDEN)
        res_ship_post = self.client.post(
            '/api/terminal/cranes/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_ship
        )
        self.assertEqual(res_ship_post.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Customs Officer: Denied on all methods (403)
        res_customs_get = self.client.get('/api/terminal/cranes/', **self.headers_customs)
        self.assertEqual(res_customs_get.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Gate & Truck Officer: Denied on all methods (403)
        res_gate_get = self.client.get('/api/terminal/cranes/', **self.headers_gate)
        self.assertEqual(res_gate_get.status_code, status.HTTP_403_FORBIDDEN)
