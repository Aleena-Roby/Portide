from django.test import TestCase
from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from authentication.models import (
    Login, User, ShippingCompany, RegistrationRequest, AuditLog
)

class RegistrationWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Port Admin setup
        self.admin_login = Login.objects.create(
            login_email="admin@portide.gov",
            login_password=make_password("Admin@12345"),
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

        # Login admin client
        login_res = self.client.post('/api/auth/login/', {
            'email': 'admin@portide.gov',
            'password': 'Admin@12345'
        }, format='json')
        self.admin_token = login_res.data.get('access')
        self.admin_client = APIClient()
        self.admin_client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')

    def test_full_registration_and_action_required_workflow(self):
        # 1. Submit Registration Request
        license_file = SimpleUploadedFile("license.pdf", b"license content", content_type="application/pdf")
        id_file = SimpleUploadedFile("id_proof.pdf", b"id content", content_type="application/pdf")

        reg_data = {
            'request_company_name': 'Oceanic Logistics Ltd',
            'request_applicant_name': 'Captain Nemo',
            'request_email': 'nemo@oceanic.com',
            'request_phone': '+65 6123 4567',
            'request_address': 'Docks 42, Harbour Bay',
            'request_jurisdiction': 'Singapore',
            'request_registration_no': 'LIC-PAN-8899',
            'password': 'Password@123',
            'confirm_password': 'Password@123',
            'request_license_file': license_file,
            'request_id_file': id_file,
            'request_terms_accepted': True
        }

        reg_resp = self.client.post('/api/auth/registration/', reg_data, format='multipart')
        self.assertEqual(reg_resp.status_code, status.HTTP_201_CREATED, reg_resp.data)
        req_id = reg_resp.data.get('data', {}).get('registration_request_id')
        self.assertIsNotNone(req_id)

        # Verify initial pending state in DB
        reg_obj = RegistrationRequest.objects.get(registration_request_id=req_id)
        self.assertEqual(reg_obj.registration_request_status, 'PENDING')
        comp_obj = ShippingCompany.objects.get(shipping_company_email='nemo@oceanic.com')
        self.assertEqual(comp_obj.shipping_company_status, 'PENDING')
        login_obj = Login.objects.get(login_email='nemo@oceanic.com')
        self.assertEqual(login_obj.login_status, 'PENDING')

        # 2. Verify applicant cannot login while PENDING
        login_attempt = self.client.post('/api/auth/login/', {
            'email': 'nemo@oceanic.com',
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(login_attempt.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(login_attempt.data.get('registration_status'), 'PENDING')
        self.assertEqual(login_attempt.data.get('registration_request_id'), req_id)

        # 3. Verify Public Registration Status Endpoint
        # 3a. By integer ID
        status_resp1 = self.client.get(f'/api/auth/registration-status/?id={req_id}')
        self.assertEqual(status_resp1.status_code, status.HTTP_200_OK)
        data1 = status_resp1.data.get('data', {})
        self.assertEqual(data1.get('registration_request_status'), 'PENDING')
        self.assertEqual(data1.get('shipping_company', {}).get('shipping_company_name'), 'Oceanic Logistics Ltd')

        # 3b. By formatted Reference Number (REG-2026-xxx)
        formatted_id = f"REG-2026-{req_id:04d}"
        status_resp2 = self.client.get(f'/api/auth/registration-status/?id={formatted_id}')
        self.assertEqual(status_resp2.status_code, status.HTTP_200_OK)
        data2 = status_resp2.data.get('data', {})
        self.assertEqual(data2.get('registration_request_id'), req_id)

        # 3c. By email
        status_resp3 = self.client.get('/api/auth/registration-status/?email=nemo@oceanic.com')
        self.assertEqual(status_resp3.status_code, status.HTTP_200_OK)
        data3 = status_resp3.data.get('data', {})
        self.assertEqual(data3.get('registration_request_id'), req_id)

        # 4. Admin marks as ACTION_REQUIRED
        action_resp = self.admin_client.post(
            f'/api/auth/admin/registration-requests/{req_id}/action-required/',
            {
                'admin_remarks': 'Business license is blurred. Please upload a clear scan.',
                'action_required_docs': ['business_license_file']
            },
            format='json'
        )
        self.assertEqual(action_resp.status_code, status.HTTP_200_OK)
        
        reg_obj.refresh_from_db()
        self.assertEqual(reg_obj.registration_request_status, 'ACTION_REQUIRED')
        self.assertIn('business_license_file', reg_obj.registration_request_action_required_docs)
        self.assertEqual(reg_obj.registration_request_admin_remarks, 'Business license is blurred. Please upload a clear scan.')

        # 5. Verify applicant login is blocked with ACTION_REQUIRED
        login_attempt2 = self.client.post('/api/auth/login/', {
            'email': 'nemo@oceanic.com',
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(login_attempt2.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(login_attempt2.data.get('registration_status'), 'ACTION_REQUIRED')

        # 6. Applicant resubmits only corrected document
        new_license = SimpleUploadedFile("license_clear.pdf", b"new clear license content", content_type="application/pdf")
        resubmit_resp = self.client.post(
            '/api/auth/registration-resubmit/',
            {
                'registration_request_id': req_id,
                'email': 'nemo@oceanic.com',
                'business_license_file': new_license
            },
            format='multipart'
        )
        self.assertEqual(resubmit_resp.status_code, status.HTTP_200_OK)

        reg_obj.refresh_from_db()
        self.assertEqual(reg_obj.registration_request_status, 'PENDING')
        self.assertIsNotNone(reg_obj.registration_request_resubmitted_at)
        self.assertTrue(bool(reg_obj.registration_request_previous_license_file))

        # 7. Admin approves registration
        approve_resp = self.admin_client.post(
            f'/api/auth/admin/registration-requests/{req_id}/approve/',
            {},
            format='json'
        )
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)

        reg_obj.refresh_from_db()
        self.assertEqual(reg_obj.registration_request_status, 'APPROVED')
        comp_obj.refresh_from_db()
        self.assertEqual(comp_obj.shipping_company_status, 'ACTIVE')
        login_obj.refresh_from_db()
        self.assertEqual(login_obj.login_status, 'ACTIVE')

        # 8. Approved company can now successfully login
        login_success = self.client.post('/api/auth/login/', {
            'email': 'nemo@oceanic.com',
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(login_success.status_code, status.HTTP_200_OK)
        self.assertEqual(login_success.data.get('status'), 'success')
        self.assertEqual(login_success.data.get('data', {}).get('role'), 'shipping_company')
        self.assertEqual(login_success.data.get('data', {}).get('full_name'), 'Captain Nemo')

    def test_registration_rejection_workflow(self):
        # Create a registration directly
        license_file = SimpleUploadedFile("lic.pdf", b"lic content", content_type="application/pdf")
        reg_resp = self.client.post('/api/auth/registration/', {
            'request_company_name': 'Rejected Shipping Co',
            'request_applicant_name': 'Bob',
            'request_email': 'bob@rejected.com',
            'request_phone': '+65 6111 2222',
            'request_address': 'Pier 9, Marina',
            'request_jurisdiction': 'Singapore',
            'request_registration_no': 'LIC-REJ-01',
            'password': 'Password@123',
            'confirm_password': 'Password@123',
            'request_license_file': license_file,
            'request_terms_accepted': True
        }, format='multipart')
        self.assertEqual(reg_resp.status_code, status.HTTP_201_CREATED, reg_resp.data)
        req_id = reg_resp.data.get('data', {}).get('registration_request_id')
        self.assertIsNotNone(req_id)

        # Admin rejects
        reject_resp = self.admin_client.post(
            f'/api/auth/admin/registration-requests/{req_id}/reject/',
            {'admin_remarks': 'Fraudulent document provided.'},
            format='json'
        )
        self.assertEqual(reject_resp.status_code, status.HTTP_200_OK)

        reg_obj = RegistrationRequest.objects.get(registration_request_id=req_id)
        self.assertEqual(reg_obj.registration_request_status, 'REJECTED')
        self.assertEqual(reg_obj.registration_request_admin_remarks, 'Fraudulent document provided.')

        # Login blocked with REJECTED
        login_attempt = self.client.post('/api/auth/login/', {
            'email': 'bob@rejected.com',
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(login_attempt.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(login_attempt.data.get('registration_status'), 'REJECTED')
