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
    AuditLog,
    Berth,
    VesselSchedule
)


class CustomsOfficerWorkflowTestCase(TestCase):
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
            user_full_name="Rajesh Agent",
            user_status="ACTIVE"
        )

        # Terminal & Logistics Operator
        self.login_terminal = Login.objects.create(
            login_email="terminal@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="terminal_logistics_operator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_terminal = User.objects.create(
            login_id=self.login_terminal,
            user_full_name="Anil Terminal",
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
            user_full_name="Dev Operations",
            user_status="ACTIVE"
        )

        # Gate Officer
        self.login_gate = Login.objects.create(
            login_email="gate@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="gate_truck_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_gate = User.objects.create(
            login_id=self.login_gate,
            user_full_name="Girish Gate Officer",
            user_status="ACTIVE"
        )

        # Vessel & Arrival Request
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="Oceanic Voyager",
            vessel_imo_number="9876543",
            vessel_type="Container Ship",
            vessel_flag="India",
            vessel_length=Decimal("300.00"),
            vessel_draft=Decimal("14.00"),
            vessel_capacity=10000
        )
        now = timezone.now()
        self.arrival_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=3),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=500,
            vessel_arrival_request_status="APPROVED"
        )

        # Berth & Schedule
        self.berth = Berth.objects.create(
            berth_name="Customs Inspection Berth 1",
            berth_code="CIB-1",
            berth_type="CONTAINER_TERMINAL",
            berth_status="OCCUPIED"
        )
        self.schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.arrival_request,
            vessel_schedule_berth_id=self.berth,
            vessel_schedule_scheduled_arrival_at=now,
            vessel_schedule_scheduled_departure_at=now + timezone.timedelta(days=2),
            vessel_schedule_status='ARRIVED'
        )

        # Cargo
        self.cargo = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_request,
            cargo_description="High-Tech Electronic Components",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("1500.00"),
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_status="REGISTERED"
        )

        # Request headers
        self.headers_customs = {
            'HTTP_X_USER_EMAIL': 'customs@portide.com',
            'HTTP_X_USER_ROLE': 'customs_officer',
            'HTTP_X_USER_ID': str(self.user_customs.user_id)
        }
        self.headers_terminal = {
            'HTTP_X_USER_EMAIL': 'terminal@portide.com',
            'HTTP_X_USER_ROLE': 'terminal_logistics_operator',
            'HTTP_X_USER_ID': str(self.user_terminal.user_id)
        }
        self.headers_shipping = {
            'HTTP_X_USER_EMAIL': 'agent@oceanic.com',
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.user_shipping.user_id)
        }
        self.headers_ops = {
            'HTTP_X_USER_EMAIL': 'ops@portide.com',
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.user_ops.user_id)
        }
        self.headers_gate = {
            'HTTP_X_USER_EMAIL': 'gate@portide.com',
            'HTTP_X_USER_ROLE': 'gate_truck_officer',
            'HTTP_X_USER_ID': str(self.user_gate.user_id)
        }

    # =========================================================================
    # 1. Full Lifecycle: REGISTERED -> ARRIVED -> AT_TERMINAL -> AWAITING_CUSTOMS -> UNDER_INSPECTION -> CLEARED
    # =========================================================================
    def test_01_full_successful_clearance_workflow(self):
        """End-to-end container lifecycle through terminal processing to customs clearance."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU1111111",
            container_type="20FT",
            container_gross_weight=Decimal("18.50"),
            container_status="REGISTERED"
        )

        # Terminal Operator receives: REGISTERED -> ARRIVED
        res_arr = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "ARRIVED"},
            format='json',
            **self.headers_terminal
        )
        self.assertEqual(res_arr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_arr.data['data']['container_status'], 'ARRIVED')

        # Terminal Operator moves to terminal: ARRIVED -> AT_TERMINAL
        res_term = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "AT_TERMINAL"},
            format='json',
            **self.headers_terminal
        )
        self.assertEqual(res_term.status_code, status.HTTP_200_OK)
        self.assertEqual(res_term.data['data']['container_status'], 'AT_TERMINAL')

        # Terminal Operator sends to customs: AT_TERMINAL -> AWAITING_CUSTOMS
        res_await = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "AWAITING_CUSTOMS"},
            format='json',
            **self.headers_terminal
        )
        self.assertEqual(res_await.status_code, status.HTTP_200_OK)
        self.assertEqual(res_await.data['data']['container_status'], 'AWAITING_CUSTOMS')

        # Customs Officer checks pending worklist: container MSCU1111111 is present
        res_list = self.client.get('/api/customs/containers/', **self.headers_customs)
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(res_list.data['counts']['pending_customs'], 1)
        container_numbers = [c['container_number'] for c in res_list.data['data']]
        self.assertIn("MSCU1111111", container_numbers)

        # Customs Officer starts inspection: AWAITING_CUSTOMS -> UNDER_INSPECTION
        res_start = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            {"remarks": "Starting seal and physical package check"},
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_start.status_code, status.HTTP_200_OK)
        self.assertEqual(res_start.data['data']['container_status'], 'UNDER_INSPECTION')

        # Verify inspection record was created
        inspection = CustomsInspection.objects.filter(customs_inspection_container_id=container).first()
        self.assertIsNotNone(inspection)
        self.assertEqual(inspection.customs_inspection_status, 'IN_PROGRESS')
        self.assertEqual(inspection.customs_inspection_officer_id, self.user_customs)

        # Customs Officer submits inspection: Clear Container
        res_clear = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "CLEARED",
                "document_verification_status": "VERIFIED",
                "remarks": "Manifest verified and container seal intact."
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_clear.status_code, status.HTTP_200_OK)
        self.assertEqual(res_clear.data['data']['container_status'], 'CLEARED')

        # Reload container & check DB state
        container.refresh_from_db()
        self.assertEqual(container.container_status, 'CLEARED')

        inspection.refresh_from_db()
        self.assertEqual(inspection.customs_inspection_status, 'COMPLETED')
        self.assertEqual(inspection.customs_inspection_result, 'CLEARED')
        self.assertIsNotNone(inspection.customs_inspection_clearance_date)

        # Audit log verification
        audit_clear = AuditLog.objects.filter(
            audit_log_category='CUSTOMS',
            audit_log_action='CLEAR_CONTAINER',
            audit_log_target_id=str(container.container_id)
        ).first()
        self.assertIsNotNone(audit_clear)
        self.assertEqual(audit_clear.audit_log_role, 'Customs Officer')

    # =========================================================================
    # 2. Customs Hold Workflow
    # =========================================================================
    def test_02_customs_hold_workflow(self):
        """Container with discrepancy is placed on Customs Hold with reason and remarks."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU2222222",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AWAITING_CUSTOMS"
        )

        # Start inspection
        res_start = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_start.status_code, status.HTTP_200_OK)

        # Place on Customs Hold: requires hold_reason and remarks
        res_hold = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "HOLD",
                "document_verification_status": "ISSUE_FOUND",
                "hold_reason": "WEIGHT_DISCREPANCY",
                "remarks": "Declared weight differs from weighbridge scan by 3.5 tonnes."
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_hold.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hold.data['data']['container_status'], 'CUSTOMS_HOLD')

        container.refresh_from_db()
        self.assertEqual(container.container_status, 'CUSTOMS_HOLD')

        inspection = container.latest_customs_inspection
        self.assertEqual(inspection.customs_inspection_status, 'ON_HOLD')
        self.assertEqual(inspection.customs_inspection_result, 'HOLD')
        self.assertEqual(inspection.customs_inspection_hold_reason, 'WEIGHT_DISCREPANCY')

        # Audit log verified
        audit_hold = AuditLog.objects.filter(
            audit_log_category='CUSTOMS',
            audit_log_action='CUSTOMS_HOLD',
            audit_log_target_id=str(container.container_id)
        ).first()
        self.assertIsNotNone(audit_hold)
        self.assertIn("Weight discrepancy", audit_hold.audit_log_description)

    # =========================================================================
    # 3. Resume Inspection after Customs Hold
    # =========================================================================
    def test_03_resume_inspection_from_customs_hold(self):
        """Customs Officer can re-inspect a container on Customs Hold once documentation is clarified."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU3333333",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="CUSTOMS_HOLD"
        )
        CustomsInspection.objects.create(
            customs_inspection_container_id=container,
            customs_inspection_officer_id=self.user_customs,
            customs_inspection_status='ON_HOLD',
            customs_inspection_result='HOLD',
            customs_inspection_hold_reason='DOCUMENTATION_ISSUE',
            customs_inspection_remarks='Missing certificate of origin'
        )

        # Resume inspection
        res_resume = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            {"remarks": "Revised certificate received, resuming inspection"},
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_resume.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, 'UNDER_INSPECTION')

        # Now clear it
        res_clear = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "CLEARED",
                "document_verification_status": "VERIFIED",
                "remarks": "Certificate of origin verified."
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_clear.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, 'CLEARED')

    # =========================================================================
    # 4. Incomplete Verification Blocks Clearance
    # =========================================================================
    def test_04_incomplete_verification_blocks_clearance(self):
        """Cannot clear container if document verification is PENDING or ISSUE_FOUND."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU4444444",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="UNDER_INSPECTION"
        )
        res_fail = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "CLEARED",
                "document_verification_status": "PENDING",
                "remarks": "Trying to clear with pending documents"
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Document verification status must be 'VERIFIED'", str(res_fail.data))
        container.refresh_from_db()
        self.assertEqual(container.container_status, 'UNDER_INSPECTION')

    # =========================================================================
    # 5. Cannot Inspect Container Still in REGISTERED, ARRIVED, or AT_TERMINAL
    # =========================================================================
    def test_05_cannot_inspect_pre_customs_containers(self):
        """Containers that have not reached Awaiting Customs cannot be inspected by Customs."""
        c_reg = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU5555551",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="REGISTERED"
        )
        c_arr = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU5555552",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="ARRIVED"
        )
        c_term = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU5555553",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="AT_TERMINAL"
        )

        for c in [c_reg, c_arr, c_term]:
            res = self.client.post(
                f'/api/customs/containers/{c.container_id}/start-inspection/',
                format='json',
                **self.headers_customs
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("Awaiting Customs", str(res.data['message']))

    # =========================================================================
    # 6. Containers on Customs Hold CANNOT be Released
    # =========================================================================
    def test_06_container_on_hold_cannot_be_released(self):
        """A container on Customs Hold cannot be marked RELEASED."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU6666666",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="CUSTOMS_HOLD"
        )
        res = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "RELEASED"},
            format='json',
            **self.headers_gate
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid status transition", str(res.data['message']))

    # =========================================================================
    # 7. Un-cleared Containers CANNOT enter Release Workflow (Section 18)
    # =========================================================================
    def test_07_uncleared_containers_cannot_be_released(self):
        """System enforces: container cannot be Released unless container_status == CLEARED."""
        statuses_to_test = ['REGISTERED', 'ARRIVED', 'AT_TERMINAL', 'AWAITING_CUSTOMS', 'UNDER_INSPECTION', 'CUSTOMS_HOLD']
        for s in statuses_to_test:
            c = Container.objects.create(
                container_cargo_id=self.cargo,
                container_number=f"TCLU{s[:4]}999",
                container_type="20FT",
                container_gross_weight=Decimal("20.00"),
                container_status=s
            )
            res = self.client.post(
                f'/api/containers/{c.container_id}/status/',
                {"status": "RELEASED"},
                format='json',
                **self.headers_gate
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 8. RBAC: Unauthorized Roles Blocked from Customs Actions
    # =========================================================================
    def test_08_unauthorized_roles_blocked_from_customs_actions(self):
        """Shipping Companies, Terminal Operators, and Port Operations Officers cannot call customs APIs."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU8888888",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AWAITING_CUSTOMS"
        )

        unauthorized_headers = [self.headers_shipping, self.headers_terminal, self.headers_ops, self.headers_gate]

        for h in unauthorized_headers:
            # Blocked from customs worklist
            res_list = self.client.get('/api/customs/containers/', **h)
            self.assertEqual(res_list.status_code, status.HTTP_403_FORBIDDEN)

            # Blocked from start inspection
            res_start = self.client.post(f'/api/customs/containers/{container.container_id}/start-inspection/', **h)
            self.assertEqual(res_start.status_code, status.HTTP_403_FORBIDDEN)

            # Blocked from submit inspection
            res_submit = self.client.post(
                f'/api/customs/containers/{container.container_id}/submit-inspection/',
                {"inspection_result": "CLEARED", "document_verification_status": "VERIFIED"},
                format='json',
                **h
            )
            self.assertEqual(res_submit.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 9. Customs Officer Blocked from Non-Customs Operations
    # =========================================================================
    def test_09_customs_officer_blocked_from_non_customs_operations(self):
        """Customs Officer cannot approve arrival requests, manage berths, or release containers."""
        # 1. Blocked from approving arrival request
        unapproved_arr = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=timezone.now() + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=timezone.now() + timezone.timedelta(days=4),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=100,
            vessel_arrival_request_status="PENDING"
        )
        res_arr = self.client.post(f'/api/arrival-requests/{unapproved_arr.vessel_arrival_request_id}/approve/', **self.headers_customs)
        self.assertEqual(res_arr.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Blocked from managing berths
        res_berth = self.client.post('/api/admin/berths/', {"berth_name": "Unauthorized Berth", "berth_max_draft": "14.0"}, format='json', **self.headers_customs)
        self.assertEqual(res_berth.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Blocked from directly releasing container
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU9090909",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="CLEARED"
        )
        res_release = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "RELEASED"},
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_release.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 10. Officer Identity Taken Strictly from Authentication
    # =========================================================================
    def test_10_officer_identity_enforced_from_session(self):
        """Inspection officer identity is taken strictly from authenticated session, not spoofed request body."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU7171717",
            container_type="20FT",
            container_gross_weight=Decimal("20.00"),
            container_status="AWAITING_CUSTOMS"
        )
        # Attempt to spoof officer ID
        res = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            {"officer_id": 9999, "officer_name": "Fake Officer"},
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        inspection = container.latest_customs_inspection
        # Must be authenticated user Pooja Customs Officer, not 9999
        self.assertEqual(inspection.customs_inspection_officer_id, self.user_customs)
        self.assertEqual(res.data['inspection']['officer_name'], "Pooja Customs Officer")

    # =========================================================================
    # 11. Complete End-to-End Terminal -> Customs -> Gate Release Pipeline
    # =========================================================================
    def test_11_end_to_end_lifecycle_pipeline(self):
        """
        Verify the complete business lifecycle:
        REGISTERED -> ARRIVED -> AT_TERMINAL -> AWAITING_CUSTOMS ->
        UNDER_INSPECTION -> (CUSTOMS_HOLD -> UNDER_INSPECTION ->) CLEARED -> RELEASED
        """
        # 1. Create registered container
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU9990001",
            container_type="20FT",
            container_gross_weight=Decimal("21.50"),
            container_status="REGISTERED"
        )

        # 2. Terminal Operator receives container: REGISTERED -> ARRIVED
        res_arr = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "ARRIVED"},
            format='json',
            **self.headers_terminal
        )
        self.assertEqual(res_arr.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "ARRIVED")

        # 3. Terminal Operator moves to yard: ARRIVED -> AT_TERMINAL
        res_term = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "AT_TERMINAL"},
            format='json',
            **self.headers_terminal
        )
        self.assertEqual(res_term.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "AT_TERMINAL")

        # 4. Terminal Operator dispatches to Customs: AT_TERMINAL -> AWAITING_CUSTOMS
        res_cust_disp = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "AWAITING_CUSTOMS"},
            format='json',
            **self.headers_terminal
        )
        self.assertEqual(res_cust_disp.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "AWAITING_CUSTOMS")

        # Verify Gate Operator cannot release it yet
        res_blocked_gate = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "RELEASED"},
            format='json',
            **self.headers_gate
        )
        self.assertEqual(res_blocked_gate.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. Customs Officer starts inspection: AWAITING_CUSTOMS -> UNDER_INSPECTION
        res_start = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_start.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "UNDER_INSPECTION")

        # 6. Customs Officer places on Customs Hold first: UNDER_INSPECTION -> CUSTOMS_HOLD
        res_hold = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "HOLD",
                "document_verification_status": "ISSUE_FOUND",
                "hold_reason": "Documentation issue",
                "remarks": "Missing import declaration seal"
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_hold.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CUSTOMS_HOLD")

        # Verify Gate Operator is strictly blocked from releasing held container
        res_gate_hold = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "RELEASED"},
            format='json',
            **self.headers_gate
        )
        self.assertEqual(res_gate_hold.status_code, status.HTTP_400_BAD_REQUEST)

        # 7. Customs Officer re-inspects: CUSTOMS_HOLD -> UNDER_INSPECTION
        res_reinspect = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            {"remarks": "Re-inspection initiated after documentation submitted"},
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_reinspect.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "UNDER_INSPECTION")

        # 8. Customs Officer clears container: UNDER_INSPECTION -> CLEARED
        res_clear = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "CLEARED",
                "document_verification_status": "VERIFIED",
                "remarks": "All documents authenticated and seals verified."
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_clear.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "CLEARED")

        # 9. Gate & Truck Operations releases the container: CLEARED -> RELEASED
        res_gate_release = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "RELEASED"},
            format='json',
            **self.headers_gate
        )
        self.assertEqual(res_gate_release.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "RELEASED")

    # =========================================================================
    # 12. Clearance with Optional Empty Remarks & Worklist Refresh
    # =========================================================================
    def test_12_clearance_with_optional_empty_remarks_and_worklist_filter(self):
        """Confirm CLEARED with VERIFIED and empty remarks succeeds and updates worklist."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU6660001",
            container_type="40FT",
            container_gross_weight=Decimal("26.00"),
            container_status="AWAITING_CUSTOMS"
        )

        # 1. Put container into UNDER_INSPECTION
        res_start = self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_start.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "UNDER_INSPECTION")

        # Confirm it appears under Under Inspection worklist
        res_inspecting_list = self.client.get('/api/customs/containers/?status=UNDER_INSPECTION', **self.headers_customs)
        self.assertEqual(res_inspecting_list.status_code, status.HTTP_200_OK)
        inspecting_ids = [c['container_id'] for c in res_inspecting_list.data['data']]
        self.assertIn(container.container_id, inspecting_ids)

        # 2 & 3. Select VERIFIED + CLEARED with empty/optional remarks
        res_clear = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "CLEARED",
                "document_verification_status": "VERIFIED",
                "remarks": ""
            },
            format='json',
            **self.headers_customs
        )
        # 4. Confirm HTTP 200 success
        self.assertEqual(res_clear.status_code, status.HTTP_200_OK)

        # 5. Confirm container status becomes CLEARED
        container.refresh_from_db()
        self.assertEqual(container.container_status, 'CLEARED')

        # 6, 7, 8. Confirm inspection fields
        inspection = container.latest_customs_inspection
        self.assertIsNotNone(inspection)
        self.assertEqual(inspection.customs_inspection_status, 'COMPLETED')
        self.assertEqual(inspection.customs_inspection_result, 'CLEARED')
        self.assertEqual(inspection.customs_inspection_document_status, 'VERIFIED')
        self.assertIsNotNone(inspection.customs_inspection_completed_at)
        self.assertIsNotNone(inspection.customs_inspection_clearance_date)

        # 9. Confirm the container appears in the Cleared section of Customs dashboard
        res_cleared_list = self.client.get('/api/customs/containers/?status=CLEARED', **self.headers_customs)
        self.assertEqual(res_cleared_list.status_code, status.HTTP_200_OK)
        cleared_ids = [c['container_id'] for c in res_cleared_list.data['data']]
        self.assertIn(container.container_id, cleared_ids)

        # 10. Confirm it does not remain under Under Inspection
        res_inspecting_after = self.client.get('/api/customs/containers/?status=UNDER_INSPECTION', **self.headers_customs)
        inspecting_after_ids = [c['container_id'] for c in res_inspecting_after.data['data']]
        self.assertNotIn(container.container_id, inspecting_after_ids)

        # 11. Customs Officer must NOT directly release it
        res_release = self.client.post(
            f'/api/containers/{container.container_id}/status/',
            {"status": "RELEASED"},
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_release.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 13. Customs Hold Mandatory Fields Validation
    # =========================================================================
    def test_13_customs_hold_mandatory_validations(self):
        """CUSTOMS_HOLD requires both hold_reason and remarks."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU6660002",
            container_type="20FT",
            container_gross_weight=Decimal("19.00"),
            container_status="AWAITING_CUSTOMS"
        )
        self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            format='json',
            **self.headers_customs
        )

        # Missing hold reason
        res_no_reason = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "HOLD",
                "document_verification_status": "ISSUE_FOUND",
                "remarks": "Discrepancy noted"
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hold_reason', str(res_no_reason.data))

        # Missing remarks
        res_no_remarks = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "HOLD",
                "document_verification_status": "ISSUE_FOUND",
                "hold_reason": "CARGO_MISMATCH",
                "remarks": ""
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_no_remarks.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('remarks', str(res_no_remarks.data))

    # =========================================================================
    # 14. Invalid Clearance Rejected When Document Status Not Verified
    # =========================================================================
    def test_14_invalid_clearance_non_verified_document_status_rejected(self):
        """Clearance must be rejected when document verification is not VERIFIED."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU6660003",
            container_type="20FT",
            container_gross_weight=Decimal("15.00"),
            container_status="AWAITING_CUSTOMS"
        )
        self.client.post(
            f'/api/customs/containers/{container.container_id}/start-inspection/',
            format='json',
            **self.headers_customs
        )

        for invalid_doc_status in ['PENDING', 'ISSUE_FOUND']:
            res = self.client.post(
                f'/api/customs/containers/{container.container_id}/submit-inspection/',
                {
                    "inspection_result": "CLEARED",
                    "document_verification_status": invalid_doc_status,
                    "remarks": "Attempting invalid clearance"
                },
                format='json',
                **self.headers_customs
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            container.refresh_from_db()
            self.assertEqual(container.container_status, "UNDER_INSPECTION")

    # =========================================================================
    # 15. Additional Information Request Decision Workflow
    # =========================================================================
    def test_15_request_additional_information_workflow(self):
        """Customs Officer can request additional information with mandatory remarks."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU7770001",
            container_type="40FT",
            container_gross_weight=Decimal("22.50"),
            container_status="UNDER_INSPECTION",
            container_customs_status="UNDER_INSPECTION"
        )

        # Missing remarks should fail validation
        res_fail = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "ADDITIONAL_INFORMATION_REQUIRED",
                "document_verification_status": "PENDING",
                "remarks": "   "
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid submission with remarks
        res_ok = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "ADDITIONAL_INFORMATION_REQUIRED",
                "document_verification_status": "PENDING",
                "remarks": "Commercial invoice values mismatch with declared manifest. Submit updated invoice."
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_customs_status, "ADDITIONAL_INFORMATION_REQUIRED")
        self.assertEqual(container.container_status, "UNDER_INSPECTION")

        # Verify Audit Log
        audit = AuditLog.objects.filter(
            audit_log_category='CUSTOMS',
            audit_log_action='REQUEST_ADDITIONAL_INFO',
            audit_log_target_id=str(container.container_id)
        ).first()
        self.assertIsNotNone(audit)
        self.assertIn("additional information", audit.audit_log_description.lower())

    # =========================================================================
    # 16. Mark for Physical Inspection Workflow
    # =========================================================================
    def test_16_mark_for_physical_inspection_workflow(self):
        """Customs Officer can mark container for physical inspection."""
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU7770002",
            container_type="20FT",
            container_gross_weight=Decimal("18.00"),
            container_status="AWAITING_CUSTOMS",
            container_customs_status="PENDING_REVIEW"
        )

        res = self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "UNDER_INSPECTION",
                "document_verification_status": "PENDING",
                "remarks": "Direct physical seal and hazardous contents examination ordered."
            },
            format='json',
            **self.headers_customs
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        container.refresh_from_db()
        self.assertEqual(container.container_status, "UNDER_INSPECTION")
        self.assertEqual(container.container_customs_status, "UNDER_INSPECTION")

        # Verify Audit Log
        audit = AuditLog.objects.filter(
            audit_log_category='CUSTOMS',
            audit_log_action='UNDER_INSPECTION',
            audit_log_target_id=str(container.container_id)
        ).first()
        self.assertIsNotNone(audit)

    # =========================================================================
    # 17. Customs Decision History API & Scoping
    # =========================================================================
    def test_17_customs_decision_history_api(self):
        """GET /api/customs/history/ returns audit records with filtering and proper RBAC."""
        # Create sample container and record inspection decisions
        container = Container.objects.create(
            container_cargo_id=self.cargo,
            container_number="MSCU7770003",
            container_type="40FT",
            container_gross_weight=Decimal("24.00"),
            container_status="AWAITING_CUSTOMS"
        )

        # 1. Place on Hold
        self.client.post(
            f'/api/customs/containers/{container.container_id}/submit-inspection/',
            {
                "inspection_result": "HOLD",
                "document_verification_status": "ISSUE_FOUND",
                "hold_reason": "DOCUMENTATION_ISSUE",
                "remarks": "Missing import manifest stamp"
            },
            format='json',
            **self.headers_customs
        )

        # 2. Query history endpoint
        res = self.client.get('/api/customs/history/', **self.headers_customs)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'success')
        self.assertGreaterEqual(res.data['total_count'], 1)

        # 3. Action filter
        res_filter = self.client.get('/api/customs/history/?action=CUSTOMS_HOLD', **self.headers_customs)
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_filter.data['total_count'], 1)

        # 4. Unauthorized role rejected
        res_unauth = self.client.get('/api/customs/history/', **self.headers_shipping)
        self.assertEqual(res_unauth.status_code, status.HTTP_403_FORBIDDEN)



