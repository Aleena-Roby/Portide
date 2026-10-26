from unittest.mock import patch, MagicMock
from decimal import Decimal
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from authentication.models import (
    Login,
    User,
    Role,
    Department,
    ShippingCompany,
    Vessel,
    VesselArrivalRequest,
    Berth,
    VesselSchedule
)
from authentication.email_service import (
    send_arrival_request_approved_email,
    send_arrival_request_rejected_email
)


class VesselArrivalRequestEmailNotificationTestCase(APITestCase):
    def setUp(self):
        # 1. Port Operations Officer Role & Department
        self.role_officer = Role.objects.create(
            role_role_name="Port Operations Officer",
            role_role_code="PORT_OPERATIONS_OFFICER"
        )
        self.dept_ops = Department.objects.create(
            department_department_name="Marine & Port Operations"
        )
        self.login_officer = Login.objects.create(
            login_email="officer.marine@portide.test",
            login_password="HashedPassword123!",
            login_role="port_operations_officer"
        )
        self.user_officer = User.objects.create(
            login_id=self.login_officer,
            user_full_name="Capt. Rajesh Kumar",
            role_id=self.role_officer,
            department_id=self.dept_ops,
            user_status="ACTIVE"
        )

        # 2. Shipping Company
        self.company = ShippingCompany.objects.create(
            shipping_company_name="Pacific Ocean Lines Ltd",
            shipping_company_license_number="LIC-PACIFIC-2026-999",
            shipping_company_email="ops@pacificlines.com",
            shipping_company_phone="+91 98765 43210",
            shipping_company_address="Harbor Gateway Tower 4, Singapore",
            shipping_company_jurisdiction="Singapore Maritime",
            shipping_company_status="ACTIVE"
        )

        # 3. Vessel
        self.vessel = Vessel.objects.create(
            vessel_shipping_company_id=self.company,
            vessel_name="Pacific Voyager",
            vessel_imo_number="IMO9876543",
            vessel_call_sign="9V9876",
            vessel_flag="Singapore",
            vessel_type="CONTAINER_SHIP",
            vessel_length=Decimal("280.00"),
            vessel_draft=Decimal("12.50"),
            vessel_capacity=6000,
            vessel_status="ACTIVE"
        )

        # 4. Berths
        self.berth = Berth.objects.create(
            berth_name="Container Berth 3A",
            berth_type="CONTAINER",
            berth_status="AVAILABLE",
            berth_max_length=Decimal("350.00"),
            berth_max_draft=Decimal("15.00"),
            berth_is_active=True
        )

        # 5. Pending Arrival Request
        now = timezone.now()
        self.arr_request = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=4),
            vessel_arrival_request_cargo_type="Containerized Electronics & Machinery",
            vessel_arrival_request_cargo_quantity=Decimal("1450.00"),
            vessel_arrival_request_preferred_berth_id=self.berth,
            vessel_arrival_request_status="PENDING"
        )

        self.headers_officer = {
            "HTTP_X_USER_ROLE": "port_operations_officer",
            "HTTP_X_USER_EMAIL": self.login_officer.login_email,
            "HTTP_X_USER_ID": str(self.login_officer.login_id)
        }

    @patch("authentication.email_service._send_mail_async")
    def test_approve_arrival_request_sends_official_company_email(self, mock_send_async):
        """
        Verifies that approving an arrival request triggers an email to the shipping company's official email
        with complete vessel berthing details and operational remarks.
        """
        url = f"/api/arrival-requests/{self.arr_request.vessel_arrival_request_id}/approve/"
        payload = {
            "berth_id": self.berth.berth_id,
            "remarks": "Approved with priority tug assistance allocated at pilot station."
        }

        response = self.client.post(url, payload, format="json", **self.headers_officer)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("status"), "success")

        # Verify database update
        self.arr_request.refresh_from_db()
        self.assertEqual(self.arr_request.vessel_arrival_request_status, "APPROVED")

        # Verify email dispatch
        mock_send_async.assert_called_once()
        call_kwargs = mock_send_async.call_args[1]

        self.assertEqual(call_kwargs["recipient_list"], ["ops@pacificlines.com"])
        self.assertIn("PORTIDE Approval", call_kwargs["subject"])
        self.assertIn("Pacific Voyager", call_kwargs["subject"])
        self.assertIn("Container Berth 3A", call_kwargs["message"])
        self.assertIn("IMO9876543", call_kwargs["message"])
        self.assertIn("Pacific Ocean Lines Ltd", call_kwargs["message"])
        self.assertIn("priority tug assistance allocated", call_kwargs["message"])

    @patch("authentication.email_service._send_mail_async")
    def test_reject_arrival_request_sends_official_company_email(self, mock_send_async):
        """
        Verifies that rejecting an arrival request triggers an email to the shipping company's official email
        with the specified operational rejection remarks.
        """
        url = f"/api/arrival-requests/{self.arr_request.vessel_arrival_request_id}/reject/"
        payload = {
            "remarks": "Requested arrival window conflicts with scheduled deep-draft carrier dredging operations."
        }

        response = self.client.post(url, payload, format="json", **self.headers_officer)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("status"), "success")

        # Verify database update
        self.arr_request.refresh_from_db()
        self.assertEqual(self.arr_request.vessel_arrival_request_status, "REJECTED")

        # Verify email dispatch
        mock_send_async.assert_called_once()
        call_kwargs = mock_send_async.call_args[1]

        self.assertEqual(call_kwargs["recipient_list"], ["ops@pacificlines.com"])
        self.assertIn("PORTIDE Notice", call_kwargs["subject"])
        self.assertIn("Rejected", call_kwargs["subject"])
        self.assertIn("Pacific Voyager", call_kwargs["subject"])
        self.assertIn("dredging operations", call_kwargs["message"])
        self.assertIn("Pacific Ocean Lines Ltd", call_kwargs["message"])

    @patch("authentication.email_service._send_mail_async")
    def test_direct_email_service_functions(self, mock_send_async):
        """
        Direct test for email service helpers.
        """
        ok_app = send_arrival_request_approved_email(
            arrival_request=self.arr_request,
            berth_obj=self.berth,
            remarks="Direct test remarks",
            officer_name="Capt. Rajesh Kumar"
        )
        self.assertTrue(ok_app)

        ok_rej = send_arrival_request_rejected_email(
            arrival_request=self.arr_request,
            rejection_reason="Direct test rejection",
            officer_name="Capt. Rajesh Kumar"
        )
        self.assertTrue(ok_rej)
        self.assertEqual(mock_send_async.call_count, 2)
