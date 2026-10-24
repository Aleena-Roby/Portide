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
    Berth,
    VesselSchedule,
    Cargo,
    Port,
    AuditLog
)


class CargoRegistrationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 0. Master Ports
        self.port_singapore, _ = Port.objects.get_or_create(
            port_code="SGSIN",
            defaults={"port_name": "Port of Singapore", "port_country": "Singapore", "port_country_code": "SG"}
        )
        self.port_mumbai, _ = Port.objects.get_or_create(
            port_code="INBOM",
            defaults={"port_name": "Mumbai Port", "port_country": "India", "port_country_code": "IN"}
        )
        self.port_rotterdam, _ = Port.objects.get_or_create(
            port_code="NLRTM",
            defaults={"port_name": "Port of Rotterdam", "port_country": "Netherlands", "port_country_code": "NL"}
        )
        self.port_dubai, _ = Port.objects.get_or_create(
            port_code="AEJEA",
            defaults={"port_name": "Port of Jebel Ali", "port_country": "United Arab Emirates", "port_country_code": "AE"}
        )

        # 1. Company A & User A
        self.company_a = ShippingCompany.objects.create(
            shipping_company_name="Maersk Line India",
            shipping_company_license_number="LIC-MAE-001",
            shipping_company_email="agent@maersk.com",
            shipping_company_phone="+919876543210",
            shipping_company_address="Navi Mumbai Port Gateway",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_a = Login.objects.create(
            login_email="agent@maersk.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_a = User.objects.create(
            login_id=self.login_a,
            shipping_company_id=self.company_a,
            user_full_name="Maersk Shipping Agent",
            user_status="ACTIVE"
        )

        # 2. Company B & User B
        self.company_b = ShippingCompany.objects.create(
            shipping_company_name="CMA CGM Logistics",
            shipping_company_license_number="LIC-CMA-002",
            shipping_company_email="agent@cmacgm.com",
            shipping_company_phone="+919876543211",
            shipping_company_address="JNPT Terminal 2",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_b = Login.objects.create(
            login_email="agent@cmacgm.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_b = User.objects.create(
            login_id=self.login_b,
            shipping_company_id=self.company_b,
            user_full_name="CMA CGM Agent",
            user_status="ACTIVE"
        )

        # 3. Vessels
        self.vessel_a = Vessel.objects.create(
            vessel_shipping_company_id=self.company_a,
            vessel_name="MV Maersk Pelican",
            vessel_imo_number="9123456",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Denmark",
            vessel_length=Decimal("250.00"),
            vessel_draft=Decimal("11.50"),
            vessel_capacity=4500,
            vessel_status="ACTIVE"
        )

        self.vessel_b = Vessel.objects.create(
            vessel_shipping_company_id=self.company_b,
            vessel_name="MV CMA CGM Vasco",
            vessel_imo_number="9654321",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="France",
            vessel_length=Decimal("280.00"),
            vessel_draft=Decimal("12.00"),
            vessel_capacity=6000,
            vessel_status="ACTIVE"
        )

        # 4. Arrival Requests
        now = timezone.now()
        self.arrival_a = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("1200.00"),
            vessel_arrival_request_status="APPROVED"
        )

        self.arrival_b = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_b,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=4),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=5),
            vessel_arrival_request_cargo_type="Bulk Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("3000.00"),
            vessel_arrival_request_status="PENDING"
        )

    def test_01_authorized_shipping_company_create_cargo(self):
        """Authorized shipping company can create Cargo for its own APPROVED Arrival Request."""
        payload = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Consumer Electronics and Automobile Parts",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 450,
            "cargo_unit": "TEU",
            "cargo_weight": 5400.50,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "success")
        cargo_data = response.data["data"]
        self.assertEqual(cargo_data["cargo_description"], "Consumer Electronics and Automobile Parts")
        self.assertEqual(cargo_data["cargo_status"], "REGISTERED")
        self.assertEqual(cargo_data["cargo_type"], "CONTAINERIZED")
        self.assertEqual(Decimal(str(cargo_data["cargo_quantity"])), Decimal("450.00"))
        self.assertEqual(cargo_data["cargo_quantity_display"], "450")
        self.assertEqual(cargo_data["cargo_weight_display"], "5400.50")
        self.assertEqual(cargo_data["cargo_origin_port_id"], self.port_singapore.port_id)
        self.assertEqual(cargo_data["cargo_destination_port_id"], self.port_mumbai.port_id)

        # Check normalization: read-only arrival_request_summary
        self.assertIn("arrival_request_summary", cargo_data)
        summary = cargo_data["arrival_request_summary"]
        self.assertEqual(summary["vessel_name"], "MV Maersk Pelican")
        self.assertEqual(summary["vessel_imo_number"], "9123456")
        self.assertEqual(summary["company_name"], "Maersk Line India")

        # Verify database record
        cargo_record = Cargo.objects.get(cargo_id=cargo_data["cargo_id"])
        self.assertEqual(cargo_record.vessel.vessel_name, "MV Maersk Pelican")
        self.assertEqual(cargo_record.shipping_company.shipping_company_name, "Maersk Line India")
        self.assertEqual(cargo_record.cargo_origin_port_id, self.port_singapore)
        self.assertEqual(cargo_record.cargo_destination_port_id, self.port_mumbai)

    def test_02_shipping_company_cannot_create_cargo_for_another_company(self):
        """Shipping Company cannot create Cargo for another company's Arrival Request."""
        # Approve arrival_b for company B first to isolate RBAC check
        self.arrival_b.vessel_arrival_request_status = "APPROVED"
        self.arrival_b.save()

        payload = {
            "cargo_arrival_request_id": self.arrival_b.vessel_arrival_request_id,  # Belongs to Company B!
            "cargo_description": "Illegal Attempt Cargo",
            "cargo_type": "GENERAL_CARGO",
            "cargo_quantity": 100,
            "cargo_unit": "UNITS",
            "cargo_weight": 200.00,
            "cargo_origin_port_id": self.port_dubai.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        # Company A attempts to register against Company B's arrival request
        response = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["status"], "error")
        self.assertIn("not authorized", response.data["message"].lower())
        self.assertFalse(Cargo.objects.filter(cargo_description="Illegal Attempt Cargo").exists())

    def test_03_invalid_arrival_request_rejected(self):
        """Invalid or non-existent Arrival Request is rejected."""
        payload = {
            "cargo_arrival_request_id": 9999999,  # Does not exist
            "cargo_description": "Non-existent AR Cargo",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 500,
            "cargo_unit": "TONNES",
            "cargo_weight": 1000.00,
            "cargo_origin_port_id": self.port_rotterdam.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")

    def test_04_required_field_validation(self):
        """Missing required fields fail validation."""
        payload_no_desc = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "   ",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 10,
            "cargo_unit": "TEU",
            "cargo_weight": 50.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload_no_desc,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_description", response.data["errors"])

    def test_05_quantity_and_weight_positive_validation(self):
        """Zero or negative quantity and weight must be rejected."""
        payload_bad_qty = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Test Zero Quantity",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 0,  # Invalid <= 0
            "cargo_unit": "TEU",
            "cargo_weight": 50.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload_bad_qty,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_quantity", response.data["errors"])

        payload_neg_weight = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Test Negative Weight",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 50,
            "cargo_unit": "TEU",
            "cargo_weight": -10.5,  # Invalid <= 0
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload_neg_weight,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_weight", response.data["errors"])

    def test_06_cargo_type_validation(self):
        """Arbitrary invalid cargo types are rejected."""
        payload_bad_type = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Weird Cargo",
            "cargo_type": "INVALID_ALIEN_TYPE",
            "cargo_quantity": 10,
            "cargo_unit": "TEU",
            "cargo_weight": 50.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload_bad_type,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_type", response.data["errors"])

    def test_07_shipping_company_only_views_own_cargo(self):
        """Shipping Company can view only its own cargo; query results are isolated."""
        cargo_a = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_a,
            cargo_description="Maersk Cargo Item",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_rotterdam,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )
        cargo_b = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_b,
            cargo_description="CMA CGM Cargo Item",
            cargo_type="BULK_CARGO",
            cargo_quantity=Decimal("2000.00"),
            cargo_unit="TONNES",
            cargo_weight=Decimal("2000.00"),
            cargo_origin_port_id=self.port_dubai,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # Company A gets cargo list
        response_a = self.client.get(
            "/api/cargo/",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(response_a.status_code, status.HTTP_200_OK)
        ids_a = [c["cargo_id"] for c in response_a.data["data"]]
        self.assertIn(cargo_a.cargo_id, ids_a)
        self.assertNotIn(cargo_b.cargo_id, ids_a)

        # Company A attempts to get Company B's cargo detail
        detail_res = self.client.get(
            f"/api/cargo/{cargo_b.cargo_id}/",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(detail_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_08_cargo_edit_workflow_restrictions(self):
        """Shipping company can edit registered cargo, but cannot edit completed cargo."""
        cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_a,
            cargo_description="Original Cargo Description",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("50.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("600.00"),
            cargo_origin_port_id=self.port_dubai,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # Valid edit
        edit_res = self.client.patch(
            f"/api/cargo/{cargo.cargo_id}/",
            data={"cargo_description": "Updated Cargo Description", "cargo_quantity": 60},
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(edit_res.status_code, status.HTTP_200_OK)
        cargo.refresh_from_db()
        self.assertEqual(cargo.cargo_description, "Updated Cargo Description")
        self.assertEqual(cargo.cargo_quantity, Decimal("60.00"))

        # Cannot edit if completed
        cargo.cargo_status = "COMPLETED"
        cargo.save()

        blocked_edit = self.client.patch(
            f"/api/cargo/{cargo.cargo_id}/",
            data={"cargo_description": "Attempt to edit completed cargo"},
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(blocked_edit.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be edited", blocked_edit.data["message"].lower())

    def test_09_audit_log_created_for_cargo_actions(self):
        """Cargo creation creates an AuditLog record in the CARGO category."""
        payload = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Audited Cargo Shipment",
            "cargo_type": "GENERAL_CARGO",
            "cargo_quantity": 25,
            "cargo_unit": "TONNES",
            "cargo_weight": 25.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cargo_id = response.data["data"]["cargo_id"]

        audit_entry = AuditLog.objects.filter(
            audit_log_category="CARGO",
            audit_log_action="CREATE",
            audit_log_target_id=str(cargo_id)
        ).first()
        self.assertIsNotNone(audit_entry)
        self.assertEqual(audit_entry.audit_log_status, "SUCCESS")

    def test_10_cargo_origin_destination_same_port_rejected(self):
        """Origin and Destination ports cannot be identical."""
        payload = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Same Port Cargo Attempt",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 50,
            "cargo_unit": "TEU",
            "cargo_weight": 600.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_singapore.port_id  # SAME!
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_destination_port_id", response.data["errors"])

    def test_11_cargo_unit_type_compatibility_enforced(self):
        """Cargo unit must match cargo type requirements."""
        # 1. CONTAINERIZED with TONNES should fail
        payload_invalid_unit = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Containers measured in Tonnes",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 50,
            "cargo_unit": "TONNES",  # Invalid for CONTAINERIZED (requires TEU/FEU)
            "cargo_weight": 600.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res1 = self.client.post(
            "/api/cargo/",
            data=payload_invalid_unit,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_unit", res1.data["errors"])

        # 2. BULK_CARGO with TEU should fail
        payload_bulk_teu = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Bulk Iron Ore in TEU",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 100,
            "cargo_unit": "TEU",  # Invalid for BULK_CARGO (requires TONNES/KG)
            "cargo_weight": 2000.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res2 = self.client.post(
            "/api/cargo/",
            data=payload_bulk_teu,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_unit", res2.data["errors"])

        # 3. BULK_CARGO with KG should succeed
        payload_bulk_kg = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Bulk Grain in KG",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 50000,
            "cargo_unit": "KG",
            "cargo_weight": 50.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res3 = self.client.post(
            "/api/cargo/",
            data=payload_bulk_kg,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

    def test_12_non_approved_arrival_request_rejected(self):
        """Cargo registration must be rejected if Arrival Request is not APPROVED."""
        # Create a PENDING arrival request for Company A's vessel
        now = timezone.now()
        pending_arrival = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=10),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=11),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("500.00"),
            vessel_arrival_request_status="PENDING"
        )

        payload = {
            "cargo_arrival_request_id": pending_arrival.vessel_arrival_request_id,
            "cargo_description": "Pending Arrival Request Cargo",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 100,
            "cargo_unit": "TEU",
            "cargo_weight": 1200.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }

        response = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("APPROVED", response.data["message"])

    def test_13_port_list_api(self):
        """Ports API returns active ports and supports search."""
        response = self.client.get("/api/ports/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 4)

        search_res = self.client.get("/api/ports/?search=Singapore")
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertEqual(search_res.data["data"][0]["port_code"], "SGSIN")

    def test_14_case1_pending_request_excluded_and_rejected(self):
        """CASE 1: PENDING request -> Not shown in eligible dropdown -> Cannot register cargo."""
        now = timezone.now()
        pending_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("300.00"),
            vessel_arrival_request_status="PENDING"
        )

        # 1. Verify excluded from eligible cargo dropdown endpoint
        res_eligible = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_eligible.status_code, status.HTTP_200_OK)
        ids = [r["vessel_arrival_request_id"] for r in res_eligible.data["data"]]
        self.assertNotIn(pending_req.vessel_arrival_request_id, ids)

        # 2. Verify backend rejects cargo registration attempt
        payload = {
            "cargo_arrival_request_id": pending_req.vessel_arrival_request_id,
            "cargo_description": "Attempt on Pending Request",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 50,
            "cargo_unit": "TEU",
            "cargo_weight": 500.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_post = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_post.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("APPROVED", res_post.data["message"])

    def test_15_case2_rejected_request_excluded_and_rejected(self):
        """CASE 2: REJECTED request -> Not shown in eligible dropdown -> Cannot register cargo."""
        now = timezone.now()
        rejected_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("300.00"),
            vessel_arrival_request_status="REJECTED"
        )

        # 1. Verify excluded from eligible requests list
        res_eligible = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_eligible.status_code, status.HTTP_200_OK)
        ids = [r["vessel_arrival_request_id"] for r in res_eligible.data["data"]]
        self.assertNotIn(rejected_req.vessel_arrival_request_id, ids)

        # 2. Verify backend rejects registration
        payload = {
            "cargo_arrival_request_id": rejected_req.vessel_arrival_request_id,
            "cargo_description": "Attempt on Rejected Request",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 50,
            "cargo_unit": "TEU",
            "cargo_weight": 500.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_post = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_post.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("APPROVED", res_post.data["message"])

    def test_16_case3_approved_request_before_departure_allowed(self):
        """CASE 3: APPROVED request before departure -> Shown -> Cargo registration allowed."""
        now = timezone.now()
        active_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("500.00"),
            vessel_arrival_request_status="APPROVED"
        )

        # 1. Verify shown in eligible list with valid serializer flags
        res_eligible = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_eligible.status_code, status.HTTP_200_OK)
        matching = [r for r in res_eligible.data["data"] if r["vessel_arrival_request_id"] == active_req.vessel_arrival_request_id]
        self.assertEqual(len(matching), 1)
        self.assertTrue(matching[0]["is_cargo_eligible"])
        self.assertFalse(matching[0]["is_expired"])
        self.assertEqual(matching[0]["vessel_arrival_request_status"], "APPROVED")

        # 2. Verify registration allowed
        payload = {
            "cargo_arrival_request_id": active_req.vessel_arrival_request_id,
            "cargo_description": "Valid Active Consignment",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 250,
            "cargo_unit": "TEU",
            "cargo_weight": 2500.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_post = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_post.data["data"]["cargo_arrival_request_id"], active_req.vessel_arrival_request_id)

    def test_17_case4_approved_request_after_departure_excluded_and_rejected(self):
        """CASE 4: APPROVED request after arrival deadline -> Not shown -> Backend rejects registration."""
        now = timezone.now()
        # Scheduled in the past
        expired_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now - timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("600.00"),
            vessel_arrival_request_status="APPROVED"
        )

        # 1. Verify excluded from eligible cargo list
        res_eligible = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_eligible.status_code, status.HTTP_200_OK)
        ids = [r["vessel_arrival_request_id"] for r in res_eligible.data["data"]]
        self.assertNotIn(expired_req.vessel_arrival_request_id, ids)

        # 2. Verify flags in general list
        res_all = self.client.get(
            "/api/arrival-requests/",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        matching = [r for r in res_all.data["data"] if r["vessel_arrival_request_id"] == expired_req.vessel_arrival_request_id]
        self.assertEqual(len(matching), 1)
        self.assertTrue(matching[0]["is_expired"])
        self.assertFalse(matching[0]["is_cargo_eligible"])
        self.assertEqual(matching[0]["vessel_arrival_request_status"], "APPROVED")

        # 3. Verify backend rejects cargo registration with clear expiration message
        payload = {
            "cargo_arrival_request_id": expired_req.vessel_arrival_request_id,
            "cargo_description": "Attempt on Expired Request",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 100,
            "cargo_unit": "TEU",
            "cargo_weight": 1000.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_post = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_post.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("scheduled vessel arrival time has passed", res_post.data["message"])

    def test_18_case5_another_shipping_company_request_rejected(self):
        """CASE 5: Approved request belonging to another Shipping Company -> Not shown -> Backend rejects."""
        # Ensure arrival_b belongs to Company B and is APPROVED
        self.arrival_b.vessel_arrival_request_status = "APPROVED"
        self.arrival_b.save()

        # 1. Company A checks eligible requests - should not see Company B's request
        res_eligible = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        ids = [r["vessel_arrival_request_id"] for r in res_eligible.data["data"]]
        self.assertNotIn(self.arrival_b.vessel_arrival_request_id, ids)

        # 2. Company A attempts to register cargo against Company B's arrival request
        payload = {
            "cargo_arrival_request_id": self.arrival_b.vessel_arrival_request_id,
            "cargo_description": "Unauthorized Cross-Company Cargo",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 100,
            "cargo_unit": "TEU",
            "cargo_weight": 1000.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_post = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("another company", res_post.data["message"])

    def test_19_case6_multi_company_isolation(self):
        """CASE 6: Two shipping companies have different approved requests -> Each sees only its own."""
        # Ensure both companies have approved requests before departure
        self.arrival_b.vessel_arrival_request_status = "APPROVED"
        self.arrival_b.save()

        res_a = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        res_b = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_b.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_b.login_id)
        )

        ids_a = {r["vessel_arrival_request_id"] for r in res_a.data["data"]}
        ids_b = {r["vessel_arrival_request_id"] for r in res_b.data["data"]}

        self.assertIn(self.arrival_a.vessel_arrival_request_id, ids_a)
        self.assertNotIn(self.arrival_b.vessel_arrival_request_id, ids_a)

        self.assertIn(self.arrival_b.vessel_arrival_request_id, ids_b)
        self.assertNotIn(self.arrival_a.vessel_arrival_request_id, ids_b)

        # Disjoint sets
        self.assertTrue(ids_a.isdisjoint(ids_b))

    def test_20_case7_request_expires_while_page_open_rejected(self):
        """CASE 7: Request expires while page is already open -> Submission still rejected by backend."""
        now = timezone.now()
        # Create request expiring 1 second from now
        fast_expiring_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(seconds=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("400.00"),
            vessel_arrival_request_status="APPROVED"
        )

        # Fast forward request expiration by setting arrival in the past
        fast_expiring_req.vessel_arrival_request_requested_arrival_at = timezone.now() - timezone.timedelta(seconds=5)
        fast_expiring_req.save()

        # Submit cargo registration
        payload = {
            "cargo_arrival_request_id": fast_expiring_req.vessel_arrival_request_id,
            "cargo_description": "Late Submission After Arrival",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 100,
            "cargo_unit": "TEU",
            "cargo_weight": 1000.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("scheduled vessel arrival time has passed", res.data["message"])

        # Consignment must not have been created
        self.assertFalse(Cargo.objects.filter(cargo_arrival_request_id=fast_expiring_req).exists())

    def test_21_case8_refresh_after_expiration_removes_from_eligible_list(self):
        """CASE 8: Refresh after expiration -> Expired request no longer selectable, historical status preserved."""
        now = timezone.now()
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(hours=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(hours=5),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("400.00"),
            vessel_arrival_request_status="APPROVED"
        )

        # Before expiration: in eligible list
        res_before = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        ids_before = [r["vessel_arrival_request_id"] for r in res_before.data["data"]]
        self.assertIn(req.vessel_arrival_request_id, ids_before)

        # Expire request by moving requested arrival to past
        req.vessel_arrival_request_requested_arrival_at = timezone.now() - timezone.timedelta(minutes=10)
        req.save()

        # After refresh: no longer in eligible list
        res_after = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        ids_after = [r["vessel_arrival_request_id"] for r in res_after.data["data"]]
        self.assertNotIn(req.vessel_arrival_request_id, ids_after)

    def test_22_scheduled_arrival_time_used_over_requested_arrival_time(self):
        """Precedence: VesselSchedule scheduled arrival takes precedence over requested arrival."""
        now = timezone.now()
        berth = Berth.objects.create(
            berth_name="Test Berth 1",
            berth_code="TB1",
            berth_type="CONTAINER",
            berth_max_length=Decimal("300.00"),
            berth_max_draft=Decimal("15.00"),
            berth_status="AVAILABLE"
        )
        # Requested arrival is in the future (+2 days), but scheduled arrival is in the past (-1 hour)
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("300.00"),
            vessel_arrival_request_status="APPROVED"
        )
        from authentication.models import VesselSchedule
        VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=req,
            vessel_schedule_berth_id=berth,
            vessel_schedule_scheduled_arrival_at=now - timezone.timedelta(hours=1),
            vessel_schedule_scheduled_departure_at=now + timezone.timedelta(days=1),
            vessel_schedule_status="CONFIRMED"
        )

        # Excluded from eligible requests
        res_eligible = self.client.get(
            "/api/arrival-requests/?eligible_for_cargo=true",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        ids = [r["vessel_arrival_request_id"] for r in res_eligible.data["data"]]
        self.assertNotIn(req.vessel_arrival_request_id, ids)

        # Registration rejected by backend
        payload = {
            "cargo_arrival_request_id": req.vessel_arrival_request_id,
            "cargo_description": "Precedence Test Cargo",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 50,
            "cargo_unit": "TEU",
            "cargo_weight": 500.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_post = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_post.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("scheduled vessel arrival time has passed", res_post.data["message"])

    def test_23_existing_cargo_update_allowed_after_arrival_deadline(self):
        """Rule 8: Existing cargo registered before deadline can still be updated after deadline."""
        now = timezone.now()
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_cargo_type="Container Cargo",
            vessel_arrival_request_cargo_quantity=Decimal("300.00"),
            vessel_arrival_request_status="APPROVED"
        )
        cargo = Cargo.objects.create(
            cargo_arrival_request_id=req,
            cargo_description="Original Cargo Consignment",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # Now pass the arrival deadline
        req.vessel_arrival_request_requested_arrival_at = timezone.now() - timezone.timedelta(days=1)
        req.save()

        # Update existing cargo should be permitted
        patch_payload = {
            "cargo_description": "Updated Cargo Consignment Description"
        }
        res_patch = self.client.patch(
            f"/api/cargo/{cargo.cargo_id}/",
            data=patch_payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        cargo.refresh_from_db()
        self.assertEqual(cargo.cargo_description, "Updated Cargo Consignment Description")

        # Safe historical retention: original status remains APPROVED in database
        req.refresh_from_db()
        self.assertEqual(req.vessel_arrival_request_status, "APPROVED")

    # =========================================================================
    # 24. Containerized Cargo: Physical Container Counts & Workflow Access
    # =========================================================================
    def test_24_containerized_cargo_physical_container_counts_allowed(self):
        """Rule 1: Containerized cargo allows TEU, FEU, and physical container counts (UNITS)."""
        payload = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Electronics in Physical Container Units",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 100,
            "cargo_unit": "UNITS",  # Physical container count
            "cargo_weight": 1400.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res = self.client.post(
            "/api/cargo/",
            data=payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        cargo_id = res.data["data"]["cargo_id"]

        # Containerized cargo CAN proceed to container registration workflow
        container_payload = {
            "container_cargo_id": cargo_id,
            "container_number": "MSCU1112223",
            "container_type": "20FT",
            "container_gross_weight": 14.0
        }
        res_container = self.client.post(
            "/api/containers/",
            data=container_payload,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_container.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 25. Bulk Cargo: Appropriate Units & Rejection of TEU
    # =========================================================================
    def test_25_bulk_cargo_allowed_units_and_rejection_of_teu(self):
        """Rule 2: Bulk cargo accepts MT/KG and strictly rejects TEU/container units."""
        # 1. Bulk cargo with TEU must be rejected
        payload_teu = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Coal Bulk in TEU",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 500,
            "cargo_unit": "TEU",  # Inappropriate for bulk!
            "cargo_weight": 5000.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_teu = self.client.post(
            "/api/cargo/",
            data=payload_teu,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_teu.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_unit", res_teu.data["errors"])

        # 2. Bulk cargo with TONNES (Metric Tonnes) must succeed
        payload_tonnes = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Thermal Coal Consignment",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 5000,
            "cargo_unit": "TONNES",
            "cargo_weight": 5000.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_tonnes = self.client.post(
            "/api/cargo/",
            data=payload_tonnes,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_tonnes.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 26. Bulk & General Cargo Blocked from Container Workflows
    # =========================================================================
    def test_26_bulk_and_general_cargo_cannot_enter_container_workflows(self):
        """Rule 2 & 6: Bulk & General cargo cannot enter container registration or manifests."""
        bulk_cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_a,
            cargo_description="Dry Grain Consignment",
            cargo_type="BULK_CARGO",
            cargo_quantity=Decimal("3000.00"),
            cargo_unit="TONNES",
            cargo_weight=Decimal("3000.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )
        general_cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_a,
            cargo_description="Machinery Equipment",
            cargo_type="GENERAL_CARGO",
            cargo_quantity=Decimal("50.00"),
            cargo_unit="PACKAGES",
            cargo_weight=Decimal("120.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # 1. Attempt container registration for bulk cargo -> Rejected 400
        res_bulk_cont = self.client.post(
            "/api/containers/",
            data={
                "container_cargo_id": bulk_cargo.cargo_id,
                "container_number": "MSCU3334445",
                "container_type": "20FT",
                "container_gross_weight": 20.0
            },
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_bulk_cont.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("containerized", res_bulk_cont.data["message"].lower())

        # 2. Attempt container registration for general cargo -> Rejected 400
        res_gen_cont = self.client.post(
            "/api/containers/",
            data={
                "container_cargo_id": general_cargo.cargo_id,
                "container_number": "MSCU3334446",
                "container_type": "20FT",
                "container_gross_weight": 20.0
            },
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_gen_cont.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("containerized", res_gen_cont.data["message"].lower())

        # 3. Attempt container manifest summary for non-containerized cargo -> Rejected 400
        res_summary = self.client.get(
            f"/api/cargo/{bulk_cargo.cargo_id}/containers/",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_summary.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("containerized", res_summary.data["message"].lower())

    # =========================================================================
    # 27. General Cargo: Package/Piece Units & Quantity/Weight Independence
    # =========================================================================
    def test_27_general_cargo_units_and_quantity_weight_distinction(self):
        """Rule 3 & 4: General cargo allows packages/pieces; quantity does NOT need to equal gross weight."""
        # 10,000 packages weighing 50 MT (5 kg per package) is completely valid
        payload_packages = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Packaged Textiles and Footwear",
            "cargo_type": "GENERAL_CARGO",
            "cargo_quantity": 10000,
            "cargo_unit": "PACKAGES",
            "cargo_weight": 50.0,  # 50 MT total (Quantity 10,000 != Weight 50.0)
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_pkg = self.client.post(
            "/api/cargo/",
            data=payload_packages,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_pkg.status_code, status.HTTP_201_CREATED)

        # 25 heavy turbine generator units weighing 850 MT is completely valid
        payload_units = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Heavy Industrial Generator Units",
            "cargo_type": "GENERAL_CARGO",
            "cargo_quantity": 25,
            "cargo_unit": "UNITS",
            "cargo_weight": 850.0,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_units = self.client.post(
            "/api/cargo/",
            data=payload_units,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_units.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # 28. Physical Quantity and Gross Weight Consistency Validation
    # =========================================================================
    def test_28_quantity_and_weight_consistency_enforcement(self):
        """Rule 4: Inconsistent values rejected according to physical meanings and units."""
        # 1. TONNES: Gross weight far less than net quantity (1000 MT cargo with 1 MT weight) -> Rejected
        payload_tonnes_mismatch = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Weight Mismatch Grain",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 1000,
            "cargo_unit": "TONNES",
            "cargo_weight": 1.0,  # 1 MT weight for 1,000 MT cargo!
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res1 = self.client.post(
            "/api/cargo/",
            data=payload_tonnes_mismatch,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_weight", res1.data["errors"])

        # 2. KG: Gross weight in MT far less than quantity in KG (50,000 KG = 50 MT, but entered 0.01 MT) -> Rejected
        payload_kg_mismatch = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "KG Mismatch Bulk",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 50000,
            "cargo_unit": "KG",
            "cargo_weight": 0.01,  # 10 kg weight for 50,000 kg cargo!
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res2 = self.client.post(
            "/api/cargo/",
            data=payload_kg_mismatch,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_weight", res2.data["errors"])

        # 3. CONTAINERIZED: Physically impossible weight (> 50 MT per TEU, e.g. 10 TEU weighing 5,000 MT) -> Rejected
        payload_container_impossible = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Impossible Weight Containers",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 10,
            "cargo_unit": "TEU",
            "cargo_weight": 5000.0,  # 500 MT per container!
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res3 = self.client.post(
            "/api/cargo/",
            data=payload_container_impossible,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cargo_weight", res3.data["errors"])

    def test_cargo_quantity_and_gross_weight_formatting(self):
        """Verify quantity formatting (whole numbers without trailing zeros for TEU/FEU) and gross weight decimals."""
        # 1. Whole number TEU quantity -> displayed as "250", not "250.00"
        payload_teu = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Clean Container Consignment",
            "cargo_type": "CONTAINERIZED",
            "cargo_quantity": 250,
            "cargo_unit": "TEU",
            "cargo_weight": 3500.50,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_teu = self.client.post(
            "/api/cargo/",
            data=payload_teu,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_teu.status_code, status.HTTP_201_CREATED)
        data_teu = res_teu.data["data"]
        self.assertEqual(data_teu["cargo_quantity_display"], "250")
        self.assertEqual(data_teu["cargo_weight_display"], "3500.50")

        # 2. Decimal Bulk Quantity (supported for TONNES) -> displays decimal places
        payload_bulk_decimal = {
            "cargo_arrival_request_id": self.arrival_a.vessel_arrival_request_id,
            "cargo_description": "Precision Grain Cargo",
            "cargo_type": "BULK_CARGO",
            "cargo_quantity": 1250.75,
            "cargo_unit": "TONNES",
            "cargo_weight": 1250.75,
            "cargo_origin_port_id": self.port_singapore.port_id,
            "cargo_destination_port_id": self.port_mumbai.port_id
        }
        res_bulk = self.client.post(
            "/api/cargo/",
            data=payload_bulk_decimal,
            format="json",
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_bulk.status_code, status.HTTP_201_CREATED)
        data_bulk = res_bulk.data["data"]
        self.assertEqual(data_bulk["cargo_quantity_display"], "1250.75")
        self.assertEqual(data_bulk["cargo_weight_display"], "1250.75")


