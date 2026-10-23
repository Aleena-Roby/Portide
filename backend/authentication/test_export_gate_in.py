from decimal import Decimal
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
    VesselSchedule,
    Berth,
    Cargo,
    Port,
    Container,
    Gate,
    Truck,
    Driver,
    GateIn,
    ContainerTrackingEvent,
    Yard,
    YardBlock,
    YardSlot,
    YardAllocation,
    AuditLog
)


class ExportGateInWorkflowTestCase(TestCase):
    """
    Test suite for Phase 2: Export Truck Gate-In in PORTIDE.
    Validates that authorized Gate Officers can record the physical arrival of an external
    drayage truck delivering an export container into the port prior to yard allocation.
    """

    def setUp(self):
        self.client = APIClient()

        # Ports
        self.port_origin, _ = Port.objects.get_or_create(
            port_code="INBOM",
            defaults={"port_name": "Mumbai Port", "port_country": "India", "port_country_code": "IN"}
        )
        self.port_dest, _ = Port.objects.get_or_create(
            port_code="SGSIN",
            defaults={"port_name": "Port of Singapore", "port_country": "Singapore", "port_country_code": "SG"}
        )

        # Shipping Company & Agent
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Evergreen Ocean Marine",
            shipping_company_license_number="LIC-EGM-2026",
            shipping_company_email="agent@evergreen.com",
            shipping_company_phone="+919876543001",
            shipping_company_address="Marine Lines, Mumbai",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_shipping = Login.objects.create(
            login_email="agent@evergreen.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_shipping = User.objects.create(
            login_id=self.login_shipping,
            shipping_company_id=self.company,
            user_full_name="Evergreen Agent",
            user_status="ACTIVE"
        )

        # Gate Officer
        self.login_gate = Login.objects.create(
            login_email="gate.officer@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_gate = User.objects.create(
            login_id=self.login_gate,
            user_full_name="Rajesh Gate Officer",
            user_employee_id="EMP-GATE-101",
            user_department="Gate Operations",
            user_status="ACTIVE"
        )

        # Port Administrator
        self.login_admin = Login.objects.create(
            login_email="admin@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_admin = User.objects.create(
            login_id=self.login_admin,
            user_full_name="Chief Port Admin",
            user_status="ACTIVE"
        )

        # Customs Officer (Unauthorized for Gate-In)
        self.login_customs = Login.objects.create(
            login_email="customs@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="customs_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_customs = User.objects.create(
            login_id=self.login_customs,
            user_full_name="Customs Officer",
            user_status="ACTIVE"
        )

        # Terminal Operator (Unauthorized for Gate-In)
        self.login_terminal = Login.objects.create(
            login_email="terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_terminal = User.objects.create(
            login_id=self.login_terminal,
            user_full_name="Terminal Operator",
            user_status="ACTIVE"
        )

        # Vessel & Voyage Arrival Request
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="EVER FORWARD",
            vessel_imo_number="IMO9871234",
            vessel_call_sign="EVFWD",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Panama",
            vessel_length=Decimal("300.00"),
            vessel_draft=Decimal("12.50"),
            vessel_capacity=5000,
            vessel_status="ACTIVE"
        )

        now = timezone.now()
        self.arrival_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_cargo_type="CONTAINERIZED",
            vessel_arrival_request_cargo_quantity=Decimal("100"),
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=4),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_reviewed_by=self.user_gate,
            vessel_arrival_request_reviewed_at=now
        )

        self.berth = Berth.objects.create(
            berth_name="Quay Berth 01",
            berth_code="QB-01",
            berth_type="CONTAINER_TERMINAL",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("15.50"),
            berth_status="OCCUPIED",
            berth_is_active=True
        )

        self.schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_request,
            vessel_schedule_berth_id=self.berth,
            vessel_schedule_scheduled_arrival_at=now + timezone.timedelta(days=2),
            vessel_schedule_scheduled_departure_at=now + timezone.timedelta(days=4),
            vessel_schedule_status="AT_BERTH"
        )

        # Export Cargo
        self.export_cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="High-Precision Machinery Components",
            cargo_type="CONTAINERIZED",
            cargo_direction="EXPORT",
            cargo_quantity=Decimal("1.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("22.50")
        )

        # Export Container in REGISTERED status
        self.export_container = Container.objects.create(
            container_cargo_id=self.export_cargo,
            container_number="EMCU9123456",
            container_type="40FT",
            container_gross_weight=Decimal("22.50"),
            container_status="REGISTERED",
            container_customs_status="NOT_SUBMITTED"
        )

        # Import Cargo & Container for negative test
        self.import_cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_origin_port_id=self.port_dest,
            cargo_destination_port_id=self.port_origin,
            cargo_description="Imported Electronics",
            cargo_type="CONTAINERIZED",
            cargo_direction="IMPORT",
            cargo_quantity=Decimal("1.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("15.00")
        )
        self.import_container = Container.objects.create(
            container_cargo_id=self.import_cargo,
            container_number="MEDU1234567",
            container_type="20FT",
            container_gross_weight=Decimal("15.00"),
            container_status="REGISTERED"
        )

        # Gate
        self.gate, _ = Gate.objects.get_or_create(
            gate_code="GATE-EXP-01",
            defaults={
                "gate_name": "Export Freight Dedicated Gate 1",
                "gate_type": "INBOUND",
                "gate_is_active": True
            }
        )

        # Storage Yard structure (to verify no side effects on occupancy)
        self.yard, _ = Yard.objects.get_or_create(
            yard_code="CY-EXP-01",
            defaults={"yard_name": "Export Container Yard 1", "yard_type": "CONTAINER_YARD", "yard_status": "ACTIVE"}
        )
        self.block, _ = YardBlock.objects.get_or_create(
            yard_block_code="EXP-B1",
            yard_block_yard_id=self.yard,
            defaults={"yard_block_name": "Block 1", "yard_block_capacity": 50}
        )
        self.slot, _ = YardSlot.objects.get_or_create(
            yard_slot_block_id=self.block,
            yard_slot_code="EXP-B1-01-01-1",
            defaults={"yard_slot_bay": 1, "yard_slot_row": 1, "yard_slot_tier": 1, "yard_slot_status": "AVAILABLE"}
        )

    def _auth_gate(self):
        return {
            "HTTP_X_USER_ROLE": "gate_truck_officer",
            "HTTP_X_USER_ID": str(self.login_gate.login_id),
            "HTTP_X_USER_EMAIL": self.login_gate.login_email
        }

    def _auth_admin(self):
        return {
            "HTTP_X_USER_ROLE": "port_administrator",
            "HTTP_X_USER_ID": str(self.login_admin.login_id),
            "HTTP_X_USER_EMAIL": self.login_admin.login_email
        }

    def _auth_shipping(self):
        return {
            "HTTP_X_USER_ROLE": "shipping_company",
            "HTTP_X_USER_ID": str(self.login_shipping.login_id),
            "HTTP_X_USER_EMAIL": self.login_shipping.login_email
        }

    def _auth_customs(self):
        return {
            "HTTP_X_USER_ROLE": "customs_officer",
            "HTTP_X_USER_ID": str(self.login_customs.login_id),
            "HTTP_X_USER_EMAIL": self.login_customs.login_email
        }

    def _auth_terminal(self):
        return {
            "HTTP_X_USER_ROLE": "terminal_operator",
            "HTTP_X_USER_ID": str(self.login_terminal.login_id),
            "HTTP_X_USER_EMAIL": self.login_terminal.login_email
        }

    # -------------------------------------------------------------------------
    # TEST 1: SUCCESSFUL EXPORT GATE-IN BY GATE OFFICER
    # -------------------------------------------------------------------------
    def test_01_gate_officer_successful_export_gate_in(self):
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "truck_company": "FastLogistics Freight Ltd",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "driver_phone": "+919876543322",
            "gate_id": self.gate.gate_id,
            "seal_number": "SEAL-EXP-889911",
            "remarks": "Container arrived with seal intact, no structural damage."
        }

        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "success")

        # Verify container status advanced from REGISTERED to ARRIVED
        self.export_container.refresh_from_db()
        self.assertEqual(self.export_container.container_status, "ARRIVED")

        # Verify GateIn record created
        gate_in = GateIn.objects.filter(gate_in_container_id=self.export_container).first()
        self.assertIsNotNone(gate_in)
        self.assertEqual(gate_in.gate_in_truck_number, "MH-04-AB-1234")
        self.assertEqual(gate_in.gate_in_driver_name, "Suresh Kumar")
        self.assertEqual(gate_in.gate_in_driver_license, "DL-MH-2015-889900")
        self.assertEqual(gate_in.gate_in_seal_number, "SEAL-EXP-889911")
        self.assertEqual(gate_in.gate_in_previous_status, "REGISTERED")
        self.assertEqual(gate_in.gate_in_new_status, "ARRIVED")
        self.assertEqual(gate_in.gate_in_officer_id, self.user_gate)

        # Verify ContainerTrackingEvent created
        event = ContainerTrackingEvent.objects.filter(
            tracking_event_container_id=self.export_container,
            tracking_event_status="GATE_IN"
        ).first()
        self.assertIsNotNone(event)
        self.assertIn("Export container arrived and gated into port terminal", event.tracking_event_description)

        # Verify AuditLog created
        audit = AuditLog.objects.filter(
            audit_log_action="EXPORT_GATE_IN",
            audit_log_target_id=str(self.export_container.container_id)
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.audit_log_category, "GATE_OPERATIONS")

    # -------------------------------------------------------------------------
    # TEST 2: PORT ADMINISTRATOR CAN PERFORM EXPORT GATE-IN
    # -------------------------------------------------------------------------
    def test_02_port_administrator_can_perform_export_gate_in(self):
        payload = {
            "container_number": "EMCU9123456",
            "truck_number": "MH-02-CD-5678",
            "driver_name": "Ramesh Patel",
            "driver_license": "DL-GJ-2017-112233",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_admin())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.export_container.refresh_from_db()
        self.assertEqual(self.export_container.container_status, "ARRIVED")

    # -------------------------------------------------------------------------
    # TEST 3: UNAUTHORIZED ROLE - SHIPPING COMPANY MUST NOT SELF-CONFIRM ARRIVAL
    # -------------------------------------------------------------------------
    def test_03_unauthorized_role_shipping_company_denied(self):
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_shipping())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.export_container.refresh_from_db()
        self.assertEqual(self.export_container.container_status, "REGISTERED")
        self.assertEqual(GateIn.objects.count(), 0)

    # -------------------------------------------------------------------------
    # TEST 4: UNAUTHORIZED ROLE - CUSTOMS OFFICER DENIED
    # -------------------------------------------------------------------------
    def test_04_unauthorized_role_customs_officer_denied(self):
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_customs())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # TEST 5: UNAUTHORIZED ROLE - TERMINAL OPERATOR DENIED
    # -------------------------------------------------------------------------
    def test_05_unauthorized_role_terminal_operator_denied(self):
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_terminal())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # TEST 6: REJECT NON-EXPORT (IMPORT) CONTAINER
    # -------------------------------------------------------------------------
    def test_06_non_export_import_container_rejected(self):
        payload = {
            "container_id": self.import_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not an export container", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 7: REJECT DUPLICATE GATE-IN
    # -------------------------------------------------------------------------
    def test_07_duplicate_gate_in_rejected(self):
        # Initial gate-in
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        res1 = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second attempt must be rejected as duplicate
        res2 = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Duplicate Gate-In", res2.data["message"])

    # -------------------------------------------------------------------------
    # TEST 8: REJECT CONTAINER ALREADY AT TERMINAL (YARD ALLOCATED)
    # -------------------------------------------------------------------------
    def test_08_already_at_terminal_rejected(self):
        self.export_container.container_status = "AT_TERMINAL"
        self.export_container.save(update_fields=["container_status"])

        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already at terminal", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 9: REJECT CONTAINER ALREADY LOADED ON VESSEL
    # -------------------------------------------------------------------------
    def test_09_already_loaded_rejected(self):
        self.export_container.container_status = "LOADED"
        self.export_container.save(update_fields=["container_status"])

        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been loaded", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 10: REJECT CONTAINER ALREADY RELEASED
    # -------------------------------------------------------------------------
    def test_10_already_released_rejected(self):
        self.export_container.container_status = "RELEASED"
        self.export_container.save(update_fields=["container_status"])

        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been released", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 11: REJECT CONTAINER WITH UNAPPROVED VOYAGE REQUEST
    # -------------------------------------------------------------------------
    def test_11_unapproved_voyage_arrival_request_rejected(self):
        self.arrival_request.vessel_arrival_request_status = "PENDING"
        self.arrival_request.save(update_fields=["vessel_arrival_request_status"])

        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("approved voyage request is required", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 12: REJECT CONTAINER WITH DEPARTED VOYAGE SCHEDULE
    # -------------------------------------------------------------------------
    def test_12_departed_or_cancelled_voyage_rejected(self):
        self.schedule.vessel_schedule_status = "DEPARTED"
        self.schedule.save(update_fields=["vessel_schedule_status"])

        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("departed or cancelled", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 13: REJECT MISSING OR INVALID TRUCK/DRIVER DATA
    # -------------------------------------------------------------------------
    def test_13_missing_or_invalid_truck_driver_data_rejected(self):
        # Missing truck number
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        res = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing driver name
        payload["truck_number"] = "MH-04-AB-1234"
        payload["driver_name"] = ""
        res = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing driver license
        payload["driver_name"] = "Suresh Kumar"
        payload["driver_license"] = ""
        res = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # TEST 14: REJECT SUSPENDED DRIVER
    # -------------------------------------------------------------------------
    def test_14_suspended_driver_rejected(self):
        Driver.objects.create(
            driver_name="Suspended Driver",
            driver_license_number="DL-SUSPENDED-99",
            driver_phone="+919999999999",
            driver_email="suspended@driver.com",
            driver_status="SUSPENDED"
        )
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suspended Driver",
            "driver_license": "DL-SUSPENDED-99",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("suspended", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 15: REJECT TRUCK UNDER MAINTENANCE
    # -------------------------------------------------------------------------
    def test_15_maintenance_truck_rejected(self):
        Truck.objects.create(
            truck_number="MH-04-MAINT-01",
            truck_company_name="Logistics Corp",
            truck_status="MAINTENANCE"
        )
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-MAINT-01",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("under maintenance", response.data["message"])

    # -------------------------------------------------------------------------
    # TEST 16: STRICT VERIFICATION - NO YARD OCCUPANCY OR ALLOCATION OCCURS
    # -------------------------------------------------------------------------
    def test_16_no_yard_occupancy_or_allocation_side_effects(self):
        alloc_count_before = YardAllocation.objects.count()
        slot_status_before = self.slot.yard_slot_status

        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        response = self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        alloc_count_after = YardAllocation.objects.count()
        self.slot.refresh_from_db()
        self.export_container.refresh_from_db()

        # Strict assertion: Zero yard allocations created
        self.assertEqual(alloc_count_before, alloc_count_after)
        # Strict assertion: Yard slot remains untouched
        self.assertEqual(self.slot.yard_slot_status, slot_status_before)
        # Strict assertion: Container storage_status is NOT_ALLOCATED
        self.assertEqual(self.export_container.storage_status, "NOT_ALLOCATED")

    # -------------------------------------------------------------------------
    # TEST 17: ELIGIBLE EXPORT CONTAINERS WORKLIST
    # -------------------------------------------------------------------------
    def test_17_eligible_export_containers_worklist_filtering(self):
        response = self.client.get("/api/gate/export/containers/", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")

        container_numbers = [c["container_number"] for c in response.data["data"]]
        # Export container in REGISTERED status must be present
        self.assertIn("EMCU9123456", container_numbers)
        # Import container must NOT be in the export gate-in list
        self.assertNotIn("MEDU1234567", container_numbers)

        # After gate-in, it should disappear from the awaiting gate-in list
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id
        }
        self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())

        response2 = self.client.get("/api/gate/export/containers/", **self._auth_gate())
        container_numbers_after = [c["container_number"] for c in response2.data["data"]]
        self.assertNotIn("EMCU9123456", container_numbers_after)

    # -------------------------------------------------------------------------
    # TEST 18: GATE-IN AUDIT HISTORY ENDPOINT
    # -------------------------------------------------------------------------
    def test_18_gate_in_history_audit_endpoint(self):
        payload = {
            "container_id": self.export_container.container_id,
            "truck_number": "MH-04-AB-1234",
            "driver_name": "Suresh Kumar",
            "driver_license": "DL-MH-2015-889900",
            "gate_id": self.gate.gate_id,
            "seal_number": "SEAL-XYZ-123"
        }
        self.client.post("/api/gate/export-gate-in/", payload, format="json", **self._auth_gate())

        response = self.client.get("/api/gate/gate-in-history/", **self._auth_gate())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)

        first_rec = response.data["data"][0]
        self.assertEqual(first_rec["container_number"], "EMCU9123456")
        self.assertEqual(first_rec["gate_in_truck_number"], "MH-04-AB-1234")
        self.assertEqual(first_rec["gate_in_driver_name"], "Suresh Kumar")
        self.assertEqual(first_rec["gate_in_seal_number"], "SEAL-XYZ-123")
        self.assertEqual(first_rec["officer_name"], "Rajesh Gate Officer")
