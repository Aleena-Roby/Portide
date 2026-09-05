import datetime
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from rest_framework.test import APIClient
from rest_framework import status
from authentication.models import (
    Login, User, ShippingCompany, Vessel, VesselArrivalRequest,
    Berth, VesselSchedule, AuditLog
)
from authentication.audit_service import create_audit_log

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
        self.assertIn("Administrator accounts cannot be modified", response.json()["message"])


class InternationalPhoneValidationTests(TestCase):
    def test_all_twelve_supported_countries_validation(self):
        from authentication.validators import validate_international_phone_number
        test_cases = [
            ("Singapore", "+65 8123 4567", "SG", "+6581234567"),
            ("India", "+91 98765 43210", "IN", "+919876543210"),
            ("UAE", "+971 50 123 4567", "AE", "+971501234567"),
            ("UK", "+44 7912 345678", "GB", "+447912345678"),
            ("Germany", "+49 1512 3456789", "DE", "+4915123456789"),
            ("Japan", "+81 90 1234 5678", "JP", "+819012345678"),
            ("US", "+1 202 555 0123", "US", "+12025550123"),
            ("Netherlands", "+31 6 12345678", "NL", "+31612345678"),
            ("Greece", "+30 691 234 5678", "GR", "+306912345678"),
            ("China", "+86 138 0013 8000", "CN", "+8613800138000"),
            ("Panama", "+507 6123 4567", "PA", "+50761234567"),
            ("Marshall Islands", "+692 235 1234", "MH", "+6922351234"),
        ]

        for country_name, phone_input, region, expected in test_cases:
            with self.subTest(country=country_name):
                result = validate_international_phone_number(phone_input, default_region=region)
                self.assertEqual(result, expected)

    def test_national_number_with_default_region_resolution(self):
        from authentication.validators import validate_international_phone_number
        # Using country name as default region
        result = validate_international_phone_number("8123 4567", default_region="Singapore")
        self.assertEqual(result, "+6581234567")

        result2 = validate_international_phone_number("235 1234", default_region="Marshall Islands")
        self.assertEqual(result2, "+6922351234")

    def test_rejection_of_unsupported_countries(self):
        from authentication.validators import validate_international_phone_number
        from rest_framework.exceptions import ValidationError

        unsupported_phones = [
            "+33 6 12 34 56 78",    # France
            "+61 412 345 678",      # Australia
            "+55 11 91234-5678",    # Brazil
            "+7 912 345-67-89",     # Russia
            "+39 312 3456789",      # Italy
        ]

        for phone in unsupported_phones:
            with self.subTest(phone=phone):
                with self.assertRaises(ValidationError) as ctx:
                    validate_international_phone_number(phone, required=True)
                self.assertIn("Please enter a valid phone number for the selected country.", str(ctx.exception))

    def test_invalid_phone_number_raises_validation_error(self):
        from authentication.validators import validate_international_phone_number
        from rest_framework.exceptions import ValidationError
        
        invalid_inputs = [
            "12345",
            "+999 12345678",
            "+65 INVALID",
            "abc",
            "+1 123",
        ]
        for invalid in invalid_inputs:
            with self.subTest(input=invalid):
                with self.assertRaises(ValidationError) as ctx:
                    validate_international_phone_number(invalid, default_region="SG", required=True)
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


class VesselEditFeatureTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from authentication.models import Login, User, ShippingCompany, Vessel

        self.client = APIClient()

        # Company A (Owner)
        self.company_a = ShippingCompany.objects.create(
            shipping_company_name="Pacific Freight Carriers Ltd.",
            shipping_company_license_number="LIC-PAC-001",
            shipping_company_email="ops@pacific.com",
            shipping_company_phone="+6581234567",
            shipping_company_address="12 Marina Bay",
            shipping_company_jurisdiction="Singapore",
            shipping_company_status="ACTIVE"
        )
        self.login_a = Login.objects.create(
            login_email="ops@pacific.com",
            login_password="hash",
            login_role="shipping_company",
            login_status="ACTIVE"
        )
        self.user_a = User.objects.create(
            login_id=self.login_a,
            shipping_company_id=self.company_a,
            user_full_name="Capt. Arthur Pendelton",
            user_status="ACTIVE"
        )

        # Company B (Other company)
        self.company_b = ShippingCompany.objects.create(
            shipping_company_name="Atlantic Cargo Inc.",
            shipping_company_license_number="LIC-ATL-002",
            shipping_company_email="ops@atlantic.com",
            shipping_company_phone="+12025550123",
            shipping_company_address="45 Ocean Ave",
            shipping_company_jurisdiction="United States",
            shipping_company_status="ACTIVE"
        )
        self.login_b = Login.objects.create(
            login_email="ops@atlantic.com",
            login_password="hash",
            login_role="shipping_company",
            login_status="ACTIVE"
        )

        # Vessel owned by Company A
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company_a,
            vessel_name="MV Pacific Pioneer",
            vessel_imo_number="9876543",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Panama",
            vessel_call_sign="3E245",
            vessel_length=210.0,
            vessel_draft=8.5,
            vessel_capacity=2500,
            vessel_status="ACTIVE"
        )

    def test_edit_vessel_success(self):
        from rest_framework import status
        headers = {
            'HTTP_X_USER_EMAIL': self.login_a.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login_a.login_id)
        }
        payload = {
            'vessel_name': 'MV Pacific Pioneer II',
            'vessel_type': 'BULK_CARRIER',
            'vessel_flag': 'Singapore',
            'vessel_call_sign': '9V123',
            'vessel_length': 225.5,
            'vessel_draft': 9.2,
            'vessel_capacity': 3200
        }

        response = self.client.patch(f'/api/vessels/{self.vessel.vessel_id}/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(response.json()['message'], 'Vessel details updated successfully.')

        self.vessel.refresh_from_db()
        self.assertEqual(self.vessel.vessel_name, 'MV Pacific Pioneer II')
        self.assertEqual(self.vessel.vessel_type, 'BULK_CARRIER')
        self.assertEqual(self.vessel.vessel_flag, 'Singapore')
        self.assertEqual(self.vessel.vessel_call_sign, '9V123')
        self.assertEqual(float(self.vessel.vessel_length), 225.5)
        self.assertEqual(float(self.vessel.vessel_draft), 9.2)
        self.assertEqual(self.vessel.vessel_capacity, 3200)
        # IMO, ownership, and status remain unchanged
        self.assertEqual(self.vessel.vessel_imo_number, '9876543')
        self.assertEqual(self.vessel.vessel_shipping_company_id, self.company_a)
        self.assertEqual(self.vessel.vessel_status, 'ACTIVE')

    def test_edit_vessel_optional_call_sign(self):
        from rest_framework import status
        headers = {
            'HTTP_X_USER_EMAIL': self.login_a.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login_a.login_id)
        }
        payload = {
            'vessel_name': 'MV Pacific Pioneer',
            'vessel_type': 'CONTAINER_SHIP',
            'vessel_flag': 'Panama',
            'vessel_call_sign': '',
            'vessel_length': 210.0,
            'vessel_draft': 8.5,
            'vessel_capacity': 2500
        }

        response = self.client.patch(f'/api/vessels/{self.vessel.vessel_id}/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.vessel.refresh_from_db()
        self.assertEqual(self.vessel.vessel_call_sign, '')

    def test_cannot_edit_another_companys_vessel(self):
        from rest_framework import status
        headers = {
            'HTTP_X_USER_EMAIL': self.login_b.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login_b.login_id)
        }
        payload = {
            'vessel_name': 'Hacked Vessel Name',
            'vessel_type': 'CONTAINER_SHIP',
            'vessel_flag': 'Panama',
            'vessel_length': 210.0,
            'vessel_draft': 8.5,
            'vessel_capacity': 2500
        }

        response = self.client.patch(f'/api/vessels/{self.vessel.vessel_id}/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("You are not authorized to edit another shipping company's vessel.", response.json()['message'])

    def test_edit_vessel_validation_failures(self):
        from rest_framework import status
        headers = {
            'HTTP_X_USER_EMAIL': self.login_a.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login_a.login_id)
        }

        # 1. Blank vessel name
        res1 = self.client.patch(f'/api/vessels/{self.vessel.vessel_id}/', {'vessel_name': '   '}, format='json', **headers)
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Negative length
        res2 = self.client.patch(f'/api/vessels/{self.vessel.vessel_id}/', {'vessel_length': -50}, format='json', **headers)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Attempting to modify protected IMO number to something else
        res3 = self.client.patch(f'/api/vessels/{self.vessel.vessel_id}/', {'vessel_imo_number': '1111111'}, format='json', **headers)
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Modification of vessel_imo_number is not permitted", str(res3.json()))


class ArrivalRequestAdvanceValidationTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from authentication.models import Login, User, ShippingCompany, Vessel, SystemSetting
        from django.utils import timezone

        self.client = APIClient()

        self.company = ShippingCompany.objects.create(
            shipping_company_name="Pacific Lines",
            shipping_company_license_number="LIC-PL-009",
            shipping_company_email="admin@pacificlines.com",
            shipping_company_phone="+6581234567",
            shipping_company_address="Port Zone 1",
            shipping_company_jurisdiction="Singapore",
            shipping_company_status="ACTIVE"
        )
        self.login = Login.objects.create(
            login_email="admin@pacificlines.com",
            login_password="hash",
            login_role="shipping_company",
            login_status="ACTIVE"
        )
        self.user = User.objects.create(
            login_id=self.login,
            shipping_company_id=self.company,
            user_full_name="Fleet Officer",
            user_status="ACTIVE"
        )
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="MV Pacific Horizon",
            vessel_imo_number="9123456",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Singapore",
            vessel_length=250.0,
            vessel_draft=11.5,
            vessel_capacity=4500,
            vessel_status="ACTIVE"
        )

        self.admin_login = Login.objects.create(
            login_email="portadmin@portide.com",
            login_password="hash",
            login_role="port_administrator",
            login_status="ACTIVE"
        )

        # Clear any system settings so default 2 days applies
        SystemSetting.objects.filter(system_setting_key='MIN_ARRIVAL_ADVANCE_DAYS').delete()

    def test_past_date_rejected(self):
        from rest_framework import status
        from django.utils import timezone
        import datetime

        now = timezone.now()
        past_arrival = now - datetime.timedelta(days=2)
        past_departure = past_arrival + datetime.timedelta(days=1)

        payload = {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': past_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': past_departure.isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }
        headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }

        response = self.client.post('/api/arrival-requests/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Requested arrival time cannot be in the past.", str(response.json()))

    def test_today_arrival_accepted(self):
        from rest_framework import status
        from django.utils import timezone
        import datetime

        now = timezone.now()
        today_arrival = now + datetime.timedelta(hours=2)
        today_departure = today_arrival + datetime.timedelta(days=1)

        payload = {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': today_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': today_departure.isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }
        headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }

        response = self.client.post('/api/arrival-requests/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')

    def test_tomorrow_arrival_accepted(self):
        from rest_framework import status
        from django.utils import timezone
        import datetime

        now = timezone.now()
        tomorrow_arrival = now + datetime.timedelta(days=1)
        tomorrow_departure = tomorrow_arrival + datetime.timedelta(days=1)

        payload = {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': tomorrow_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': tomorrow_departure.isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }
        headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }

        response = self.client.post('/api/arrival-requests/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')

    def test_future_arrival_accepted(self):
        from rest_framework import status
        from django.utils import timezone
        import datetime

        now = timezone.now()
        future_arrival = now + datetime.timedelta(days=7)
        future_departure = future_arrival + datetime.timedelta(days=2)

        payload = {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': future_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': future_departure.isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }
        headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }

        response = self.client.post('/api/arrival-requests/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['status'], 'success')

    def test_departure_validation(self):
        from rest_framework import status
        from django.utils import timezone
        import datetime

        now = timezone.now()
        valid_arrival = now + datetime.timedelta(days=4)
        
        headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }

        # 1. Departure before arrival
        res1 = self.client.post('/api/arrival-requests/', {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': valid_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': (valid_arrival - datetime.timedelta(hours=2)).isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }, format='json', **headers)
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Requested departure time must be later than requested arrival time.", str(res1.json()))

        # 2. Departure equal to arrival
        res2 = self.client.post('/api/arrival-requests/', {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': valid_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': valid_arrival.isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }, format='json', **headers)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Requested departure time must be later than requested arrival time.", str(res2.json()))

    def test_dynamic_configurable_advance_days(self):
        from rest_framework import status
        from authentication.models import SystemSetting
        from django.utils import timezone
        import datetime

        # Port Admin explicitly configures MIN_ARRIVAL_ADVANCE_DAYS to 3
        SystemSetting.objects.update_or_create(
            system_setting_key='MIN_ARRIVAL_ADVANCE_DAYS',
            defaults={'system_setting_value': '3'}
        )

        now = timezone.localtime(timezone.now())
        two_days_arrival = (now + datetime.timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0)
        three_days_arrival = (now + datetime.timedelta(days=3)).replace(hour=10, minute=0, second=0, microsecond=0)

        headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }

        # 2 days in advance is REJECTED when 3 days configured
        res_two = self.client.post('/api/arrival-requests/', {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': two_days_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': (two_days_arrival + datetime.timedelta(days=1)).isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }, format='json', **headers)
        self.assertEqual(res_two.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("at least 3 days in advance", str(res_two.json()))

        # 3 days in advance is ACCEPTED
        res_three = self.client.post('/api/arrival-requests/', {
            'vessel_arrival_request_vessel_id': self.vessel.vessel_id,
            'vessel_arrival_request_requested_arrival_at': three_days_arrival.isoformat(),
            'vessel_arrival_request_requested_departure_at': (three_days_arrival + datetime.timedelta(days=1)).isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 500
        }, format='json', **headers)
        self.assertEqual(res_three.status_code, status.HTTP_201_CREATED)

    def test_port_settings_api(self):
        from rest_framework import status

        # 1. Public GET
        get_res = self.client.get('/api/settings/port-config/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertIn('min_arrival_advance_days', get_res.json()['data'])

        # 2. Non-admin PATCH -> 403
        non_admin_headers = {
            'HTTP_X_USER_EMAIL': self.login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.login.login_id)
        }
        patch_res1 = self.client.patch('/api/settings/port-config/', {'min_arrival_advance_days': 4}, format='json', **non_admin_headers)
        self.assertEqual(patch_res1.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Admin PATCH -> 200
        admin_headers = {
            'HTTP_X_USER_EMAIL': self.admin_login.login_email,
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.admin_login.login_id)
        }
        patch_res2 = self.client.patch('/api/settings/port-config/', {'min_arrival_advance_days': 4}, format='json', **admin_headers)
        self.assertEqual(patch_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res2.json()['data']['min_arrival_advance_days'], 4)


class SecurityAuditLogModuleTests(TestCase):
    """
    Comprehensive Test Suite for Central Security & Audit Log Module.
    Validates:
    - Real event logging across Authentication, User Management, Vessels, Arrivals, Berths, Schedules
    - Proper IP address capture & actor resolution
    - Port Administrator RBAC protection (403 for non-admins)
    - Filtering by category, search by actor/action/target, and pagination
    - Future module readiness (Customs, Gate & Truck Operations)
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Port Administrator
        self.admin_login = Login.objects.create(
            login_email="admin@portide.gov",
            login_password=make_password("AdminPass123!"),
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.admin_user = User.objects.create(
            login_id=self.admin_login,
            user_full_name="Port Administrator",
            user_employee_id="ADM-001",
            user_status="ACTIVE"
        )
        self.admin_headers = {
            'HTTP_X_USER_EMAIL': self.admin_login.login_email,
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.admin_login.login_id)
        }

        # 2. Port Operations Officer
        self.ops_login = Login.objects.create(
            login_email="ops@portide.gov",
            login_password=make_password("OpsPass123!"),
            login_role="port_operations_officer",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.ops_user = User.objects.create(
            login_id=self.ops_login,
            user_full_name="Operations Officer John",
            user_employee_id="POO-001",
            user_status="ACTIVE"
        )
        self.ops_headers = {
            'HTTP_X_USER_EMAIL': self.ops_login.login_email,
            'HTTP_X_USER_ROLE': 'port_operations_officer',
            'HTTP_X_USER_ID': str(self.ops_login.login_id)
        }

        # 3. Active Shipping Company
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Oceanic Logistics Corp",
            shipping_company_license_number="LIC-OCN-999",
            shipping_company_email="agent@oceanic.com",
            shipping_company_phone="+1-555-0999",
            shipping_company_address="Harbor Dock 5",
            shipping_company_jurisdiction="Panama",
            shipping_company_status="ACTIVE"
        )
        self.company_login = Login.objects.create(
            login_email="agent@oceanic.com",
            login_password=make_password("OceanicPass123!"),
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.company_user = User.objects.create(
            login_id=self.company_login,
            shipping_company_id=self.company,
            user_full_name="Capt. Thomas Hardy",
            user_status="ACTIVE"
        )
        self.company_headers = {
            'HTTP_X_USER_EMAIL': self.company_login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.company_login.login_id)
        }

        # Clear any setup audit logs
        AuditLog.objects.all().delete()

    def test_login_success_and_failure_audit_logging(self):
        # Successful login
        res1 = self.client.post('/api/auth/login/', {
            'email': 'agent@oceanic.com',
            'password': 'OceanicPass123!'
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        log1 = AuditLog.objects.filter(audit_log_action='LOGIN').first()
        self.assertIsNotNone(log1)
        self.assertEqual(log1.audit_log_status, 'SUCCESS')
        self.assertEqual(log1.audit_log_category, 'AUTHENTICATION')
        self.assertEqual(log1.audit_log_actor_name, 'Capt. Thomas Hardy')

        # Failed login: incorrect password
        res2 = self.client.post('/api/auth/login/', {
            'email': 'agent@oceanic.com',
            'password': 'WrongPassword999!'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_401_UNAUTHORIZED)

        log2 = AuditLog.objects.filter(audit_log_action='LOGIN_FAILED', audit_log_status='FAILED').first()
        self.assertIsNotNone(log2)
        self.assertIn('Incorrect password', log2.audit_log_description)

        # Logout audit log
        res3 = self.client.post('/api/auth/logout/', {}, format='json', **self.company_headers)
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        log3 = AuditLog.objects.filter(audit_log_action='LOGOUT').first()
        self.assertIsNotNone(log3)
        self.assertEqual(log3.audit_log_status, 'SUCCESS')

    def test_shipping_company_registration_lifecycle_audit_logging(self):
        # 1. Registration
        reg_payload = {
            'request_company_name': 'Nordic Seaways',
            'request_registration_no': 'LIC-NOR-777',
            'request_applicant_name': 'Lars Svensson',
            'request_email': 'contact@nordic.com',
            'request_phone': '+65 6123 4567',
            'request_address': 'Oslo Port Quay 3',
            'request_jurisdiction': 'SG',
            'password': 'SecureNordicPass123!',
            'confirm_password': 'SecureNordicPass123!'
        }
        res_reg = self.client.post('/api/auth/registration/', reg_payload, format='json')
        self.assertEqual(res_reg.status_code, status.HTTP_201_CREATED)

        reg_log = AuditLog.objects.filter(audit_log_action='CREATE', audit_log_category='SHIPPING_COMPANY').first()
        self.assertIsNotNone(reg_log)
        self.assertIn('Nordic Seaways', reg_log.audit_log_description)

        from authentication.models import RegistrationRequest
        created_company = ShippingCompany.objects.get(shipping_company_license_number='LIC-NOR-777')
        reg_req = RegistrationRequest.objects.get(shipping_company_id=created_company)

        # 2. Rejection of registration request
        res_reject = self.client.post(
            f'/api/admin/registration-requests/{reg_req.registration_request_id}/reject/',
            {'rejection_reason': 'Missing official maritime license documentation.'},
            format='json',
            **self.admin_headers
        )
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)

        reject_log = AuditLog.objects.filter(audit_log_action='REJECT', audit_log_category='SHIPPING_COMPANY').first()
        self.assertIsNotNone(reject_log)
        self.assertEqual(reject_log.audit_log_actor_name, 'Port Administrator')
        self.assertIn('Missing official maritime license', reject_log.audit_log_description)

        # 3. Approval of registration request
        res_approve = self.client.post(
            f'/api/admin/registration-requests/{reg_req.registration_request_id}/approve/',
            {},
            format='json',
            **self.admin_headers
        )
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)

        approve_log = AuditLog.objects.filter(audit_log_action='APPROVE', audit_log_category='SHIPPING_COMPANY').first()
        self.assertIsNotNone(approve_log)
        self.assertEqual(approve_log.audit_log_status, 'SUCCESS')

    def test_vessel_and_arrival_request_audit_logging(self):
        # 1. Register vessel
        vessel_payload = {
            'vessel_name': 'MV Star Horizon',
            'vessel_imo_number': '9123456',
            'vessel_type': 'CONTAINER_SHIP',
            'vessel_flag': 'Panama',
            'vessel_length': 280.0,
            'vessel_draft': 12.5,
            'vessel_capacity': 5000
        }
        res_vessel = self.client.post('/api/vessels/', vessel_payload, format='json', **self.company_headers)
        self.assertEqual(res_vessel.status_code, status.HTTP_201_CREATED)

        vessel_id = res_vessel.json()['data']['vessel_id']
        vessel_log = AuditLog.objects.filter(audit_log_action='CREATE', audit_log_category='VESSEL').first()
        self.assertIsNotNone(vessel_log)
        self.assertIn('MV Star Horizon', vessel_log.audit_log_description)

        # 2. Update vessel
        res_upd = self.client.patch(
            f'/api/vessels/{vessel_id}/',
            {'vessel_draft': 13.0},
            format='json',
            **self.company_headers
        )
        self.assertEqual(res_upd.status_code, status.HTTP_200_OK)
        upd_log = AuditLog.objects.filter(audit_log_action='UPDATE', audit_log_category='VESSEL').first()
        self.assertIsNotNone(upd_log)

        # 3. Create arrival request (4 days in advance)
        arrival_time = timezone.now() + datetime.timedelta(days=4)
        departure_time = arrival_time + datetime.timedelta(days=2)
        arr_payload = {
            'vessel_arrival_request_vessel_id': vessel_id,
            'vessel_arrival_request_requested_arrival_at': arrival_time.isoformat(),
            'vessel_arrival_request_requested_departure_at': departure_time.isoformat(),
            'vessel_arrival_request_cargo_type': 'Containers',
            'vessel_arrival_request_cargo_quantity': 1200
        }
        res_arr = self.client.post('/api/arrival-requests/', arr_payload, format='json', **self.company_headers)
        self.assertEqual(res_arr.status_code, status.HTTP_201_CREATED)
        arr_id = res_arr.json()['data']['vessel_arrival_request_id']

        arr_log = AuditLog.objects.filter(audit_log_action='CREATE', audit_log_category='ARRIVAL_REQUEST').first()
        self.assertIsNotNone(arr_log)

        # 4. Port Operations Officer approves arrival request
        res_appr = self.client.post(
            f'/api/arrival-requests/{arr_id}/approve/',
            {'remarks': 'Approved for Berth 01 approach.'},
            format='json',
            **self.ops_headers
        )
        self.assertEqual(res_appr.status_code, status.HTTP_200_OK)

        arr_appr_log = AuditLog.objects.filter(audit_log_action='APPROVE', audit_log_category='ARRIVAL_REQUEST').first()
        self.assertIsNotNone(arr_appr_log)
        self.assertEqual(arr_appr_log.audit_log_actor_name, 'Operations Officer John')

    def test_berth_and_scheduling_audit_logging(self):
        # 1. Admin creates Berth
        berth_payload = {
            'berth_name': 'Berth North 05',
            'berth_code': 'BN-05',
            'berth_type': 'CONTAINER_TERMINAL',
            'berth_max_length': 380.0,
            'berth_max_draft': 16.0,
            'berth_capacity_teu': 15000,
            'berth_status': 'AVAILABLE'
        }
        res_b = self.client.post('/api/admin/berths/', berth_payload, format='json', **self.admin_headers)
        self.assertEqual(res_b.status_code, status.HTTP_201_CREATED)
        berth_id = res_b.json()['data']['berth_id']

        b_log = AuditLog.objects.filter(audit_log_action='CREATE', audit_log_category='BERTH').first()
        self.assertIsNotNone(b_log)
        self.assertIn('Berth North 05', b_log.audit_log_description)

        # 2. Ops Officer toggles maintenance status
        res_maint = self.client.patch(
            f'/api/berths/{berth_id}/status/',
            {'status': 'MAINTENANCE'},
            format='json',
            **self.ops_headers
        )
        self.assertEqual(res_maint.status_code, status.HTTP_200_OK)

        maint_log = AuditLog.objects.filter(audit_log_action='STATUS_CHANGE', audit_log_category='BERTH').first()
        self.assertIsNotNone(maint_log)
        self.assertIn('MAINTENANCE', maint_log.audit_log_description)

    def test_audit_logs_list_endpoint_permissions_and_filtering(self):
        # Seed test audit logs across categories
        create_audit_log(
            user=self.admin_user,
            actor_name="Port Administrator",
            role="Port Administrator",
            action="CREATE",
            category="USER_MANAGEMENT",
            target_type="User",
            target_id="USR-101",
            description="Created terminal operator account."
        )
        create_audit_log(
            user=self.company_user,
            actor_name="Capt. Thomas Hardy",
            role="Shipping Company",
            action="CREATE",
            category="VESSEL",
            target_type="Vessel",
            target_id="VES-202",
            description="Vessel registered."
        )
        create_audit_log(
            user=self.ops_user,
            actor_name="Operations Officer John",
            role="Port Operations Officer",
            action="STATUS_CHANGE",
            category="BERTH",
            target_type="Berth",
            target_id="1",
            description="Berth 01 marked in maintenance."
        )

        # 1. Non-admin / Shipping Company is blocked (403)
        res_unauth = self.client.get('/api/audit-logs/', **self.company_headers)
        self.assertEqual(res_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Port Administrator is authorized (200)
        res_admin = self.client.get('/api/audit-logs/', **self.admin_headers)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.json()['status'], 'success')
        self.assertGreaterEqual(res_admin.json()['data']['total_count'], 3)

        # 3. Category Filter
        res_vessel = self.client.get('/api/audit-logs/?category=VESSEL', **self.admin_headers)
        self.assertEqual(res_vessel.status_code, status.HTTP_200_OK)
        results = res_vessel.json()['data']['results']
        self.assertTrue(all(r['category'] == 'VESSEL' for r in results))

        # 4. Search Filter
        res_search = self.client.get('/api/audit-logs/?search=Thomas', **self.admin_headers)
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        search_results = res_search.json()['data']['results']
        self.assertTrue(len(search_results) > 0)
        self.assertIn('Thomas', search_results[0]['actor'])

        # 5. Pagination
        res_paged = self.client.get('/api/audit-logs/?page=1&page_size=2', **self.admin_headers)
        self.assertEqual(res_paged.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_paged.json()['data']['results']), 2)
        self.assertEqual(res_paged.json()['data']['page_size'], 2)

    def test_future_extensibility_customs_and_gate_operations_ready(self):
        """
        Verify that future modules (Customs Declaration, Gate & Truck Operations) can immediately
        use the generic audit infrastructure without database alterations.
        """
        log_customs = create_audit_log(
            user=None,
            actor_name="Customs Inspector Dave",
            role="Customs Officer",
            action="APPROVE",
            category="CUSTOMS",
            target_type="CustomsDeclaration",
            target_id="CUST-2026-888",
            description="Customs clearance approved for container batch #CB-99.",
            status="SUCCESS"
        )
        self.assertIsNotNone(log_customs)
        self.assertEqual(log_customs.audit_log_category, "CUSTOMS")

        log_gate = create_audit_log(
            user=None,
            actor_name="Gate Officer Sarah",
            role="Gate Officer",
            action="CREATE",
            category="GATE_OPERATIONS",
            target_type="GatePass",
            target_id="GATE-PASS-104",
            description="Truck TRK-784 admitted through Gate 02 for container pickup.",
            status="SUCCESS"
        )
        self.assertIsNotNone(log_gate)
        self.assertEqual(log_gate.audit_log_category, "GATE_OPERATIONS")

        # Confirm queryable via AuditLogListAPIView
        res_cust = self.client.get('/api/audit-logs/?category=CUSTOMS', **self.admin_headers)
        self.assertEqual(res_cust.status_code, status.HTTP_200_OK)
        self.assertEqual(res_cust.json()['data']['results'][0]['target_resource'], "CustomsDeclaration #CUST-2026-888")







