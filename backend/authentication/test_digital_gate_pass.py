from decimal import Decimal
from unittest.mock import patch
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
    Truck,
    Driver,
    Gate,
    GatePass,
    GatePassContainer,
    AuditLog
)


class DigitalGatePassWorkflowTestCase(TestCase):
    """
    Comprehensive test suite for Digital Gate Pass + QR Verification in PORTIDE.
    Validates all 30 scenarios specified in the system requirements.
    """

    def setUp(self):
        self.client = APIClient()

        # Ports
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
            user_full_name="Chief Port Administrator",
            user_status="ACTIVE"
        )

        # Terminal Operator
        self.login_terminal = Login.objects.create(
            login_email="terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
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

        # Gate & Truck Operations Officer
        self.login_gate = Login.objects.create(
            login_email="gate@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_operations_officer",
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

        # Vessel & Cargo
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
            vessel_arrival_request_reviewed_at=now
        )

        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="Electronic Equipment & Microchips",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1850.00")
        )

        # Master Truck, Driver, and Gate (seeded via migration 0028 or get_or_create)
        self.truck, _ = Truck.objects.get_or_create(
            truck_number="KL-05-AB-7824",
            defaults={
                "truck_company_name": "Kerala Express Logistics",
                "truck_status": "ACTIVE"
            }
        )
        self.driver, _ = Driver.objects.get_or_create(
            driver_license_number="DL-KL-2018-0091823",
            defaults={
                "driver_name": "Arun Thomas",
                "driver_phone": "+91 98471 23456",
                "driver_email": "arun.thomas.portide@gmail.com",
                "driver_status": "ACTIVE"
            }
        )
        self.gate, _ = Gate.objects.get_or_create(
            gate_code="GATE-NORTH-1",
            defaults={
                "gate_name": "Main Freight Gate 1 (North Terminal)",
                "gate_type": "OUTBOUND",
                "gate_is_active": True
            }
        )

    def _create_container(self, number: str, status_str: str) -> Container:
        return Container.objects.create(
            container_cargo_id=self.cargo,
            container_number=number,
            container_type="20FT",
            container_gross_weight=Decimal("18.50"),
            container_status=status_str
        )

    def _create_cleared_container(self, number: str, result="CLEARED", doc_status="VERIFIED") -> Container:
        status_val = "CLEARED" if result == "CLEARED" else "CUSTOMS_HOLD"
        container = self._create_container(number, status_val)
        now = timezone.now()
        CustomsInspection.objects.create(
            customs_inspection_container_id=container,
            customs_inspection_officer_id=self.user_customs,
            customs_inspection_status="COMPLETED",
            customs_inspection_result=result,
            customs_inspection_document_status=doc_status,
            customs_inspection_remarks="Formal customs clearance verification.",
            customs_inspection_started_at=now - timezone.timedelta(hours=2),
            customs_inspection_completed_at=now,
            customs_inspection_clearance_date=now
        )
        return container

    def _auth_gate(self):
        self.client.force_authenticate(user=self.login_gate)
        return {
            "HTTP_X_USER_ROLE": "gate_truck_operations_officer",
            "HTTP_X_USER_EMAIL": self.login_gate.login_email,
            "HTTP_X_USER_ID": str(self.user_gate.user_id)
        }

    # =========================================================================
    # 1. Gate & Truck Officer can assign a driver to a gate movement
    # =========================================================================
    def test_01_gate_officer_can_assign_driver_to_gate_movement(self):
        c = self._create_cleared_container("MSCU8000001")
        headers = self._auth_gate()

        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id],
            "valid_hours": 24,
            "remarks": "Standard gate movement assignment"
        }

        with patch("authentication.email_service.send_mail", return_value=1):
            response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"]["driver"]["driver_name"], "Arun Thomas")
        self.assertEqual(response.data["data"]["driver"]["driver_email"], "arun.thomas.portide@gmail.com")

    # =========================================================================
    # 2. Unauthorized role cannot perform driver assignment
    # =========================================================================
    def test_02_unauthorized_role_cannot_perform_driver_assignment(self):
        c = self._create_cleared_container("MSCU8000002")
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }

        # Shipping Company attempt
        self.client.force_authenticate(user=self.login_shipping)
        res_shipping = self.client.post(
            "/api/gate/passes/generate/",
            data=payload,
            format="json",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_EMAIL=self.login_shipping.login_email,
            HTTP_X_USER_ID=str(self.user_shipping.user_id)
        )
        self.assertEqual(res_shipping.status_code, status.HTTP_403_FORBIDDEN)

        # Customs Officer attempt
        self.client.force_authenticate(user=self.login_customs)
        res_customs = self.client.post(
            "/api/gate/passes/generate/",
            data=payload,
            format="json",
            HTTP_X_USER_ROLE="customs_officer",
            HTTP_X_USER_EMAIL=self.login_customs.login_email,
            HTTP_X_USER_ID=str(self.user_customs.user_id)
        )
        self.assertEqual(res_customs.status_code, status.HTTP_403_FORBIDDEN)

        # Terminal Operator attempt
        self.client.force_authenticate(user=self.login_terminal)
        res_terminal = self.client.post(
            "/api/gate/passes/generate/",
            data=payload,
            format="json",
            HTTP_X_USER_ROLE="terminal_logistics_operator",
            HTTP_X_USER_EMAIL=self.login_terminal.login_email,
            HTTP_X_USER_ID=str(self.user_terminal.user_id)
        )
        self.assertEqual(res_terminal.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 3. CLEARED container can be included
    # =========================================================================
    def test_03_cleared_container_can_be_included(self):
        c = self._create_cleared_container("MSCU8000003")
        headers = self._auth_gate()

        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }

        with patch("authentication.email_service.send_mail", return_value=1):
            response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["data"]["containers"]), 1)
        self.assertEqual(response.data["data"]["containers"][0]["container_number"], "MSCU8000003")

    # =========================================================================
    # 4. REGISTERED container cannot be included
    # =========================================================================
    def test_04_registered_container_cannot_be_included(self):
        c = self._create_container("MSCU8000004", "REGISTERED")
        headers = self._auth_gate()

        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("CLEARED", response.data["message"])

    # =========================================================================
    # 5. ARRIVED container cannot be included
    # =========================================================================
    def test_05_arrived_container_cannot_be_included(self):
        c = self._create_container("MSCU8000005", "ARRIVED")
        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 6. AT_TERMINAL container cannot be included
    # =========================================================================
    def test_06_at_terminal_container_cannot_be_included(self):
        c = self._create_container("MSCU8000006", "AT_TERMINAL")
        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 7. UNDER_INSPECTION container cannot be included
    # =========================================================================
    def test_07_under_inspection_container_cannot_be_included(self):
        c = self._create_container("MSCU8000007", "UNDER_INSPECTION")
        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 8. CUSTOMS_HOLD container cannot be included
    # =========================================================================
    def test_08_customs_hold_container_cannot_be_included(self):
        c = self._create_cleared_container("MSCU8000008", result="HOLD", doc_status="ISSUE_FOUND")
        c.container_status = "CUSTOMS_HOLD"
        c.save()

        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Customs Hold", response.data["message"])

    # =========================================================================
    # 9. Container without verified customs documents cannot be included
    # =========================================================================
    def test_09_unverified_documents_container_cannot_be_included(self):
        c = self._create_cleared_container("MSCU8000009", result="CLEARED", doc_status="PENDING")
        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("VERIFIED", response.data["message"])

    # =========================================================================
    # 10. One gate pass can contain multiple eligible containers
    # =========================================================================
    def test_10_multiple_eligible_containers_in_one_pass(self):
        c1 = self._create_cleared_container("MSCU8000010")
        c2 = self._create_cleared_container("MSCU8000011")
        headers = self._auth_gate()

        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c1.container_id, c2.container_id]
        }

        with patch("authentication.email_service.send_mail", return_value=1):
            response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["data"]["containers"]), 2)
        returned_numbers = [item["container_number"] for item in response.data["data"]["containers"]]
        self.assertIn("MSCU8000010", returned_numbers)
        self.assertIn("MSCU8000011", returned_numbers)

    # =========================================================================
    # 11. Ineligible containers cannot be included (Partial Eligibility)
    # =========================================================================
    def test_11_ineligible_container_blocks_mixed_pass(self):
        c_eligible = self._create_cleared_container("MSCU8000012")
        c_hold = self._create_cleared_container("MSCU8000013", result="HOLD")
        c_hold.container_status = "CUSTOMS_HOLD"
        c_hold.save()

        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c_eligible.container_id, c_hold.container_id]
        }
        response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("MSCU8000013", response.data["message"])

    # =========================================================================
    # 12. Digital Gate Pass is generated successfully
    # =========================================================================
    def test_12_digital_gate_pass_generated_successfully(self):
        c = self._create_cleared_container("MSCU8000014")
        headers = self._auth_gate()
        payload = {
            "truck_id": self.truck.truck_id,
            "driver_id": self.driver.driver_id,
            "gate_id": self.gate.gate_id,
            "container_ids": [c.container_id],
            "valid_hours": 12
        }

        with patch("authentication.email_service.send_mail", return_value=1):
            response = self.client.post("/api/gate/passes/generate/", data=payload, format="json", **headers)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data["data"]
        self.assertTrue(data["gate_pass_pass_number"].startswith("GP-"))
        self.assertTrue(data["gate_pass_movement_number"].startswith("GM-"))
        self.assertEqual(data["gate_pass_status"], "ACTIVE")
        self.assertTrue(data["is_valid"])
        self.assertIn("PORTIDE-GP:", data["gate_pass_qr_code"])
        self.assertTrue(data["qr_svg"].startswith("<svg"))

    # =========================================================================
    # 13. QR verification succeeds for valid ACTIVE pass
    # =========================================================================
    def test_13_qr_verification_succeeds_for_valid_active_pass(self):
        c = self._create_cleared_container("MSCU8000015")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        qr_code = gen_res.data["data"]["gate_pass_qr_code"]

        verify_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"qr_data": qr_code},
            format="json",
            **headers
        )
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data["message"], "VALID DIGITAL GATE PASS")
        self.assertEqual(verify_res.data["data"]["gate_pass_status"], "ACTIVE")

    # =========================================================================
    # 14. Invalid QR/pass fails
    # =========================================================================
    def test_14_invalid_qr_pass_fails(self):
        headers = self._auth_gate()
        verify_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"qr_data": "PORTIDE-GP:GP-2026-99999:VREF-INVALID"},
            format="json",
            **headers
        )
        self.assertEqual(verify_res.status_code, status.HTTP_404_NOT_FOUND)

    # =========================================================================
    # 15. Expired pass fails
    # =========================================================================
    def test_15_expired_pass_fails(self):
        c = self._create_cleared_container("MSCU8000016")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]
        gp = GatePass.objects.get(gate_pass_id=pass_id)
        # Force expiration
        gp.gate_pass_valid_until = timezone.now() - timezone.timedelta(hours=1)
        gp.save()

        verify_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"pass_number": gp.gate_pass_pass_number},
            format="json",
            **headers
        )
        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", verify_res.data["message"].lower())

    # =========================================================================
    # 16. Cancelled pass fails
    # =========================================================================
    def test_16_cancelled_pass_fails(self):
        c = self._create_cleared_container("MSCU8000017")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        # Cancel pass
        self.client.post(f"/api/gate/passes/{pass_id}/cancel/", **headers)

        verify_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"verification_code": gen_res.data["data"]["gate_pass_verification_code"]},
            format="json",
            **headers
        )
        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelled", verify_res.data["message"].lower())

    # =========================================================================
    # 17. Used pass fails on reuse
    # =========================================================================
    def test_17_used_pass_fails_on_reuse(self):
        c = self._create_cleared_container("MSCU8000018")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        # First release consumes pass
        rel_res = self.client.post(f"/api/gate/passes/{pass_id}/release/", data={}, format="json", **headers)
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)

        # Attempt to reuse pass for release
        reuse_res = self.client.post(f"/api/gate/passes/{pass_id}/release/", data={}, format="json", **headers)
        self.assertEqual(reuse_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("USED", reuse_res.data["message"])

        # Attempt to verify used pass
        verify_used = self.client.post(
            "/api/gate/passes/verify/",
            data={"pass_number": gen_res.data["data"]["gate_pass_pass_number"]},
            format="json",
            **headers
        )
        self.assertEqual(verify_used.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already used", verify_used.data["message"].lower())

    # =========================================================================
    # 18. Truck mismatch fails
    # =========================================================================
    def test_18_truck_mismatch_fails_release(self):
        c = self._create_cleared_container("MSCU8000019")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        # Officer provides different physical truck
        rel_res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={"truck_number": "KA-01-XX-9999"},
            format="json",
            **headers
        )
        self.assertEqual(rel_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Truck mismatch", rel_res.data["message"])

    # =========================================================================
    # 19. Driver mismatch fails
    # =========================================================================
    def test_19_driver_mismatch_fails_release(self):
        c = self._create_cleared_container("MSCU8000020")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        rel_res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={"driver_name": "Different Driver"},
            format="json",
            **headers
        )
        self.assertEqual(rel_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Driver mismatch", rel_res.data["message"])

    # =========================================================================
    # 20. Gate mismatch fails
    # =========================================================================
    def test_20_gate_mismatch_fails_release(self):
        c = self._create_cleared_container("MSCU8000021")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        rel_res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={"gate_name": "Commercial Exit Gate 2 (East Terminal)"},
            format="json",
            **headers
        )
        self.assertEqual(rel_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Gate mismatch", rel_res.data["message"])

    # =========================================================================
    # 21. Valid gate pass allows release
    # =========================================================================
    def test_21_valid_gate_pass_allows_release(self):
        c = self._create_cleared_container("MSCU8000022")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        rel_res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={
                "truck_number": self.truck.truck_number,
                "driver_name": self.driver.driver_name,
                "gate_name": self.gate.gate_name,
                "remarks": "Gate clearance verified, physical seal intact."
            },
            format="json",
            **headers
        )
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rel_res.data["status"], "success")

    # =========================================================================
    # 22. Successful release changes container: CLEARED → RELEASED
    # =========================================================================
    def test_22_successful_release_changes_container_status_to_released(self):
        c = self._create_cleared_container("MSCU8000023")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        self.client.post(f"/api/gate/passes/{pass_id}/release/", data={}, format="json", **headers)

        c.refresh_from_db()
        self.assertEqual(c.container_status, "RELEASED")

        # Verify GateRelease entry created
        release = GateRelease.objects.filter(gate_release_container_id=c).first()
        self.assertIsNotNone(release)
        self.assertEqual(release.gate_release_new_status, "RELEASED")
        self.assertEqual(release.gate_release_truck_number, self.truck.truck_number)

    # =========================================================================
    # 23. Successful release changes pass: ACTIVE → USED
    # =========================================================================
    def test_23_successful_release_changes_pass_status_to_used(self):
        c = self._create_cleared_container("MSCU8000024")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        self.client.post(f"/api/gate/passes/{pass_id}/release/", data={}, format="json", **headers)

        gp = GatePass.objects.get(gate_pass_id=pass_id)
        self.assertEqual(gp.gate_pass_status, "USED")
        self.assertIsNotNone(gp.gate_pass_used_at)

    # =========================================================================
    # 24. Driver receives automatic email when pass is generated
    # =========================================================================
    def test_24_driver_receives_automatic_email_on_generation(self):
        c = self._create_cleared_container("MSCU8000025")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1) as mock_send:
            res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_send.called)
        call_args = mock_send.call_args[1]
        self.assertEqual(call_args["recipient_list"], [self.driver.driver_email])
        self.assertIn("PORTIDE – Digital Gate Pass", call_args["subject"])

        gp = GatePass.objects.get(gate_pass_id=res.data["data"]["gate_pass_id"])
        self.assertEqual(gp.gate_pass_email_status, "SENT")
        self.assertIsNotNone(gp.gate_pass_email_sent_at)

    # =========================================================================
    # 25. Email failure is handled correctly
    # =========================================================================
    def test_25_email_failure_handled_safely(self):
        c = self._create_cleared_container("MSCU8000026")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", side_effect=Exception("SMTP Connection Timed Out")):
            res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )

        # Gate pass is preserved safely
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data["email_dispatched"])
        self.assertIsNotNone(res.data["email_warning"])

        gp = GatePass.objects.get(gate_pass_id=res.data["data"]["gate_pass_id"])
        self.assertEqual(gp.gate_pass_email_status, "FAILED")
        self.assertIn("SMTP Connection Timed Out", gp.gate_pass_email_error)

    # =========================================================================
    # 26. Shipping Company cannot bypass gate release
    # =========================================================================
    def test_26_shipping_company_cannot_bypass_gate_release(self):
        c = self._create_cleared_container("MSCU8000027")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        self.client.force_authenticate(user=self.login_shipping)
        res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={},
            format="json",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_EMAIL=self.login_shipping.login_email,
            HTTP_X_USER_ID=str(self.user_shipping.user_id)
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 27. Customs Officer cannot bypass gate release
    # =========================================================================
    def test_27_customs_officer_cannot_bypass_gate_release(self):
        c = self._create_cleared_container("MSCU8000028")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        self.client.force_authenticate(user=self.login_customs)
        res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={},
            format="json",
            HTTP_X_USER_ROLE="customs_officer",
            HTTP_X_USER_EMAIL=self.login_customs.login_email,
            HTTP_X_USER_ID=str(self.user_customs.user_id)
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 28. Terminal Operator cannot bypass gate release
    # =========================================================================
    def test_28_terminal_operator_cannot_bypass_gate_release(self):
        c = self._create_cleared_container("MSCU8000029")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        self.client.force_authenticate(user=self.login_terminal)
        res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={},
            format="json",
            HTTP_X_USER_ROLE="terminal_logistics_operator",
            HTTP_X_USER_EMAIL=self.login_terminal.login_email,
            HTTP_X_USER_ID=str(self.user_terminal.user_id)
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 29. Gate & Truck Officer can perform authorized operations
    # =========================================================================
    def test_29_gate_officer_full_authorized_operations(self):
        c = self._create_cleared_container("MSCU8000030")
        headers = self._auth_gate()

        # Step 1: Assign driver & generate pass
        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        self.assertEqual(gen_res.status_code, status.HTTP_201_CREATED)
        pass_id = gen_res.data["data"]["gate_pass_id"]
        vcode = gen_res.data["data"]["gate_pass_verification_code"]

        # Step 2: Verify QR code
        ver_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"verification_code": vcode},
            format="json",
            **headers
        )
        self.assertEqual(ver_res.status_code, status.HTTP_200_OK)

        # Step 3: Final gate release
        rel_res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={"remarks": "Officer authorized terminal departure."},
            format="json",
            **headers
        )
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.container_status, "RELEASED")

    # =========================================================================
    # 30. Port Administrator can view gate-pass information
    # =========================================================================
    def test_30_port_administrator_can_view_gate_pass_information(self):
        c = self._create_cleared_container("MSCU8000031")
        headers = self._auth_gate()

        with patch("authentication.email_service.send_mail", return_value=1):
            gen_res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id]
                },
                format="json",
                **headers
            )
        pass_id = gen_res.data["data"]["gate_pass_id"]

        # Port Administrator views pass
        self.client.force_authenticate(user=self.login_admin)
        view_res = self.client.get(
            f"/api/gate/passes/{pass_id}/",
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_EMAIL=self.login_admin.login_email,
            HTTP_X_USER_ID=str(self.user_admin.user_id)
        )
        self.assertEqual(view_res.status_code, status.HTTP_200_OK)
        self.assertEqual(view_res.data["data"]["gate_pass_id"], pass_id)
        self.assertEqual(view_res.data["data"]["truck"]["truck_number"], self.truck.truck_number)
        self.assertEqual(view_res.data["data"]["driver"]["driver_name"], self.driver.driver_name)
        self.assertEqual(len(view_res.data["data"]["containers"]), 1)

    # =========================================================================
    # 31. Complete Digital Gate Pass Email + QR Verification & Release Workflow
    # =========================================================================
    def test_31_digital_gate_pass_email_qr_image_and_full_workflow(self):
        """
        Validates the entire 11-step requirement:
        1. Generate a new Gate Pass.
        2. Confirm email contains visible actual QR code image and required text.
        3. Confirm QR code has secure token and no personal leaks.
        4. Scan the QR code.
        5. Confirm PORTIDE resolves correct Gate Pass with all verified details.
        6. Confirm scanning alone does NOT consume the pass.
        7. Authorize gate exit.
        8. Confirm Gate Pass becomes USED.
        9. Confirm container becomes RELEASED.
        10. Scan the same QR again.
        11. Confirm reuse is rejected with clear message.
        """
        c = self._create_cleared_container("MSCU8000031")
        headers = self._auth_gate()

        # Step 1: Generate Gate Pass and capture emailed content
        with patch("authentication.email_service.send_mail", return_value=1) as mock_send:
            res = self.client.post(
                "/api/gate/passes/generate/",
                data={
                    "truck_id": self.truck.truck_id,
                    "driver_id": self.driver.driver_id,
                    "gate_id": self.gate.gate_id,
                    "container_ids": [c.container_id],
                    "valid_hours": 24,
                    "remarks": "Priority port outbound clearance."
                },
                format="json",
                **headers
            )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        pass_data = res.data["data"]
        pass_id = pass_data["gate_pass_id"]
        pass_number = pass_data["gate_pass_pass_number"]
        qr_payload = pass_data["gate_pass_qr_code"]

        # Step 2: Confirm email contains actual embedded QR code image & required texts
        self.assertTrue(mock_send.called)
        mail_kwargs = mock_send.call_args[1]
        html_content = mail_kwargs["html_message"]
        text_content = mail_kwargs["message"]

        self.assertIn('<img src="cid:gate_pass_qr_code"', html_content)
        self.assertIn("inline_images", mail_kwargs)
        self.assertEqual(mail_kwargs["inline_images"][0][0], "gate_pass_qr_code")
        self.assertIn("Present this QR Code at the designated port gate", html_content)
        self.assertIn("The Gate &amp; Truck Operations Officer will scan the QR code", html_content)
        self.assertIn("This pass is valid only for the assigned driver, truck, authorized container(s)", html_content)
        self.assertIn(self.truck.truck_number, html_content)
        self.assertIn(self.driver.driver_name, html_content)
        self.assertIn(self.driver.driver_license_number, html_content)
        self.assertIn(self.driver.driver_license_number, text_content)
        self.assertIn(self.gate.gate_name, html_content)
        self.assertIn(c.container_number, html_content)
        self.assertIn("CLEARED &bull; AUTHORIZED", html_content)

        # Step 3: Confirm QR payload has secure token and no personal credentials
        self.assertTrue(qr_payload.startswith("PORTIDE-GP:"))
        self.assertIn(pass_number, qr_payload)
        self.assertIn("VREF-", qr_payload)
        self.assertNotIn(self.driver.driver_license_number, qr_payload)
        self.assertNotIn(self.driver.driver_email, qr_payload)

        # Step 4 & 5: Scan the QR code and confirm PORTIDE resolves the Gate Pass
        verify_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"qr_data": qr_payload, "gate_id": self.gate.gate_id},
            format="json",
            **headers
        )
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_res.data["status"], "success")
        self.assertEqual(verify_res.data["message"], "VALID DIGITAL GATE PASS")
        verified_pass = verify_res.data["data"]
        self.assertEqual(verified_pass["gate_pass_pass_number"], pass_number)
        self.assertEqual(verified_pass["truck"]["truck_number"], self.truck.truck_number)
        self.assertEqual(verified_pass["driver"]["driver_name"], self.driver.driver_name)
        self.assertEqual(verified_pass["gate"]["gate_name"], self.gate.gate_name)
        self.assertEqual(verified_pass["containers"][0]["container_number"], c.container_number)
        self.assertEqual(verified_pass["gate_pass_status"], "ACTIVE")

        # Step 6: Confirm scanning alone does NOT consume the pass
        gp_fresh = GatePass.objects.get(gate_pass_id=pass_id)
        self.assertEqual(gp_fresh.gate_pass_status, "ACTIVE")
        self.assertIsNone(gp_fresh.gate_pass_used_at)
        c.refresh_from_db()
        self.assertEqual(c.container_status, "CLEARED")

        # Step 7: Authorize gate exit
        release_res = self.client.post(
            f"/api/gate/passes/{pass_id}/release/",
            data={"remarks": "Physical verification completed at exit gate."},
            format="json",
            **headers
        )
        self.assertEqual(release_res.status_code, status.HTTP_200_OK)
        self.assertEqual(release_res.data["status"], "success")

        # Step 8 & 9: Confirm Gate Pass becomes USED and container becomes RELEASED
        gp_fresh.refresh_from_db()
        self.assertEqual(gp_fresh.gate_pass_status, "USED")
        self.assertIsNotNone(gp_fresh.gate_pass_used_at)
        c.refresh_from_db()
        self.assertEqual(c.container_status, "RELEASED")
        release_obj = GateRelease.objects.filter(gate_release_gate_pass_id=gp_fresh, gate_release_container_id=c).first()
        self.assertIsNotNone(release_obj)
        self.assertIsNotNone(release_obj.gate_release_time)

        # Step 10 & 11: Scan the same QR again and confirm reuse is strictly rejected
        reuse_verify_res = self.client.post(
            "/api/gate/passes/verify/",
            data={"qr_data": qr_payload},
            format="json",
            **headers
        )
        self.assertEqual(reuse_verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(reuse_verify_res.data["status"], "error")
        self.assertIn("already used", reuse_verify_res.data["message"].lower())
        self.assertIn("cannot be reused", reuse_verify_res.data["message"].lower())

