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
    AuditLog,
    Berth,
    VesselSchedule
)



class ContainerManagementTestCase(TestCase):
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
            user_full_name="Rajesh Sharma",
            user_phone="+919876543210",
            user_status="ACTIVE"
        )

        # 2. Company B & User B (For cross-tenant authorization testing)
        self.company_b = ShippingCompany.objects.create(
            shipping_company_name="MSC Mediterranean",
            shipping_company_license_number="LIC-MSC-002",
            shipping_company_email="agent@msc.com",
            shipping_company_phone="+919876543299",
            shipping_company_address="Ballard Estate, Mumbai",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_b = Login.objects.create(
            login_email="agent@msc.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_b = User.objects.create(
            login_id=self.login_b,
            shipping_company_id=self.company_b,
            user_full_name="Vikram Patel",
            user_phone="+919876543299",
            user_status="ACTIVE"
        )

        # 3. Port Operations User
        self.login_ops = Login.objects.create(
            login_email="ops@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_ops = User.objects.create(
            login_id=self.login_ops,
            user_full_name="Suresh Operations",
            user_phone="+919876543288",
            user_status="ACTIVE"
        )

        # 3b. Terminal & Logistics Operator User
        self.login_tlo = Login.objects.create(
            login_email="terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_tlo = User.objects.create(
            login_id=self.login_tlo,
            user_full_name="Kiran Terminal",
            user_phone="+919876543277",
            user_status="ACTIVE"
        )


        # 4. Vessels
        self.vessel_a = Vessel.objects.create(
            vessel_shipping_company_id=self.company_a,
            vessel_name="Maersk Mc-Kinney Moller",
            vessel_imo_number="9619907",
            vessel_type="Container Ship",
            vessel_flag="Denmark",
            vessel_length=Decimal("399.00"),
            vessel_draft=Decimal("16.00"),
            vessel_capacity=18270
        )
        self.vessel_b = Vessel.objects.create(
            vessel_shipping_company_id=self.company_b,
            vessel_name="MSC Oscar",
            vessel_imo_number="9703291",
            vessel_type="Container Ship",
            vessel_flag="Panama",
            vessel_length=Decimal("395.40"),
            vessel_draft=Decimal("16.00"),
            vessel_capacity=19224
        )

        # 5. Approved Arrival Requests
        now = timezone.now()
        self.arr_req_a = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=4),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=1000,
            vessel_arrival_request_status="APPROVED"
        )
        self.arr_req_b = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_b,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=5),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=800,
            vessel_arrival_request_status="APPROVED"
        )

        # 6. Cargo for Company A: Containerized
        self.cargo_containerized = Cargo.objects.create(
            cargo_arrival_request_id=self.arr_req_a,
            cargo_description="Consumer Electronics and Hardware",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("500.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("6000.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # 7. Cargo for Company A: General Cargo
        self.cargo_general = Cargo.objects.create(
            cargo_arrival_request_id=self.arr_req_a,
            cargo_description="Industrial Machinery Parts",
            cargo_type="GENERAL_CARGO",
            cargo_quantity=Decimal("150.00"),
            cargo_unit="UNITS",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # 8. Cargo for Company A: Bulk Cargo
        self.cargo_bulk = Cargo.objects.create(
            cargo_arrival_request_id=self.arr_req_a,
            cargo_description="High-Grade Thermal Coal",
            cargo_type="BULK_CARGO",
            cargo_quantity=Decimal("25000.00"),
            cargo_unit="TONNES",
            cargo_weight=Decimal("25000.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # 9. Cargo for Company B
        self.cargo_company_b = Cargo.objects.create(
            cargo_arrival_request_id=self.arr_req_b,
            cargo_description="Automotive Components",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("300.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("3500.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )

        # Auth headers
        self.headers_company_a = {
            'HTTP_X_USER_EMAIL': 'agent@maersk.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.user_a.user_id)
        }
        self.headers_company_b = {
            'HTTP_X_USER_EMAIL': 'agent@msc.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.user_b.user_id)
        }
        self.headers_ops = {
            'HTTP_X_USER_EMAIL': 'ops@portide.com',
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.user_ops.user_id)
        }
        self.headers_tlo = {
            'HTTP_X_USER_EMAIL': 'terminal@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_tlo.user_id)
        }


    # =========================================================================
    # 1. Successful Container Registration for Containerized Cargo
    # =========================================================================
    def test_01_create_container_success(self):
        """Container can be created for valid Containerized Cargo with ISO-6346 format."""
        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "MSCU1234567",
            "container_type": "20 FT",
            "container_gross_weight": "18.50"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'success')
        self.assertEqual(res.data['data']['container_number'], 'MSCU1234567')
        self.assertEqual(res.data['data']['container_type'], '20FT')
        self.assertEqual(res.data['data']['container_status'], 'REGISTERED')
        self.assertEqual(res.data['data']['teu_equivalent'], 1.0)
        self.assertTrue(Container.objects.filter(container_number='MSCU1234567').exists())

    # =========================================================================
    # 2. Rejection for General Cargo
    # =========================================================================
    def test_02_create_container_rejected_for_general_cargo(self):
        """Container registration is rejected for General Cargo."""
        payload = {
            "container_cargo_id": self.cargo_general.cargo_id,
            "container_number": "TCLU7654321",
            "container_type": "40 FT",
            "container_gross_weight": "22.40"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Containers can only be registered for containerized cargo", str(res.data))

    # =========================================================================
    # 3. Rejection for Bulk Cargo
    # =========================================================================
    def test_03_create_container_rejected_for_bulk_cargo(self):
        """Container registration is rejected for Bulk Cargo."""
        payload = {
            "container_cargo_id": self.cargo_bulk.cargo_id,
            "container_number": "ABCU1234567",
            "container_type": "20 FT",
            "container_gross_weight": "24.00"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Containers can only be registered for containerized cargo", str(res.data))

    # =========================================================================
    # 4. Format Validation: Accepts Standard ISO Formats and Normalizes to Uppercase
    # =========================================================================
    def test_04_container_number_format_and_normalization(self):
        """Container numbers are normalized to uppercase and standard formats are accepted."""
        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "msCu9876543",  # lowercase
            "container_type": "40 FT High Cube",
            "container_gross_weight": "26.50"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['data']['container_number'], 'MSCU9876543')
        self.assertEqual(res.data['data']['container_type'], '40FT_HC')
        self.assertEqual(res.data['data']['teu_equivalent'], 2.0)

    # =========================================================================
    # 5. Format Validation: Rejection of Invalid Formats
    # =========================================================================
    def test_05_container_number_invalid_formats_rejected(self):
        """Invalid container numbers (ABC, 123456, MSCU-123, CONTAINER123) are rejected."""
        invalid_numbers = ['ABC', '123456', 'MSCU-123', 'CONTAINER123', 'MSCU12345', 'M1234567890']
        for invalid_no in invalid_numbers:
            payload = {
                "container_cargo_id": self.cargo_containerized.cargo_id,
                "container_number": invalid_no,
                "container_type": "20 FT",
                "container_gross_weight": "15.00"
            }
            res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, f"Failed for {invalid_no}")
            self.assertIn("Invalid container number format", str(res.data))

    # =========================================================================
    # 6. Uniqueness Enforcement Across Database
    # =========================================================================
    def test_06_duplicate_container_number_rejected(self):
        """Duplicate container number is rejected across the system."""
        Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU1111111",
            container_type="20FT",
            container_gross_weight=Decimal("19.00"),
            container_status="REGISTERED"
        )

        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "MSCU1111111",
            "container_type": "20 FT",
            "container_gross_weight": "18.00"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(res.data))

    # =========================================================================
    # 7. Container Type Validation
    # =========================================================================
    def test_07_container_type_validation(self):
        """Controlled container types are validated, free-text types are rejected."""
        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "TCLU2222222",
            "container_type": "Custom Free Text Box",
            "container_gross_weight": "20.00"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid container type", str(res.data))

    # =========================================================================
    # 8. Gross Weight Validation
    # =========================================================================
    def test_08_gross_weight_validation(self):
        """Gross weight must be strictly > 0."""
        # Test 0 weight
        res_zero = self.client.post('/api/containers/', {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "TCLU3333333",
            "container_type": "20 FT",
            "container_gross_weight": "0.00"
        }, format='json', **self.headers_company_a)
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Test negative weight
        res_neg = self.client.post('/api/containers/', {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "TCLU3333333",
            "container_type": "20 FT",
            "container_gross_weight": "-5.50"
        }, format='json', **self.headers_company_a)
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 9. Correct ForeignKey Relationship & Properties
    # =========================================================================
    def test_09_container_relationship_properties(self):
        """Container correctly resolves linked Cargo, Arrival Request, Vessel, and Company."""
        container = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU4444444",
            container_type="40FT",
            container_gross_weight=Decimal("24.00"),
            container_status="REGISTERED"
        )
        self.assertEqual(container.cargo, self.cargo_containerized)
        self.assertEqual(container.arrival_request, self.arr_req_a)
        self.assertEqual(container.vessel, self.vessel_a)
        self.assertEqual(container.shipping_company, self.company_a)
        self.assertEqual(container.teu_equivalent, 2.0)

    # =========================================================================
    # 10. Cross-Company Authorization Rejection
    # =========================================================================
    def test_10_cross_company_access_denied(self):
        """Company B cannot register containers under Company A's cargo."""
        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "MSCU5555555",
            "container_type": "20 FT",
            "container_gross_weight": "18.00"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_b)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("not authorized", str(res.data))

    # =========================================================================
    # 11. Non-existent Cargo ID Rejection
    # =========================================================================
    def test_11_non_existent_cargo_id_rejected(self):
        """Non-existent Cargo ID returns 400 Bad Request during registration."""
        payload = {
            "container_cargo_id": 999999,
            "container_number": "MSCU6666666",
            "container_type": "20 FT",
            "container_gross_weight": "18.00"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 12. Initial Status is Strictly REGISTERED
    # =========================================================================
    def test_12_initial_status_is_registered(self):
        """Newly created container always starts in REGISTERED status."""
        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "MSCU7777777",
            "container_type": "20 FT",
            "container_gross_weight": "19.20"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['data']['container_status'], 'REGISTERED')

    # =========================================================================
    # 13. Sequential Status Transition for Authorized Roles
    # =========================================================================
    def test_13_sequential_status_transition(self):
        """Operations role can transition container from REGISTERED to ARRIVED, then AT_TERMINAL."""
        container = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU8888888",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="REGISTERED"
        )

        # 1. REGISTERED -> ARRIVED
        res1 = self.client.post(f'/api/containers/{container.container_id}/status/', {"status": "ARRIVED"}, format='json', **self.headers_ops)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data['data']['container_status'], 'ARRIVED')

        # 2. ARRIVED -> AT_TERMINAL
        res2 = self.client.post(f'/api/containers/{container.container_id}/status/', {"status": "AT_TERMINAL"}, format='json', **self.headers_ops)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['data']['container_status'], 'AT_TERMINAL')

    # =========================================================================
    # 14. Invalid Status Jumps Rejected
    # =========================================================================
    def test_14_invalid_status_jumps_rejected(self):
        """Jumping from REGISTERED directly to CLEARED or RELEASED is rejected."""
        container = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU9999999",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="REGISTERED"
        )
        res_jump = self.client.post(f'/api/containers/{container.container_id}/status/', {"status": "CLEARED"}, format='json', **self.headers_ops)
        self.assertEqual(res_jump.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid status transition", str(res_jump.data))

    # =========================================================================
    # 15. Shipping Company Cannot Transition Operational/Customs Statuses
    # =========================================================================
    def test_15_shipping_company_cannot_transition_status(self):
        """Shipping company cannot mark a container as ARRIVED, CLEARED, or RELEASED."""
        container = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU1212121",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="REGISTERED"
        )
        res = self.client.post(f'/api/containers/{container.container_id}/status/', {"status": "ARRIVED"}, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("not authorized", str(res.data))

    # =========================================================================
    # 16. Dynamic TEU Calculation
    # =========================================================================
    def test_16_teu_calculation(self):
        """20 FT = 1 TEU, 40 FT = 2 TEU, 40 FT HC = 2 TEU."""
        c1 = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU3131313",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )
        c2 = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU4141414",
            container_type="40FT",
            container_gross_weight=Decimal("24.00"),
            container_status="REGISTERED"
        )
        c3 = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU5151515",
            container_type="40FT_HC",
            container_gross_weight=Decimal("25.00"),
            container_status="REGISTERED"
        )
        self.assertEqual(c1.teu_equivalent, 1.0)
        self.assertEqual(c2.teu_equivalent, 2.0)
        self.assertEqual(c3.teu_equivalent, 2.0)

    # =========================================================================
    # 17. Multiple Containers Belonging to One Cargo
    # =========================================================================
    def test_17_multiple_containers_per_cargo(self):
        """Multiple containers can be registered under a single Cargo."""
        for i in range(1, 4):
            Container.objects.create(
                container_cargo_id=self.cargo_containerized,
                container_number=f"TCLU000000{i}",
                container_type="20FT",
                container_gross_weight=Decimal("18.00"),
                container_status="REGISTERED"
            )
        self.assertEqual(self.cargo_containerized.containers.count(), 3)

    # =========================================================================
    # 18. Cargo Container Summary Endpoint
    # =========================================================================
    def test_18_cargo_containers_summary(self):
        """Cargo container summary returns real database counts and capacity mismatch flag."""
        Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU6161616",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )
        Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU7171717",
            container_type="40FT",
            container_gross_weight=Decimal("24.00"),
            container_status="ARRIVED"
        )
        res = self.client.get(f'/api/cargo/{self.cargo_containerized.cargo_id}/containers/', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        summary = res.data['summary']
        self.assertEqual(summary['total_containers'], 2)
        self.assertEqual(summary['total_teu'], 3.0)  # 1 TEU + 2 TEU = 3 TEU
        self.assertEqual(summary['status_breakdown']['REGISTERED'], 1)
        self.assertEqual(summary['status_breakdown']['ARRIVED'], 1)
        # Declared quantity is 500 TEU vs 3 TEU registered -> capacity_mismatch is True
        self.assertTrue(summary['capacity_mismatch'])
        self.assertIsNotNone(summary['mismatch_message'])

    # =========================================================================
    # 19. Centralized Audit Log Creation
    # =========================================================================
    def test_19_audit_log_created_on_container_events(self):
        """Audit log entry is created under category CONTAINER when container is registered."""
        payload = {
            "container_cargo_id": self.cargo_containerized.cargo_id,
            "container_number": "MSCU8181818",
            "container_type": "20 FT",
            "container_gross_weight": "19.00"
        }
        res = self.client.post('/api/containers/', payload, format='json', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        
        audit_entry = AuditLog.objects.filter(
            audit_log_category='CONTAINER',
            audit_log_action='CREATE',
            audit_log_target_id=str(res.data['data']['container_id'])
        ).first()
        self.assertIsNotNone(audit_entry)
        self.assertIn("MSCU8181818", audit_entry.audit_log_description)

    # =========================================================================
    # 20. Container Detail View Returns Full Context
    # =========================================================================
    def test_20_container_detail_context(self):
        """Container detail API returns complete relationship context."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU9191919",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )
        res = self.client.get(f'/api/containers/{c.container_id}/', **self.headers_company_a)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ctx = res.data['data']['cargo_context']
        self.assertIsNotNone(ctx)
        self.assertEqual(ctx['vessel_name'], self.vessel_a.vessel_name)
        self.assertEqual(ctx['vessel_imo_number'], self.vessel_a.vessel_imo_number)
        self.assertEqual(ctx['company_name'], self.company_a.shipping_company_name)

    # =========================================================================
    # 21. Technical Edits Blocked Once Operational
    # =========================================================================
    def test_21_editing_blocked_once_arrived(self):
        """Container technical specifications can be edited while REGISTERED, but blocked once ARRIVED."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU1313131",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )
        # Edit while REGISTERED succeeds
        res_edit = self.client.patch(f'/api/containers/{c.container_id}/', {"container_gross_weight": "19.50"}, format='json', **self.headers_company_a)
        self.assertEqual(res_edit.status_code, status.HTTP_200_OK)

        # Move to ARRIVED
        c.container_status = "ARRIVED"
        c.save()

        # Edit while ARRIVED is blocked
        res_blocked = self.client.patch(f'/api/containers/{c.container_id}/', {"container_gross_weight": "22.00"}, format='json', **self.headers_company_a)
        self.assertEqual(res_blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only REGISTERED containers may be updated", str(res_blocked.data))

    # =========================================================================
    # 22. Terminal Operator Authorized to View Eligible Cargo Containers
    # =========================================================================
    def test_22_terminal_operator_view_containers_eligible_cargo(self):
        """Terminal Operator can view container manifest and stats for eligible cargo (APPROVED arrival request)."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU2222222",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="REGISTERED"
        )
        res = self.client.get(f'/api/cargo/{self.cargo_containerized.cargo_id}/containers/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        self.assertEqual(len(res.data['data']), 1)
        self.assertEqual(res.data['data'][0]['container_number'], 'MSCU2222222')

    # =========================================================================
    # 23. Terminal Operator Blocked from Unapproved Cargo Containers
    # =========================================================================
    def test_23_terminal_operator_blocked_unapproved_cargo(self):
        """Terminal Operator cannot access containers for cargo belonging to an unapproved arrival request."""
        unapproved_arr = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=timezone.now() + timezone.timedelta(days=5),
            vessel_arrival_request_requested_departure_at=timezone.now() + timezone.timedelta(days=7),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=500,
            vessel_arrival_request_status="PENDING"
        )
        unapproved_cargo = Cargo.objects.create(
            cargo_arrival_request_id=unapproved_arr,
            cargo_description="Unapproved Electronic Spares",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_status="REGISTERED"
        )
        res = self.client.get(f'/api/cargo/{unapproved_cargo.cargo_id}/containers/', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("APPROVED", str(res.data['message']))

    # =========================================================================
    # 24. Terminal Operator Can Receive Container When Vessel Arrived
    # =========================================================================
    def test_24_terminal_operator_receive_container_when_vessel_arrived(self):
        """Terminal Operator can transition container REGISTERED -> ARRIVED when vessel has arrived in port."""
        berth = Berth.objects.create(
            berth_name="Container Terminal Berth 1",
            berth_code="CTB-1",
            berth_type="CONTAINER_TERMINAL",
            berth_status="OCCUPIED"
        )
        VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arr_req_a,
            vessel_schedule_berth_id=berth,
            vessel_schedule_scheduled_arrival_at=timezone.now(),
            vessel_schedule_scheduled_departure_at=timezone.now() + timezone.timedelta(days=2),
            vessel_schedule_status='ARRIVED'
        )
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU3333333",
            container_type="20FT",
            container_gross_weight=Decimal("21.00"),
            container_status="REGISTERED"
        )

        res = self.client.post(f'/api/containers/{c.container_id}/status/', {"status": "ARRIVED"}, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data']['container_status'], 'ARRIVED')

    # =========================================================================
    # 25. Terminal Operator Blocked from Receiving if Vessel Still SCHEDULED
    # =========================================================================
    def test_25_terminal_operator_blocked_receive_if_vessel_scheduled(self):
        """Terminal Operator cannot receive container while vessel is still in SCHEDULED status (not yet arrived)."""
        berth = Berth.objects.create(
            berth_name="Container Terminal Berth 2",
            berth_code="CTB-2",
            berth_type="CONTAINER_TERMINAL",
            berth_status="RESERVED"
        )
        VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arr_req_b,
            vessel_schedule_berth_id=berth,
            vessel_schedule_scheduled_arrival_at=timezone.now() + timezone.timedelta(days=3),
            vessel_schedule_scheduled_departure_at=timezone.now() + timezone.timedelta(days=5),
            vessel_schedule_status='SCHEDULED'
        )
        c = Container.objects.create(
            container_cargo_id=self.cargo_company_b,
            container_number="MSCU4444445",
            container_type="20FT",
            container_gross_weight=Decimal("22.00"),
            container_status="REGISTERED"
        )

        res = self.client.post(f'/api/containers/{c.container_id}/status/', {"status": "ARRIVED"}, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("operational stage", str(res.data['message']))

    # =========================================================================
    # 26. Terminal Operator Moves Container ARRIVED -> AT_TERMINAL
    # =========================================================================
    def test_26_terminal_operator_move_to_terminal(self):
        """Terminal Operator can transition container ARRIVED -> AT_TERMINAL."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU5555556",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="ARRIVED"
        )
        res = self.client.post(f'/api/containers/{c.container_id}/status/', {"status": "AT_TERMINAL"}, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data']['container_status'], 'AT_TERMINAL')

    # =========================================================================
    # 27. Terminal Operator Blocked from Customs / Gate Transitions
    # =========================================================================
    def test_27_terminal_operator_blocked_from_customs_or_release_transitions(self):
        """Terminal Operator cannot advance container to UNDER_INSPECTION, CLEARED, or RELEASED."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU6666667",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AT_TERMINAL"
        )
        # Attempt to trigger customs inspection
        res_customs = self.client.post(f'/api/containers/{c.container_id}/status/', {"status": "UNDER_INSPECTION"}, format='json', **self.headers_tlo)
        self.assertEqual(res_customs.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("only authorized", str(res_customs.data['message']))

        # Attempt to mark released
        res_release = self.client.post(f'/api/containers/{c.container_id}/status/', {"status": "RELEASED"}, format='json', **self.headers_tlo)
        self.assertEqual(res_release.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 28. Terminal Operator Cannot Modify Container Technical Specifications
    # =========================================================================
    def test_28_terminal_operator_cannot_modify_container_specs(self):
        """Terminal Operator cannot modify technical container specifications (weights, dimensions)."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU7777778",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )
        res = self.client.patch(f'/api/containers/{c.container_id}/', {"container_gross_weight": "24.00"}, format='json', **self.headers_tlo)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("not authorized", str(res.data['message']))

    # =========================================================================
    # 29. Terminal Operator Transitions Recorded in Audit Log
    # =========================================================================
    def test_29_terminal_operator_transition_audit_log_recorded(self):
        """Every status transition performed by Terminal Operator creates an audit log entry."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU8888889",
            container_type="20FT",
            container_gross_weight=Decimal("19.50"),
            container_status="ARRIVED"
        )
        res = self.client.post(
            f'/api/containers/{c.container_id}/status/',
            {"status": "AT_TERMINAL", "remarks": "Moved to Yard Block B-14"},
            format='json',
            **self.headers_tlo
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        log = AuditLog.objects.filter(
            audit_log_category='CONTAINER',
            audit_log_action='STATUS_CHANGE',
            audit_log_target_id=str(c.container_id)
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.audit_log_role, 'Terminal & Logistics Operator')
        self.assertIn('MSCU8888889', log.audit_log_description)
        self.assertIn('ARRIVED to AT_TERMINAL', log.audit_log_description)
        self.assertIn('Moved to Yard Block B-14', log.audit_log_description)

    # =========================================================================
    # 30. Public Container Tracking API - Success & Lifecycle Lookups
    # =========================================================================
    def test_30_public_container_tracking_success(self):
        """Public container tracking returns valid container details without authentication."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU7777771",
            container_type="40FT",
            container_gross_weight=Decimal("22.50"),
            container_status="CLEARED"
        )

        # 1. Standard search without authentication headers
        res = self.client.get('/api/containers/track/?number=MSCU7777771')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data['data']
        self.assertEqual(data['container_number'], 'MSCU7777771')
        self.assertEqual(data['cargo_description'], self.cargo_containerized.cargo_description)
        self.assertEqual(data['cargo_type'], 'Containerized')
        self.assertEqual(data['vessel_name'], self.vessel_a.vessel_name)
        self.assertEqual(data['arrival_request_id'], f"AR-{str(self.arr_req_a.vessel_arrival_request_id).zfill(4)}")
        self.assertEqual(data['current_status'], 'CLEARED')
        self.assertEqual(data['current_status_display'], 'Customs Cleared')
        self.assertIn('last_updated', data)

        # 2. Case-insensitive and hyphenated search
        res_hyphen = self.client.get('/api/containers/track/?number=mscu-7777771')
        self.assertEqual(res_hyphen.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hyphen.data['data']['container_number'], 'MSCU7777771')

    # =========================================================================
    # 31. Public Container Tracking API - Not Found & Validation
    # =========================================================================
    def test_31_public_container_tracking_not_found_and_empty(self):
        """Unregistered container returns 404 with exact user-facing message, and empty returns 400."""
        # 1. Non-existent container
        res_404 = self.client.get('/api/containers/track/?number=MSCU9999999')
        self.assertEqual(res_404.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res_404.data['message'], "Container not found. Please check the container number and try again.")

        # 2. Empty query
        res_empty = self.client.get('/api/containers/track/?number=')
        self.assertEqual(res_empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Please enter a container number", res_empty.data['message'])

    # =========================================================================
    # 32. Public Data Security & Read-Only Invariance
    # =========================================================================
    def test_32_public_container_tracking_data_security_and_readonly(self):
        """Public tracking NEVER exposes sensitive operational details and never alters database state."""
        c = Container.objects.create(
            container_cargo_id=self.cargo_containerized,
            container_number="MSCU6666662",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="RELEASED"
        )
        original_updated_at = c.container_updated_at

        res = self.client.get('/api/containers/track/?number=MSCU6666662')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data['data']

        # Confirm strictly public payload - NO sensitive operational data
        sensitive_keys = [
            'driver_name', 'driver_email', 'driver_license_number', 'driver_phone',
            'truck_registration_number', 'truck_plate', 'gate_pass_id', 'gate_pass_number',
            'qr_code', 'qr_verification_code', 'assigned_gate', 'customs_officer',
            'gate_officer', 'internal_remarks', 'customs_remarks', 'audit_log'
        ]
        for key in sensitive_keys:
            self.assertNotIn(key, data)

        # Confirm read-only: status and record unchanged
        c.refresh_from_db()
        self.assertEqual(c.container_status, 'RELEASED')
        self.assertEqual(c.container_updated_at, original_updated_at)

    # =========================================================================
    # 33. Arrival Request Approval Enforcement
    # =========================================================================
    def test_33_container_registration_rejected_when_arrival_request_not_approved(self):
        """Rule 1 & 3: Container registration rejected when linked arrival request is not APPROVED."""
        now = timezone.now()
        pending_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=500,
            vessel_arrival_request_status="PENDING"
        )
        cargo_pending = Cargo.objects.create(
            cargo_arrival_request_id=pending_req,
            cargo_description="Pending Request Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )
        payload = {
            "container_cargo_id": cargo_pending.cargo_id,
            "container_number": "MSCU9990001",
            "container_type": "20FT",
            "container_gross_weight": 19.5
        }
        res = self.client.post(
            '/api/containers/',
            data=payload,
            format='json',
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE='shipping_company',
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("APPROVED", res.data['message'])

    # =========================================================================
    # 34. Arrival Deadline Expiration Enforcement
    # =========================================================================
    def test_34_container_registration_rejected_when_arrival_deadline_passed(self):
        """Rule 2 & 3: Container registration rejected when server time >= scheduled arrival."""
        now = timezone.now()
        expired_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now - timezone.timedelta(hours=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=500,
            vessel_arrival_request_status="APPROVED"
        )
        cargo_expired = Cargo.objects.create(
            cargo_arrival_request_id=expired_req,
            cargo_description="Expired Request Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )
        payload = {
            "container_cargo_id": cargo_expired.cargo_id,
            "container_number": "MSCU9990002",
            "container_type": "20FT",
            "container_gross_weight": 19.5
        }
        res = self.client.post(
            '/api/containers/',
            data=payload,
            format='json',
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE='shipping_company',
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("scheduled vessel arrival time has passed", res.data['message'])

    # =========================================================================
    # 35. Scheduled Arrival Override Precedence for Containers
    # =========================================================================
    def test_35_container_registration_uses_scheduled_arrival_precedence(self):
        """Rule 6: VesselSchedule scheduled arrival takes precedence over requested arrival."""
        now = timezone.now()
        berth = Berth.objects.create(
            berth_name="Container Berth 2",
            berth_code="CB2",
            berth_type="CONTAINER",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("16.00"),
            berth_status="AVAILABLE"
        )
        sched_req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=500,
            vessel_arrival_request_status="APPROVED"
        )
        from authentication.models import VesselSchedule
        VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=sched_req,
            vessel_schedule_berth_id=berth,
            vessel_schedule_scheduled_arrival_at=now - timezone.timedelta(minutes=30),
            vessel_schedule_scheduled_departure_at=now + timezone.timedelta(days=1),
            vessel_schedule_status="CONFIRMED"
        )
        cargo_sched = Cargo.objects.create(
            cargo_arrival_request_id=sched_req,
            cargo_description="Scheduled Precedence Cargo",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )
        payload = {
            "container_cargo_id": cargo_sched.cargo_id,
            "container_number": "MSCU9990003",
            "container_type": "20FT",
            "container_gross_weight": 19.5
        }
        res = self.client.post(
            '/api/containers/',
            data=payload,
            format='json',
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE='shipping_company',
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("scheduled vessel arrival time has passed", res.data['message'])

    # =========================================================================
    # 36. Existing Containers Updatable and Readable After Deadline
    # =========================================================================
    def test_36_existing_containers_readable_and_updatable_after_arrival_deadline(self):
        """Rule 7 & 8: Existing containers remain readable and updatable after arrival deadline passes."""
        now = timezone.now()
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=500,
            vessel_arrival_request_status="APPROVED"
        )
        cargo = Cargo.objects.create(
            cargo_arrival_request_id=req,
            cargo_description="Cargo with Pre-Existing Containers",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1200.00"),
            cargo_origin_port_id=self.port_singapore,
            cargo_destination_port_id=self.port_mumbai,
            cargo_status="REGISTERED"
        )
        container = Container.objects.create(
            container_cargo_id=cargo,
            container_number="MSCU9990004",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )

        # Move arrival deadline to the past
        req.vessel_arrival_request_requested_arrival_at = timezone.now() - timezone.timedelta(hours=5)
        req.save()

        # 1. Existing container must still be retrievable
        res_get = self.client.get(
            f'/api/containers/{container.container_id}/',
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE='shipping_company',
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data['data']['container_number'], "MSCU9990004")

        # 2. Existing container can be updated (e.g. gross weight)
        res_patch = self.client.patch(
            f'/api/containers/{container.container_id}/',
            data={"container_gross_weight": 21.5},
            format='json',
            HTTP_X_USER_EMAIL=self.login_a.login_email,
            HTTP_X_USER_ROLE='shipping_company',
            HTTP_X_USER_ID=str(self.login_a.login_id)
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_gross_weight, Decimal("21.50"))


