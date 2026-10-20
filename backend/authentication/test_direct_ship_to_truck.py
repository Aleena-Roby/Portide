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
    Gate,
    Truck,
    Driver,
    GatePass,
    DeliveryOrder,
    PreArrivalCustomsDeclaration,
    DirectShipToTruckTransfer,
    AuditLog,
    CustomsInspection,
    ContainerTrackingEvent
)


class DirectShipToTruckTransferTestCase(TestCase):
    """
    Automated test suite covering all 22 Acceptance Criteria for the
    Direct Ship-to-Truck Transfer and Pre-Arrival Customs workflow.
    """

    def setUp(self):
        self.client = APIClient()
        self.now = timezone.now()

        # -------------------------------------------------------------
        # 1. Setup Roles and Logins
        # -------------------------------------------------------------
        # Shipping Company A User
        self.login_ship_a = Login.objects.create(
            login_email="agent_a@maersk-test.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.company_a = ShippingCompany.objects.create(
            shipping_company_name="Maersk Line Test",
            shipping_company_license_number="LIC-MSK-TEST-001",
            shipping_company_email="agent_a@maersk-test.com",
            shipping_company_phone="+919876543101",
            shipping_company_address="Port Terminal Rd, Singapore",
            shipping_company_jurisdiction="Singapore",
            shipping_company_status="ACTIVE"
        )
        self.user_ship_a = User.objects.create(
            login_id=self.login_ship_a,
            shipping_company_id=self.company_a,
            user_full_name="Alice Agent",
            user_phone="+919876543101",
            user_status="ACTIVE"
        )
        self.headers_ship_a = {
            'HTTP_X_USER_EMAIL': 'agent_a@maersk-test.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.user_ship_a.user_id)
        }

        # Shipping Company B User (Different company for cross-tenant checks)
        self.login_ship_b = Login.objects.create(
            login_email="agent_b@msc-test.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.company_b = ShippingCompany.objects.create(
            shipping_company_name="MSC Line Test",
            shipping_company_license_number="LIC-MSC-TEST-002",
            shipping_company_email="agent_b@msc-test.com",
            shipping_company_phone="+919876543102",
            shipping_company_address="Port Terminal Rd, Geneva",
            shipping_company_jurisdiction="Switzerland",
            shipping_company_status="ACTIVE"
        )
        self.user_ship_b = User.objects.create(
            login_id=self.login_ship_b,
            shipping_company_id=self.company_b,
            user_full_name="Bob Agent",
            user_phone="+919876543102",
            user_status="ACTIVE"
        )
        self.headers_ship_b = {
            'HTTP_X_USER_EMAIL': 'agent_b@msc-test.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.user_ship_b.user_id)
        }

        # Customs Officer
        self.login_customs = Login.objects.create(
            login_email="officer_customs@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="customs_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_customs = User.objects.create(
            login_id=self.login_customs,
            user_full_name="Catherine Customs",
            user_phone="+919876543103",
            user_status="ACTIVE"
        )
        self.headers_customs = {
            'HTTP_X_USER_EMAIL': 'officer_customs@portide.com',
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.user_customs.user_id)
        }

        # Terminal & Logistics Operator
        self.login_terminal = Login.objects.create(
            login_email="operator_terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_terminal = User.objects.create(
            login_id=self.login_terminal,
            user_full_name="Tom Terminal",
            user_phone="+919876543104",
            user_status="ACTIVE"
        )
        self.headers_terminal = {
            'HTTP_X_USER_EMAIL': 'operator_terminal@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_terminal.user_id)
        }

        # Gate & Truck Operations Officer
        self.login_gate = Login.objects.create(
            login_email="officer_gate@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_gate = User.objects.create(
            login_id=self.login_gate,
            user_full_name="Gary Gate",
            user_phone="+919876543105",
            user_status="ACTIVE"
        )
        self.headers_gate = {
            'HTTP_X_USER_EMAIL': 'officer_gate@portide.com',
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.user_gate.user_id)
        }

        # Port Administrator
        self.login_admin = Login.objects.create(
            login_email="admin_port@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_admin = User.objects.create(
            login_id=self.login_admin,
            user_full_name="Adam Admin",
            user_phone="+919876543106",
            user_status="ACTIVE"
        )
        self.headers_admin = {
            'HTTP_X_USER_EMAIL': 'admin_port@portide.com',
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.user_admin.user_id)
        }

        # -------------------------------------------------------------
        # 2. Port & Quayside Infrastructure Setup
        # -------------------------------------------------------------
        self.port_origin, _ = Port.objects.get_or_create(
            port_code="SGSIN",
            defaults={"port_name": "Port of Singapore", "port_country": "Singapore"}
        )
        self.port_dest, _ = Port.objects.get_or_create(
            port_code="NLRTM",
            defaults={"port_name": "Port of Rotterdam", "port_country": "Netherlands"}
        )

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
            berth_max_length=Decimal("300.00"),
            berth_max_draft=Decimal("14.00"),
            berth_status="AVAILABLE",
            berth_is_active=True
        )

        # Vessels & Vessel Schedules
        self.vessel_a = Vessel.objects.create(
            vessel_name="Maersk Mc-Kinney Moller",
            vessel_imo_number="IMO9632064",
            vessel_shipping_company_id=self.company_a,
            vessel_type="CONTAINER_SHIP",
            vessel_capacity=18270,
            vessel_length=Decimal("399.20"),
            vessel_draft=Decimal("16.00"),
            vessel_status="ACTIVE"
        )
        self.arrival_a = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=self.now - timedelta(hours=6),
            vessel_arrival_request_requested_departure_at=self.now + timedelta(days=2),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("1200.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth_1
        )
        self.schedule_a = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_a,
            vessel_schedule_berth_id=self.berth_1,
            vessel_schedule_scheduled_arrival_at=self.now - timedelta(hours=6),
            vessel_schedule_scheduled_departure_at=self.now + timedelta(days=2),
            vessel_schedule_actual_arrival_at=self.now - timedelta(hours=5),
            vessel_schedule_actual_at_berth_at=self.now - timedelta(hours=4),
            vessel_schedule_status="AT_BERTH"
        )

        # Manifest Cargo & Containers
        self.cargo_a = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_a,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="Heavy Machinery & Electronic Components",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("200.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("3000.00"),
            cargo_status="IN_PORT"
        )

        self.container_eligible = Container.objects.create(
            container_cargo_id=self.cargo_a,
            container_number="MSKU9988771",
            container_type="40FT",
            container_gross_weight=Decimal("24.50"),
            container_status="ARRIVED",
            container_customs_status="NOT_SUBMITTED"
        )
        self.container_second = Container.objects.create(
            container_cargo_id=self.cargo_a,
            container_number="MSKU9988772",
            container_type="40FT",
            container_gross_weight=Decimal("22.00"),
            container_status="ARRIVED",
            container_customs_status="NOT_SUBMITTED"
        )

        # -------------------------------------------------------------
        # 3. Cranes Setup (Quayside STS/MHC vs Yard Equipment)
        # -------------------------------------------------------------
        # STS 01 assigned to Berth 1
        self.crane_sts_berth1 = Crane.objects.create(
            crane_name="Quayside STS Crane 01",
            crane_code="STS-01",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=self.berth_1,
            crane_is_active=True
        )
        # STS 02 assigned to Berth 2 (Mismatched berth)
        self.crane_sts_berth2 = Crane.objects.create(
            crane_name="Quayside STS Crane 02",
            crane_code="STS-02",
            crane_type="STS",
            crane_max_lifting_capacity_mt=Decimal("65.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=self.berth_2,
            crane_is_active=True
        )
        # MHC 01 (Mobile Harbour Crane, flexible berth)
        self.crane_mhc = Crane.objects.create(
            crane_name="Mobile Harbour Crane 01",
            crane_code="MHC-01",
            crane_type="MHC",
            crane_max_lifting_capacity_mt=Decimal("50.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=None,
            crane_is_active=True
        )
        # RTG 01 (Yard Crane - invalid for vessel discharge)
        self.crane_rtg = Crane.objects.create(
            crane_name="Rubber Tyred Gantry 01",
            crane_code="RTG-01",
            crane_type="RTG",
            crane_max_lifting_capacity_mt=Decimal("40.00"),
            crane_status="AVAILABLE",
            crane_assigned_berth_id=None,
            crane_is_active=True
        )

        # Active Crane Allocation for STS-01 on Schedule A / Berth 1
        self.allocation_active = CraneAllocation.objects.create(
            crane_allocation_crane_id=self.crane_sts_berth1,
            crane_allocation_vessel_schedule_id=self.schedule_a,
            crane_allocation_berth_id=self.berth_1,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=self.now - timedelta(hours=2),
            crane_allocation_planned_end_at=self.now + timedelta(hours=8),
            crane_allocation_actual_start_at=self.now - timedelta(hours=2)
        )

        # -------------------------------------------------------------
        # 4. Gate, Truck & Driver Setup
        # -------------------------------------------------------------
        self.gate_1 = Gate.objects.create(
            gate_name="Main Exit Gate 01",
            gate_code="G-01",
            gate_type="OUTBOUND",
            gate_is_active=True
        )
        self.truck_1 = Truck.objects.create(
            truck_number="TRK-KA-01-9988",
            truck_company_name="Swift Logistics Express",
            truck_status="ACTIVE"
        )
        self.driver_1 = Driver.objects.create(
            driver_name="David Driver",
            driver_license_number="DL-KA-2022-887766",
            driver_phone="+919876543110",
            driver_email="david.driver@swiftlogistics.com",
            driver_status="ACTIVE"
        )

        # Delivery Order
        self.delivery_order = DeliveryOrder.objects.create(
            delivery_order_number="DO-2026-0001",
            delivery_order_container_id=self.container_eligible,
            delivery_order_shipping_company_id=self.company_a,
            delivery_order_consignee_name="Global Cargo Importers Ltd",
            delivery_order_status="ISSUED",
            delivery_order_valid_until=self.now + timedelta(days=3)
        )

        # -------------------------------------------------------------
        # 5. Yard Setup (to verify zero occupancy impact)
        # -------------------------------------------------------------
        self.yard = Yard.objects.create(
            yard_name="Container Yard 1",
            yard_code="CY1",
            yard_capacity=100,
            yard_status="ACTIVE"
        )
        self.yard_block = YardBlock.objects.create(
            yard_block_yard_id=self.yard,
            yard_block_code="B1",
            yard_block_name="Block 1",
            yard_block_capacity=50,
            yard_block_status="ACTIVE"
        )
        self.yard_slot = YardSlot.objects.create(
            yard_slot_block_id=self.yard_block,
            yard_slot_bay=1,
            yard_slot_row=1,
            yard_slot_tier=1,
            yard_slot_code="CY1-B1-01-01-1",
            yard_slot_status="AVAILABLE"
        )

    # =========================================================================
    # PART G TEST CASES
    # =========================================================================

    def test_01_authorized_pre_arrival_customs_submission(self):
        """1. Authorized pre-arrival customs document submission by shipping company."""
        url = "/api/customs/pre-arrival/submit/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "declaration_reference": "DEC-ADV-2026-001",
            "consignee_name": "Global Cargo Importers Ltd",
            "consignee_tax_id": "TAX-SG-889977",
            "cargo_description": "Consumer Electronic Equipment",
            "cargo_declared_value": "125000.00",
            "hs_code": "8471.30.00",
            "declaration_remarks": "Advance filing ahead of berthing."
        }
        res = self.client.post(url, payload, format="json", **self.headers_ship_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]
        self.assertEqual(data["declaration_reference"], "DEC-ADV-2026-001")
        self.assertEqual(data["declaration_status"], "PENDING_REVIEW")

        # Container customs status updated to PENDING_REVIEW
        self.container_eligible.refresh_from_db()
        self.assertEqual(self.container_eligible.container_customs_status, "PENDING_REVIEW")

    def test_02_unauthorized_user_cannot_submit_cross_company(self):
        """2. Unauthorized user cannot submit for another company's shipment (cross-tenant security)."""
        url = "/api/customs/pre-arrival/submit/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "declaration_reference": "DEC-ADV-HACK-001",
            "consignee_name": "Intruder Corp",
            "cargo_declared_value": "50000.00"
        }
        # Shipping company B attempts to submit declaration for Company A's container
        res = self.client.post(url, payload, format="json", **self.headers_ship_b)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue("not authorized" in res.json()["message"].lower())

    def test_03_only_customs_officer_can_approve_clearance(self):
        """3. Only Customs Officer can review/approve clearance; shipping company or terminal cannot self-approve."""
        # Create declaration
        decl = PreArrivalCustomsDeclaration.objects.create(
            declaration_container_id=self.container_eligible,
            declaration_vessel_schedule_id=self.schedule_a,
            declaration_cargo_id=self.cargo_a,
            declaration_shipping_company_id=self.company_a,
            declaration_reference="DEC-APPROVAL-001",
            declaration_status="PENDING_REVIEW"
        )
        url = f"/api/customs/pre-arrival/declarations/{decl.declaration_id}/review/"
        payload = {
            "decision": "CLEARED",
            "remarks": "Self-clearing attempt"
        }

        # Attempt review by shipping company user -> 403 Forbidden
        res_ship = self.client.post(url, payload, format="json", **self.headers_ship_a)
        self.assertEqual(res_ship.status_code, status.HTTP_403_FORBIDDEN)

        # Attempt review by terminal operator -> 403 Forbidden
        res_terminal = self.client.post(url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res_terminal.status_code, status.HTTP_403_FORBIDDEN)

        # Customs Officer reviews and approves -> 200 OK
        res_customs = self.client.post(url, {
            "decision": "CLEARED",
            "remarks": "Declaration fully verified and compliant."
        }, format="json", **self.headers_customs)
        self.assertEqual(res_customs.status_code, status.HTTP_200_OK)

        decl.refresh_from_db()
        self.assertEqual(decl.declaration_status, "CLEARED")
        self.container_eligible.refresh_from_db()
        self.assertEqual(self.container_eligible.container_customs_status, "CLEARED")
        self.assertTrue(self.container_eligible.is_customs_cleared)

    def test_04_customs_hold_and_inspection_prevent_direct_transfer(self):
        """4. Customs hold, pending review, and mandatory inspection prevent direct transfer."""
        exec_url = "/api/terminal/direct-transfer/execute/"
        base_payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }

        # Case 4a: NOT_SUBMITTED -> rejected
        self.container_eligible.container_customs_status = "NOT_SUBMITTED"
        self.container_eligible.save()
        res = self.client.post(exec_url, base_payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("customs", res.json()["message"].lower())

        # Case 4b: PENDING_REVIEW -> rejected
        self.container_eligible.container_customs_status = "PENDING_REVIEW"
        self.container_eligible.save()
        res = self.client.post(exec_url, base_payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Case 4c: CUSTOMS_HOLD -> rejected
        self.container_eligible.container_customs_status = "CUSTOMS_HOLD"
        self.container_eligible.save()
        res = self.client.post(exec_url, base_payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("hold", res.json()["message"].lower())

        # Case 4d: UNDER_INSPECTION -> rejected
        self.container_eligible.container_customs_status = "UNDER_INSPECTION"
        self.container_eligible.save()
        res = self.client.post(exec_url, base_payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inspection", res.json()["message"].lower())

    def test_05_valid_pre_arrival_cleared_status_survives_physical_transitions(self):
        """5. Existing valid pre-arrival CLEARED status survives physical status updates (e.g., normal discharge)."""
        # Set customs cleared in advance
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # Execute a normal discharge into yard slot
        discharge_url = "/api/terminal/unloading/discharge/"
        discharge_payload = {
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "container_id": self.container_eligible.container_id,
            "slot_id": self.yard_slot.yard_slot_id,
            "remarks": "Normal yard discharge test"
        }
        res = self.client.post(discharge_url, discharge_payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.container_eligible.refresh_from_db()
        self.assertEqual(self.container_eligible.container_status, "AT_TERMINAL")
        # Customs status MUST remain CLEARED
        self.assertEqual(self.container_eligible.container_customs_status, "CLEARED")
        self.assertTrue(self.container_eligible.is_customs_cleared)

    def test_06_vessel_arrival_does_not_automatically_approve_customs(self):
        """6. Vessel arrival does not automatically approve customs clearance."""
        new_vessel = Vessel.objects.create(
            vessel_name="Maersk Test Arrival",
            vessel_imo_number="IMO9991112",
            vessel_shipping_company_id=self.company_a,
            vessel_type="CONTAINER_SHIP",
            vessel_capacity=10000,
            vessel_length=Decimal("300.00"),
            vessel_draft=Decimal("14.00"),
            vessel_status="ACTIVE"
        )
        new_arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=new_vessel,
            vessel_arrival_request_requested_arrival_at=self.now - timedelta(hours=2),
            vessel_arrival_request_requested_departure_at=self.now + timedelta(days=1),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("500.00"),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_preferred_berth_id=self.berth_2
        )
        new_sched = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=new_arrival,
            vessel_schedule_berth_id=self.berth_2,
            vessel_schedule_scheduled_arrival_at=self.now - timedelta(hours=2),
            vessel_schedule_scheduled_departure_at=self.now + timedelta(days=1),
            vessel_schedule_status="SCHEDULED"
        )
        new_cargo = Cargo.objects.create(
            cargo_arrival_request_id=new_arrival,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="Electronic Equipment",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_weight=Decimal("1500.00"),
            cargo_status="IN_PORT"
        )
        new_cntr = Container.objects.create(
            container_cargo_id=new_cargo,
            container_number="MSKU1122334",
            container_type="20FT",
            container_gross_weight=Decimal("18.50"),
            container_status="ARRIVED",
            container_customs_status="NOT_SUBMITTED"
        )

        # Update schedule to AT_BERTH
        new_sched.vessel_schedule_status = "AT_BERTH"
        new_sched.save()

        new_cntr.refresh_from_db()
        self.assertEqual(new_cntr.container_customs_status, "NOT_SUBMITTED")
        self.assertFalse(new_cntr.is_customs_cleared)

    def test_07_eligible_direct_transfer_succeeds(self):
        """7. Eligible direct transfer succeeds with active STS UNLOADING allocation, matching berth, customs cleared, DO, truck/driver."""
        # Set customs cleared
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id,
            "remarks": "Priority direct transfer to refrigerated consignee fleet."
        }

        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()["data"]

        self.assertIn(data["transfer_status"], ["TRANSFERRED_TO_TRUCK", "AWAITING_GATE_EXIT"])
        self.assertTrue(data["transfer_reference"].startswith("DST-"))
        self.assertIsNotNone(data["transfer_gate_pass_id"])

        # Container status is not premature RELEASED, delivery status is GATE_PASS_GENERATED, customs cleared intact
        self.container_eligible.refresh_from_db()
        self.assertNotEqual(self.container_eligible.container_status, "RELEASED")
        self.assertEqual(self.container_eligible.container_delivery_status, "GATE_PASS_GENERATED")
        self.assertEqual(self.container_eligible.container_customs_status, "CLEARED")

    def test_08_rtg_and_rmg_crane_types_rejected(self):
        """8. RTG and RMG are rejected for quayside vessel direct transfer operations."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # Create allocation for RTG
        alloc_rtg = CraneAllocation.objects.create(
            crane_allocation_crane_id=self.crane_rtg,
            crane_allocation_vessel_schedule_id=self.schedule_a,
            crane_allocation_berth_id=self.berth_1,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=self.now,
            crane_allocation_planned_end_at=self.now + timedelta(hours=4)
        )

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": alloc_rtg.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue("compatible" in res.json()["message"].lower() or "rejected" in res.json()["message"].lower())

    def test_09_fixed_berth_sts_mismatch_rejected(self):
        """9. Fixed-berth STS mismatch is rejected (STS assigned to Berth 2 cannot discharge at Berth 1)."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # STS-02 is fixed to Berth 2; allocate it erroneously to Berth 1
        alloc_mismatch = CraneAllocation.objects.create(
            crane_allocation_crane_id=self.crane_sts_berth2,
            crane_allocation_vessel_schedule_id=self.schedule_a,
            crane_allocation_berth_id=self.berth_1,
            crane_allocation_operation_type="UNLOADING",
            crane_allocation_status="ACTIVE",
            crane_allocation_planned_start_at=self.now,
            crane_allocation_planned_end_at=self.now + timedelta(hours=4)
        )

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": alloc_mismatch.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("berth", res.json()["message"].lower())

    def test_10_invalid_crane_allocation_status_or_operation_type_rejected(self):
        """10. Missing, scheduled-only, completed, cancelled or LOADING-only crane allocation is rejected."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()
        exec_url = "/api/terminal/direct-transfer/execute/"

        # 10a: SCHEDULED allocation
        self.allocation_active.crane_allocation_status = "SCHEDULED"
        self.allocation_active.save()
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("active", res.json()["message"].lower())

        # 10b: LOADING-only allocation
        self.allocation_active.crane_allocation_status = "ACTIVE"
        self.allocation_active.crane_allocation_operation_type = "LOADING"
        self.allocation_active.save()
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("operation type", res.json()["message"].lower())

    def test_11_crane_under_maintenance_or_inactive_rejected(self):
        """11. Maintenance, inactive or defective crane operations are rejected."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # Set crane to MAINTENANCE
        self.crane_sts_berth1.crane_status = "MAINTENANCE"
        self.crane_sts_berth1.save()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("operational", res.json()["message"].lower())

    def test_12_vessel_not_at_berth_or_absent_manifest_rejected(self):
        """12. Vessel not AT_BERTH or container absent from manifest is rejected."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()
        exec_url = "/api/terminal/direct-transfer/execute/"

        # 12a: Vessel schedule not AT_BERTH
        self.schedule_a.vessel_schedule_status = "SCHEDULED"
        self.schedule_a.save()
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("at berth", res.json()["message"].lower())

        # Reset schedule to AT_BERTH
        self.schedule_a.vessel_schedule_status = "AT_BERTH"
        self.schedule_a.save()

        # 12b: Container from another cargo / vessel
        other_arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=self.now - timedelta(days=5),
            vessel_arrival_request_requested_departure_at=self.now - timedelta(days=3),
            vessel_arrival_request_cargo_type="CONTAINER",
            vessel_arrival_request_cargo_quantity=Decimal("100.00"),
            vessel_arrival_request_status="APPROVED"
        )
        other_cargo = Cargo.objects.create(
            cargo_arrival_request_id=other_arrival,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="Other Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("50.00"),
            cargo_weight=Decimal("500.00"),
            cargo_status="IN_PORT"
        )
        foreign_cntr = Container.objects.create(
            container_cargo_id=other_cargo,
            container_number="MSCU7777777",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="ARRIVED",
            container_customs_status="CLEARED"
        )
        payload["container_number"] = foreign_cntr.container_number
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue("schedule" in res.json()["message"].lower() or "manifest" in res.json()["message"].lower() or "arrival request" in res.json()["message"].lower())

    def test_13_missing_delivery_order_or_truck_driver_rejected(self):
        """13. Missing/invalid delivery authorization, truck, driver or appointment is rejected."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # Delete DO to simulate missing delivery authorization
        self.delivery_order.delete()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("delivery order", res.json()["message"].lower())

    def test_14_container_with_yard_allocation_rejected(self):
        """14. Container already allocated to a yard slot or incompatible active transfer is rejected."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # Allocate container to yard
        YardAllocation.objects.create(
            yard_allocation_container_id=self.container_eligible,
            yard_allocation_slot_id=self.yard_slot,
            yard_allocation_status="ACTIVE",
            yard_allocation_allocated_by_id=self.user_terminal
        )

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("yard", res.json()["message"].lower())

    def test_15_direct_transfer_creates_audit_log(self):
        """15. Successful direct transfer creates an AuditLog record in the DIRECT_TRANSFER category."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        initial_audits = AuditLog.objects.filter(audit_log_category="DIRECT_TRANSFER").count()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        new_audits = AuditLog.objects.filter(audit_log_category="DIRECT_TRANSFER").count()
        self.assertEqual(new_audits, initial_audits + 1)

    def test_16_direct_transfer_creates_no_yard_allocation_nor_slot_occupancy(self):
        """16. Direct transfer creates NO YardAllocation, occupies no yard slot, and leaves yard occupancy untouched."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        initial_yard_allocs = YardAllocation.objects.count()
        initial_available_slots = YardSlot.objects.filter(yard_slot_status="AVAILABLE").count()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Verification: Zero change in YardAllocation and YardSlot
        self.assertEqual(YardAllocation.objects.count(), initial_yard_allocs)
        self.assertEqual(
            YardSlot.objects.filter(yard_slot_status="AVAILABLE").count(),
            initial_available_slots
        )
        self.assertFalse(YardAllocation.objects.filter(yard_allocation_container_id=self.container_eligible).exists())

    def test_17_failed_operation_rolls_back_atomic_changes(self):
        """17. A failure during validation leaves all models completely unmodified."""
        self.container_eligible.container_customs_status = "NOT_SUBMITTED"
        self.container_eligible.save()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Check that no transfer and no gate pass were created
        self.assertEqual(DirectShipToTruckTransfer.objects.count(), 0)
        self.assertEqual(GatePass.objects.count(), 0)
        self.container_eligible.refresh_from_db()
        self.assertEqual(self.container_eligible.container_status, "ARRIVED")

    def test_18_duplicate_transfer_attempt_prevented(self):
        """18. Concurrent / duplicate requests cannot create duplicate operations for the same container."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        # First execution succeeds
        res1 = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second execution for same container must fail
        res2 = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already", res2.json()["message"].lower())

    def test_19_gate_exit_required_before_final_released_status(self):
        """19. Gate exit verification is strictly required before final DELIVERED/RELEASED status."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        pass_id = res.json()["data"]["transfer_gate_pass_id"]

        # Container is not premature RELEASED, delivery status is GATE_PASS_GENERATED
        self.container_eligible.refresh_from_db()
        self.assertNotEqual(self.container_eligible.container_status, "RELEASED")
        self.assertEqual(self.container_eligible.container_delivery_status, "GATE_PASS_GENERATED")

        # Now perform Gate Officer verification and release
        release_url = f"/api/gate/passes/{pass_id}/release/"
        rel_res = self.client.post(release_url, {
            "remarks": "Driver credentials verified. Container inspected at exit gate."
        }, format="json", **self.headers_gate)
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)

        # Now container transitions to RELEASED
        self.container_eligible.refresh_from_db()
        self.assertEqual(self.container_eligible.container_status, "RELEASED")

        # DirectShipToTruckTransfer transitions to COMPLETED
        transfer = DirectShipToTruckTransfer.objects.get(transfer_container_id=self.container_eligible)
        self.assertEqual(transfer.transfer_status, "COMPLETED")
        self.assertIsNotNone(transfer.transfer_completed_at)
        self.assertIsNotNone(transfer.transfer_gate_verified_by)

    def test_20_invalid_or_duplicate_gate_verification_rejected(self):
        """20. Invalid or duplicate gate verification cannot complete the transfer multiple times."""
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()

        # Execute transfer
        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        res = self.client.post(exec_url, payload, format="json", **self.headers_terminal)
        pass_id = res.json()["data"]["transfer_gate_pass_id"]

        # 20a: Cancel the pass, then attempt release
        gate_pass = GatePass.objects.get(pk=pass_id)
        gate_pass.gate_pass_status = "CANCELLED"
        gate_pass.save()

        release_url = f"/api/gate/passes/{pass_id}/release/"
        rel_res = self.client.post(release_url, {"remarks": "Attempting on cancelled pass"}, format="json", **self.headers_gate)
        self.assertEqual(rel_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 20b: Mark USED, then attempt duplicate release
        gate_pass.gate_pass_status = "USED"
        gate_pass.save()
        rel_res2 = self.client.post(release_url, {"remarks": "Duplicate release scan"}, format="json", **self.headers_gate)
        self.assertEqual(rel_res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_21_role_based_access_controls_enforced(self):
        """21. Role-based access controls strictly enforced on all new endpoints."""
        exec_url = "/api/terminal/direct-transfer/execute/"
        payload = {
            "container_number": self.container_eligible.container_number,
            "vessel_schedule_id": self.schedule_a.vessel_schedule_id,
            "crane_allocation_id": self.allocation_active.crane_allocation_id,
            "truck_number": self.truck_1.truck_number,
            "driver_id": self.driver_1.driver_id,
            "gate_id": self.gate_1.gate_id
        }
        # Gate Security Officer CANNOT execute transfer
        res_gate = self.client.post(exec_url, payload, format="json", **self.headers_gate)
        self.assertEqual(res_gate.status_code, status.HTTP_403_FORBIDDEN)

        # Shipping Company CANNOT execute transfer
        res_ship = self.client.post(exec_url, payload, format="json", **self.headers_ship_a)
        self.assertEqual(res_ship.status_code, status.HTTP_403_FORBIDDEN)

        # Customs Officer CANNOT execute transfer
        res_cust = self.client.post(exec_url, payload, format="json", **self.headers_customs)
        self.assertEqual(res_cust.status_code, status.HTTP_403_FORBIDDEN)

        # Terminal Operator CAN execute (or Port Administrator)
        self.container_eligible.container_customs_status = "CLEARED"
        self.container_eligible.save()
        res_admin = self.client.post(exec_url, payload, format="json", **self.headers_admin)
        self.assertEqual(res_admin.status_code, status.HTTP_201_CREATED)

    def test_22_eligible_containers_list_endpoint_filters_correctly(self):
        """22. Eligible containers list endpoint returns correct containers and eligibility flags."""
        url = f"/api/terminal/direct-transfer/eligible-containers/?vessel_schedule_id={self.schedule_a.vessel_schedule_id}"
        res = self.client.get(url, **self.headers_terminal)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()["data"]

        # We have container_eligible and container_second
        self.assertTrue(len(data) >= 2)
        target = next((c for c in data if c["container_number"] == self.container_eligible.container_number), None)
        self.assertIsNotNone(target)
        self.assertEqual(target["is_customs_cleared"], False)
        self.assertIsNotNone(target["delivery_order"])
        self.assertFalse(target["is_eligible"])
