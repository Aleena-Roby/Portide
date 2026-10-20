from django.test import TestCase
from django.core import mail
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.test import APIClient
from rest_framework import status
from authentication.models import Login, User, Department, Role
from authentication.validators import generate_temporary_password, validate_strong_password


class TemporaryPasswordWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_login = Login.objects.create(
            login_email="admin.test@portide.gov",
            login_password=make_password("AdminStrongPass@2026"),
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.admin_user = User.objects.create(
            login_id=self.admin_login,
            user_full_name="Super Admin",
            user_employee_id="ADM-2026-TEST",
            user_status="ACTIVE",
            user_must_change_password=False
        )

    def test_generate_temporary_password_satisfies_validation(self):
        """Verify generated passwords always satisfy the 5 strong password requirements."""
        for _ in range(25):
            pwd = generate_temporary_password()
            self.assertGreaterEqual(len(pwd), 8)
            validated = validate_strong_password(pwd)
            self.assertEqual(pwd, validated)

    def test_admin_create_staff_auto_generates_password_and_sends_email(self):
        """Verify admin can create staff without entering passwords, email is sent, and must_change_password is true."""
        payload = {
            "user_full_name": "Kiran Kumar",
            "user_email": "kiran.kumar@portide.local",
            "user_phone": "+919876543210",
            "user_employee_id": "POO-2026-999",
            "user_role": "port_operations_officer"
        }
        res = self.client.post(
            '/api/admin/users/staff/',
            payload,
            format='json',
            HTTP_X_USER_ROLE='port_administrator',
            HTTP_X_USER_EMAIL=self.admin_login.login_email
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertNotIn("password", data["data"])
        self.assertNotIn("temp_password", data["data"])

        # Check DB state
        created_user = User.objects.get(user_employee_id="POO-2026-999")
        self.assertTrue(created_user.user_must_change_password)
        self.assertTrue(created_user.must_change_password)
        self.assertEqual(created_user.login_id.login_status, "ACTIVE")
        # Password hash exists and is valid Django PBKDF2
        self.assertTrue(created_user.login_id.login_password.startswith("pbkdf2_sha256$"))

        # Check that email was sent (or attempted through Django mail test outbox)
        self.assertGreaterEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[-1]
        self.assertIn("PORTIDE – Internal Staff Account Created", sent_email.subject)
        self.assertIn("Kiran Kumar", sent_email.body)
        self.assertIn("POO-2026-999", sent_email.body)
        self.assertIn("Temporary Password:", sent_email.body)

    def test_first_login_flow_and_mandatory_password_change(self):
        """Verify full login with temporary password, mandatory flag, change password, and invalidation of temporary password."""
        # 1. Admin creates staff user
        payload = {
            "user_full_name": "David Miller",
            "user_email": "david.miller@portide.local",
            "user_phone": "+919876543211",
            "user_employee_id": "CUS-2026-888",
            "user_role": "customs_officer"
        }
        create_res = self.client.post(
            '/api/admin/users/staff/',
            payload,
            format='json',
            HTTP_X_USER_ROLE='port_administrator',
            HTTP_X_USER_EMAIL=self.admin_login.login_email
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        # Extract temporary password from sent test email
        sent_email = mail.outbox[-1]
        body_lines = sent_email.body.splitlines()
        temp_pwd = None
        for i, line in enumerate(body_lines):
            if "Temporary Password:" in line and i + 1 < len(body_lines):
                temp_pwd = body_lines[i + 1].strip()
                break
        self.assertIsNotNone(temp_pwd)

        # 2. Login with temporary password
        login_res = self.client.post(
            '/api/auth/login/',
            {"email": "david.miller@portide.local", "password": temp_pwd},
            format='json'
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        login_data = login_res.json()["data"]
        self.assertTrue(login_data["must_change_password"])

        # Verify CurrentUserAPIView also reflects must_change_password
        me_res = self.client.get(
            '/api/auth/me/',
            HTTP_X_USER_EMAIL="david.miller@portide.local",
            HTTP_X_USER_ID=str(login_data["login_id"])
        )
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertTrue(me_res.json()["data"]["must_change_password"])

        # 3. Test changing password with invalid inputs
        # 3a. Mismatched passwords
        bad_change = self.client.post(
            '/api/auth/first-login-change-password/',
            {"new_password": "MyNewPassword@123", "confirm_new_password": "DifferentPassword@123"},
            format='json',
            HTTP_X_USER_EMAIL="david.miller@portide.local",
            HTTP_X_USER_ID=str(login_data["login_id"])
        )
        self.assertEqual(bad_change.status_code, status.HTTP_400_BAD_REQUEST)

        # 3b. Weak password
        weak_change = self.client.post(
            '/api/auth/first-login-change-password/',
            {"new_password": "weak", "confirm_new_password": "weak"},
            format='json',
            HTTP_X_USER_EMAIL="david.miller@portide.local",
            HTTP_X_USER_ID=str(login_data["login_id"])
        )
        self.assertEqual(weak_change.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Valid password change
        good_change = self.client.post(
            '/api/auth/first-login-change-password/',
            {"new_password": "PermanentPass@2026", "confirm_new_password": "PermanentPass@2026"},
            format='json',
            HTTP_X_USER_EMAIL="david.miller@portide.local",
            HTTP_X_USER_ID=str(login_data["login_id"])
        )
        self.assertEqual(good_change.status_code, status.HTTP_200_OK)
        self.assertFalse(good_change.json()["data"]["must_change_password"])

        # Verify DB state updated
        user_in_db = User.objects.get(user_employee_id="CUS-2026-888")
        self.assertFalse(user_in_db.user_must_change_password)

        # 5. Verify old temporary password is now INVALID
        failed_login = self.client.post(
            '/api/auth/login/',
            {"email": "david.miller@portide.local", "password": temp_pwd},
            format='json'
        )
        self.assertEqual(failed_login.status_code, status.HTTP_401_UNAUTHORIZED)

        # 6. Verify new password is VALID and must_change_password is False
        new_login = self.client.post(
            '/api/auth/login/',
            {"email": "david.miller@portide.local", "password": "PermanentPass@2026"},
            format='json'
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
        self.assertFalse(new_login.json()["data"]["must_change_password"])
