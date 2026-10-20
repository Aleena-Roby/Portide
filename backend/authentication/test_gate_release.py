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
    Cargo,
    Port,
    Container,
    CustomsInspection,
    GateRelease,
    AuditLog
)
from authentication.serializers import ContainerSerializer


class GateTruckOperationsReleaseTestCase(TestCase):
    """
    Test suite for Gate & Truck Operations workflow in PORTIDE (CLEARED -> RELEASED).
    Tests all 12 scenarios required by the specification.
    """

    def setUp(self):
        self.client = APIClient()

        # Master Ports
        self.port_origin, _ = Port.objects.get_or_create(
            port_code="SGSIN",
            defaults={"port_name": "Port of Singapore", "port_country": "Singapore", "port_country_code": "SG"}
        )
        self.port_dest, _ = Port.objects.get_or_create(
            port_code="INBOM",
            defaults={"port_name": "Mumbai Port", "port_country": "India", "port_country_code": "IN"}
        )

        # Shipping Company & Agent
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Oceanic Logistics Ltd",
            shipping_company_license_number="LIC-OCN-2026",
            shipping_company_email="agent@oceanic.com",
            shipping_company_phone="+919876543000",
            shipping_company_address="Harbor Road, Mumbai",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_shipping = Login.objects.create(
            login_email="agent@oceanic.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_shipping = User.objects.create(
            login_id=self.login_shipping,
            shipping_company_id=self.company,
            user_full_name="Rajesh Shipping Agent",
            user_status="ACTIVE"
        )

        # Terminal Operator
        self.login_terminal = Login.objects.create(
            login_email="terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_terminal = User.objects.create(
            login_id=self.login_terminal,
            user_full_name="Anil Terminal Operator",
            user_status="ACTIVE"
        )

        # Customs Officer
        self.login_customs = Login.objects.create(
            login_email="customs@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="customs_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_customs = User.objects.create(
            login_id=self.login_customs,
            user_full_name="Pooja Customs Officer",
            user_employee_id="EMP-CUST-007",
            user_department="Customs & Border Control",
            user_status="ACTIVE"
        )

        # Port Operations Officer
        self.login_ops = Login.objects.create(
            login_email="ops@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_ops = User.objects.create(
            login_id=self.login_ops,
            user_full_name="Vikram Port Ops",
            user_employee_id="EMP-OPS-001",
            user_department="Operations Control",
            user_status="ACTIVE"
        )

        # Gate & Truck Operations Officer
        self.login_gate = Login.objects.create(
            login_email="gate@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_gate = User.objects.create(
            login_id=self.login_gate,
            user_full_name="Ramesh Gate Officer",
            user_employee_id="EMP-GATE-011",
            user_department="Gate Logistics & Trucking",
            user_status="ACTIVE"
        )

        # Vessel & Arrival Request
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="MV Ocean Trader",
            vessel_imo_number="IMO9876543",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Panama",
            vessel_call_sign="3E2911",
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
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_reviewed_by=self.user_ops,
            vessel_arrival_request_reviewed_at=now
        )

        # Containerized Cargo
        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="High-Tech Electronics & Components",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1850.00")
        )

        # Standard valid truck release payload
        self.valid_release_payload = {
            "truck_number": "MH-04-AZ-9921",
            "driver_name": "Sunil Sharma",
            "driver_license": "DL-MH-2019-881234",
            "exit_point": "Main Freight Gate 1 (North Terminal)",
            "remarks": "Driver ID verified, seal intact."
        }

    def _create_container(self, container_number: str, container_status: str) -> Container:
        return Container.objects.create(
            container_cargo_id=self.cargo,
            container_number=container_number,
            container_type="20FT",
            container_gross_weight=Decimal("18.50"),
            container_status=container_status
        )

    def _create_cleared_container(self, container_number: str) -> Container:
        """Helper to create a container that has passed customs inspection and is CLEARED."""
        container = self._create_container(container_number, "CLEARED")
        now = timezone.now()
        CustomsInspection.objects.create(
            customs_inspection_container_id=container,
            customs_inspection_officer_id=self.user_customs,
            customs_inspection_status="COMPLETED",
            customs_inspection_result="CLEARED",
            customs_inspection_document_status="VERIFIED",
            customs_inspection_remarks="Documentation verified, seal intact. Formal clearance granted.",
            customs_inspection_started_at=now - timezone.timedelta(hours=2),
            customs_inspection_completed_at=now,
            customs_inspection_clearance_date=now
        )
        return container

    # =========================================================================
    # Test 1: CLEARED → RELEASED succeeds for Gate & Truck Officer
    # =========================================================================
    def test_01_cleared_to_released_succeeds_for_gate_truck_officer(self):
        container = self._create_cleared_container("MSCU1000001")

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["status"], "success")

        # Container status is now RELEASED
        container.refresh_from_db()
        self.assertEqual(container.container_status, "RELEASED")

        # GateRelease record is created
        release = GateRelease.objects.filter(gate_release_container_id=container).first()
        self.assertIsNotNone(release)
        self.assertEqual(release.gate_release_previous_status, "CLEARED")
        self.assertEqual(release.gate_release_new_status, "RELEASED")
        self.assertEqual(release.gate_release_truck_number, "MH-04-AZ-9921")
        self.assertEqual(release.gate_release_driver_name, "Sunil Sharma")
        self.assertEqual(release.gate_release_driver_license, "DL-MH-2019-881234")
        self.assertEqual(release.gate_release_exit_point, "Main Freight Gate 1 (North Terminal)")
        self.assertEqual(release.gate_release_officer_id, self.user_gate)

    # =========================================================================
    # Test 2: REGISTERED → RELEASED fails
    # =========================================================================
    def test_02_registered_to_released_fails(self):
        container = self._create_container("MSCU1000002", "REGISTERED")

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "REGISTERED")
        self.assertFalse(GateRelease.objects.filter(gate_release_container_id=container).exists())

    # =========================================================================
    # Test 3: ARRIVED → RELEASED fails
    # =========================================================================
    def test_03_arrived_to_released_fails(self):
        container = self._create_container("MSCU1000003", "ARRIVED")

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "ARRIVED")
        self.assertFalse(GateRelease.objects.filter(gate_release_container_id=container).exists())

    # =========================================================================
    # Test 4: AT_TERMINAL → RELEASED fails
    # =========================================================================
    def test_04_at_terminal_to_released_fails(self):
        container = self._create_container("MSCU1000004", "AT_TERMINAL")

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "AT_TERMINAL")
        self.assertFalse(GateRelease.objects.filter(gate_release_container_id=container).exists())

    # =========================================================================
    # Test 5: UNDER_INSPECTION → RELEASED fails
    # =========================================================================
    def test_05_under_inspection_to_released_fails(self):
        container = self._create_container("MSCU1000005", "UNDER_INSPECTION")
        CustomsInspection.objects.create(
            customs_inspection_container_id=container,
            customs_inspection_officer_id=self.user_customs,
            customs_inspection_status="IN_PROGRESS",
            customs_inspection_result="PENDING",
            customs_inspection_document_status="PENDING",
            customs_inspection_started_at=timezone.now()
        )

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "UNDER_INSPECTION")
        self.assertFalse(GateRelease.objects.filter(gate_release_container_id=container).exists())

    # =========================================================================
    # Test 6: CUSTOMS_HOLD → RELEASED fails
    # =========================================================================
    def test_06_customs_hold_to_released_fails(self):
        container = self._create_container("MSCU1000006", "CUSTOMS_HOLD")
        CustomsInspection.objects.create(
            customs_inspection_container_id=container,
            customs_inspection_officer_id=self.user_customs,
            customs_inspection_status="ON_HOLD",
            customs_inspection_result="HOLD",
            customs_inspection_document_status="ISSUE_FOUND",
            customs_inspection_hold_reason="PHYSICAL_MISMATCH",
            customs_inspection_remarks="Discrepancy in seal number."
        )

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Customs Hold", response.data.get("message", ""))
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CUSTOMS_HOLD")
        self.assertFalse(GateRelease.objects.filter(gate_release_container_id=container).exists())

    # =========================================================================
    # Test 7: Customs Officer cannot release a container
    # =========================================================================
    def test_07_customs_officer_cannot_release_container(self):
        container = self._create_cleared_container("MSCU1000007")

        self.client.force_authenticate(user=self.login_customs)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="customs_officer",
            HTTP_X_USER_EMAIL=self.login_customs.login_email,
            HTTP_X_USER_ID=str(self.user_customs.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CLEARED")

    # =========================================================================
    # Test 8: Terminal Operator cannot release a container
    # =========================================================================
    def test_08_terminal_operator_cannot_release_container(self):
        container = self._create_cleared_container("MSCU1000008")

        self.client.force_authenticate(user=self.login_terminal)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="terminal_operator",
            HTTP_X_USER_EMAIL=self.login_terminal.login_email,
            HTTP_X_USER_ID=str(self.user_terminal.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CLEARED")

    # =========================================================================
    # Test 9: Shipping Company cannot release a container
    # =========================================================================
    def test_09_shipping_company_cannot_release_container(self):
        container = self._create_cleared_container("MSCU1000009")

        self.client.force_authenticate(user=self.login_shipping)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_EMAIL=self.login_shipping.login_email,
            HTTP_X_USER_ID=str(self.user_shipping.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CLEARED")

    # =========================================================================
    # Test 10: Missing required truck/gate information fails validation
    # =========================================================================
    def test_10_missing_required_truck_gate_information_fails_validation(self):
        container = self._create_cleared_container("MSCU1000010")

        self.client.force_authenticate(user=self.login_gate)

        # Missing truck_number
        invalid_payload_1 = {
            "driver_name": "Sunil Sharma",
            "driver_license": "DL-MH-2019-881234",
            "exit_point": "Main Freight Gate 1"
        }
        res1 = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=invalid_payload_1,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("truck_number", res1.data.get("errors", {}))

        # Missing driver_name
        invalid_payload_2 = {
            "truck_number": "MH-04-AZ-9921",
            "driver_license": "DL-MH-2019-881234",
            "exit_point": "Main Freight Gate 1"
        }
        res2 = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=invalid_payload_2,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("driver_name", res2.data.get("errors", {}))

        # Missing driver_license
        invalid_payload_3 = {
            "truck_number": "MH-04-AZ-9921",
            "driver_name": "Sunil Sharma",
            "exit_point": "Main Freight Gate 1"
        }
        res3 = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=invalid_payload_3,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("driver_license", res3.data.get("errors", {}))

        # Container remains CLEARED
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CLEARED")

    # =========================================================================
    # Test 11: Successful release creates an audit record
    # =========================================================================
    def test_11_successful_release_creates_audit_record(self):
        container = self._create_cleared_container("MSCU1000011")

        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # AuditLog record in GATE_OPERATIONS category
        audit_log = AuditLog.objects.filter(
            audit_log_target_id=str(container.container_id),
            audit_log_category="GATE_OPERATIONS",
            audit_log_action="RELEASE_CONTAINER"
        ).first()

        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.audit_log_role, "Gate & Truck Operations Officer")
        self.assertIn("MH-04-AZ-9921", audit_log.audit_log_description)
        self.assertIn("Sunil Sharma", audit_log.audit_log_description)
        self.assertEqual(audit_log.audit_log_status, "SUCCESS")

        # Database GateRelease record verification
        gate_rel = GateRelease.objects.filter(gate_release_container_id=container).first()
        self.assertIsNotNone(gate_rel)
        self.assertEqual(gate_rel.gate_release_officer_id, self.user_gate)
        self.assertEqual(gate_rel.gate_release_previous_status, "CLEARED")
        self.assertEqual(gate_rel.gate_release_new_status, "RELEASED")

    # =========================================================================
    # Test 12: Lifecycle correctly displays Step 6/6 after release
    # =========================================================================
    def test_12_lifecycle_correctly_displays_step_6_of_6_after_release(self):
        container = self._create_cleared_container("MSCU1000012")

        # Prior to release: Status is CLEARED (Step 5 of 6)
        serializer_before = ContainerSerializer(container)
        self.assertEqual(serializer_before.data["container_status"], "CLEARED")
        self.assertIsNone(serializer_before.data["gate_release"])

        # Execute Gate Release
        self.client.force_authenticate(user=self.login_gate)
        response = self.client.post(
            f"/api/containers/{container.container_id}/release/",
            data=self.valid_release_payload,
            format="json",
            HTTP_X_USER_ROLE="gate_truck_officer",
            HTTP_X_USER_EMAIL=self.login_gate.login_email,
            HTTP_X_USER_ID=str(self.user_gate.user_id)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # After release: Status is RELEASED (Step 6 of 6)
        container.refresh_from_db()
        serializer_after = ContainerSerializer(container)
        self.assertEqual(serializer_after.data["container_status"], "RELEASED")

        # Check gate_release object in serialized response
        gate_rel_data = serializer_after.data["gate_release"]
        self.assertIsNotNone(gate_rel_data)
        self.assertEqual(gate_rel_data["truck_number"], "MH-04-AZ-9921")
        self.assertEqual(gate_rel_data["driver_name"], "Sunil Sharma")
        self.assertEqual(gate_rel_data["exit_point"], "Main Freight Gate 1 (North Terminal)")
        self.assertEqual(gate_rel_data["new_status"], "RELEASED")
        self.assertEqual(gate_rel_data["officer_name"], "Ramesh Gate Officer")

        # Verify lifecycle stage definition logic (equivalent to Step 6/6)
        LIFECYCLE_SEQUENCE = [
            'REGISTERED',
            'ARRIVED',
            'AT_TERMINAL',
            'UNDER_INSPECTION',
            'CLEARED',
            'RELEASED'
        ]
        status_step_number = LIFECYCLE_SEQUENCE.index(container.container_status) + 1
        self.assertEqual(status_step_number, 6)
        self.assertEqual(f"Step {status_step_number}/{len(LIFECYCLE_SEQUENCE)}", "Step 6/6")
