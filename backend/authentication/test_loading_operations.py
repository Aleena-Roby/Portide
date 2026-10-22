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
    ContainerTrackingEvent,
    AuditLog
)


class LoadingOperationsTestCase(TestCase):
    """
    Automated test suite for Loading Operations (Vessel Stowage Integration).
    Tests atomic quay crane container loading, vessel schedule & berth validation,
    crane allocation status & operational checks, yard container linkage,
    origin yard slot release & occupancy accounting, append-only LOADING
    movement history, audit logs, and dual-state tracking events.
    """

    def setUp(self):
        self.client = APIClient()

        # Terminal Operator (Authorized)
        self.login_tlo = Login.objects.create(
            login_email="tlo_load@portide.com",
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
            'HTTP_X_USER_EMAIL': 'tlo_load@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_tlo.user_id)
        }

        # Berth setup
        self.berth = Berth.objects.create(
            berth_name="Quay Berth 01",
            berth_code="QB-01",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("15.50"),
            berth_status="OCCUPIED",
            berth_is_active=True
        )

        # Shipping Company & Vessel
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Pacific Lines Loading",
            shipping_company_license_number="LIC-LOAD-01",
            shipping_company_email="agent_load@pacific.com",
            shipping_company_phone="+919876543404",
            shipping_company_address="Harbour Way 202"
        )
        self.port_origin, _ = Port.objects.get_or_create(port_code="SGSIN", defaults={"port_name": "Singapore Hub", "port_country": "Singapore"})
        self.port_dest, _ = Port.objects.get_or_create(port_code="PORT1", defaults={"port_name": "Portide Gateway", "port_country": "India"})

        now = timezone.now()
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="Pacific Voyager",
            vessel_imo_number="IMO9876543",
            vessel_call_sign="PV987",
            vessel_type="CONTAINER_SHIP",
            vessel_length=Decimal("300.00"),
            vessel_draft=Decimal("14.00"),
            vessel_capacity=5000,
            vessel_flag="Panama",
            vessel_status="ACTIVE"
        )

        self.arrival_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now - timedelta(hours=5),
            vessel_arrival_request_requested_departure_at=now + timedelta(hours=20),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("1200.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth
        )

        self.vessel_schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_request,
            vessel_schedule_berth_id=self.berth,
            vessel_schedule_scheduled_arrival_at=now - timedelta(hours=5),
            vessel_schedule_scheduled_departure_at=now + timedelta(hours=20),
            vessel_schedule_actual_at_berth_at=now - timedelta(hours=3),
            vessel_schedule_status="AT_BERTH"
        )

        # Quay Crane setup
        self.crane_sts = Crane.objects.create(
            crane_code="STS-01",
            crane_name="Ship-to-Shore Gantry 1",
            crane_type="STS",
            crane_status="IN_USE",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_assigned_berth_id=self.berth,
            crane_is_active=True
        )

        self.crane_allocation = CraneAllocation.objects.create(
            crane_allocation_crane_id=self.crane_sts,
            crane_allocation_vessel_schedule_id=self.vessel_schedule,
            crane_allocation_berth_id=self.berth,
            crane_allocation_operation_type="LOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=now - timedelta(hours=2),
            crane_allocation_planned_end_at=now + timedelta(hours=10),
            crane_allocation_actual_start_at=now - timedelta(hours=2)
        )

        # Yard Infrastructure
        self.yard = Yard.objects.create(
            yard_code="YARD-EXP",
            yard_name="Export Terminal Yard",
            yard_type="CONTAINER_YARD",
            yard_capacity=100,
            yard_occupied=1,
            yard_status="ACTIVE"
        )

        self.block = YardBlock.objects.create(
            yard_block_yard_id=self.yard,
            yard_block_code="EXP-B1",
            yard_block_name="Export Block 1",
            yard_block_type="STANDARD",
            yard_block_capacity=50,
            yard_block_occupied=1,
            yard_block_status="ACTIVE"
        )

        self.slot = YardSlot.objects.create(
            yard_slot_block_id=self.block,
            yard_slot_code="EXP-B1-R1-B1-T1",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=1,
            yard_slot_status="OCCUPIED"
        )

        # Export Cargo & Container
        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_type="CONTAINERIZED",
            cargo_description="Electronic Components Export",
            cargo_quantity=Decimal("1.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("24.00"),
            cargo_origin_port_id=self.port_dest,
            cargo_destination_port_id=self.port_origin,
            cargo_status="IN_PORT"
        )

        self.container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU9876543",
            container_type="40FT",
            container_gross_weight=Decimal("24.00"),
            container_status="AT_TERMINAL",
            container_customs_status="CLEARED"
        )

        # Active Yard Allocation
        self.allocation = YardAllocation.objects.create(
            yard_allocation_container_id=self.container,
            yard_allocation_slot_id=self.slot,
            yard_allocation_allocated_by_id=self.user_tlo,
            yard_allocation_status="ACTIVE"
        )

    def test_01_successful_loading_stowage_happy_path(self):
        """Happy path: Load yard container via active quay crane onto berthed vessel."""
        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container.container_id,
            "slot_id": self.slot.yard_slot_id,
            "remarks": "Export voyage loading test"
        }

        res = self.client.post(
            '/api/terminal/loading/load/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'success')

        # 1. Container transitioned to LOADED
        self.container.refresh_from_db()
        self.assertEqual(self.container.container_status, 'LOADED')

        # 2. YardAllocation transitioned to RELEASED
        self.allocation.refresh_from_db()
        self.assertEqual(self.allocation.yard_allocation_status, 'RELEASED')

        # 3. Origin Slot released to AVAILABLE
        self.slot.refresh_from_db()
        self.assertEqual(self.slot.yard_slot_status, 'AVAILABLE')

        # 4. Yard and Block occupancy decremented
        self.block.refresh_from_db()
        self.yard.refresh_from_db()
        self.assertEqual(self.block.yard_block_occupied, 0)
        self.assertEqual(self.yard.yard_occupied, 0)

        # 5. Append-only YardMovementHistory record created with LOADING
        movement = YardMovementHistory.objects.get(
            yard_movement_container_id=self.container,
            yard_movement_movement_type='LOADING'
        )
        self.assertEqual(movement.yard_movement_from_slot_id, self.slot)
        self.assertIsNone(movement.yard_movement_to_slot_id)
        self.assertEqual(movement.yard_movement_crane_id, self.crane_sts)
        self.assertEqual(movement.to_location_display, 'Vessel (Loaded)')

        # 6. ContainerTrackingEvent recorded
        tracking_event = ContainerTrackingEvent.objects.filter(
            tracking_event_container_id=self.container,
            tracking_event_status='LOADED_ON_VESSEL'
        ).first()
        self.assertIsNotNone(tracking_event)

        # 7. AuditLog entry recorded
        audit = AuditLog.objects.filter(
            audit_log_action='LOAD_CONTAINER_VESSEL',
            audit_log_target_id=str(self.container.container_id)
        ).first()
        self.assertIsNotNone(audit)

    def test_02_loading_rejected_when_vessel_not_at_berth(self):
        """Negative check: Loading fails if carrier vessel is not in AT_BERTH schedule status."""
        self.vessel_schedule.vessel_schedule_status = 'SCHEDULED'
        self.vessel_schedule.save()

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": self.container.container_id,
            "slot_id": self.slot.yard_slot_id
        }

        res = self.client.post(
            '/api/terminal/loading/load/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('At Berth', res.data['message'])

    def test_03_loading_eligible_vessels_endpoint(self):
        """Endpoint check: GET /api/terminal/loading/eligible-vessels/ returns berthed vessel."""
        res = self.client.get('/api/terminal/loading/eligible-vessels/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['data'][0]['vessel_name'], 'Pacific Voyager')

    def test_04_loading_yard_containers_endpoint(self):
        """Endpoint check: GET /api/terminal/loading/yard-containers/ returns yard container."""
        res = self.client.get('/api/terminal/loading/yard-containers/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['data'][0]['container_number'], 'MSCU9876543')
        self.assertEqual(res.data['data'][0]['trade_direction'], 'EXPORT')

    def test_05_import_discharged_container_excluded_from_loading_containers(self):
        """Import container discharged from vessel must be excluded from loading yard containers."""
        # Create an import container that was discharged into a yard slot
        import_container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="IMPU1122334",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="AT_TERMINAL",
            container_customs_status="CLEARED"
        )
        slot_import = YardSlot.objects.create(
            yard_slot_block_id=self.block,
            yard_slot_code="EXP-B1-R1-B1-T2",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=2,
            yard_slot_status="OCCUPIED"
        )
        YardAllocation.objects.create(
            yard_allocation_container_id=import_container,
            yard_allocation_slot_id=slot_import,
            yard_allocation_allocated_by_id=self.user_tlo,
            yard_allocation_status="ACTIVE"
        )
        # Record DISCHARGE movement history (marking this as an import container)
        YardMovementHistory.objects.create(
            yard_movement_container_id=import_container,
            yard_movement_from_slot_id=None,
            yard_movement_to_slot_id=slot_import,
            yard_movement_movement_type='DISCHARGE',
            yard_movement_crane_id=self.crane_sts,
            yard_movement_moved_by_id=self.user_tlo
        )

        # GET /api/terminal/loading/yard-containers/ must only return the export container MSCU9876543
        res = self.client.get('/api/terminal/loading/yard-containers/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        container_numbers = [c['container_number'] for c in res.data['data']]
        self.assertIn('MSCU9876543', container_numbers)
        self.assertNotIn('IMPU1122334', container_numbers)

    def test_06_loading_filtered_by_vessel_schedule_id(self):
        """GET /api/terminal/loading/yard-containers/?vessel_schedule_id=<id> only returns assigned containers."""
        # Query with current vessel schedule
        res = self.client.get(
            f'/api/terminal/loading/yard-containers/?vessel_schedule_id={self.vessel_schedule.vessel_schedule_id}',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['data'][0]['container_number'], 'MSCU9876543')

        # Query with a non-matching ID or schedule without assigned containers
        vessel_2 = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="Atlantic Express",
            vessel_imo_number="IMO1122334",
            vessel_type="CONTAINER_SHIP",
            vessel_length=Decimal("280.00"),
            vessel_draft=Decimal("12.00"),
            vessel_capacity=4000,
            vessel_flag="Liberia",
            vessel_status="ACTIVE"
        )
        now = timezone.now()
        req_2 = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=vessel_2,
            vessel_arrival_request_requested_arrival_at=now - timedelta(hours=3),
            vessel_arrival_request_requested_departure_at=now + timedelta(hours=24),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("500.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth
        )
        sched_2 = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=req_2,
            vessel_schedule_berth_id=self.berth,
            vessel_schedule_scheduled_arrival_at=now - timedelta(hours=3),
            vessel_schedule_scheduled_departure_at=now + timedelta(hours=24),
            vessel_schedule_actual_at_berth_at=now - timedelta(hours=2),
            vessel_schedule_status="AT_BERTH"
        )

        res_sched2 = self.client.get(
            f'/api/terminal/loading/yard-containers/?vessel_schedule_id={sched_2.vessel_schedule_id}',
            **self.headers_tlo
        )
        self.assertEqual(res_sched2.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sched2.data['count'], 0)

    def test_07_loading_rejected_for_discharged_import_container(self):
        """Backend rejects loading if container is an import container discharged from vessel."""
        import_container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="IMPU9988776",
            container_type="20FT",
            container_gross_weight=Decimal("16.00"),
            container_status="AT_TERMINAL",
            container_customs_status="CLEARED"
        )
        slot_imp = YardSlot.objects.create(
            yard_slot_block_id=self.block,
            yard_slot_code="EXP-B1-R1-B1-T3",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=3,
            yard_slot_status="OCCUPIED"
        )
        YardAllocation.objects.create(
            yard_allocation_container_id=import_container,
            yard_allocation_slot_id=slot_imp,
            yard_allocation_allocated_by_id=self.user_tlo,
            yard_allocation_status="ACTIVE"
        )
        YardMovementHistory.objects.create(
            yard_movement_container_id=import_container,
            yard_movement_from_slot_id=None,
            yard_movement_to_slot_id=slot_imp,
            yard_movement_movement_type='DISCHARGE',
            yard_movement_crane_id=self.crane_sts,
            yard_movement_moved_by_id=self.user_tlo
        )

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": import_container.container_id,
            "slot_id": slot_imp.yard_slot_id
        }

        res = self.client.post(
            '/api/terminal/loading/load/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("import container discharged from a vessel", res.data['message'])

    def test_08_loading_rejected_for_container_assigned_to_different_vessel(self):
        """Backend rejects loading if container is assigned to another vessel schedule."""
        vessel_other = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="Nordic Pioneer",
            vessel_imo_number="IMO7788990",
            vessel_type="CONTAINER_SHIP",
            vessel_length=Decimal("260.00"),
            vessel_draft=Decimal("11.50"),
            vessel_capacity=3500,
            vessel_flag="Norway",
            vessel_status="ACTIVE"
        )
        now = timezone.now()
        req_other = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=vessel_other,
            vessel_arrival_request_requested_arrival_at=now - timedelta(hours=4),
            vessel_arrival_request_requested_departure_at=now + timedelta(hours=20),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("300.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth
        )
        cargo_other = Cargo.objects.create(
            cargo_arrival_request_id=req_other,
            cargo_type="CONTAINERIZED",
            cargo_description="Other Export Goods",
            cargo_quantity=Decimal("1.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("20.00"),
            cargo_origin_port_id=self.port_dest,
            cargo_destination_port_id=self.port_origin,
            cargo_status="IN_PORT"
        )
        container_other = Container.objects.create(
            container_cargo_id=cargo_other,
            container_number="OTHR1234567",
            container_type="40FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AT_TERMINAL",
            container_customs_status="CLEARED"
        )
        slot_other = YardSlot.objects.create(
            yard_slot_block_id=self.block,
            yard_slot_code="EXP-B1-R1-B1-T4",
            yard_slot_row=1,
            yard_slot_bay=1,
            yard_slot_tier=4,
            yard_slot_status="OCCUPIED"
        )
        YardAllocation.objects.create(
            yard_allocation_container_id=container_other,
            yard_allocation_slot_id=slot_other,
            yard_allocation_allocated_by_id=self.user_tlo,
            yard_allocation_status="ACTIVE"
        )

        payload = {
            "vessel_schedule_id": self.vessel_schedule.vessel_schedule_id,
            "crane_allocation_id": self.crane_allocation.crane_allocation_id,
            "container_id": container_other.container_id,
            "slot_id": slot_other.yard_slot_id
        }

        res = self.client.post(
            '/api/terminal/loading/load/',
            data=json.dumps(payload),
            content_type='application/json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not the selected vessel schedule", res.data['message'])
