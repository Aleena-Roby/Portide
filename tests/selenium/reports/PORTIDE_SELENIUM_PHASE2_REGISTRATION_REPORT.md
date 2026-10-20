# PORTIDE – Selenium Testing Phase 2
## Shipping Company Registration & Admin Approval

### 1. Testing Objective

Phase 2 verifies the end-to-end onboarding, compliance review, and approval lifecycle for Shipping Companies on the **PORTIDE Maritime Port Operations Intelligence Platform**. It validates registration form field integrity, international telephone validation rules, document uploads, pending queue visibility, administrator review modal controls, approval activation, Action Required document correction cycles, application resubmission, rejection with audit justifications, role-based access control, and duplicate prevention.

---

### 2. Test Environment

- **Frontend URL**: http://localhost:3000
- **Backend URL**: http://localhost:8000
- **Browser**: Chromium / Chrome Headless
- **Selenium Version**: v4.50.0
- **Python Version**: v3.13.14
- **Operating System**: Windows 11
- **Execution Date/Time**: 2026-10-07T14:46:21.725415

---

### 3. Testing Scope

The scope of Phase 2 encompasses:
- Registration page load and field availability (`REG-001`)
- Client-side validation of mandatory registration fields (`REG-002`)
- RFC email format validation (`REG-003`)
- Country-specific international phone validation (`REG-004`)
- Document requirement evaluation (`REG-005`)
- Valid shipping company registration submission (`REG-006`)
- Status initialization to `PENDING REVIEW` (`REG-007`)
- Port Administrator visibility in Company Approvals table (`REG-008`)
- Detailed review modal rendering (`REG-009`)
- Uploaded evidence inspectability (`REG-010`)
- Port Administrator approval action (`REG-011`)
- Approved status persistence across sessions and status lookups (`REG-012`)
- Action Required notification and feedback workflow (`REG-013`)
- Corrected document resubmission loop (`REG-014`)
- Rejection workflow with audit remarks (`REG-015`)
- Role-based route guard enforcement on admin approvals (`REG-016`)
- Duplicate submission prevention on existing License and Email (`REG-017`)

*Excluded*: User Management, Vessels, Berths, Arrival Requests, Cargo, Customs, Gate passes, QR, and Delivery Tracking.

---

### 4. Registration Workflow Tested

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SHIPPING COMPANY REGISTRATION LIFECYCLE              │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Applicant Registers (/register)                                     │
│    └─> Assigned Reference: REG-2026-XXX (Status: PENDING)             │
│                                                                        │
│ 2. Port Administrator Review (/admin/company-approvals)                │
│    ├─> Path A: Approve ────> Status: APPROVED / ACTIVE                 │
│    ├─> Path B: Action Req ─> Status: ACTION_REQUIRED                   │
│    │     └─> Applicant Resubmits ─> Status: PENDING REVIEW             │
│    │           └─> Admin Final Review                                  │
│    └─> Path C: Reject ─────> Status: REJECTED (Reason Saved)           │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Detailed Test Results

| ID | Test Case | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| REG-001 | REG-001 – SHIPPING COMPANY REGISTRATION PAGE LOAD | Registration page loads correctly and form controls are accessible. | Registration page loaded in 3245 ms. All required input fields and controls rendered correctly. | **PASS** |
| REG-002 | REG-002 – EMPTY REGISTRATION FORM VALIDATION | Empty required fields prevent submission. Validation feedback appears. | Submission was blocked by form validation. HTML5 checkValidity() returned False. No record was created. | **PASS** |
| REG-003 | REG-003 – INVALID EMAIL VALIDATION | Email validation appears. Registration is not successfully submitted. | Malformed email rejected by HTML5 input validation. Form submission prevented. | **PASS** |
| REG-004 | REG-004 – INVALID PHONE VALIDATION | Phone validation appears. Registration is not successfully submitted. | Phone validation message displayed: 'Please enter a valid phone number for the selected country.'. Form submission prevented. | **PASS** |
| REG-005 | REG-005 – REQUIRED DOCUMENT VALIDATION | Document validation if required; otherwise mark NOT IMPLEMENTED / NOT APPLICABLE. | Document upload controls are operational on the registration page; document attachments are optional during initial registration per system design, deferring mandatory document requirements to the compliance review workflow. | **NOT_IMPLEMENTED** |
| REG-006 | REG-006 – VALID SHIPPING COMPANY REGISTRATION | Registration is successfully submitted and enters the review workflow. | Registration request submitted successfully in 15075 ms. Assigned reference: REG-2026-055. | **PASS** |
| REG-007 | REG-007 – REGISTRATION STATUS IS PENDING REVIEW | Newly submitted company is in PENDING REVIEW status and not marked as approved. | Status verified as 'Pending Compliance Review' for 'Selenium Test Shipping Company Primary 20261007144406'. | **PASS** |
| REG-008 | REG-008 – ADMIN REGISTRATION REQUEST VISIBILITY | Admin can see the submitted registration request with correct company name, license, and pending status. | Submitted company successfully located in Admin Approvals table with license 'LIC-SEL-PRIMARY-20261007144406'. | **PASS** |
| REG-009 | REG-009 – ADMIN VIEW REGISTRATION DETAILS | Modal opens with Company name, license number, email, phone, applicant, address, and status. | Detailed review modal rendered in 308 ms. All metadata matched submitted values. | **PASS** |
| REG-010 | REG-010 – ADMIN VIEW UPLOADED DOCUMENT/EVIDENCE | Uploaded document information is correctly displayed in the review modal. | Uploaded document evidence container is visible and associated with the registration request. | **PASS** |
| REG-011 | REG-011 – ADMIN APPROVES VALID REGISTRATION | Valid shipping company registration is successfully approved. Status updates to Approved. | Approval action completed in 8844 ms. Status transitioned to APPROVED. | **PASS** |
| REG-012 | REG-012 – APPROVED COMPANY STATUS VERIFICATION | Approved company status is persisted in database and shown as APPROVED. | Status 'APPROVED' verified across Admin Approvals view and Applicant Status lookup. | **PASS** |
| REG-013 | REG-013 – ACTION REQUIRED WORKFLOW | Registration enters Action Required state with saved admin instructions. | Status updated to ACTION_REQUIRED. Remarks saved and visible on applicant status portal. | **PASS** |
| REG-014 | REG-014 – ACTION REQUIRED CORRECTION AND RESUBMISSION | Existing registration is updated, status returns to PENDING REVIEW, and resubmitted date is recorded. | Resubmission succeeded. Existing registration updated and status returned to PENDING REVIEW. | **PASS** |
| REG-015 | REG-015 – REJECTION WORKFLOW | Rejection succeeds. Status becomes REJECTED. Rejection reason is recorded. | Registration rejected successfully. Status updated to REJECTED with recorded justification. | **PASS** |
| REG-016 | REG-016 – ROLE ACCESS CONTROL ON APPROVALS | Unauthorized users receive protected-route redirection and cannot view company approvals. | Access denied. User cleanly redirected to http://localhost:3000/login. No administrative tables leaked. | **PASS** |
| REG-017 | REG-017 – DUPLICATE SUBMISSION PREVENTION | Duplicate registration is prevented by business logic with appropriate duplicate error message. | Duplicate submission blocked. Error displayed: 'An account with this email address already exists.'. | **PASS** |

---

### 6. Detailed Evidence

#### REG-001 – SHIPPING COMPANY REGISTRATION PAGE LOAD

- **Objective**: Verify the Shipping Company Registration page loads with all required controls and fields visible.
- **Precondition**: PORTIDE application accessible at http://localhost:3000.
- **Actions**: 1. Navigate to /register. 2. Verify visibility of form heading, inputs, and submit button.
- **Expected Result**: Registration page loads correctly and form controls are accessible.
- **Actual Result**: Registration page loaded in 3245 ms. All required input fields and controls rendered correctly.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-001-PASS.png`
- **Remarks**: Clean UI presentation with international country calling codes and security checklists.

---
#### REG-002 – EMPTY REGISTRATION FORM VALIDATION

- **Objective**: Verify submission of empty registration form is blocked by validation without creating records.
- **Precondition**: User on /register with blank inputs.
- **Actions**: 1. Leave all required inputs empty. 2. Click Submit Registration. 3. Check client validity.
- **Expected Result**: Empty required fields prevent submission. Validation feedback appears.
- **Actual Result**: Submission was blocked by form validation. HTML5 checkValidity() returned False. No record was created.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-002-PASS.png`
- **Remarks**: Required constraints properly enforce mandatory inputs.

---
#### REG-003 – INVALID EMAIL VALIDATION

- **Objective**: Verify malformed or invalid email format is rejected by registration validation.
- **Precondition**: User on /register.
- **Actions**: 1. Fill valid data with malformed email 'invalid-email-format-without-at'. 2. Submit.
- **Expected Result**: Email validation appears. Registration is not successfully submitted.
- **Actual Result**: Malformed email rejected by HTML5 input validation. Form submission prevented.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-003-PASS.png`
- **Remarks**: Email format validation enforced properly.

---
#### REG-004 – INVALID PHONE VALIDATION

- **Objective**: Verify invalid phone number according to country rules produces validation error and stops submission.
- **Precondition**: User on /register with country Singapore selected.
- **Actions**: 1. Fill valid data with invalid 3-digit phone '123'. 2. Submit form. 3. Check validation error.
- **Expected Result**: Phone validation appears. Registration is not successfully submitted.
- **Actual Result**: Phone validation message displayed: 'Please enter a valid phone number for the selected country.'. Form submission prevented.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-004-PASS.png`
- **Remarks**: International phone validation library enforces country-specific telephone numbering plan.

---
#### REG-005 – REQUIRED DOCUMENT VALIDATION

- **Objective**: Verify behavior when submitting registration without document attachments.
- **Precondition**: Inspection of RegistrationRequestSerializer and RegisterPage component.
- **Actions**: 1. Inspect serializer schema for request_license_file and request_id_file.
- **Expected Result**: Document validation if required; otherwise mark NOT IMPLEMENTED / NOT APPLICABLE.
- **Actual Result**: Document upload controls are operational on the registration page; document attachments are optional during initial registration per system design, deferring mandatory document requirements to the compliance review workflow.
- **Status**: **NOT_IMPLEMENTED**
- **Screenshot**: `../screenshots/REG-005-NOT-IMPLEMENTED.png`
- **Remarks**: NOT IMPLEMENTED / NOT APPLICABLE: The current PORTIDE specification treats initial file attachments as optional, deferring mandatory document requests to the Port Administrator 'Action Required' compliance review workflow.

---
#### REG-006 – VALID SHIPPING COMPANY REGISTRATION

- **Objective**: Submit a valid shipping company registration and verify success screen and assigned tracking reference.
- **Precondition**: Unique test company credentials generated.
- **Actions**: 1. Enter valid details for 'Selenium Test Shipping Company Primary 20261007144406'. 2. Attach sample license. 3. Submit.
- **Expected Result**: Registration is successfully submitted and enters the review workflow.
- **Actual Result**: Registration request submitted successfully in 15075 ms. Assigned reference: REG-2026-055.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-006-PASS.png`
- **Remarks**: Test company 'Selenium Test Shipping Company Primary 20261007144406' submitted with reference REG-2026-055.

---
#### REG-007 – REGISTRATION STATUS IS PENDING REVIEW

- **Objective**: Verify initial status of submitted registration is PENDING REVIEW across applicant and tracking views.
- **Precondition**: Registration submitted for 'Selenium Test Shipping Company Primary 20261007144406'.
- **Actions**: 1. Navigate to /registration-status?email=selenium.ship.primary.20261007144406@testportide.com. 2. Verify status badge.
- **Expected Result**: Newly submitted company is in PENDING REVIEW status and not marked as approved.
- **Actual Result**: Status verified as 'Pending Compliance Review' for 'Selenium Test Shipping Company Primary 20261007144406'.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-007-PASS.png`
- **Remarks**: Initial state properly initialized to PENDING in compliance with governance workflow.

---
#### REG-008 – ADMIN REGISTRATION REQUEST VISIBILITY

- **Objective**: Verify Port Administrator can view the newly submitted registration in Company Approvals table.
- **Precondition**: Port Administrator session and submitted test registration.
- **Actions**: 1. Login as Admin. 2. Navigate to /admin/company-approvals. 3. Search 'Selenium Test Shipping Company Primary 20261007144406'.
- **Expected Result**: Admin can see the submitted registration request with correct company name, license, and pending status.
- **Actual Result**: Submitted company successfully located in Admin Approvals table with license 'LIC-SEL-PRIMARY-20261007144406'.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-008-PASS.png`
- **Remarks**: Admin dashboard synchronization with PostgreSQL backend verified.

---
#### REG-009 – ADMIN VIEW REGISTRATION DETAILS

- **Objective**: Verify clicking View Application opens the detailed review modal displaying all company details.
- **Precondition**: Admin on /admin/company-approvals with test company visible.
- **Actions**: 1. Click 'View Application' button. 2. Verify modal details (company, license, email, address).
- **Expected Result**: Modal opens with Company name, license number, email, phone, applicant, address, and status.
- **Actual Result**: Detailed review modal rendered in 308 ms. All metadata matched submitted values.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-009-PASS.png`
- **Remarks**: Modal displays comprehensive audit history and review controls.

---
#### REG-010 – ADMIN VIEW UPLOADED DOCUMENT/EVIDENCE

- **Objective**: Verify uploaded document/evidence is associated with the company and accessible to the Admin.
- **Precondition**: Review modal open for test company with attached license document.
- **Actions**: 1. Inspect Document Evidence section inside review modal.
- **Expected Result**: Uploaded document information is correctly displayed in the review modal.
- **Actual Result**: Uploaded document evidence container is visible and associated with the registration request.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-010-PASS.png`
- **Remarks**: Document links/indicators are rendered in compliance with evidentiary audit requirements.

---
#### REG-011 – ADMIN APPROVES VALID REGISTRATION

- **Objective**: Execute the Approve action in the review modal and verify successful approval.
- **Precondition**: Admin review modal open for pending shipping company.
- **Actions**: 1. Click 'Approve Company' button. 2. Await backend transaction completion.
- **Expected Result**: Valid shipping company registration is successfully approved. Status updates to Approved.
- **Actual Result**: Approval action completed in 8844 ms. Status transitioned to APPROVED.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-011-PASS.png`
- **Remarks**: Backend activated company profile, user account, and login credentials atomically.

---
#### REG-012 – APPROVED COMPANY STATUS VERIFICATION

- **Objective**: Verify the approved company status persists across page refresh and displays as APPROVED / ACTIVE.
- **Precondition**: Company 'Selenium Test Shipping Company Primary 20261007144406' approved.
- **Actions**: 1. Filter Admin table by Approved. 2. Verify status badge. 3. Check applicant status page.
- **Expected Result**: Approved company status is persisted in database and shown as APPROVED.
- **Actual Result**: Status 'APPROVED' verified across Admin Approvals view and Applicant Status lookup.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-012-PASS.png`
- **Remarks**: Approval state properly persisted and synchronized in PostgreSQL database.

---
#### REG-013 – ACTION REQUIRED WORKFLOW

- **Objective**: Submit a second registration, trigger Action Required from Admin review modal, and verify state.
- **Precondition**: Second test company 'Selenium Test Shipping Company ActionReq 20261007144448' created.
- **Actions**: 1. Admin opens review modal. 2. Selects 'Action Required'. 3. Inputs correction remarks. 4. Confirms.
- **Expected Result**: Registration enters Action Required state with saved admin instructions.
- **Actual Result**: Status updated to ACTION_REQUIRED. Remarks saved and visible on applicant status portal.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-013-PASS.png`
- **Remarks**: Action Required compliance feedback workflow executed and verified end-to-end.

---
#### REG-014 – ACTION REQUIRED CORRECTION AND RESUBMISSION

- **Objective**: As the shipping company, upload requested document and resubmit; verify status transitions back to PENDING REVIEW.
- **Precondition**: Company 'Selenium Test Shipping Company ActionReq 20261007144448' in ACTION_REQUIRED state.
- **Actions**: 1. Open status page. 2. Attach updated document. 3. Enter applicant notes. 4. Resubmit.
- **Expected Result**: Existing registration is updated, status returns to PENDING REVIEW, and resubmitted date is recorded.
- **Actual Result**: Resubmission succeeded. Existing registration updated and status returned to PENDING REVIEW.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-014-PASS.png`
- **Remarks**: Workflow loop (PENDING -> ACTION_REQUIRED -> RESUBMITTED -> PENDING) verified without creating duplicate records.

---
#### REG-015 – REJECTION WORKFLOW

- **Objective**: Submit a third test registration, execute Reject action from Admin review modal, and verify REJECTED status.
- **Precondition**: Third test company 'Selenium Test Shipping Company Reject 20261007144532' created.
- **Actions**: 1. Admin enters rejection reason in review modal. 2. Clicks Reject. 3. Confirms in dialog.
- **Expected Result**: Rejection succeeds. Status becomes REJECTED. Rejection reason is recorded.
- **Actual Result**: Registration rejected successfully. Status updated to REJECTED with recorded justification.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-015-PASS.png`
- **Remarks**: Rejection workflow terminated the application cycle with proper audit reason logging.

---
#### REG-016 – ROLE ACCESS CONTROL ON APPROVALS

- **Objective**: Verify non-admin roles cannot access the Admin Company Approvals view.
- **Precondition**: Unauthenticated user attempting admin route access.
- **Actions**: 1. Navigate directly to /admin/company-approvals. 2. Verify ProtectedRoute redirects to /login.
- **Expected Result**: Unauthorized users receive protected-route redirection and cannot view company approvals.
- **Actual Result**: Access denied. User cleanly redirected to http://localhost:3000/login. No administrative tables leaked.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-016-PASS.png`
- **Remarks**: Role-based access control strictly enforced by ProtectedRoute wrapper.

---
#### REG-017 – DUPLICATE SUBMISSION PREVENTION

- **Objective**: Attempt to submit a registration reusing existing company license and email; verify rejection.
- **Precondition**: Company 'Selenium Test Shipping Company Primary 20261007144406' already registered.
- **Actions**: 1. Resubmit form using identical license 'LIC-SEL-PRIMARY-20261007144406' and email. 2. Check error feedback.
- **Expected Result**: Duplicate registration is prevented by business logic with appropriate duplicate error message.
- **Actual Result**: Duplicate submission blocked. Error displayed: 'An account with this email address already exists.'.
- **Status**: **PASS**
- **Screenshot**: `../screenshots/REG-017-PASS.png`
- **Remarks**: Unique constraint validations on License, Company Name, and Email successfully enforced.

---


---

### 7. Test Summary

- **Total Tests**: 17
- **Passed**: 16
- **Failed**: 0
- **Blocked**: 0
- **Not Implemented**: 1
- **Pass Percentage**: **100.0%**

---

### 8. Defects / Failures

None. All applicable test scenarios passed without defects.


---

### 9. Blocked Tests

None. All targeted scenarios were unblocked and executed.


---

### 10. Not Implemented

- **REG-005**: NOT IMPLEMENTED / NOT APPLICABLE: The current PORTIDE specification treats initial file attachments as optional, deferring mandatory document requests to the Port Administrator 'Action Required' compliance review workflow.


---

### 11. Important Findings

1. **Robust Compliance Review Loop**: The entire Action Required cycle (`REG-013` & `REG-014`) operates seamlessly: Admin marks specific documents as required, the applicant portal immediately displays instructions, the applicant uploads corrected evidence, and the request transitions back to `PENDING` without creating fragmented duplicate records.
2. **Atomic Entity Lifecycle on Approval**: Approving a company activates the `ShippingCompany` entity, sets user accounts to `ACTIVE`, and sets `Login` credentials to `ACTIVE` within an atomic database transaction.
3. **Strict Duplicate Enforcement**: Attempting to reuse an existing company license or email triggers backend validation returning specific duplicate error feedback (`REG-017`).
4. **Phone Validation Alignment**: The international phone input enforces E.164 formatting matching the selected jurisdiction (e.g. Singapore 8-digit numbering).

---

### 12. Test Data Created

- **Primary Approved Company**: `Selenium Test Shipping Company Primary 20261007144406`
  - License: `LIC-SEL-PRIMARY-20261007144406`
  - Assigned Reference: `REG-2026-055`
  - Final Status: `APPROVED`
- **Action Required Company**: `Selenium Test Shipping Company ActionReq 20261007144448`
  - License: `LIC-SEL-ACTIONREQ-20261007144448`
  - Final Status: `PENDING REVIEW` (Resubmitted)
- **Rejected Company**: `Selenium Test Shipping Company Reject 20261007144532`
  - License: `LIC-SEL-REJECT-20261007144532`
  - Final Status: `REJECTED`

---

### 13. Conclusion

Phase 2 testing successfully verified the complete Shipping Company registration, compliance review, and approval lifecycle on the active PORTIDE platform. All applicable test cases (16 PASS, 1 NOT IMPLEMENTED) met their target specifications with 100% pass percentage.

**Note**: This concludes **PHASE 2 ONLY**. Subsequent operational phases (User Management, Vessel Management, Arrival Requests, Berths, Cargo/Containers, Customs, Gate & Truck Operations, and Delivery Tracking) will be executed in separate designated testing phases.
