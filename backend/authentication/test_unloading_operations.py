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
    Port,
    Vessel,
    VesselArrivalRequest,
    Berth,
    VesselSchedule,
    Cargo,
    Container,
    Crane,
    CraneAllocation,
    Yard,
    YardBlock,
    YardSlot,
    YardAllocation,
    YardMovementHistory,
    AuditLog
)


class UnloadingOperationsTestCase(TestCase):
    """
    Isolated automated test suite for Phase T4 / Unloading Operations Integration.
    Tests atomic quay crane container discharge, vessel schedule & berth validation,
    crane allocation status & operational checks, container manifest linkage,
    destination yard slot allocation & occupancy accounting, append-only DISCHARGE
    movement history, audit logs, and RBAC permissions across all 6 roles.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Terminal & Logistics Operator (Authorized to discharge)
        self.login_tlo = Login.objects.create(
            login_email="tlo_unload@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_tlo = User.objects.create(
            login_id=self.login_tlo,
            user_full_name="Tariq Terminal",
            user_phone="+919876543401",
            user_status="ACTIVE"
        )
        self.headers_tlo = {
            'HTTP_X_USER_EMAIL': 'tlo_unload@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_tlo.user_id)
        }

        # 2. Port Administrator (Authorized to discharge)
        self.login_admin = Login.objects.create(
            login_email="admin_unload@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_admin = User.objects.create(
            login_id=self.login_admin,
            user_full_name="Port Admin",
            user_phone="+919876543402",
            user_status="ACTIVE"
        )
        self.headers_admin = {
            'HTTP_X_USER_EMAIL': 'admin_unload@portide.com',
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.user_admin.user_id)
        }

        # 3. Port Operations Officer (Read-Only)
        self.login_ops = Login.objects.create(
            login_email="ops_unload@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_ops = User.objects.create(
            login_id=self.login_ops,
            user_full_name="Oliver Operations",
            user_phone="+919876543403",
            user_status="ACTIVE"
        )
        self.headers_ops = {
            'HTTP_X_USER_EMAIL': 'ops_unload@portide.com',
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.user_ops.user_id)
        }

        # 4. Shipping Company (Unauthorized)
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Pacific Lines Unload",
            shipping_company_license_number="LIC-UNLOAD-01",
            shipping_company_email="agent_unload@pacific.com",
            shipping_company_phone="+919876543404",
            shipping_company_address="Harbour Way 202"
        )
        self.login_ship = Login.objects.create(
            login_email="agent_unload@pacific.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_ship = User.objects.create(
            login_id=self.login_ship,
            shipping_company_id=self.company,
            user_full_name="Sam Shipping",
            user_phone="+919876543404",
            user_status="ACTIVE"
        )
        self.headers_ship = {
            'HTTP_X_USER_EMAIL': 'agent_unload@pacific.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login_ship.login_id)
        }

        # 5. Customs Officer (Unauthorized)
        self.login_customs = Login.objects.create(
            login_email="customs_unload@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="customs_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.headers_customs = {
            'HTTP_X_USER_EMAIL': 'customs_unload@portide.com',
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.login_customs.login_id)
        }

        # 6. Gate & Truck Officer (Unauthorized)
        self.login_gate = Login.objects.create(
            login_email="gate_unload@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.headers_gate = {
            'HTTP_X_USER_EMAIL': 'gate_unload@portide.com',
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.login_gate.login_id)
        }

        # Berth setup
        self.berth_1 = Berth.objects.create(
            berth_name="Quay Berth 01",
            berth_code="QB-01",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("15.50"),
            berth_status="OCCUPIED",
            berth_is_active=True
        )
        self.berth_2 = Berth.objects.create(
            berth_name="Quay Berth 02",
            berth_code="QB-02",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("15.50"),
            berth_status="AVAILABLE",
            berth_is_active=True
        )

        # Vessel setup
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="MV Ocean Trader",
            vessel_imo_number="IMO9876543",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="PA",
            vessel_length=Decimal("290.00"),
            vessel_draft=Decimal("13.00"),
            vessel_capacity=5000,
            vessel_status="ACTIVE"
        )

        now = timezone.now()
        self.arrival_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now - timedelta(hours=6),
            vessel_arrival_request_requested_departure_at=now + timedelta(days=2),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("1200.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth_1
        )

        self.vessel_schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_request,
            vessel_schedule_berth_id=self.berth_1,
            vessel_schedule_scheduled_arrival_at=now - timedelta(hours=6),
            vessel_schedule_scheduled_departure_at=now + timedelta(days=2),
            vessel_schedule_actual_arrival_at=now - timedelta(hours=5),
            vessel_schedule_actual_at_berth_at=now - timedelta(hours=4),
            vessel_schedule_status="AT_BERTH"
        )

        # Cargo & Container setup
        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_description="Heavy Industrial Equipment & Auto Parts",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("200.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("3000.00"),
            cargo_status="IN_PORT"
        )

        self.container_1 = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSKU1122334",
            container_type="20FT",
            container_gross_weight=Decimal("18.50"),
            container_status="ARRIVED"
        )

        self.container_2 = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSKU5566778",
            container_type="40FT",
            container_gross_weight=Decimal("26.00"),
            container_status="ARRIVED"
        )

        # Crane setup
        self.crane_sts = Crane.objects.create(
            crane_code="STS-01",
            crane_name="Super Post-Panamax Quay Crane 1",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="IN_USE",
            crane_is_active=True,
            crane_assigned_berth_id=self.berth_1
        )

        self.crane_allocation = CraneAllocation.objects.create(
            crane_allocation_crane_id=self.crane_sts,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_berth_id=self.berth_1,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=now - timedelta(hours=2),
            crane_allocation_planned_end_at=now + timedelta(hours=10),
            crane_allocation_actual_start_at=now - timedelta(hours=2),
            crane_allocation_assigned_by_id=self.user_tlo
        )

        # Yard setup
        self.yard = Yard.objects.create(
            yard_code="YARD-U",
            yard_name="Unloading Yard Alpha",
            yard_type="CONTAINER_YARD",
            yard_capacity=100,
            yard_occupied=0,
            yard_status="ACTIVE"
        )

        self.block = YardBlock.objects.create(
            yard_block_yard_id=self.yard,
            yard_block_code="BLK-U1",
            yard_block_name="Block U1",
            yard_block_type="DRY_CONTAINER",
            yard_block_capacity=50,
            yard_block_occupied=0,
            yard_block_status="ACTIVE"
        )

        self.slot_1 = YardSlot.objects.create(
            yard_slot_block_id=self.block,
            yard_slot_code="U1-01-01-1",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="AVAILABLE"
        )

        self.slot_2 = YardSlot.objects.create(
            yard_slot_block_id=self.block,
            yard_slot_code="U1-01-01-2",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=2,
            yard_slot_status="AVAILABLE"
        )

    # =========================================================================
    # 1. Successful Unloading Happy Path
    # =========================================================================
    def test_01_successful_unloading_discharge_happy_path(self):
        """Happy path: Discharge arrived container via active quay crane into available yard slot."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id,
            "remarks": "Morning shift discharge test"
        }

        res = self.client.post(
            '/api/terminal/unloading/discharge/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'success')

        # 1. Container transitioned strictly to AT_TERMINAL
        self.container_1.refresh_from_db()
        self.assertEqual(self.container_1.container_status, 'AT_TERMINAL')

        # 2. YardAllocation created and linked to CraneAllocation
        alloc = YardAllocation.objects.get(
            yard_allocation_container_id=self.container_1,
            yard_allocation_status='ACTIVE'
        )
        self.assertEqual(alloc.yard_allocation_slot_id, self.slot_1)
        self.assertEqual(alloc.yard_allocation_crane_allocation_id, self.crane_allocation)

        # 3. Slot updated to OCCUPIED
        self.slot_1.refresh_from_db()
        self.assertEqual(self.slot_1.yard_slot_status, 'OCCUPIED')

        # 4. Yard and Block occupancy incremented
        self.block.refresh_from_db()
        self.yard.refresh_from_db()
        self.assertEqual(self.block.yard_block_occupied, 1)
        self.assertEqual(self.yard.yard_occupied, 1)

        # 5. Append-only YardMovementHistory record created with DISCHARGE
        movement = YardMovementHistory.objects.get(
            yard_movement_container_id=self.container_1,
            yard_movement_movement_type='DISCHARGE'
        )
        self.assertIsNone(movement.yard_movement_from_slot_id)
        self.assertEqual(movement.yard_movement_to_slot_id, self.slot_1)
        self.assertEqual(movement.yard_movement_crane_id, self.crane_sts)
        self.assertEqual(movement.from_location_display, 'Vessel (Discharge)')

        # 6. AuditLog entry recorded
        audit = AuditLog.objects.filter(
            audit_log_action='DISCHARGE_CONTAINER_UNLOAD',
            audit_log_target_id=str(self.container_1.container_id)
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.audit_log_category, 'UNLOADING_OPERATIONS')

    # =========================================================================
    # 2. Wrong Vessel / Container Relationship Rejected
    # =========================================================================
    def test_02_wrong_vessel_container_relationship_rejected(self):
        """Reject discharge if container does not belong to the selected vessel schedule."""
        vessel_2 = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="MV Foreign Voyager",
            vessel_imo_number="IMO9999999",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="LR",
            vessel_length=Decimal("200.00"),
            vessel_draft=Decimal("10.00"),
            vessel_capacity=3000,
            vessel_status="ACTIVE"
        )
        arrival_2 = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=vessel_2,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now() + timedelta(days=1),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("100.00"),
            vessel_arrival_request_status="APPROVED"
        )
        cargo_2 = Cargo.objects.create(
            cargo_arrival_request_id=arrival_2,
            cargo_description="Foreign Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("50.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("500.00")
        )
        foreign_container = Container.objects.create(
            container_cargo_id=cargo_2,
            container_number="FRGN1234567",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="ARRIVED"
        )

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": foreign_container.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }

        res = self.client.post(
            '/api/terminal/unloading/discharge/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not the selected vessel schedule", res.data['message'])

    # =========================================================================
    # 3. Crane Allocation Status Validations
    # =========================================================================
    def test_03_crane_allocation_lifecycle_status_validations(self):
        """Reject discharge if crane allocation is SCHEDULED, COMPLETED, CANCELLED, or belongs to another schedule."""
        # SCHEDULED
        self.crane_allocation.crane_allocation_status = 'SCHEDULED'
        self.crane_allocation.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must be in 'ACTIVE' status", res.data['message'])

        # COMPLETED
        self.crane_allocation.crane_allocation_status = 'COMPLETED'
        self.crane_allocation.save()
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # CANCELLED
        self.crane_allocation.crane_allocation_status = 'CANCELLED'
        self.crane_allocation.save()
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 4. Crane Operation Type Permits Unloading
    # =========================================================================
    def test_04_crane_operation_type_validation(self):
        """Reject discharge if crane allocation is LOADING only; accept if UNLOADING or BOTH."""
        self.crane_allocation.crane_allocation_status = 'ACTIVE'
        self.crane_allocation.crane_allocation_operation_type = 'LOADING'
        self.crane_allocation.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must permit Unloading", res.data['message'])

        # When set to BOTH -> succeeds
        self.crane_allocation.crane_allocation_operation_type = 'BOTH'
        self.crane_allocation.save()
        res_both = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res_both.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 5. Crane Under Maintenance or Inactive
    # =========================================================================
    def test_05_crane_maintenance_or_inactive_rejected(self):
        """Reject discharge if crane is in MAINTENANCE or INACTIVE status."""
        self.crane_sts.crane_status = 'MAINTENANCE'
        self.crane_sts.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not operational", res.data['message'])

        # Inactive
        self.crane_sts.crane_status = 'INACTIVE'
        self.crane_sts.save()
        res_inact = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res_inact.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 6. Vessel Not At Berth or Berth Mismatch Rejected
    # =========================================================================
    def test_06_vessel_not_at_berth_or_berth_mismatch_rejected(self):
        """Reject discharge if vessel is not AT_BERTH or crane allocation berth does not match."""
        # Vessel DEPARTED
        self.vessel_schedule.vessel_schedule_status = 'DEPARTED'
        self.vessel_schedule.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must be 'At Berth'", res.data['message'])

        # Reset to AT_BERTH, but set crane allocation berth to berth_2 (mismatch)
        self.vessel_schedule.vessel_schedule_status = 'AT_BERTH'
        self.vessel_schedule.save()
        self.crane_allocation.crane_allocation_berth_id = self.berth_2
        self.crane_allocation.save()

        res_mismatch = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("does not match vessel schedule berth", res_mismatch.data['message'])

    # =========================================================================
    # 7. Container Already Allocated or Invalid Lifecycle Status
    # =========================================================================
    def test_07_container_already_allocated_or_invalid_status_rejected(self):
        """Reject discharge if container has active yard allocation or is in invalid status."""
        # Container already AT_TERMINAL
        self.container_1.container_status = 'AT_TERMINAL'
        self.container_1.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be discharged from vessel again", res.data['message'])

        # Container already CLEARED
        self.container_1.container_status = 'CLEARED'
        self.container_1.save()
        res_cleared = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res_cleared.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 8. Occupied or Inactive Destination Slot Rejected
    # =========================================================================
    def test_08_occupied_or_inactive_slot_rejected(self):
        """Reject discharge if destination yard slot is OCCUPIED, MAINTENANCE, or block is inactive."""
        # Slot OCCUPIED
        self.slot_1.yard_slot_status = 'OCCUPIED'
        self.slot_1.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not available for discharge", res.data['message'])

        # Slot in MAINTENANCE
        self.slot_1.yard_slot_status = 'MAINTENANCE'
        self.slot_1.save()
        res_maint = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res_maint.status_code, status.HTTP_400_BAD_REQUEST)

        # Block INACTIVE
        self.slot_1.yard_slot_status = 'AVAILABLE'
        self.slot_1.save()
        self.block.yard_block_status = 'INACTIVE'
        self.block.save()
        res_blk = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res_blk.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is inactive", res_blk.data['message'])

    # =========================================================================
    # 9. Duplicate Discharge Attempt Prevented
    # =========================================================================
    def test_09_duplicate_discharge_attempt_prevented(self):
        """Prevent discharging the same container twice."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res1 = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second attempt for same container to slot_2
        payload['slot_id'] = self.slot_2.yard_slot_id
        res2 = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already has an active yard allocation", res2.data['message'])

    # =========================================================================
    # 10. Occupancy Consistency Accounting
    # =========================================================================
    def test_10_occupancy_consistency_accounting(self):
        """Verify block and yard occupancy counts update accurately after discharge."""
        self.assertEqual(self.block.yard_block_occupied, 0)
        self.assertEqual(self.yard.yard_occupied, 0)

        # Discharge container 1 into slot 1
        payload_1 = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload_1), content_type='application/json', **self.headers_tlo)

        self.block.refresh_from_db()
        self.yard.refresh_from_db()
        self.assertEqual(self.block.yard_block_occupied, 1)
        self.assertEqual(self.yard.yard_occupied, 1)

        # Discharge container 2 into slot 2
        payload_2 = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_2.container_id,
            "slot_id": self.slot_2.yard_slot_id
        }
        self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload_2), content_type='application/json', **self.headers_tlo)

        self.block.refresh_from_db()
        self.yard.refresh_from_db()
        self.assertEqual(self.block.yard_block_occupied, 2)
        self.assertEqual(self.yard.yard_occupied, 2)

    # =========================================================================
    # 11. Initial DISCHARGE Movement History Entry Verified
    # =========================================================================
    def test_11_initial_discharge_movement_history_fields_verified(self):
        """Verify YardMovementHistory captures movement_type=DISCHARGE, crane, operator, and no source slot."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)

        movement = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container_1
        ).first()

        self.assertIsNotNone(movement)
        self.assertEqual(movement.yard_movement_movement_type, 'DISCHARGE')
        self.assertEqual(movement.movement_type, 'DISCHARGE')
        self.assertIsNone(movement.yard_movement_from_slot_id)
        self.assertIsNone(movement.from_slot)
        self.assertEqual(movement.from_location_display, 'Vessel (Discharge)')
        self.assertEqual(movement.yard_movement_to_slot_id, self.slot_1)
        self.assertEqual(movement.yard_movement_crane_id, self.crane_sts)
        self.assertEqual(movement.crane, self.crane_sts)
        self.assertEqual(movement.yard_movement_moved_by_id, self.user_tlo)

    # =========================================================================
    # 12. Audit Log Traceability
    # =========================================================================
    def test_12_audit_log_traceability(self):
        """Verify AuditLog records category UNLOADING_OPERATIONS and actor details."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)

        log = AuditLog.objects.filter(
            audit_log_action='DISCHARGE_CONTAINER_UNLOAD',
            audit_log_target_id=str(self.container_1.container_id)
        ).first()

        self.assertIsNotNone(log)
        self.assertEqual(log.audit_log_category, 'UNLOADING_OPERATIONS')
        self.assertEqual(log.audit_log_status, 'SUCCESS')
        self.assertIn("MV Ocean Trader", log.audit_log_description)
        self.assertIn("STS-01", log.audit_log_description)

    # =========================================================================
    # 13. Atomic Rollback on Failure
    # =========================================================================
    def test_13_atomic_rollback_on_failure(self):
        """Verify that when a validation fails midway, all state remains untouched."""
        # Intentionally make slot invalid
        self.slot_1.yard_slot_status = 'OCCUPIED'
        self.slot_1.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Assert no partial mutations occurred
        self.container_1.refresh_from_db()
        self.assertEqual(self.container_1.container_status, 'ARRIVED')
        self.assertFalse(YardAllocation.objects.filter(yard_allocation_container_id=self.container_1).exists())
        self.assertFalse(YardMovementHistory.objects.filter(yard_movement_container_id=self.container_1).exists())

    # =========================================================================
    # 14. RBAC Permissions Across All Six Roles
    # =========================================================================
    def test_14_rbac_permissions_all_six_roles(self):
        """Enforce strict RBAC: only TLO and Admin can write; Ops has read-only; others denied."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }

        # Shipping Company -> 403
        res_ship = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_ship)
        self.assertEqual(res_ship.status_code, status.HTTP_403_FORBIDDEN)

        # Customs Officer -> 403
        res_cust = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_customs)
        self.assertEqual(res_cust.status_code, status.HTTP_403_FORBIDDEN)

        # Gate Officer -> 403
        res_gate = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_gate)
        self.assertEqual(res_gate.status_code, status.HTTP_403_FORBIDDEN)

        # Port Operations Officer -> 403 on POST, but 200 on GET
        res_ops_post = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_ops)
        self.assertEqual(res_ops_post.status_code, status.HTTP_403_FORBIDDEN)

        res_ops_get = self.client.get('/api/terminal/unloading/eligible-vessels/', **self.headers_ops)
        self.assertEqual(res_ops_get.status_code, status.HTTP_200_OK)

        # Port Administrator -> 201 Created (Allowed)
        res_admin = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_admin)
        self.assertEqual(res_admin.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 15. Operational Query Endpoints
    # =========================================================================
    def test_15_query_endpoints(self):
        """Verify eligible-vessels, active-cranes, manifest-containers, and history endpoints."""
        # 1. Eligible Vessels
        res_vessels = self.client.get('/api/terminal/unloading/eligible-vessels/', **self.headers_tlo)
        self.assertEqual(res_vessels.status_code, status.HTTP_200_OK)
        self.assertEqual(res_vessels.data['count'], 1)
        self.assertEqual(res_vessels.data['data'][0]['vessel_name'], 'MV Ocean Trader')

        # 2. Active Cranes
        res_cranes = self.client.get(
            f'/api/terminal/unloading/active-cranes/?vessel_schedule_id={self.vessel_schedule.vessel_schedule_id}',
            **self.headers_tlo
        )
        self.assertEqual(res_cranes.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cranes.data['count'], 1)
        self.assertEqual(res_cranes.data['data'][0]['crane_code'], 'STS-01')

        # 3. Manifest Containers
        res_manifest = self.client.get(
            f'/api/terminal/unloading/manifest-containers/?vessel_schedule_id={self.vessel_schedule.vessel_schedule_id}',
            **self.headers_tlo
        )
        self.assertEqual(res_manifest.status_code, status.HTTP_200_OK)
        self.assertEqual(res_manifest.data['count'], 2)

        # 4. Discharge History
        # Discharge one container first
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)

        res_history = self.client.get('/api/terminal/unloading/history/', **self.headers_tlo)
        self.assertEqual(res_history.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_history.data['count'], 1)
        self.assertEqual(res_history.data['data'][0]['container_number'], 'MSKU1122334')
        self.assertEqual(res_history.data['data'][0]['movement_type'], 'DISCHARGE')

    # =========================================================================
    # 16. Duplicate Discharge Prevention
    # =========================================================================
    def test_16_duplicate_discharge_prevention(self):
        """Prevent duplicate discharge submission for already discharged container."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_1.yard_slot_id
        }
        res1 = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Retry discharge with same container (even if different slot requested)
        payload_retry = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_1.container_id,
            "slot_id": self.slot_2.yard_slot_id
        }
        res2 = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload_retry), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already", res2.data['message'])

        # Verify no duplicate allocations or movements exist
        allocations_count = YardAllocation.objects.filter(
            yard_allocation_container_id=self.container_1,
            yard_allocation_status='ACTIVE'
        ).count()
        self.assertEqual(allocations_count, 1)

        movements_count = YardMovementHistory.objects.filter(
            yard_movement_container_id=self.container_1,
            yard_movement_movement_type='DISCHARGE'
        ).count()
        self.assertEqual(movements_count, 1)

    # =========================================================================
    # 17. Discharge Preserves Customs and Delivery Status
    # =========================================================================
    def test_17_discharge_preserves_customs_and_delivery_status(self):
        """Discharging a container must preserve pre-cleared customs status and delivery status."""
        self.container_2.customs_clearance_status = 'CLEARED'
        self.container_2.container_delivery_status = 'NOT_APPLICABLE'
        self.container_2.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container_2.container_id,
            "slot_id": self.slot_2.yard_slot_id
        }
        res = self.client.post('/api/terminal/unloading/discharge/', data=json.dumps(payload), content_type='application/json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.container_2.refresh_from_db()
        self.assertEqual(self.container_2.container_status, 'AT_TERMINAL')
        self.assertEqual(self.container_2.customs_clearance_status, 'CLEARED')
        self.assertEqual(self.container_2.container_delivery_status, 'NOT_APPLICABLE')

