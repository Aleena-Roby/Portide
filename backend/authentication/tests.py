from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from authentication.models import Login, User, ShippingCompany, Vessel, VesselArrivalRequest

class DeleteFunctionalityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Admin setup
        self.admin_login = Login.objects.create(
            login_email="admin@portide.gov",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.admin_user = User.objects.create(
            login_id=self.admin_login,
            user_full_name="Port Administrator",
            user_employee_id="ADM-2026-001",
            user_status="ACTIVE"
        )

        # 2. Staff user setup
        self.staff_login = Login.objects.create(
            login_email="ops.officer@portide.gov",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.staff_user = User.objects.create(
            login_id=self.staff_login,
            user_full_name="Ops Officer",
            user_employee_id="POO-2026-001",
            user_status="ACTIVE"
        )

        # 3. Shipping Company A setup
        self.company_a = ShippingCompany.objects.create(
            shipping_company_name="Pacific Lines",
            shipping_company_license_number="LIC-101",
            shipping_company_email="ops@pacific.com",
            shipping_company_phone="+1-555-0101",
            shipping_company_address="Port Pier 1",
            shipping_company_jurisdiction="International",
            shipping_company_status="ACTIVE"
        )
        self.comp_a_login = Login.objects.create(
            login_email="ops@pacific.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.comp_a_user = User.objects.create(
            login_id=self.comp_a_login,
            shipping_company_id=self.company_a,
            user_full_name="Pacific Agent",
            user_status="ACTIVE"
        )

        # 4. Shipping Company B setup
        self.company_b = ShippingCompany.objects.create(
            shipping_company_name="Atlantic Express",
            shipping_company_license_number="LIC-102",
            shipping_company_email="ops@atlantic.com",
            shipping_company_phone="+1-555-0102",
            shipping_company_address="Port Pier 2",
            shipping_company_jurisdiction="International",
            shipping_company_status="ACTIVE"
        )
        self.comp_b_login = Login.objects.create(
            login_email="ops@atlantic.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.comp_b_user = User.objects.create(
            login_id=self.comp_b_login,
            shipping_company_id=self.company_b,
            user_full_name="Atlantic Agent",
            user_status="ACTIVE"
        )

        # Vessels
        self.vessel_a = Vessel.objects.create(
            vessel_shipping_company_id=self.company_a,
            vessel_name="MV Pacific Voyager",
            vessel_imo_number="9876541",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Panama",
            vessel_length=220.0,
            vessel_draft=9.5,
            vessel_capacity=3000
        )
        self.vessel_b = Vessel.objects.create(
            vessel_shipping_company_id=self.company_b,
            vessel_name="MV Atlantic Leader",
            vessel_imo_number="9876542",
            vessel_type="BULK_CARRIER",
            vessel_flag="Liberia",
            vessel_length=190.0,
            vessel_draft=8.0,
            vessel_capacity=2500
        )

    # ================= USER DELETION TESTS =================
    def test_admin_delete_eligible_staff_user_success(self):
        response = self.client.delete(
            f"/api/admin/users/{self.staff_user.user_id}/",
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(pk=self.staff_user.user_id).exists())

    def test_admin_delete_own_account_fails(self):
        response = self.client.delete(
            f"/api/admin/users/{self.admin_user.user_id}/",
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_login.login_id),
            HTTP_X_USER_EMAIL="admin@portide.gov"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=self.admin_user.user_id).exists())

    def test_admin_delete_another_admin_fails(self):
        another_admin_login = Login.objects.create(
            login_email="admin2@portide.gov",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE"
        )
        another_admin_user = User.objects.create(
            login_id=another_admin_login,
            user_full_name="Admin Two",
            user_status="ACTIVE"
        )

        response = self.client.delete(
            f"/api/admin/users/{another_admin_user.user_id}/",
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.filter(pk=another_admin_user.user_id).exists())

    # ================= VESSEL DELETION TESTS =================
    def test_company_delete_own_vessel_without_requests_success(self):
        response = self.client.delete(
            f"/api/vessels/{self.vessel_a.vessel_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Vessel.objects.filter(pk=self.vessel_a.vessel_id).exists())

    def test_company_delete_other_company_vessel_forbidden(self):
        response = self.client.delete(
            f"/api/vessels/{self.vessel_b.vessel_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Vessel.objects.filter(pk=self.vessel_b.vessel_id).exists())

    def test_company_delete_vessel_with_dependent_arrival_requests_blocked(self):
        VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now(),
            vessel_arrival_request_cargo_type="Containers",
            vessel_arrival_request_cargo_quantity=500.0,
            vessel_arrival_request_status="PENDING"
        )

        response = self.client.delete(
            f"/api/vessels/{self.vessel_a.vessel_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("associated operational records", response.json()["message"])
        self.assertTrue(Vessel.objects.filter(pk=self.vessel_a.vessel_id).exists())

    # ================= ARRIVAL REQUEST DELETION TESTS =================
    def test_delete_pending_arrival_request_success(self):
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now(),
            vessel_arrival_request_cargo_type="Containers",
            vessel_arrival_request_cargo_quantity=500.0,
            vessel_arrival_request_status="PENDING"
        )

        response = self.client.delete(
            f"/api/arrival-requests/{req.vessel_arrival_request_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(VesselArrivalRequest.objects.filter(pk=req.vessel_arrival_request_id).exists())

    def test_delete_approved_arrival_request_rejected_by_backend(self):
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now(),
            vessel_arrival_request_cargo_type="Containers",
            vessel_arrival_request_cargo_quantity=500.0,
            vessel_arrival_request_status="APPROVED"
        )

        response = self.client.delete(
            f"/api/arrival-requests/{req.vessel_arrival_request_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only pending arrival requests can be deleted", response.json()["message"])
        self.assertTrue(VesselArrivalRequest.objects.filter(pk=req.vessel_arrival_request_id).exists())

    def test_delete_rejected_arrival_request_rejected_by_backend(self):
        req = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_a,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now(),
            vessel_arrival_request_cargo_type="Containers",
            vessel_arrival_request_cargo_quantity=500.0,
            vessel_arrival_request_status="REJECTED"
        )

        response = self.client.delete(
            f"/api/arrival-requests/{req.vessel_arrival_request_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only pending arrival requests can be deleted", response.json()["message"])
        self.assertTrue(VesselArrivalRequest.objects.filter(pk=req.vessel_arrival_request_id).exists())

    def test_delete_other_company_arrival_request_forbidden(self):
        req_b = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel_b,
            vessel_arrival_request_requested_arrival_at=timezone.now(),
            vessel_arrival_request_requested_departure_at=timezone.now(),
            vessel_arrival_request_cargo_type="Grain",
            vessel_arrival_request_cargo_quantity=1000.0,
            vessel_arrival_request_status="PENDING"
        )

        response = self.client.delete(
            f"/api/arrival-requests/{req_b.vessel_arrival_request_id}/",
            HTTP_X_USER_EMAIL="ops@pacific.com",
            HTTP_X_USER_ROLE="shipping_company",
            HTTP_X_USER_ID=str(self.comp_a_login.login_id)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(VesselArrivalRequest.objects.filter(pk=req_b.vessel_arrival_request_id).exists())


class EditStaffUserTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin User setup
        self.admin_login = Login.objects.create(
            login_email="admin@portide.gov",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.admin_user = User.objects.create(
            login_id=self.admin_login,
            user_full_name="Port Administrator",
            user_employee_id="ADM-2026-001",
            user_status="ACTIVE"
        )

        # Staff User setup
        self.staff_login = Login.objects.create(
            login_email="arun.mathew@gmail.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.staff_user = User.objects.create(
            login_id=self.staff_login,
            user_full_name="Arun Mathew",
            user_phone="+91 9876543210",
            user_employee_id="POO-2026-001",
            user_department="Port Operations",
            user_designation="Port Operations Officer",
            user_status="ACTIVE"
        )

    def test_edit_user_full_name_and_phone_success(self):
        response = self.client.put(
            f"/api/admin/users/{self.staff_user.user_id}/",
            data={
                "user_full_name": "Arun Mathew Updated",
                "user_phone": "+91 9123456789"
            },
            format='json',
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_user.user_id)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "success")

        # Verify DB update
        self.staff_user.refresh_from_db()
        self.assertEqual(self.staff_user.user_full_name, "Arun Mathew Updated")
        self.assertEqual(self.staff_user.user_phone, "+919123456789")

        self.assertEqual(self.staff_user.user_employee_id, "POO-2026-001")
        self.assertEqual(self.staff_login.login_email, "arun.mathew@gmail.com")
        self.assertEqual(self.staff_login.login_role, "port_operations_officer")

    def test_edit_user_empty_full_name_rejected(self):
        response = self.client.put(
            f"/api/admin/users/{self.staff_user.user_id}/",
            data={
                "user_full_name": "   ",
                "user_phone": "+91 9123456789"
            },
            format='json',
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_user.user_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["status"], "error")

    def test_edit_user_attempt_protected_field_modification_rejected(self):
        # Attempt to change protected role and employee ID
        response = self.client.put(
            f"/api/admin/users/{self.staff_user.user_id}/",
            data={
                "user_full_name": "Arun Mathew",
                "user_phone": "+91 9876543210",
                "role": "customs_officer",
                "user_employee_id": "HACKED-001"
            },
            format='json',
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_user.user_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["status"], "error")

        # Verify no changes made to DB
        self.staff_user.refresh_from_db()
        self.assertEqual(self.staff_user.user_employee_id, "POO-2026-001")
        self.assertEqual(self.staff_login.login_role, "port_operations_officer")

    def test_edit_admin_account_rejected(self):
        response = self.client.put(
            f"/api/admin/users/{self.admin_user.user_id}/",
            data={
                "user_full_name": "New Admin Name",
                "user_phone": "+91 9999999999"
            },
            format='json',
            HTTP_X_USER_ROLE="port_administrator",
            HTTP_X_USER_ID=str(self.admin_user.user_id)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Port Administrator profile edits must be performed via Profile Settings.", response.json()["message"])


class InternationalPhoneValidationTests(TestCase):
    def test_validate_and_normalize_india_phone(self):
        from authentication.validators import validate_international_phone_number
        result = validate_international_phone_number("+91 98765 43210", default_region="IN")
        self.assertEqual(result, "+919876543210")

    def test_validate_and_normalize_uk_phone(self):
        from authentication.validators import validate_international_phone_number
        result = validate_international_phone_number("+44 7911 123456", default_region="GB")
        self.assertEqual(result, "+447911123456")

    def test_validate_and_normalize_uae_phone(self):
        from authentication.validators import validate_international_phone_number
        result = validate_international_phone_number("+971 50 123 4567", default_region="AE")
        self.assertEqual(result, "+971501234567")

    def test_validate_and_normalize_us_phone(self):
        from authentication.validators import validate_international_phone_number
        result = validate_international_phone_number("+1 202 555 0123", default_region="US")
        self.assertEqual(result, "+12025550123")

    def test_invalid_phone_number_raises_validation_error(self):
        from authentication.validators import validate_international_phone_number
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError) as ctx:
            validate_international_phone_number("12345", default_region="IN", required=True)
        self.assertIn("Please enter a valid phone number for the selected country.", str(ctx.exception))


class BerthAndSchedulingTests(TestCase):
    def setUp(self):
        from authentication.models import Login, User, ShippingCompany, Vessel, VesselArrivalRequest, Berth, VesselSchedule
        from django.utils import timezone
        import datetime

        self.client = APIClient()

        # Create active shipping company & user
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Oceanic Logistics",
            shipping_company_license_number="LIC-8821",
            shipping_company_email="ops@oceanic.com",
            shipping_company_phone="+12025550123",
            shipping_company_address="100 Harbor Way",
            shipping_company_jurisdiction="US",
            shipping_company_status="ACTIVE"
        )
        self.sc_login = Login.objects.create(
            login_email="sc@oceanic.com",
            login_password="hash",
            login_role="shipping_company",
            login_status="ACTIVE"
        )
        self.sc_user = User.objects.create(
            login_id=self.sc_login,
            shipping_company_id=self.company,
            user_full_name="Shipping Agent",
            user_status="ACTIVE"
        )

        # Create Port Operations Officer
        self.poo_login = Login.objects.create(
            login_email="officer@port.gov",
            login_password="hash",
            login_role="port_operations_officer",
            login_status="ACTIVE"
        )
        self.poo_user = User.objects.create(
            login_id=self.poo_login,
            user_full_name="Officer John",
            user_status="ACTIVE"
        )

        # Create Vessel
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="MV Horizon Star",
            vessel_imo_number="9876543",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Panama",
            vessel_length=220.50,
            vessel_draft=11.20,
            vessel_capacity=8500,
            vessel_status="ACTIVE"
        )

        now = timezone.now()
        # Approved arrival request
        self.approved_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + datetime.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + datetime.timedelta(days=2),
            vessel_arrival_request_cargo_type="Containerized Goods",
            vessel_arrival_request_cargo_quantity=5000.00,
            vessel_arrival_request_status="APPROVED",
            vessel_arrival_request_reviewed_by=self.poo_user
        )

        # Pending arrival request
        self.pending_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + datetime.timedelta(days=5),
            vessel_arrival_request_requested_departure_at=now + datetime.timedelta(days=6),
            vessel_arrival_request_cargo_type="Bulk Grain",
            vessel_arrival_request_cargo_quantity=2000.00,
            vessel_arrival_request_status="PENDING"
        )

    def test_berth_list_auto_seeds_default_berths(self):
        from rest_framework import status
        response = self.client.get('/api/berths/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.json()['data']) >= 4)
        berth_names = [b['berth_name'] for b in response.json()['data']]
        self.assertIn('Berth 01', berth_names)

    def test_schedule_creation_for_approved_request(self):
        from rest_framework import status
        from authentication.models import Berth
        from django.utils import timezone
        import datetime

        # Seed berths first
        self.client.get('/api/berths/')
        berth = Berth.objects.first()

        now = timezone.now()
        payload = {
            'vessel_arrival_request_id': self.approved_request.vessel_arrival_request_id,
            'berth_id': berth.berth_id,
            'scheduled_arrival_at': (now + datetime.timedelta(days=1)).isoformat(),
            'scheduled_departure_at': (now + datetime.timedelta(days=2)).isoformat(),
            'operational_remarks': 'Tugboats assigned.'
        }
        headers = {
            'HTTP_X_USER_EMAIL': self.poo_login.login_email,
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.poo_login.login_id)
        }

        response = self.client.post('/api/schedules/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(response.json()['data']['vessel_schedule_status'], 'SCHEDULED')

    def test_cannot_schedule_pending_request(self):
        from rest_framework import status
        from authentication.models import Berth
        from django.utils import timezone
        import datetime

        self.client.get('/api/berths/')
        berth = Berth.objects.first()
        now = timezone.now()

        payload = {
            'vessel_arrival_request_id': self.pending_request.vessel_arrival_request_id,
            'berth_id': berth.berth_id,
            'scheduled_arrival_at': (now + datetime.timedelta(days=5)).isoformat(),
            'scheduled_departure_at': (now + datetime.timedelta(days=6)).isoformat(),
        }
        headers = {
            'HTTP_X_USER_EMAIL': self.poo_login.login_email,
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.poo_login.login_id)
        }

        response = self.client.post('/api/schedules/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only APPROVED arrival requests can be scheduled", response.json()['message'])

    def test_valid_status_transition_sequence(self):
        from rest_framework import status
        from authentication.models import Berth, VesselSchedule
        from django.utils import timezone
        import datetime

        self.client.get('/api/berths/')
        berth = Berth.objects.first()
        now = timezone.now()

        schedule = VesselSchedule.objects.create(
            vessel_schedule_arrival_request_id=self.approved_request,
            vessel_schedule_berth_id=berth,
            vessel_schedule_scheduled_arrival_at=now + datetime.timedelta(days=1),
            vessel_schedule_scheduled_departure_at=now + datetime.timedelta(days=2),
            vessel_schedule_status='SCHEDULED'
        )

        headers = {
            'HTTP_X_USER_EMAIL': self.poo_login.login_email,
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.poo_login.login_id)
        }

        # 1. Invalid backward transition (SCHEDULED -> DEPARTED)
        bad_res = self.client.patch(f'/api/schedules/{schedule.vessel_schedule_id}/status/', {'status': 'DEPARTED'}, format='json', **headers)
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Valid transition: SCHEDULED -> ARRIVED
        res1 = self.client.patch(f'/api/schedules/{schedule.vessel_schedule_id}/status/', {'status': 'ARRIVED'}, format='json', **headers)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.json()['data']['vessel_schedule_status'], 'ARRIVED')

        # 3. Valid transition: ARRIVED -> AT_BERTH
        res2 = self.client.patch(f'/api/schedules/{schedule.vessel_schedule_id}/status/', {'status': 'AT_BERTH'}, format='json', **headers)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.json()['data']['vessel_schedule_status'], 'AT_BERTH')

        # 4. Valid transition: AT_BERTH -> DEPARTED
        res3 = self.client.patch(f'/api/schedules/{schedule.vessel_schedule_id}/status/', {'status': 'DEPARTED'}, format='json', **headers)
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.json()['data']['vessel_schedule_status'], 'DEPARTED')




