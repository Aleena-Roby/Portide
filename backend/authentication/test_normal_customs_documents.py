from decimal import Decimal
import io
import json
from django.test import TestCase
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
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
    CustomsDocument,
    PreArrivalCustomsDeclaration,
    AuditLog
)


class NormalCustomsDocumentWorkflowTestCase(TestCase):
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

        # Shipping Company 1 (Oceanic)
        self.company1 = ShippingCompany.objects.create(
            shipping_company_name="Oceanic Logistics Ltd",
            shipping_company_license_number="LIC-OCN-2026",
            shipping_company_email="agent@oceanic.com",
            shipping_company_phone="+919876543000",
            shipping_company_address="Harbor Road, Mumbai",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_shipping1 = Login.objects.create(
            login_email="agent@oceanic.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_shipping1 = User.objects.create(
            login_id=self.login_shipping1,
            shipping_company_id=self.company1,
            user_full_name="Rajesh Agent (Oceanic)",
            user_status="ACTIVE"
        )

        # Shipping Company 2 (Pacific)
        self.company2 = ShippingCompany.objects.create(
            shipping_company_name="Pacific Cargo Express",
            shipping_company_license_number="LIC-PCF-2026",
            shipping_company_email="agent@pacific.com",
            shipping_company_phone="+919876543999",
            shipping_company_address="Dockyard Road, Mumbai",
            shipping_company_jurisdiction="India West Coast",
            shipping_company_status="ACTIVE"
        )
        self.login_shipping2 = Login.objects.create(
            login_email="agent@pacific.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="shipping_company",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_shipping2 = User.objects.create(
            login_id=self.login_shipping2,
            shipping_company_id=self.company2,
            user_full_name="Vikram Agent (Pacific)",
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

        # Port Administrator
        self.login_admin = Login.objects.create(
            login_email="admin@portide.com",
            login_password="pbkdf2_sha256$hashedpassword",
            login_role="port_administrator",
            login_status="ACTIVE",
            login_is_active=True
        )
        self.user_admin = User.objects.create(
            login_id=self.login_admin,
            user_full_name="Admin Chief",
            user_status="ACTIVE"
        )

        # Vessel & Arrival Request for Company 1
        self.vessel1 = Vessel.objects.create(
            vessel_shipping_company_id=self.company1,
            vessel_name="Oceanic Pioneer",
            vessel_imo_number="IMO9876543",
            vessel_type="CONTAINER_SHIP",
            vessel_flag="Panama",
            vessel_length=Decimal("250.00"),
            vessel_draft=Decimal("12.00"),
            vessel_capacity=5000,
            vessel_status="ACTIVE"
        )
        now = timezone.now()
        self.arrival_req1 = VesselArrivalRequest.objects.create(
            vessel_arrival_request_vessel_id=self.vessel1,
            vessel_arrival_request_requested_arrival_at=now + timezone.timedelta(days=1),
            vessel_arrival_request_requested_departure_at=now + timezone.timedelta(days=2),
            vessel_arrival_request_cargo_type="Containerized",
            vessel_arrival_request_cargo_quantity=100,
            vessel_arrival_request_status="APPROVED"
        )
        self.cargo1 = Cargo.objects.create(
            cargo_arrival_request_id=self.arrival_req1,
            cargo_origin_port_id=self.port_origin,
            cargo_destination_port_id=self.port_dest,
            cargo_description="High-tech electronics and components",
            cargo_type="CONTAINERIZED",
            cargo_quantity=Decimal("100.00"),
            cargo_unit="TEU",
            cargo_weight=Decimal("25000.00"),
            cargo_status="IN_PORT"
        )

        # Arrived post-arrival container in AWAITING_CUSTOMS
        self.container1 = Container.objects.create(
            container_cargo_id=self.cargo1,
            container_number="MSCU9876543",
            container_type="STANDARD_40FT",
            container_gross_weight=Decimal("28500.00"),
            container_status="AWAITING_CUSTOMS",
            container_customs_status="NOT_SUBMITTED"
        )

    def _auth_shipping1(self):
        self.client.defaults['HTTP_X_USER_EMAIL'] = self.login_shipping1.login_email
        self.client.defaults['HTTP_X_USER_ROLE'] = 'shipping_company'
        self.client.defaults['HTTP_X_USER_ID'] = str(self.user_shipping1.user_id)

    def _auth_shipping2(self):
        self.client.defaults['HTTP_X_USER_EMAIL'] = self.login_shipping2.login_email
        self.client.defaults['HTTP_X_USER_ROLE'] = 'shipping_company'
        self.client.defaults['HTTP_X_USER_ID'] = str(self.user_shipping2.user_id)

    def _auth_customs(self):
        self.client.defaults['HTTP_X_USER_EMAIL'] = self.login_customs.login_email
        self.client.defaults['HTTP_X_USER_ROLE'] = 'customs_officer'
        self.client.defaults['HTTP_X_USER_ID'] = str(self.user_customs.user_id)

    def test_01_normal_customs_document_upload_success(self):
        """
        Shipping company submits actual supporting customs documents for its arrived container.
        Metadata is persisted, and container is NOT automatically cleared.
        """
        self._auth_shipping1()

        dummy_pdf = SimpleUploadedFile(
            "bill_of_lading_MSCU9876543.pdf",
            b"%PDF-1.4 simulated bill of lading content for oceanic pioneer",
            content_type="application/pdf"
        )

        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_type": "BILL_OF_LADING",
                "notes": "Original clean on-board bill of lading signed by carrier master.",
                "file": dummy_pdf
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(res_data["status"], "success")
        self.assertEqual(len(res_data["documents"]), 1)

        doc_data = res_data["documents"][0]
        self.assertEqual(doc_data["document_name"], "bill_of_lading_MSCU9876543.pdf")
        self.assertEqual(doc_data["document_type"], "BILL_OF_LADING")
        self.assertEqual(doc_data["workflow_type"], "NORMAL")
        self.assertEqual(doc_data["workflow_type_display"], "Normal / Post-Arrival Customs")
        self.assertEqual(doc_data["review_status"], "PENDING")
        self.assertEqual(doc_data["uploaded_by_name"], "Rajesh Agent (Oceanic)")

        # Verify database record
        doc = CustomsDocument.objects.get(document_id=doc_data["document_id"])
        self.assertEqual(doc.document_container_id, self.container1)
        self.assertEqual(doc.workflow_type, "NORMAL")
        self.assertEqual(doc.document_review_status, "PENDING")

        # Crucial: upload alone does NOT mark container as CLEARED
        self.container1.refresh_from_db()
        self.assertEqual(self.container1.container_status, "AWAITING_CUSTOMS")
        self.assertEqual(self.container1.container_customs_status, "PENDING_REVIEW")
        self.assertFalse(self.container1.is_customs_cleared)

        # Verify audit log
        audit = AuditLog.objects.filter(
            audit_log_action="UPLOAD_CUSTOMS_DOCUMENTS",
            audit_log_target_id=str(self.container1.container_id)
        ).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.audit_log_category, "CUSTOMS")

    def test_02_multiple_documents_upload_support(self):
        """
        User can upload multiple supporting documents in a single submission (e.g. Invoice + Packing List).
        """
        self._auth_shipping1()

        invoice_pdf = SimpleUploadedFile(
            "commercial_invoice.pdf",
            b"%PDF-1.4 commercial invoice $250,000 USD",
            content_type="application/pdf"
        )
        packing_pdf = SimpleUploadedFile(
            "packing_list.pdf",
            b"%PDF-1.4 packing list 100 cartons pallets",
            content_type="application/pdf"
        )

        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_type": "COMMERCIAL_INVOICE",
                "notes": "Commercial documentation package",
                "files": [invoice_pdf, packing_pdf]
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(len(res_data["documents"]), 2)
        names = [d["document_name"] for d in res_data["documents"]]
        self.assertIn("commercial_invoice.pdf", names)
        self.assertIn("packing_list.pdf", names)

        # Database count check
        self.assertEqual(self.container1.customs_documents.count(), 2)

    def test_03_missing_file_rejected(self):
        """
        Submission without any file is rejected with 400 Bad Request.
        """
        self._auth_shipping1()
        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_type": "BILL_OF_LADING",
                "notes": "No file attached"
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No document file was provided", response.json()["message"])

    def test_04_invalid_file_extension_rejected(self):
        """
        Executable and disallowed file extensions are rejected with 400 Bad Request.
        """
        self._auth_shipping1()
        bad_file = SimpleUploadedFile(
            "malicious_script.exe",
            b"MZ executable content",
            content_type="application/x-dosexec"
        )
        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_type": "BILL_OF_LADING",
                "file": bad_file
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("unsupported extension", response.json()["message"])

    def test_05_oversized_file_rejected(self):
        """
        Files exceeding maximum 15MB limit are rejected with 400 Bad Request.
        """
        self._auth_shipping1()
        # Mock oversized file
        large_file = SimpleUploadedFile(
            "giant_scans.pdf",
            b"0" * (16 * 1024 * 1024),  # 16 MB
            content_type="application/pdf"
        )
        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_type": "BILL_OF_LADING",
                "file": large_file
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maximum allowed upload limit", response.json()["message"])

    def test_06_unauthorized_shipping_company_cross_upload_forbidden(self):
        """
        Shipping Company 2 cannot upload documents for Shipping Company 1's container.
        """
        self._auth_shipping2()  # Pacific trying to submit for Oceanic's container
        dummy_pdf = SimpleUploadedFile("fake_bl.pdf", b"%PDF content", content_type="application/pdf")

        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_type": "BILL_OF_LADING",
                "file": dummy_pdf
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("not authorized", response.json()["message"])

    def test_07_shipping_company_cannot_review_documents_or_clear_customs(self):
        """
        Shipping Company cannot approve document review or approve customs clearance.
        """
        # Create a document
        doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="bl_test.pdf",
            document_review_status="PENDING"
        )

        self._auth_shipping1()
        response = self.client.post(
            f"/api/customs/documents/{doc.document_id}/review/",
            {
                "review_status": "VERIFIED",
                "remarks": "Self approving"
            }
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_08_customs_officer_review_and_verification_workflow(self):
        """
        Customs Officer can view uploaded documents, review individual documents,
        and mark them as Verified or Rejected.
        """
        doc1 = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="bl_test.pdf",
            document_review_status="PENDING"
        )
        doc2 = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="COMMERCIAL_INVOICE",
            document_name="invoice_test.pdf",
            document_review_status="PENDING"
        )

        self._auth_customs()

        # 1. Customs Officer lists documents for the container
        list_res = self.client.get(f"/api/customs/containers/{self.container1.container_id}/documents/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.json()["data"]), 2)

        # 2. Customs Officer verifies doc1
        rev_res = self.client.post(
            f"/api/customs/documents/{doc1.document_id}/review/",
            {
                "review_status": "VERIFIED",
                "remarks": "Bill of Lading authenticated with ocean carrier seal."
            }
        )
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)
        doc1.refresh_from_db()
        self.assertEqual(doc1.document_review_status, "VERIFIED")
        self.assertEqual(doc1.document_reviewed_by, self.user_customs)

        # 3. Customs Officer rejects doc2 (flags discrepancy)
        rev_res2 = self.client.post(
            f"/api/customs/documents/{doc2.document_id}/review/",
            {
                "review_status": "REJECTED",
                "remarks": "Invoice HS code does not match declared manifest."
            }
        )
        self.assertEqual(rev_res2.status_code, status.HTTP_200_OK)
        doc2.refresh_from_db()
        self.assertEqual(doc2.document_review_status, "REJECTED")

    def test_09_pre_arrival_and_normal_customs_documents_distinction(self):
        """
        Pre-arrival documents and normal post-arrival documents remain distinct in origin
        while both being accessible during normal customs inspection review.
        """
        # Pre-arrival declaration with document
        decl = PreArrivalCustomsDeclaration.objects.create(
            declaration_reference="DEC-PRE-2026-0001",
            declaration_container_id=self.container1,
            declaration_cargo_id=self.cargo1,
            declaration_shipping_company_id=self.company1,
            declaration_type="IMPORT_PRE_ARRIVAL",
            declaration_document=SimpleUploadedFile("advance_manifest.pdf", b"%PDF advance", content_type="application/pdf"),
            declaration_document_name="advance_manifest.pdf",
            declaration_status="PENDING_REVIEW"
        )
        doc_pre = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_declaration_id=decl,
            document_type="IMPORT_DECLARATION",
            workflow_type="PRE_ARRIVAL",
            document_name="advance_manifest.pdf",
            document_review_status="PENDING"
        )

        # Normal post-arrival document upload
        doc_normal = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="PACKING_LIST",
            workflow_type="NORMAL",
            document_name="discharged_packing_list.pdf",
            document_review_status="PENDING"
        )

        self._auth_customs()
        list_res = self.client.get(f"/api/customs/containers/{self.container1.container_id}/documents/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        docs = list_res.json()["data"]
        self.assertEqual(len(docs), 2)

        pre_docs = [d for d in docs if d["workflow_type"] == "PRE_ARRIVAL"]
        norm_docs = [d for d in docs if d["workflow_type"] == "NORMAL"]
        self.assertEqual(len(pre_docs), 1)
        self.assertEqual(len(norm_docs), 1)
        self.assertEqual(pre_docs[0]["document_name"], "advance_manifest.pdf")
        self.assertEqual(norm_docs[0]["document_name"], "discharged_packing_list.pdf")

    def test_10_secure_download_access_controls(self):
        """
        Document download endpoint enforces RBAC and company ownership.
        """
        doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="confidential_bl.pdf",
            document_file=SimpleUploadedFile("confidential_bl.pdf", b"%PDF confidential", content_type="application/pdf")
        )

        # 1. Company 2 (unauthorized) cannot download Company 1's document
        self._auth_shipping2()
        res_unauth = self.client.get(f"/api/customs/documents/{doc.document_id}/download/")
        self.assertEqual(res_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Company 1 (owner) can download
        self._auth_shipping1()
        res_owner = self.client.get(f"/api/customs/documents/{doc.document_id}/download/")
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)

        # 3. Customs Officer can download
        self._auth_customs()
        res_customs = self.client.get(f"/api/customs/documents/{doc.document_id}/download/")
        self.assertEqual(res_customs.status_code, status.HTTP_200_OK)

    def test_11_upload_does_not_clear_customs_and_blocks_gate_release(self):
        """
        Uploading documents transitions customs status to PENDING_REVIEW but DOES NOT
        mark the container as CLEARED. Containers awaiting customs or under inspection
        remain strictly blocked from release.
        """
        self._auth_shipping1()
        pdf_file = SimpleUploadedFile("cert_origin.pdf", b"%PDF cert content", content_type="application/pdf")
        res = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {"document_type": "CERTIFICATE_OF_ORIGIN", "file": pdf_file},
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.container1.refresh_from_db()
        self.assertFalse(self.container1.is_customs_cleared)
        self.assertNotEqual(self.container1.container_status, "CLEARED")

        # Attempt to transition directly to RELEASED must fail
        trans_res = self.client.post(
            f"/api/containers/{self.container1.container_id}/status/",
            {"new_status": "RELEASED", "remarks": "Trying to bypass customs"}
        )
        self.assertIn(trans_res.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN])

    def test_12_customs_officer_clearance_with_verified_document_workflow(self):
        """
        After documents are submitted and verified, Customs Officer starts inspection,
        reviews documents, and issues formal clearance.
        """
        # Upload doc
        self._auth_shipping1()
        pdf_file = SimpleUploadedFile("final_import_decl.pdf", b"%PDF declaration", content_type="application/pdf")
        res = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {"document_type": "IMPORT_DECLARATION", "file": pdf_file},
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Customs officer starts inspection
        self._auth_customs()
        start_res = self.client.post(f"/api/customs/containers/{self.container1.container_id}/start-inspection/")
        self.assertEqual(start_res.status_code, status.HTTP_200_OK)

        self.container1.refresh_from_db()
        self.assertEqual(self.container1.container_status, "UNDER_INSPECTION")

        # Review & verify document
        doc = self.container1.customs_documents.first()
        rev_res = self.client.post(
            f"/api/customs/documents/{doc.document_id}/review/",
            {"review_status": "VERIFIED", "remarks": "Import declaration certified correct."}
        )
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)

        # Submit clearance
        clear_res = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/submit-inspection/",
            {
                "inspection_result": "CLEARED",
                "document_verification_status": "VERIFIED",
                "remarks": "All commercial and regulatory customs documents verified. Clearance granted."
            }
        )
        self.assertEqual(clear_res.status_code, status.HTTP_200_OK)

        self.container1.refresh_from_db()
        self.assertEqual(self.container1.container_status, "CLEARED")
        self.assertTrue(self.container1.is_customs_cleared)
        self.assertEqual(self.container1.latest_customs_inspection.customs_inspection_result, "CLEARED")

    def test_13_multi_document_upload_with_per_file_categories_and_repeated_types(self):
        """
        Upload multiple files in a single submission, assigning each file its own separate
        document type via document_manifest, including repeated categories (e.g. 2 commercial invoices).
        """
        import json
        self._auth_shipping1()

        invoice1 = SimpleUploadedFile("invoice_part_1.pdf", b"%PDF invoice 1", content_type="application/pdf")
        invoice2 = SimpleUploadedFile("invoice_part_2.pdf", b"%PDF invoice 2", content_type="application/pdf")
        packing = SimpleUploadedFile("packing_manifest.pdf", b"%PDF packing list", content_type="application/pdf")
        origin = SimpleUploadedFile("origin_cert.pdf", b"%PDF origin cert", content_type="application/pdf")

        manifest = [
            {"filename": "invoice_part_1.pdf", "document_type": "COMMERCIAL_INVOICE", "notes": "Part 1 of 2"},
            {"filename": "invoice_part_2.pdf", "document_type": "COMMERCIAL_INVOICE", "notes": "Part 2 of 2"},
            {"filename": "packing_manifest.pdf", "document_type": "PACKING_LIST", "notes": "Pallet breakdown"},
            {"filename": "origin_cert.pdf", "document_type": "CERTIFICATE_OF_ORIGIN", "notes": "Chamber issued"},
        ]

        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "document_manifest": json.dumps(manifest),
                "files": [invoice1, invoice2, packing, origin]
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(len(res_data["documents"]), 4)

        # Verify each file got its separate document type
        types_by_name = {d["document_name"]: d["document_type"] for d in res_data["documents"]}
        self.assertEqual(types_by_name["invoice_part_1.pdf"], "COMMERCIAL_INVOICE")
        self.assertEqual(types_by_name["invoice_part_2.pdf"], "COMMERCIAL_INVOICE")
        self.assertEqual(types_by_name["packing_manifest.pdf"], "PACKING_LIST")
        self.assertEqual(types_by_name["origin_cert.pdf"], "CERTIFICATE_OF_ORIGIN")

        # Verify database records
        docs = self.container1.customs_documents.all()
        self.assertEqual(docs.count(), 4)
        invoices = docs.filter(document_type="COMMERCIAL_INVOICE")
        self.assertEqual(invoices.count(), 2)

    def test_14_pre_arrival_multi_document_upload_with_per_file_types(self):
        """
        Advance pre-arrival filing supports multiple actual files in one submission,
        each with its own document type, linking all attachments to the declaration.
        """
        import json
        self._auth_shipping1()

        bl_pdf = SimpleUploadedFile("ocean_carrier_bl.pdf", b"%PDF bill of lading", content_type="application/pdf")
        inv_pdf = SimpleUploadedFile("advance_invoice.pdf", b"%PDF advance invoice", content_type="application/pdf")
        haz_pdf = SimpleUploadedFile("hazmat_cert.pdf", b"%PDF hazmat declaration", content_type="application/pdf")

        manifest = [
            {"filename": "ocean_carrier_bl.pdf", "document_type": "BILL_OF_LADING"},
            {"filename": "advance_invoice.pdf", "document_type": "COMMERCIAL_INVOICE"},
            {"filename": "hazmat_cert.pdf", "document_type": "HAZMAT_DECLARATION"},
        ]

        response = self.client.post(
            "/api/customs/pre-arrival/submit/",
            {
                "container_id": self.container1.container_id,
                "declaration_reference": "DEC-ADV-2026-MULTI",
                "notes": "Advance multi-file submission for electronics",
                "document_manifest": json.dumps(manifest),
                "files": [bl_pdf, inv_pdf, haz_pdf]
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        decl_data = res_data["data"]
        self.assertEqual(decl_data["declaration_reference"], "DEC-ADV-2026-MULTI")

        # Verify nested documents
        self.assertEqual(len(decl_data["documents"]), 3)
        doc_types = [d["document_type"] for d in decl_data["documents"]]
        self.assertIn("BILL_OF_LADING", doc_types)
        self.assertIn("COMMERCIAL_INVOICE", doc_types)
        self.assertIn("HAZMAT_DECLARATION", doc_types)

        # Check database
        decl = PreArrivalCustomsDeclaration.objects.get(declaration_reference="DEC-ADV-2026-MULTI")
        self.assertEqual(decl.documents.count(), 3)
        for doc in decl.documents.all():
            self.assertEqual(doc.workflow_type, "PRE_ARRIVAL")
            self.assertEqual(doc.document_container_id, self.container1)

    def test_15_delete_pending_document_success_leaves_other_attachments_intact(self):
        """
        Authorized user can delete an unreviewed (PENDING) document.
        Deleting one attachment does NOT delete the other attachments.
        """
        self._auth_shipping1()

        doc1 = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="keep_me.pdf",
            document_review_status="PENDING",
            workflow_type="NORMAL"
        )
        doc2 = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="OTHER",
            document_name="mistake_upload.pdf",
            document_review_status="PENDING",
            workflow_type="NORMAL"
        )

        self.assertEqual(self.container1.customs_documents.count(), 2)

        del_res = self.client.post(f"/api/customs/documents/{doc2.document_id}/delete/")
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)
        self.assertIn("successfully deleted", del_res.json()["message"])

        # doc2 is deleted, but doc1 remains intact!
        self.assertEqual(self.container1.customs_documents.count(), 1)
        self.assertTrue(CustomsDocument.objects.filter(document_id=doc1.document_id).exists())
        self.assertFalse(CustomsDocument.objects.filter(document_id=doc2.document_id).exists())

    def test_16_delete_verified_or_cleared_document_strictly_rejected(self):
        """
        Attempting to delete a VERIFIED document or a document on a CLEARED container
        must be strictly rejected with 400 Bad Request.
        """
        self._auth_shipping1()

        # 1. Verified document cannot be deleted
        doc_verified = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="verified_bl.pdf",
            document_review_status="VERIFIED"
        )
        del_res = self.client.post(f"/api/customs/documents/{doc_verified.document_id}/delete/")
        self.assertEqual(del_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be deleted", del_res.json()["message"])
        self.assertTrue(CustomsDocument.objects.filter(document_id=doc_verified.document_id).exists())

        # 2. Document on a cleared container cannot be deleted
        self.container1.container_status = "CLEARED"
        self.container1.container_customs_status = "CLEARED"
        self.container1.save()

        doc_pending = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="PACKING_LIST",
            document_name="cleared_shipment_doc.pdf",
            document_review_status="PENDING"
        )
        del_res2 = self.client.post(f"/api/customs/documents/{doc_pending.document_id}/delete/")
        self.assertEqual(del_res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be deleted for a container that has already received official clearance", del_res2.json()["message"])

    def test_17_unauthorized_user_cannot_delete_or_replace_documents(self):
        """
        Cross-company user (Shipping Company 2) cannot delete or replace Shipping Company 1's documents.
        """
        doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="oceanic_bl.pdf",
            document_review_status="PENDING"
        )

        self._auth_shipping2()  # Pacific trying to delete Oceanic's doc

        # Delete attempt
        del_res = self.client.post(f"/api/customs/documents/{doc.document_id}/delete/")
        self.assertEqual(del_res.status_code, status.HTTP_403_FORBIDDEN)

        # Replace attempt
        new_pdf = SimpleUploadedFile("pacific_bl.pdf", b"%PDF pacific", content_type="application/pdf")
        rep_res = self.client.post(
            f"/api/customs/documents/{doc.document_id}/replace/",
            {"file": new_pdf, "reason": "Unauthorized replacement attempt"},
            format="multipart"
        )
        self.assertEqual(rep_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_18_replace_document_versioning_and_superseded_status(self):
        """
        Authorized replacement marks the old document as SUPERSEDED (is_active=False),
        creates a new document with incremented version number (v2), links replaced_by,
        and leaves the new document in PENDING review status.
        """
        self._auth_shipping1()

        old_doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="COMMERCIAL_INVOICE",
            document_name="invoice_v1.pdf",
            document_version=1,
            document_is_active=True,
            document_review_status="PENDING"
        )

        replacement_pdf = SimpleUploadedFile(
            "invoice_v2_corrected.pdf",
            b"%PDF-1.4 corrected total value invoice",
            content_type="application/pdf"
        )

        rep_res = self.client.post(
            f"/api/customs/documents/{old_doc.document_id}/replace/",
            {
                "file": replacement_pdf,
                "reason": "Corrected HS code and invoice line items as requested.",
                "notes": "Updated CIF valuation"
            },
            format="multipart"
        )

        self.assertEqual(rep_res.status_code, status.HTTP_201_CREATED)
        res_data = rep_res.json()
        new_doc_data = res_data["data"]

        # Verify new document attributes
        self.assertEqual(new_doc_data["version"], 2)
        self.assertTrue(new_doc_data["is_active"])
        self.assertEqual(new_doc_data["review_status"], "PENDING")
        self.assertEqual(new_doc_data["original_filename"], "invoice_v2_corrected.pdf")
        self.assertEqual(new_doc_data["amendment_reason"], "Corrected HS code and invoice line items as requested.")

        # Verify old document superseded in DB
        old_doc.refresh_from_db()
        self.assertFalse(old_doc.document_is_active)
        self.assertEqual(old_doc.document_review_status, "SUPERSEDED")
        self.assertEqual(old_doc.document_replaced_by.document_id, new_doc_data["document_id"])
        self.assertEqual(old_doc.document_amendment_reason, "Corrected HS code and invoice line items as requested.")

    def test_19_replace_verified_document_requires_mandatory_amendment_reason(self):
        """
        Replacing a document that was already VERIFIED strictly requires an amendment reason.
        If omitted, the request is rejected with 400 Bad Request.
        """
        self._auth_shipping1()

        verified_doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="PACKING_LIST",
            document_name="packing_v1.pdf",
            document_review_status="VERIFIED",
            document_version=1
        )

        new_pdf = SimpleUploadedFile("packing_v2.pdf", b"%PDF v2", content_type="application/pdf")

        # Missing reason
        res = self.client.post(
            f"/api/customs/documents/{verified_doc.document_id}/replace/",
            {"file": new_pdf},
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Amendment reason is strictly required", res.json()["message"])

        # With reason -> success
        res_ok = self.client.post(
            f"/api/customs/documents/{verified_doc.document_id}/replace/",
            {"file": new_pdf, "amendment_reason": "Shipper revised tare weight."},
            format="multipart"
        )
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

    def test_20_failed_replacement_leaves_previous_document_intact(self):
        """
        If replacement fails (e.g. invalid file extension or oversized file),
        the transaction aborts and the previous document remains active and un-superseded.
        """
        self._auth_shipping1()

        doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="BILL_OF_LADING",
            document_name="original_bl.pdf",
            document_version=1,
            document_is_active=True,
            document_review_status="PENDING"
        )

        bad_file = SimpleUploadedFile("dangerous_script.exe", b"MZ bad executable", content_type="application/octet-stream")

        res = self.client.post(
            f"/api/customs/documents/{doc.document_id}/replace/",
            {"file": bad_file, "reason": "Malicious attempt"},
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify old doc remains active and untouched
        doc.refresh_from_db()
        self.assertTrue(doc.document_is_active)
        self.assertEqual(doc.document_review_status, "PENDING")
        self.assertIsNone(doc.document_replaced_by)

    def test_21_replace_cleared_container_document_resets_customs_clearance(self):
        """
        If a document is amended/replaced after the shipment was CLEARED,
        the system does NOT preserve clearance blindly; customs status resets to PENDING_REVIEW
        so that an authorized Customs Officer must re-evaluate.
        """
        self._auth_shipping1()

        self.container1.container_status = "CLEARED"
        self.container1.container_customs_status = "CLEARED"
        self.container1.save()

        doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_type="IMPORT_DECLARATION",
            document_name="declared_v1.pdf",
            document_review_status="VERIFIED"
        )

        new_pdf = SimpleUploadedFile("declared_v2.pdf", b"%PDF v2 corrected", content_type="application/pdf")
        res = self.client.post(
            f"/api/customs/documents/{doc.document_id}/replace/",
            {"file": new_pdf, "amendment_reason": "Material amendment to declared tariff code."},
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.container1.refresh_from_db()
        self.assertFalse(self.container1.is_customs_cleared)
        self.assertEqual(self.container1.container_customs_status, "PENDING_REVIEW")
        self.assertEqual(self.container1.container_status, "UNDER_INSPECTION")

    def test_22_customs_requested_correction_resubmission_workflow(self):
        """
        When Customs Officer requests corrections (ADDITIONAL_INFORMATION_REQUIRED),
        shipping company can resubmit corrected documents. The declaration review history
        is recorded, declaration status transitions back to PENDING_REVIEW, and it does
        NOT auto-approve.
        """
        # Create declaration in ADDITIONAL_INFORMATION_REQUIRED
        decl = PreArrivalCustomsDeclaration.objects.create(
            declaration_reference="DEC-CORR-2026-001",
            declaration_container_id=self.container1,
            declaration_cargo_id=self.cargo1,
            declaration_shipping_company_id=self.company1,
            declaration_status="ADDITIONAL_INFORMATION_REQUIRED",
            declaration_review_remarks="Certificate of origin stamp missing from chamber.",
            declaration_reviewed_by=self.user_customs,
            declaration_reviewed_at=timezone.now()
        )
        doc = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_declaration_id=decl,
            document_type="CERTIFICATE_OF_ORIGIN",
            workflow_type="PRE_ARRIVAL",
            document_name="origin_unstamped.pdf",
            document_review_status="REJECTED"
        )

        self._auth_shipping1()

        # Replace rejected document with stamped version
        stamped_pdf = SimpleUploadedFile("origin_stamped_official.pdf", b"%PDF official stamp", content_type="application/pdf")
        rep_res = self.client.post(
            f"/api/customs/documents/{doc.document_id}/replace/",
            {
                "file": stamped_pdf,
                "reason": "Attached newly stamped certificate from Singapore International Chamber of Commerce."
            },
            format="multipart"
        )
        self.assertEqual(rep_res.status_code, status.HTTP_201_CREATED)

        # Verify declaration transitioned back to PENDING_REVIEW (not CLEARED!)
        decl.refresh_from_db()
        self.assertEqual(decl.declaration_status, "PENDING_REVIEW")
        self.assertNotEqual(decl.declaration_status, "CLEARED")
        self.container1.refresh_from_db()
        self.assertFalse(self.container1.is_customs_cleared)

        # Check review history recorded
        self.assertTrue(any(h.get("action") == "CORRECTION_RESUBMITTED" for h in decl.declaration_review_history))

    def test_23_pre_arrival_multi_file_submission_with_per_file_categories(self):
        """
        Verify that multiple supporting files can be uploaded simultaneously during
        Pre-Arrival Customs Declaration submission, each assigned its own category,
        and that it does not clear customs.
        """
        self._auth_shipping1()

        file1 = SimpleUploadedFile("ocean_bl.pdf", b"%PDF ocean bill of lading content", content_type="application/pdf")
        file2 = SimpleUploadedFile("comm_inv.pdf", b"%PDF commercial invoice content", content_type="application/pdf")

        manifest = [
            {"filename": "ocean_bl.pdf", "document_type": "BILL_OF_LADING", "document_notes": "Master B/L"},
            {"filename": "comm_inv.pdf", "document_type": "COMMERCIAL_INVOICE", "document_notes": "CIF Invoice"}
        ]

        res = self.client.post(
            "/api/customs/pre-arrival/submit/",
            {
                "container_id": self.container1.container_id,
                "declaration_reference": "DEC-PRE-2026-MULTI",
                "remarks": "Multi-document advance manifest filing",
                "files": [file1, file2],
                "document_manifest": json.dumps(manifest)
            },
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json().get("data", {})
        self.assertEqual(data.get("declaration_reference"), "DEC-PRE-2026-MULTI")

        # Verify declaration created in PENDING_REVIEW
        decl = PreArrivalCustomsDeclaration.objects.get(declaration_reference="DEC-PRE-2026-MULTI")
        self.assertEqual(decl.declaration_status, "PENDING_REVIEW")

        # Verify both CustomsDocument records were created and linked
        docs = CustomsDocument.objects.filter(document_declaration_id=decl)
        self.assertEqual(docs.count(), 2)

        doc_types = set(docs.values_list("document_type", flat=True))
        self.assertEqual(doc_types, {"BILL_OF_LADING", "COMMERCIAL_INVOICE"})

        for doc in docs:
            self.assertEqual(doc.workflow_type, "PRE_ARRIVAL")
            self.assertEqual(doc.document_container_id, self.container1)
            self.assertEqual(doc.document_review_status, "PENDING")
            self.assertTrue(doc.document_is_active)

        # Uploading does NOT clear customs
        self.container1.refresh_from_db()
        self.assertFalse(self.container1.is_customs_cleared)

    def test_24_pre_arrival_delete_single_attachment_does_not_affect_sibling_attachments(self):
        """
        Verify that deleting one pending attachment from a pre-arrival declaration
        does not accidentally delete or affect sibling attachments.
        """
        self._auth_shipping1()

        decl = PreArrivalCustomsDeclaration.objects.create(
            declaration_reference="DEC-MULTI-DEL-01",
            declaration_container_id=self.container1,
            declaration_cargo_id=self.cargo1,
            declaration_shipping_company_id=self.company1,
            declaration_status="PENDING_REVIEW"
        )

        doc1 = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_declaration_id=decl,
            document_type="BILL_OF_LADING",
            document_name="pre_bl.pdf",
            workflow_type="PRE_ARRIVAL",
            document_review_status="PENDING",
            document_version=1
        )
        doc2 = CustomsDocument.objects.create(
            document_container_id=self.container1,
            document_declaration_id=decl,
            document_type="PACKING_LIST",
            document_name="pre_packing.pdf",
            workflow_type="PRE_ARRIVAL",
            document_review_status="PENDING",
            document_version=1
        )

        # Delete doc1
        del_res = self.client.delete(f"/api/customs/documents/{doc1.document_id}/delete/")
        self.assertEqual(del_res.status_code, status.HTTP_200_OK)

        # Verify doc1 is gone
        self.assertFalse(CustomsDocument.objects.filter(document_id=doc1.document_id).exists())

        # Verify doc2 remains intact and unchanged
        self.assertTrue(CustomsDocument.objects.filter(document_id=doc2.document_id).exists())
        doc2.refresh_from_db()
        self.assertEqual(doc2.document_review_status, "PENDING")
        self.assertEqual(doc2.document_declaration_id, decl)

        # Declaration still exists
        decl.refresh_from_db()
        self.assertEqual(decl.declaration_status, "PENDING_REVIEW")

    def test_25_normal_upload_per_file_types_independent_and_persisted(self):
        """
        Multiple files can be submitted in one request, with every file receiving
        its own selected document type. Different files can have different types in the same batch.
        Saved types persist in database and appear in GET response.
        """
        self._auth_shipping1()

        f_bl = SimpleUploadedFile("bill_of_lading.pdf", b"%PDF-1.4 ocean bill of lading", content_type="application/pdf")
        f_inv = SimpleUploadedFile("commercial_invoice.pdf", b"%PDF-1.4 invoice $100k", content_type="application/pdf")
        f_pack = SimpleUploadedFile("packing_list.pdf", b"%PDF-1.4 packing list 500 crates", content_type="application/pdf")

        manifest = [
            {"filename": "bill_of_lading.pdf", "document_type": "BILL_OF_LADING", "notes": "Clean On-Board B/L"},
            {"filename": "commercial_invoice.pdf", "document_type": "COMMERCIAL_INVOICE", "notes": "FOB Value Invoice"},
            {"filename": "packing_list.pdf", "document_type": "PACKING_LIST", "notes": "Consignment Breakdown"}
        ]

        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "files": [f_bl, f_inv, f_pack],
                "document_types": ["BILL_OF_LADING", "COMMERCIAL_INVOICE", "PACKING_LIST"],
                "document_manifest": json.dumps(manifest),
                "notes": "Full customs documentation set"
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(len(res_data["documents"]), 3)

        # Check each file has its own document type
        doc_map = {d["original_filename"]: d["document_type"] for d in res_data["documents"]}
        self.assertEqual(doc_map["bill_of_lading.pdf"], "BILL_OF_LADING")
        self.assertEqual(doc_map["commercial_invoice.pdf"], "COMMERCIAL_INVOICE")
        self.assertEqual(doc_map["packing_list.pdf"], "PACKING_LIST")

        # Verify persisted in database
        db_docs = CustomsDocument.objects.filter(document_container_id=self.container1)
        self.assertEqual(db_docs.count(), 3)
        db_map = {d.document_name: d.document_type for d in db_docs}
        self.assertEqual(db_map["bill_of_lading.pdf"], "BILL_OF_LADING")
        self.assertEqual(db_map["commercial_invoice.pdf"], "COMMERCIAL_INVOICE")
        self.assertEqual(db_map["packing_list.pdf"], "PACKING_LIST")

        # Verify GET endpoint returns each file's persisted type
        get_res = self.client.get(f"/api/customs/containers/{self.container1.container_id}/documents/")
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        get_docs = {d["original_filename"]: d["document_type"] for d in get_res.json()["data"]}
        self.assertEqual(get_docs["bill_of_lading.pdf"], "BILL_OF_LADING")
        self.assertEqual(get_docs["commercial_invoice.pdf"], "COMMERCIAL_INVOICE")
        self.assertEqual(get_docs["packing_list.pdf"], "PACKING_LIST")

    def test_26_multiple_files_of_same_type_allowed(self):
        """
        Multiple files of the same type work where allowed (e.g. 2 packing lists).
        """
        self._auth_shipping1()

        pack1 = SimpleUploadedFile("packing_list_part1.pdf", b"%PDF part 1 packing list", content_type="application/pdf")
        pack2 = SimpleUploadedFile("packing_list_part2.pdf", b"%PDF part 2 packing list", content_type="application/pdf")

        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "files": [pack1, pack2],
                "document_types": ["PACKING_LIST", "PACKING_LIST"],
                "notes": "Two-part packing list"
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        res_data = response.json()
        self.assertEqual(len(res_data["documents"]), 2)
        for doc in res_data["documents"]:
            self.assertEqual(doc["document_type"], "PACKING_LIST")

    def test_27_missing_document_type_rejected_with_clear_error(self):
        """
        Missing document type is strictly rejected with a 400 Bad Request
        and clear error message indicating the filename.
        """
        self._auth_shipping1()

        f1 = SimpleUploadedFile("valid_bl.pdf", b"%PDF valid bill of lading", content_type="application/pdf")
        f2 = SimpleUploadedFile("untyped_doc.pdf", b"%PDF untyped document", content_type="application/pdf")

        # File 2 has an empty string document_type
        response = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "files": [f1, f2],
                "document_types": ["BILL_OF_LADING", ""],
            },
            format="multipart"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_msg = response.json().get("message", "")
        self.assertIn("untyped_doc.pdf", error_msg)
        self.assertIn("Document type is required", error_msg)

        # Pre-arrival workflow also rejects missing document type
        f3 = SimpleUploadedFile("pre_valid.pdf", b"%PDF valid pre-arrival", content_type="application/pdf")
        f4 = SimpleUploadedFile("pre_missing.pdf", b"%PDF missing pre-arrival type", content_type="application/pdf")

        pre_res = self.client.post(
            "/api/customs/pre-arrival/submit/",
            {
                "container_id": self.container1.container_id,
                "declaration_reference": "DEC-PRE-MISSING-01",
                "files": [f3, f4],
                "document_types": ["BILL_OF_LADING", ""]
            },
            format="multipart"
        )
        self.assertEqual(pre_res.status_code, status.HTTP_400_BAD_REQUEST)
        pre_error_msg = pre_res.json().get("message", "")
        self.assertIn("pre_missing.pdf", pre_error_msg)
        self.assertIn("Document type is required", pre_error_msg)

    def test_28_pre_arrival_per_file_types_independent_and_customs_review_dashboard(self):
        """
        Pre-arrival workflow saves independent document types for each attachment.
        Types appear correctly for customs officer review.
        """
        self._auth_shipping1()

        f_coo = SimpleUploadedFile("certificate_of_origin.pdf", b"%PDF certificate of origin", content_type="application/pdf")
        f_haz = SimpleUploadedFile("hazmat_msds.pdf", b"%PDF dangerous goods hazmat declaration", content_type="application/pdf")

        manifest = [
            {"filename": "certificate_of_origin.pdf", "document_type": "CERTIFICATE_OF_ORIGIN", "notes": "Chamber of Commerce"},
            {"filename": "hazmat_msds.pdf", "document_type": "HAZMAT_DECLARATION", "notes": "Class 3 Flammable"}
        ]

        res = self.client.post(
            "/api/customs/pre-arrival/submit/",
            {
                "container_id": self.container1.container_id,
                "declaration_reference": "DEC-PRE-2026-INDEP",
                "files": [f_coo, f_haz],
                "document_manifest": json.dumps(manifest)
            },
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Retrieve as Customs Officer
        self._auth_customs()
        list_res = self.client.get("/api/customs/pre-arrival/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        decls = list_res.json().get("data", [])
        matched = next((d for d in decls if d["declaration_reference"] == "DEC-PRE-2026-INDEP"), None)
        self.assertIsNotNone(matched)
        self.assertEqual(len(matched["documents"]), 2)
        dash_map = {d["original_filename"]: d["document_type"] for d in matched["documents"]}
        self.assertEqual(dash_map["certificate_of_origin.pdf"], "CERTIFICATE_OF_ORIGIN")
        self.assertEqual(dash_map["hazmat_msds.pdf"], "HAZMAT_DECLARATION")

    def test_29_unauthorized_company_cannot_submit_or_view_documents(self):
        """
        Company B cannot submit customs documents for Company A's container or view them.
        """
        # Company 2 tries to submit documents for Container 1 (owned by Company 1)
        self._auth_shipping2()
        f = SimpleUploadedFile("unauth.pdf", b"%PDF unauthorized upload", content_type="application/pdf")
        res = self.client.post(
            f"/api/customs/containers/{self.container1.container_id}/documents/",
            {
                "files": [f],
                "document_types": ["BILL_OF_LADING"]
            },
            format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Company 2 tries to view Container 1's documents
        get_res = self.client.get(f"/api/customs/containers/{self.container1.container_id}/documents/")
        self.assertEqual(get_res.status_code, status.HTTP_403_FORBIDDEN)




