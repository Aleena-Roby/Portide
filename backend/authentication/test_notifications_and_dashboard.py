import json
from django.test import TestCase, Client
from django.utils import timezone
from authentication.models import Login, User, Role, Department, ShippingCompany, Notification
from authentication.notification_service import create_notification
from authentication.email_service import (
    send_customs_cleared_notification,
    send_customs_hold_notification,
    send_customs_document_review_notification
)

class NotificationsAndDashboardTests(TestCase):
    def setUp(self):
        self.client = Client()

        # Create admin login & user
        self.admin_login = Login.objects.create(
            login_email="admin_test_notif@portide.com",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_password="testhash"
        )
        self.admin_user = User.objects.create(
            login_id=self.admin_login,
            user_full_name="Admin Test Notif",
            user_employee_id="ADM-TEST-01",
            user_status="ACTIVE"
        )

        # Create shipping company & login
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Oceanic Test Line",
            shipping_company_license_number="LIC-OTL-9988",
            shipping_company_email="agent_test_notif@oceanic.com",
            shipping_company_phone="+1234567890",
            shipping_company_address="Port Terminal West",
            shipping_company_jurisdiction="International",
            shipping_company_status="ACTIVE"
        )
        self.shipping_login = Login.objects.create(
            login_email="agent_test_notif@oceanic.com",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_password="testhash"
        )
        self.shipping_user = User.objects.create(
            login_id=self.shipping_login,
            user_full_name="Agent Oceanic",
            user_employee_id="AGT-TEST-01",
            user_status="ACTIVE",
            shipping_company_id=self.company
        )

    def test_create_notification_and_deduplication(self):
        # 1. Create first notification
        n1 = create_notification(
            title="Test Event 1",
            message="Initial notification message",
            recipient_role="port_operations_officer",
            category="VESSEL",
            event_key="unique_evt_key_001"
        )
        self.assertIsNotNone(n1)
        self.assertEqual(n1.notification_title, "Test Event 1")
        self.assertFalse(n1.notification_is_read)

        # 2. Try creating duplicate with same event_key
        n2 = create_notification(
            title="Test Event 1 Duplicate",
            message="Duplicate notification message",
            recipient_role="port_operations_officer",
            category="VESSEL",
            event_key="unique_evt_key_001"
        )
        # Should return existing without creating another
        self.assertEqual(n1.notification_id, n2.notification_id)
        self.assertEqual(Notification.objects.filter(notification_event_key="unique_evt_key_001").count(), 1)

    def test_notification_api_endpoints(self):
        # Create a notification for admin
        n = create_notification(
            title="Admin Alert",
            message="System alert for port admin",
            recipient_role="port_administrator",
            category="SYSTEM",
            event_key="admin_evt_101"
        )

        headers = {
            'HTTP_X_USER_EMAIL': self.admin_login.login_email,
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.admin_login.login_id)
        }

        # GET /api/notifications/
        res = self.client.get('/api/notifications/', **headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get('status'), 'success')
        self.assertGreaterEqual(data.get('unread_count'), 1)

        # POST /api/notifications/<id>/read/
        read_res = self.client.post(f'/api/notifications/{n.notification_id}/read/', **headers)
        self.assertEqual(read_res.status_code, 200)
        n.refresh_from_db()
        self.assertTrue(n.notification_is_read)

        # POST /api/notifications/read-all/
        read_all_res = self.client.post('/api/notifications/read-all/', **headers)
        self.assertEqual(read_all_res.status_code, 200)

    def test_dashboard_stats_endpoint(self):
        headers = {
            'HTTP_X_USER_EMAIL': self.admin_login.login_email,
            'HTTP_X_USER_ROLE': 'port_administrator',
            'HTTP_X_USER_ID': str(self.admin_login.login_id)
        }
        res = self.client.get('/api/dashboard/stats/', **headers)
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        self.assertEqual(json_data.get('status'), 'success')
        data = json_data.get('data', {})
        self.assertIn('kpis', data)
        self.assertIn('charts', data)
        self.assertIn('total_vessels', data['kpis'])
        self.assertIn('cargo_classification', data['charts'])

    def test_shipping_company_dashboard_isolation(self):
        headers = {
            'HTTP_X_USER_EMAIL': self.shipping_login.login_email,
            'HTTP_X_USER_ROLE': 'shipping_company',
            'HTTP_X_USER_ID': str(self.shipping_login.login_id)
        }
        res = self.client.get('/api/dashboard/stats/', **headers)
        self.assertEqual(res.status_code, 200)
        json_data = res.json()
        self.assertEqual(json_data.get('status'), 'success')
        data = json_data.get('data', {})
        self.assertIn('kpis', data)
        self.assertEqual(data.get('role'), 'shipping_company')

    def test_existing_email_functions_preserved(self):
        # Confirm that critical email functions remain imported, callable, and untouched
        self.assertTrue(callable(send_customs_cleared_notification))
        self.assertTrue(callable(send_customs_hold_notification))
        self.assertTrue(callable(send_customs_document_review_notification))
