import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set minimal Django settings for standalone execution
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from authentication import email_service


class ResponsiveEmailSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output_dir = os.path.join(os.path.dirname(__file__), 'rendered_emails')
        os.makedirs(cls.output_dir, exist_ok=True)
        cls.rendered_emails = {}

    def test_01_registration_submitted_email(self):
        mock_req = MagicMock()
        mock_req.registration_request_id = 42
        mock_req.registration_request_applicant_name = "Captain Robert Vance"
        mock_req.shipping_company_id.shipping_company_name = "Pacific Trans-Oceanic Global Logistics Ltd"
        mock_req.shipping_company_id.shipping_company_email = "dispatch-operations@pacific-transoceanic.com"

        captured = {}
        def mock_send_async(**kwargs):
            captured.update(kwargs)

        with patch.object(email_service, '_send_mail_async', side_effect=mock_send_async):
            res = email_service.send_registration_submitted_email(mock_req)
            self.assertTrue(res)
            self.assertIn('html_message', captured)
            html = captured['html_message']
            self.assertIn("REGISTRATION RECEIVED", html)
            self.assertIn("Pacific Trans-Oceanic Global Logistics Ltd", html)
            self.assertIn("REG-2026-042", html)
            self.assertIn("viewport", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "01_registration_submitted.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["registration_submitted"] = filepath

    def test_02_registration_action_required_email(self):
        mock_req = MagicMock()
        mock_req.registration_request_id = 89
        mock_req.registration_request_applicant_name = "Elena Rostova"
        mock_req.shipping_company_id.shipping_company_name = "Nordic Star Maritime Navigation & Freight Corp"
        mock_req.shipping_company_id.shipping_company_email = "compliance@nordicstar-freight.com"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_registration_action_required_email(
                mock_req,
                required_docs_display="IMO Certificate of Registration, Proof of Marine Hull Insurance 2026",
                admin_message="Your business license document is expired. Please upload the 2026/2027 renewal cert."
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("ACTION REQUIRED", html)
            self.assertIn("IMO Certificate of Registration", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "02_registration_action_required.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["registration_action_required"] = filepath

    def test_03_registration_resubmitted_email(self):
        mock_req = MagicMock()
        mock_req.registration_request_id = 89
        mock_req.shipping_company_id.shipping_company_name = "Nordic Star Maritime Navigation & Freight Corp"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            with patch.object(email_service.User.objects, 'filter') as mock_filter:
                mock_filter.return_value.values_list.return_value = ["admin@portide.local"]
                res = email_service.send_registration_resubmitted_email(mock_req)
                self.assertTrue(res)
                html = captured['html_message']
                self.assertIn("APPLICATION RESUBMITTED", html)
                self.assertNotIn("click or tap", html.lower())
                
                filepath = os.path.join(self.output_dir, "03_registration_resubmitted.html")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(html)
                self.rendered_emails["registration_resubmitted"] = filepath

    def test_04_registration_approved_email(self):
        mock_req = MagicMock()
        mock_req.registration_request_id = 104
        mock_req.registration_request_applicant_name = "Marcus Aurelius Thorne"
        mock_req.shipping_company_id.shipping_company_name = "Maersk Intercontinental Maritime Lines"
        mock_req.shipping_company_id.shipping_company_email = "maritime-admin@maersk-intercontinental.com"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_registration_approved_email(mock_req)
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("WELCOME TO PORTIDE", html)
            self.assertIn("ACTIVE &bull; APPROVED", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "04_registration_approved.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["registration_approved"] = filepath

    def test_05_registration_rejected_email(self):
        mock_req = MagicMock()
        mock_req.registration_request_id = 112
        mock_req.registration_request_applicant_name = "Arthur Pendelton"
        mock_req.shipping_company_id.shipping_company_name = "Atlantic Substandard Carriers LLC"
        mock_req.shipping_company_id.shipping_company_email = "arthur@atlantic-substandard.com"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_registration_rejected_email(
                mock_req,
                rejection_reason="Failed international maritime carrier safety audit and non-compliant vessel flag registry."
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("APPLICATION REJECTED", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "05_registration_rejected.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["registration_rejected"] = filepath

    def test_06_staff_account_created_email(self):
        mock_user = MagicMock()
        mock_user.user_full_name = "Sarah Jennifer Connor-MacDonald"
        mock_user.user_employee_id = "PORT-STAFF-2026-ENG-98745"
        mock_user.user_department = "Terminal Logistics & Berth Operations Division"
        mock_user.login_id.login_role = "terminal_logistics_operator"
        mock_user.login_id.login_email = "sarah.connor.terminal.ops@portide-operations.domain.com"

        captured = {}
        def mock_send(subject, message, from_email, recipient_list, **kwargs):
            captured.update(kwargs)
            captured['subject'] = subject
            return 1

        with patch.object(email_service, 'send_mail', side_effect=mock_send):
            temp_pw = "Tmp#Sec!982@Portide2026Key$"
            res = email_service.send_staff_account_created_email(mock_user, temp_pw)
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("STAFF ACCOUNT CREATED", html)
            self.assertIn(mock_user.user_employee_id, html)
            self.assertIn("Terminal & Logistics Operator", html)
            self.assertIn(temp_pw, html)
            self.assertIn("sarah.connor.terminal.ops@portide-operations.domain.com", html)
            # Verify "click or tap the password to copy" is REMOVED
            self.assertNotIn("click or tap password to select & copy", html.lower())
            self.assertNotIn("click or tap the password to copy", html.lower())
            self.assertIn("Select password to copy", html)
            
            filepath = os.path.join(self.output_dir, "06_staff_account_created.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["staff_account_created"] = filepath

    def test_07_password_reset_email(self):
        mock_login = MagicMock()
        mock_login.login_email = "operations.lead@maritime-logistics.org"
        mock_login.profile.user_full_name = "Commander Thomas Sterling"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            plain_token = "7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c"
            reset_link = "https://portide.vercel.app/reset-password?token=7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c"
            res = email_service.send_password_reset_email(mock_login, plain_token, reset_link)
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("PASSWORD RESET REQUEST", html)
            self.assertIn(plain_token, html)
            self.assertIn("Select token to copy", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "07_password_reset.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["password_reset"] = filepath

    def test_08_password_changed_notification(self):
        mock_login = MagicMock()
        mock_login.login_email = "operations.lead@maritime-logistics.org"
        mock_login.login_role = "port_operations_officer"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_password_changed_notification(mock_login)
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("PASSWORD UPDATED", html)
            self.assertIn("ACTIVE &bull; SECURED", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "08_password_changed.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["password_changed"] = filepath

    def test_09_customs_cleared_notification(self):
        mock_cnt = MagicMock()
        mock_cnt.container_number = "MSKU984512347"
        mock_cnt.get_container_type_display.return_value = "40ft High Cube Refrigerated"
        mock_cnt.container_gross_weight = 32.75
        mock_cnt.cargo.cargo_description = "Pharmaceutical Cold-Chain Vaccines & Biological Specimen"
        mock_cnt.vessel.vessel_name = "MV Ever Given Intercontinental Ultra Carrier"
        mock_cnt.shipping_company.shipping_company_name = "Mediterranean Shipping Company (MSC)"
        mock_cnt.shipping_company.shipping_company_email = "customs-clearance@msc-global.com"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_customs_cleared_notification(mock_cnt, "Senior Officer James Alistair Finch")
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("CONTAINER CLEARED", html)
            self.assertIn("MSKU984512347", html)
            self.assertIn("MV Ever Given Intercontinental Ultra Carrier", html)
            self.assertIn("Select container number to copy", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "09_customs_cleared.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["customs_cleared"] = filepath

    def test_10_customs_hold_notification(self):
        mock_cnt = MagicMock()
        mock_cnt.container_number = "CMAU776519022"
        mock_cnt.get_container_type_display.return_value = "20ft Standard Dry Cargo Container"
        mock_cnt.container_gross_weight = 24.10
        mock_cnt.cargo.cargo_description = "Industrial Chemicals & Precision Electronic Circuitry"
        mock_cnt.vessel.vessel_name = "MV Hapag-Lloyd Hamburg Express"
        mock_cnt.shipping_company.shipping_company_name = "CMA CGM Maritime Shipping Group"
        mock_cnt.shipping_company.shipping_company_email = "agency.customs@cmacgm.com"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_customs_hold_notification(
                mock_cnt,
                hold_reason="Physical X-ray scan anomaly detected in aft bulkhead quadrant. Secondary manual inspection mandated.",
                officer_name="Inspector Devendra Kumar"
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("CUSTOMS HOLD ALERT", html)
            self.assertIn("CMAU776519022", html)
            self.assertIn("MV Hapag-Lloyd Hamburg Express", html)
            self.assertIn("Select container number to copy", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "10_customs_hold.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["customs_hold"] = filepath

    def test_11_container_released_notification(self):
        mock_cnt = MagicMock()
        mock_cnt.container_number = "COSCO109283741"
        mock_cnt.get_container_type_display.return_value = "40ft Open Top Heavy Machinery Container"
        mock_cnt.container_gross_weight = 30.20
        mock_cnt.cargo.cargo_description = "Automotive Transmission Assembly Units"
        mock_cnt.vessel.vessel_name = "COSCO Star of Shanghai"
        mock_cnt.shipping_company.shipping_company_name = "COSCO Shipping Lines Co."
        mock_cnt.shipping_company.shipping_company_email = "port.operations@cosco-lines.com"

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_container_released_notification(
                mock_cnt,
                truck_number="TRK-IND-MH-04-AB-9876",
                officer_name="Officer Ramesh Patel"
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("CONTAINER RELEASED", html)
            self.assertIn("COSCO109283741", html)
            self.assertIn("TRK-IND-MH-04-AB-9876", html)
            self.assertIn("RELEASED &bull; OUTBOUND", html)
            self.assertIn("Select container number to copy", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "11_container_released.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["container_released"] = filepath

    def test_12_gate_pass_driver_email(self):
        from django.utils import timezone
        import datetime

        mock_driver = MagicMock()
        mock_driver.driver_name = "Harpreet Singh Sandhu"
        mock_driver.driver_email = "driver.harpreet.sandhu@punjab-freightways.org"
        mock_driver.driver_license_number = "DL-04-2019-982347102"

        mock_truck = MagicMock()
        mock_truck.truck_number = "KA-01-MJ-5432-HEAVY"

        mock_gate = MagicMock()
        mock_gate.gate_name = "Gate 04 Outbound Heavy Commercial Terminal"

        mock_c1 = MagicMock()
        mock_c1.container_number = "MAEU881920345"
        mock_c1.get_container_type_display.return_value = "40ft Refrigerated Container"
        mock_c1.container_gross_weight = 29.80

        mock_assoc1 = MagicMock()
        mock_assoc1.gate_pass_container_container_id = mock_c1

        mock_pass = MagicMock()
        mock_pass.gate_pass_pass_number = "GP-2026-OCT-889900"
        mock_pass.gate_pass_movement_number = "MOV-TERMINAL-NORTH-2026-90"
        mock_pass.gate_pass_driver_id = mock_driver
        mock_pass.gate_pass_truck_id = mock_truck
        mock_pass.gate_pass_gate_id = mock_gate
        mock_pass.gate_pass_valid_until = timezone.now() + datetime.timedelta(hours=6)
        mock_pass.gate_pass_verification_code = "VERIFY-PASS-9823-PORTIDE-SEC"
        mock_pass.gate_pass_qr_code = "PORTIDE-GP:GP-2026-OCT-889900:VERIFY-PASS-9823-PORTIDE-SEC"
        mock_pass.containers.select_related.return_value.all.return_value = [mock_assoc1]

        captured = {}
        def mock_send(subject, message, from_email, recipient_list, **kwargs):
            captured.update(kwargs)
            captured['subject'] = subject
            return 1

        with patch.object(email_service, 'send_mail', side_effect=mock_send):
            success, err = email_service.send_gate_pass_driver_email(mock_pass)
            self.assertTrue(success)
            self.assertIsNone(err)
            html = captured['html_message']
            self.assertIn("DIGITAL GATE PASS", html)
            self.assertIn("GP-2026-OCT-889900", html)
            self.assertIn("Harpreet Singh Sandhu", html)
            self.assertIn("KA-01-MJ-5432-HEAVY", html)
            self.assertIn("MAEU881920345", html)
            self.assertIn("VERIFY-PASS-9823-PORTIDE-SEC", html)
            self.assertIn("Select verification code to copy", html)
            # Verify QR code image is responsive and high contrast
            self.assertIn("qr-img", html)
            self.assertIn("api.qrserver.com", html)
            # Verify "tap or click" is REMOVED
            self.assertNotIn("click or tap", html.lower())
            self.assertNotIn("tap or click", html.lower())
            
            filepath = os.path.join(self.output_dir, "12_digital_gate_pass.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["digital_gate_pass"] = filepath

    def test_13_customs_document_review_notification_rejected(self):
        mock_doc = MagicMock()
        mock_doc.document_id = 501
        mock_doc.document_name = "Bill_Of_Lading_MSKU_Final.pdf"
        mock_doc.document_version = 1
        mock_doc.get_document_type_display.return_value = "Commercial Bill of Lading"
        mock_cnt = MagicMock()
        mock_cnt.container_number = "MSKU554433221"
        mock_cnt.cargo.cargo_description = "Electronic Household Equipment & Appliances"
        mock_cnt.vessel.vessel_name = "CMA CGM Christophe Colomb"
        mock_cnt.shipping_company.shipping_company_name = "Hapag-Lloyd Line Ag"
        mock_cnt.shipping_company.shipping_company_email = "compliance@hapag-lloyd.de"
        mock_doc.document_container_id = mock_cnt
        mock_doc.document_uploaded_by = None

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_customs_document_review_notification(
                mock_doc,
                review_status="REJECTED",
                remarks="Consignee Tax Identification Number does not match Import Customs Declaration record. Correct document and resubmit.",
                officer_name="Inspector Fatima Al-Mansoor"
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("DOCUMENT REJECTED", html)
            self.assertIn("MSKU554433221", html)
            self.assertIn("Bill_Of_Lading_MSKU_Final.pdf", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "13_customs_doc_rejected.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["customs_doc_rejected"] = filepath

    def test_14_customs_document_review_notification_verified(self):
        mock_doc = MagicMock()
        mock_doc.document_id = 502
        mock_doc.document_name = "Phytosanitary_Inspection_Clearance.pdf"
        mock_doc.document_version = 2
        mock_doc.get_document_type_display.return_value = "Phytosanitary Health Certificate"
        mock_cnt = MagicMock()
        mock_cnt.container_number = "MSKU554433221"
        mock_cnt.vessel.vessel_name = "CMA CGM Christophe Colomb"
        mock_cnt.shipping_company.shipping_company_name = "Hapag-Lloyd Line Ag"
        mock_cnt.shipping_company.shipping_company_email = "compliance@hapag-lloyd.de"
        mock_doc.document_container_id = mock_cnt
        mock_doc.document_uploaded_by = None

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_customs_document_review_notification(
                mock_doc,
                review_status="VERIFIED",
                remarks="Verified against National Plant Protection Organization authority database. Compliant.",
                officer_name="Inspector Fatima Al-Mansoor"
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("DOCUMENT VERIFIED", html)
            self.assertIn("MSKU554433221", html)
            self.assertIn("Phytosanitary_Inspection_Clearance.pdf", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "14_customs_doc_verified.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["customs_doc_verified"] = filepath

    def test_15_customs_document_resubmitted_notification(self):
        mock_new_doc = MagicMock()
        mock_new_doc.document_id = 601
        mock_new_doc.document_name = "Corrected_Bill_Of_Lading_v2.pdf"
        mock_new_doc.document_version = 2
        mock_new_doc.get_document_type_display.return_value = "Commercial Bill of Lading"

        mock_old_doc = MagicMock()
        mock_old_doc.document_name = "Bill_Of_Lading_v1_Discrepancy.pdf"
        mock_old_doc.document_version = 1

        mock_cnt = MagicMock()
        mock_cnt.container_number = "NYKU776655443"
        mock_cnt.shipping_company.shipping_company_name = "Ocean Network Express (ONE)"
        mock_cnt.shipping_company.shipping_company_email = "documentation@ocean-network-express.jp"
        mock_new_doc.document_container_id = mock_cnt
        mock_new_doc.document_uploaded_by = None

        captured = {}
        with patch.object(email_service, '_send_mail_async', side_effect=lambda **kw: captured.update(kw)):
            res = email_service.send_customs_document_resubmitted_notification(
                mock_new_doc,
                mock_old_doc,
                reason="Updated Consignee Tax ID to match Import Declaration Form 24B",
                carrier_name="Ocean Network Express (ONE)"
            )
            self.assertTrue(res)
            html = captured['html_message']
            self.assertIn("DOCUMENT RESUBMITTED", html)
            self.assertIn("NYKU776655443", html)
            self.assertIn("Corrected_Bill_Of_Lading_v2.pdf", html)
            self.assertIn("Bill_Of_Lading_v1_Discrepancy.pdf", html)
            self.assertNotIn("click or tap", html.lower())
            
            filepath = os.path.join(self.output_dir, "15_customs_doc_resubmitted.html")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            self.rendered_emails["customs_doc_resubmitted"] = filepath


if __name__ == '__main__':
    unittest.main()
