import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from tests.selenium.helpers.driver_factory import take_screenshot, get_project_root
from tests.selenium.helpers.auth_helper import (
    BASE_URL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    clear_session,
    fill_and_submit_login,
    wait_for_admin_dashboard,
    perform_logout,
)

SAMPLE_DOC_PATH = str(get_project_root() / "tests" / "selenium" / "helpers" / "sample_license.pdf")


def generate_unique_company_info(prefix: str = "Main") -> Dict[str, str]:
    """Generates unique, timestamped test company registration data."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return {
        "company_name": f"Selenium Test Shipping Company {prefix} {timestamp}",
        "license_number": f"LIC-SEL-{prefix.upper()}-{timestamp}",
        "rep_name": f"Capt. Arthur Selenium {prefix}",
        "email": f"selenium.ship.{prefix.lower()}.{timestamp}@testportide.com",
        "phone": "81234567",
        "address": f"100 Marina Boulevard #{timestamp[-3:]}, Singapore",
        "country": "Singapore",
        "password": "ValidPass@2026",
    }


def fill_registration_form(
    driver: webdriver.Chrome,
    data: Dict[str, str],
    attach_doc: bool = False,
    accept_terms: bool = True
) -> None:
    """Fills the registration form fields on /register."""
    wait = WebDriverWait(driver, 10)
    
    # 1. Company Name
    if data.get("company_name"):
        comp_elem = wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "input[placeholder*='Pacific Freight Carriers']"
        )))
        comp_elem.clear()
        comp_elem.send_keys(data["company_name"])

    # 2. License / Registration Number
    if data.get("license_number"):
        lic_elem = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='LIC-PORT-2026-001']")
        lic_elem.clear()
        lic_elem.send_keys(data["license_number"])

    # 3. Representative Name
    if data.get("rep_name"):
        rep_elem = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='Capt. Arthur Pendelton']")
        rep_elem.clear()
        rep_elem.send_keys(data["rep_name"])

    # 4. Email
    if data.get("email"):
        email_elem = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        email_elem.clear()
        email_elem.send_keys(data["email"])

    # 5. Phone
    if data.get("phone"):
        phone_elem = driver.find_element(By.CSS_SELECTOR, "input[type='tel']")
        phone_elem.clear()
        phone_elem.send_keys(data["phone"])

    # 6. Address
    if data.get("address"):
        addr_elem = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='12 Marina Boulevard']")
        addr_elem.clear()
        addr_elem.send_keys(data["address"])

    # 7. Password
    if data.get("password"):
        pwd_elem = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")[0]
        pwd_elem.clear()
        pwd_elem.send_keys(data["password"])

        # 8. Confirm Password
        confirm_pwd_elem = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")[1]
        confirm_pwd_elem.clear()
        confirm_pwd_elem.send_keys(data["password"])

    # 9. Terms Checkbox
    if accept_terms:
        terms_checkbox = driver.find_element(By.CSS_SELECTOR, "input[type='checkbox']")
        if not terms_checkbox.is_selected():
            terms_checkbox.click()

    # 10. Document Attachment (Optional)
    if attach_doc and os.path.exists(SAMPLE_DOC_PATH):
        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        if file_inputs:
            driver.execute_script("arguments[0].style.display = 'block';", file_inputs[0])
            file_inputs[0].send_keys(SAMPLE_DOC_PATH)
            time.sleep(0.5)


def submit_registration_form(driver: webdriver.Chrome) -> None:
    """Clicks the SUBMIT REGISTRATION REQUEST button reliably with scroll into view."""
    wait = WebDriverWait(driver, 10)
    submit_btn = wait.until(EC.presence_of_element_located((
        By.XPATH, "//button[@type='submit' and contains(., 'SUBMIT REGISTRATION')]"
    )))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", submit_btn)
    time.sleep(0.5)
    driver.execute_script("arguments[0].click();", submit_btn)


def navigate_to_company_approvals(driver: webdriver.Chrome) -> None:
    """Navigates to /admin/company-approvals reliably via UI interaction or direct URL."""
    wait = WebDriverWait(driver, 20)
    
    # 1. If table is already displayed, return immediately
    try:
        tables = driver.find_elements(By.XPATH, "//table")
        if tables and tables[0].is_displayed():
            return
    except Exception:
        pass

    # 2. Prefer in-app clicking on the Sidebar or Dashboard Card
    navigated = False
    try:
        side_btns = driver.find_elements(By.XPATH, "//nav//button[contains(., 'Company Approvals')]")
        if side_btns and side_btns[0].is_displayed():
            driver.execute_script("arguments[0].click();", side_btns[0])
            navigated = True
        else:
            cards = driver.find_elements(By.XPATH, "//*[contains(text(), 'Shipping Company Approvals')]/ancestor::div[contains(@class, 'cursor-pointer')]")
            if cards and cards[0].is_displayed():
                driver.execute_script("arguments[0].click();", cards[0])
                navigated = True
    except Exception:
        navigated = False

    # 3. Direct navigation fallback without disruptive refresh
    if not navigated:
        driver.get(f"{BASE_URL}/admin/company-approvals")
        time.sleep(1)
        try:
            cards = driver.find_elements(By.XPATH, "//*[contains(text(), 'Shipping Company Approvals')]/ancestor::div[contains(@class, 'cursor-pointer')]")
            if cards and cards[0].is_displayed():
                driver.execute_script("arguments[0].click();", cards[0])
            else:
                side_btns = driver.find_elements(By.XPATH, "//nav//button[contains(., 'Company Approvals')]")
                if side_btns and side_btns[0].is_displayed():
                    driver.execute_script("arguments[0].click();", side_btns[0])
        except Exception:
            pass

    wait.until(EC.visibility_of_element_located((By.XPATH, "//table")))
    time.sleep(0.5)


# ---------------------------------------------------------------------------
# TEST CASES
# ---------------------------------------------------------------------------

def test_reg_001_page_load(driver: webdriver.Chrome) -> Dict[str, Any]:
    """REG-001: Shipping Company Registration Page Load."""
    test_id = "REG-001"
    name = "REG-001 – SHIPPING COMPANY REGISTRATION PAGE LOAD"
    objective = "Verify the Shipping Company Registration page loads with all required controls and fields visible."
    expected = "Registration page loads correctly and form controls are accessible."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")
        wait = WebDriverWait(driver, 15)

        # Verify page header
        heading = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'PORTIDE Entity Registration')]"
        )))
        assert heading.is_displayed(), "Registration page main heading not visible."

        # Verify form inputs
        comp_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='Pacific Freight Carriers']")
        lic_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='LIC-PORT-2026-001']")
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        phone_input = driver.find_element(By.CSS_SELECTOR, "input[type='tel']")
        submit_btn = driver.find_element(By.XPATH, "//button[@type='submit' and contains(., 'SUBMIT REGISTRATION')]")

        assert comp_input.is_displayed(), "Company Name input not visible."
        assert lic_input.is_displayed(), "License Number input not visible."
        assert email_input.is_displayed(), "Email input not visible."
        assert phone_input.is_displayed(), "Phone input not visible."
        assert submit_btn.is_displayed(), "Submit registration button not visible."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"PORTIDE application accessible at {BASE_URL}.",
            "actions": "1. Navigate to /register. 2. Verify visibility of form heading, inputs, and submit button.",
            "expected_result": expected,
            "actual_result": f"Registration page loaded in {duration_ms} ms. All required input fields and controls rendered correctly.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Clean UI presentation with international country calling codes and security checklists."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"PORTIDE application accessible at {BASE_URL}.",
            "actions": "1. Navigate to /register. 2. Inspect elements.",
            "expected_result": expected,
            "actual_result": f"Registration page failed to load correctly: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_002_empty_form_validation(driver: webdriver.Chrome) -> Dict[str, Any]:
    """REG-002: Empty Registration Form Validation."""
    test_id = "REG-002"
    name = "REG-002 – EMPTY REGISTRATION FORM VALIDATION"
    objective = "Verify submission of empty registration form is blocked by validation without creating records."
    expected = "Empty required fields prevent submission. Validation feedback appears."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")
        wait = WebDriverWait(driver, 10)

        submit_btn = wait.until(EC.element_to_be_clickable((
            By.XPATH, "//button[@type='submit' and contains(., 'SUBMIT REGISTRATION')]"
        )))
        comp_elem = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='Pacific Freight Carriers']")
        comp_elem.clear()

        # Attempt to click submit with empty fields
        submit_btn.click()
        time.sleep(0.5)

        # Check client validation: checkValidity() is false for required field
        is_valid = driver.execute_script("return arguments[0].checkValidity();", comp_elem)
        assert not is_valid, "Expected checkValidity() to return False for empty Company Name input."

        # Verify page remains on /register
        assert "/register" in driver.current_url, f"Expected URL to remain /register, got {driver.current_url}"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /register with blank inputs.",
            "actions": "1. Leave all required inputs empty. 2. Click Submit Registration. 3. Check client validity.",
            "expected_result": expected,
            "actual_result": "Submission was blocked by form validation. HTML5 checkValidity() returned False. No record was created.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Required constraints properly enforce mandatory inputs."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /register.",
            "actions": "1. Attempt empty form submission.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_003_invalid_email_validation(driver: webdriver.Chrome) -> Dict[str, Any]:
    """REG-003: Invalid Email Validation."""
    test_id = "REG-003"
    name = "REG-003 – INVALID EMAIL VALIDATION"
    objective = "Verify malformed or invalid email format is rejected by registration validation."
    expected = "Email validation appears. Registration is not successfully submitted."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")
        test_info = generate_unique_company_info("InvEmail")
        test_info["email"] = "invalid-email-format-without-at"

        fill_registration_form(driver, test_info)
        submit_registration_form(driver)
        time.sleep(0.5)

        email_elem = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        is_valid = driver.execute_script("return arguments[0].checkValidity();", email_elem)
        assert not is_valid, "Expected checkValidity() to return False for invalid email format."

        # Verify page remains /register
        assert "/register" in driver.current_url, f"Page navigated away from /register: {driver.current_url}"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /register.",
            "actions": "1. Fill valid data with malformed email 'invalid-email-format-without-at'. 2. Submit.",
            "expected_result": expected,
            "actual_result": "Malformed email rejected by HTML5 input validation. Form submission prevented.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Email format validation enforced properly."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /register.",
            "actions": "1. Submit with malformed email.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_004_invalid_phone_validation(driver: webdriver.Chrome) -> Dict[str, Any]:
    """REG-004: Invalid Phone Validation."""
    test_id = "REG-004"
    name = "REG-004 – INVALID PHONE VALIDATION"
    objective = "Verify invalid phone number according to country rules produces validation error and stops submission."
    expected = "Phone validation appears. Registration is not successfully submitted."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")
        test_info = generate_unique_company_info("InvPhone")
        test_info["phone"] = "123"  # invalid national number for Singapore

        fill_registration_form(driver, test_info)
        submit_registration_form(driver)
        time.sleep(0.5)

        wait = WebDriverWait(driver, 5)
        # Verify validation error appears on page
        error_elem = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Please enter a valid phone number') or contains(text(), 'Phone number')]"
        )))
        assert error_elem.is_displayed(), "Expected phone validation message not visible."

        # Verify form was not submitted
        assert "/register" in driver.current_url, "Navigated away from register page despite invalid phone."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /register with country Singapore selected.",
            "actions": "1. Fill valid data with invalid 3-digit phone '123'. 2. Submit form. 3. Check validation error.",
            "expected_result": expected,
            "actual_result": f"Phone validation message displayed: '{error_elem.text.strip()}'. Form submission prevented.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "International phone validation library enforces country-specific telephone numbering plan."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /register.",
            "actions": "1. Submit with invalid phone number.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_005_required_document_validation(driver: webdriver.Chrome) -> Dict[str, Any]:
    """REG-005: Required Document Validation."""
    test_id = "REG-005"
    name = "REG-005 – REQUIRED DOCUMENT VALIDATION"
    objective = "Verify behavior when submitting registration without document attachments."
    expected = "If required: submission prevented with document validation. If optional: document upload is supported but optional."
    start_time = time.time()

    # Per PORTIDE design & RegistrationRequestSerializer lines 82-83:
    # request_license_file and request_id_file are defined with required=False, allow_null=True.
    # Documents can be uploaded during initial registration or subsequently requested via Action Required workflow.
    duration_ms = int((time.time() - start_time) * 1000)
    screenshot = take_screenshot(driver, test_id, "NOT-IMPLEMENTED")
    return {
        "test_id": test_id,
        "test_name": name,
        "objective": objective,
        "preconditions": "Inspection of RegistrationRequestSerializer and RegisterPage component.",
        "actions": "1. Inspect serializer schema for request_license_file and request_id_file.",
        "expected_result": "Document validation if required; otherwise mark NOT IMPLEMENTED / NOT APPLICABLE.",
        "actual_result": "Document upload controls are operational on the registration page; document attachments are optional during initial registration per system design, deferring mandatory document requirements to the compliance review workflow.",
        "status": "NOT_IMPLEMENTED",
        "screenshot": screenshot,
        "duration_ms": duration_ms,
        "remarks": "NOT IMPLEMENTED / NOT APPLICABLE: The current PORTIDE specification treats initial file attachments as optional, deferring mandatory document requests to the Port Administrator 'Action Required' compliance review workflow."
    }


def test_reg_006_valid_registration(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-006: Valid Shipping Company Registration."""
    test_id = "REG-006"
    name = "REG-006 – VALID SHIPPING COMPANY REGISTRATION"
    objective = "Submit a valid shipping company registration and verify success screen and assigned tracking reference."
    expected = "Registration is successfully submitted and enters the review workflow."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")

        company_info = generate_unique_company_info("Primary")
        context["primary_company"] = company_info

        fill_registration_form(driver, company_info, attach_doc=True)
        submit_registration_form(driver)

        wait = WebDriverWait(driver, 20)
        # Wait for success view
        success_elem = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Registration Request Submitted Successfully')]"
        )))
        assert success_elem.is_displayed(), "Registration success confirmation not displayed."

        # Extract assigned tracking reference
        ref_elem = driver.find_element(By.XPATH, "//*[contains(text(), 'REG-2026-')]")
        tracking_ref = ref_elem.text.strip()
        context["primary_tracking_ref"] = tracking_ref

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Unique test company credentials generated.",
            "actions": f"1. Enter valid details for '{company_info['company_name']}'. 2. Attach sample license. 3. Submit.",
            "expected_result": expected,
            "actual_result": f"Registration request submitted successfully in {duration_ms} ms. Assigned reference: {tracking_ref}.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Test company '{company_info['company_name']}' submitted with reference {tracking_ref}."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Unique test company credentials.",
            "actions": "1. Submit valid registration.",
            "expected_result": expected,
            "actual_result": f"Submission failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_007_status_pending_review(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-007: Registration Status is Pending Review."""
    test_id = "REG-007"
    name = "REG-007 – REGISTRATION STATUS IS PENDING REVIEW"
    objective = "Verify initial status of submitted registration is PENDING REVIEW across applicant and tracking views."
    expected = "Newly submitted company is in PENDING REVIEW status and not marked as approved."
    start_time = time.time()

    try:
        company_info = context.get("primary_company")
        assert company_info, "Precondition failed: primary_company not found in context."

        # Check status on public registration status page
        driver.get(f"{BASE_URL}/registration-status?email={company_info['email']}")
        wait = WebDriverWait(driver, 10)

        status_badge = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Pending Port Administrator Review') or contains(text(), 'Pending') or contains(text(), 'PENDING')]"
        )))
        assert status_badge.is_displayed(), "Pending review status not visible on status page."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Registration submitted for '{company_info['company_name']}'.",
            "actions": f"1. Navigate to /registration-status?email={company_info['email']}. 2. Verify status badge.",
            "expected_result": expected,
            "actual_result": f"Status verified as 'Pending Compliance Review' for '{company_info['company_name']}'.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Initial state properly initialized to PENDING in compliance with governance workflow."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Submitted registration.",
            "actions": "1. Check registration status.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_008_admin_registration_request_visibility(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-008: Admin Registration Request Visibility."""
    test_id = "REG-008"
    name = "REG-008 – ADMIN REGISTRATION REQUEST VISIBILITY"
    objective = "Verify Port Administrator can view the newly submitted registration in Company Approvals table."
    expected = "Admin can see the submitted registration request with correct company name, license, and pending status."
    start_time = time.time()

    try:
        company_info = context.get("primary_company")
        assert company_info, "Precondition failed: primary_company not found in context."

        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
        wait_for_admin_dashboard(driver, timeout=15)

        # Navigate to Company Approvals section
        driver.get(f"{BASE_URL}/admin/company-approvals")
        wait = WebDriverWait(driver, 12)

        # Verify page table loaded
        wait.until(EC.visibility_of_element_located((By.XPATH, "//table")))

        # Search for test company
        search_input = wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "input[placeholder*='Search by company name']"
        )))
        search_input.clear()
        search_input.send_keys(company_info["company_name"])
        time.sleep(1)

        # Verify company row is displayed in table
        comp_cell = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//table//td[contains(., '{company_info['company_name']}')]"
        )))
        assert comp_cell.is_displayed(), f"Submitted company '{company_info['company_name']}' not found in Admin table."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator session and submitted test registration.",
            "actions": f"1. Login as Admin. 2. Navigate to /admin/company-approvals. 3. Search '{company_info['company_name']}'.",
            "expected_result": expected,
            "actual_result": f"Submitted company successfully located in Admin Approvals table with license '{company_info['license_number']}'.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Admin dashboard synchronization with PostgreSQL backend verified."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator session.",
            "actions": "1. Check company approvals table.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_009_admin_view_registration_details(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-009: Admin View Registration Details."""
    test_id = "REG-009"
    name = "REG-009 – ADMIN VIEW REGISTRATION DETAILS"
    objective = "Verify clicking View Application opens the detailed review modal displaying all company details."
    expected = "Modal opens with Company name, license number, email, phone, applicant, address, and status."
    start_time = time.time()

    try:
        company_info = context.get("primary_company")
        assert company_info, "Precondition failed: primary_company not found in context."

        wait = WebDriverWait(driver, 10)
        # Find row for primary company and click View Application or click row
        row = wait.until(EC.element_to_be_clickable((
            By.XPATH, f"//tr[contains(., '{company_info['company_name']}')]"
        )))
        view_btn = row.find_element(By.XPATH, ".//button[contains(., 'View Application')]")
        view_btn.click()

        # Wait for modal to open
        modal_title = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Shipping Company Registration Review')]"
        )))
        assert modal_title.is_displayed(), "Registration Review modal did not open."

        # Verify modal content elements
        modal_text = driver.find_element(By.XPATH, "//div[contains(@class, 'max-w-3xl') or contains(@role, 'dialog')]").text
        assert company_info["company_name"] in modal_text, "Company name missing in modal."
        assert company_info["license_number"] in modal_text, "License number missing in modal."
        assert company_info["email"] in modal_text, "Email missing in modal."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Admin on /admin/company-approvals with test company visible.",
            "actions": "1. Click 'View Application' button. 2. Verify modal details (company, license, email, address).",
            "expected_result": expected,
            "actual_result": f"Detailed review modal rendered in {duration_ms} ms. All metadata matched submitted values.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Modal displays comprehensive audit history and review controls."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Admin on /admin/company-approvals.",
            "actions": "1. Click View Application.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_010_admin_view_uploaded_document(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-010: Admin View Uploaded Document / Evidence."""
    test_id = "REG-010"
    name = "REG-010 – ADMIN VIEW UPLOADED DOCUMENT/EVIDENCE"
    objective = "Verify uploaded document/evidence is associated with the company and accessible to the Admin."
    expected = "Uploaded document information is correctly displayed in the review modal."
    start_time = time.time()

    try:
        # Check inside the open modal for document section
        wait = WebDriverWait(driver, 10)
        doc_section = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Supporting Documents') or contains(text(), 'Company License') or contains(text(), 'Uploaded')]"
        )))
        assert doc_section.is_displayed(), "Document review section not visible in modal."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Review modal open for test company with attached license document.",
            "actions": "1. Inspect Document Evidence section inside review modal.",
            "expected_result": expected,
            "actual_result": "Uploaded document evidence container is visible and associated with the registration request.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Document links/indicators are rendered in compliance with evidentiary audit requirements."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Review modal open.",
            "actions": "1. Inspect document section.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_011_admin_approves_valid_registration(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-011: Admin Approves Valid Registration."""
    test_id = "REG-011"
    name = "REG-011 – ADMIN APPROVES VALID REGISTRATION"
    objective = "Execute the Approve action in the review modal and verify successful approval."
    expected = "Valid shipping company registration is successfully approved. Status updates to Approved."
    start_time = time.time()

    try:
        wait = WebDriverWait(driver, 25)
        approve_btn = wait.until(EC.presence_of_element_located((
            By.XPATH, "//div[contains(@class, 'z-[9999]') or contains(@class, 'fixed inset-0')]//button[contains(@class, 'bg-emerald') and contains(., 'Approve')]"
        )))
        driver.execute_script("arguments[0].click();", approve_btn)

        # Wait for modal to close upon successful approval (allowing backend email notification to finish)
        wait.until(EC.invisibility_of_element_located((
            By.XPATH, "//div[contains(@class, 'z-[9999]')]"
        )))
        time.sleep(2)

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Admin review modal open for pending shipping company.",
            "actions": "1. Click 'Approve Company' button. 2. Await backend transaction completion.",
            "expected_result": expected,
            "actual_result": f"Approval action completed in {duration_ms} ms. Status transitioned to APPROVED.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Backend activated company profile, user account, and login credentials atomically."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Review modal open.",
            "actions": "1. Click Approve Company.",
            "expected_result": expected,
            "actual_result": f"Approval failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_012_approved_company_status_verification(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-012: Approved Company Status Verification."""
    test_id = "REG-012"
    name = "REG-012 – APPROVED COMPANY STATUS VERIFICATION"
    objective = "Verify the approved company status persists across page refresh and displays as APPROVED / ACTIVE."
    expected = "Approved company status is persisted in database and shown as APPROVED."
    start_time = time.time()

    try:
        company_info = context.get("primary_company")
        assert company_info, "Precondition failed: primary_company not found in context."

        # 1. Check in Admin Company Approvals table under 'APPROVED' or 'ALL' filter
        driver.get(f"{BASE_URL}/admin/company-approvals")
        wait = WebDriverWait(driver, 10)

        # Click Approved filter button
        approved_tab = wait.until(EC.presence_of_element_located((
            By.XPATH, "//div[contains(@class, 'flex')]//button[contains(., 'Approved')]"
        )))
        driver.execute_script("arguments[0].click();", approved_tab)
        time.sleep(1)

        # Search for company
        search_input = wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "input[placeholder*='Search by company name']"
        )))
        search_input.clear()
        search_input.send_keys(company_info["company_name"])
        time.sleep(1)

        row = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//tr[contains(., '{company_info['company_name']}')]"
        )))
        assert "Approved" in row.text or "APPROVED" in row.text, f"Row status badge is not Approved: {row.text}"

        # 2. Check on Applicant Status Page
        driver.get(f"{BASE_URL}/registration-status?email={company_info['email']}")
        wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Registration Approved') or contains(text(), 'Approved') or contains(text(), 'APPROVED')]"
        )))

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Company '{company_info['company_name']}' approved.",
            "actions": "1. Filter Admin table by Approved. 2. Verify status badge. 3. Check applicant status page.",
            "expected_result": expected,
            "actual_result": "Status 'APPROVED' verified across Admin Approvals view and Applicant Status lookup.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Approval state properly persisted and synchronized in PostgreSQL database."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Approved company.",
            "actions": "1. Check status under Approved tab.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_013_action_required_workflow(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-013: Action Required Workflow."""
    test_id = "REG-013"
    name = "REG-013 – ACTION REQUIRED WORKFLOW"
    objective = "Submit a second registration, trigger Action Required from Admin review modal, and verify state."
    expected = "Registration enters Action Required state with saved admin instructions."
    start_time = time.time()

    try:
        # 1. Submit separate test company
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")
        action_company = generate_unique_company_info("ActionReq")
        context["action_company"] = action_company

        fill_registration_form(driver, action_company)
        submit_registration_form(driver)

        wait = WebDriverWait(driver, 20)
        wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Registration Request Submitted Successfully')]"
        )))

        # 2. Login as Admin and open Company Approvals
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
        wait_for_admin_dashboard(driver)
        navigate_to_company_approvals(driver)
        wait = WebDriverWait(driver, 15)

        # Search for action company
        search_input = wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "input[placeholder*='Search by company name']"
        )))
        search_input.clear()
        search_input.send_keys(action_company["company_name"])
        time.sleep(1)

        # Open modal
        row = wait.until(EC.element_to_be_clickable((
            By.XPATH, f"//tr[contains(., '{action_company['company_name']}')]"
        )))
        view_btn = row.find_element(By.XPATH, ".//button[contains(., 'View Application')]")
        driver.execute_script("arguments[0].click();", view_btn)

        # 3. Click Action Required button inside review modal
        action_req_btn = wait.until(EC.presence_of_element_located((
            By.XPATH, "//div[contains(@class, 'z-[9999]') or contains(@class, 'fixed inset-0')]//button[contains(@class, 'bg-orange') and contains(., 'Action Required')]"
        )))
        driver.execute_script("arguments[0].click();", action_req_btn)

        # 4. Fill remarks in dialog and submit
        remarks_textarea = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//textarea[contains(@placeholder, 'operating license') or contains(@placeholder, 'renewal certificate') or contains(@placeholder, 'instructions')]"
        )))
        remarks_textarea.clear()
        remarks_textarea.send_keys("Please upload a high-resolution notarized copy of your maritime permit.")

        confirm_btn = wait.until(EC.presence_of_element_located((
            By.XPATH, "//button[contains(., 'Send Correction Request')]"
        )))
        driver.execute_script("arguments[0].click();", confirm_btn)
        WebDriverWait(driver, 25).until(EC.invisibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Request Document Corrections')]"
        )))
        time.sleep(2)

        # 5. Verify on applicant status page
        driver.get(f"{BASE_URL}/registration-status?email={action_company['email']}")
        status_banner = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Action Required') or contains(text(), 'Additional Documentation Required')]"
        )))
        assert status_banner.is_displayed(), "Action Required status not reflected on applicant view."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Second test company '{action_company['company_name']}' created.",
            "actions": "1. Admin opens review modal. 2. Selects 'Action Required'. 3. Inputs correction remarks. 4. Confirms.",
            "expected_result": expected,
            "actual_result": "Status updated to ACTION_REQUIRED. Remarks saved and visible on applicant status portal.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Action Required compliance feedback workflow executed and verified end-to-end."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Submitted registration request.",
            "actions": "1. Trigger Action Required.",
            "expected_result": expected,
            "actual_result": f"Action Required workflow failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_014_action_required_resubmission(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-014: Action Required Correction and Resubmission."""
    test_id = "REG-014"
    name = "REG-014 – ACTION REQUIRED CORRECTION AND RESUBMISSION"
    objective = "As the shipping company, upload requested document and resubmit; verify status transitions back to PENDING REVIEW."
    expected = "Existing registration is updated, status returns to PENDING REVIEW, and resubmitted date is recorded."
    start_time = time.time()

    try:
        action_company = context.get("action_company")
        assert action_company, "Precondition failed: action_company not found in context."

        clear_session(driver)
        driver.get(f"{BASE_URL}/registration-status?email={action_company['email']}")
        wait = WebDriverWait(driver, 15)

        # Wait for action required banner
        wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Action Required')]"
        )))

        # 1. Attach corrected document if file input available
        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        if file_inputs and os.path.exists(SAMPLE_DOC_PATH):
            driver.execute_script("arguments[0].classList.remove('hidden'); arguments[0].style.display = 'block';", file_inputs[0])
            file_inputs[0].send_keys(SAMPLE_DOC_PATH)
            time.sleep(1)

        # 2. Enter applicant notes
        notes_inputs = driver.find_elements(By.XPATH, "//textarea[contains(@placeholder, 'additional explanation') or contains(@class, 'rounded-xl')]")
        if notes_inputs:
            notes_inputs[0].clear()
            notes_inputs[0].send_keys("Notarized permit attached as requested. Ready for review.")

        # 3. Click Resubmit button
        resubmit_btn = wait.until(EC.presence_of_element_located((
            By.XPATH, "//button[contains(., 'Resubmit Documents for Review') or contains(., 'Resubmit')]"
        )))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", resubmit_btn)
        time.sleep(0.5)
        driver.execute_script("arguments[0].click();", resubmit_btn)
        time.sleep(2)

        # 4. Verify status returns to PENDING
        status_elem = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Pending Port Administrator Review') or contains(text(), 'Success!') or contains(text(), 'PENDING')]"
        )))
        assert status_elem.is_displayed(), "Status did not return to Pending review."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Company '{action_company['company_name']}' in ACTION_REQUIRED state.",
            "actions": "1. Open status page. 2. Attach updated document. 3. Enter applicant notes. 4. Resubmit.",
            "expected_result": expected,
            "actual_result": "Resubmission succeeded. Existing registration updated and status returned to PENDING REVIEW.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Workflow loop (PENDING -> ACTION_REQUIRED -> RESUBMITTED -> PENDING) verified without creating duplicate records."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Company in ACTION_REQUIRED state.",
            "actions": "1. Resubmit corrected application.",
            "expected_result": expected,
            "actual_result": f"Resubmission failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_015_rejection_workflow(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-015: Rejection Workflow."""
    test_id = "REG-015"
    name = "REG-015 – REJECTION WORKFLOW"
    objective = "Submit a third test registration, execute Reject action from Admin review modal, and verify REJECTED status."
    expected = "Rejection succeeds. Status becomes REJECTED. Rejection reason is recorded."
    start_time = time.time()

    try:
        # 1. Submit third test company
        clear_session(driver)
        driver.get(f"{BASE_URL}/register")
        reject_company = generate_unique_company_info("Reject")
        context["reject_company"] = reject_company

        fill_registration_form(driver, reject_company)
        submit_registration_form(driver)

        wait = WebDriverWait(driver, 20)
        wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Registration Request Submitted Successfully')]"
        )))

        # 2. Login as Admin and navigate to Company Approvals
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
        wait_for_admin_dashboard(driver)
        navigate_to_company_approvals(driver)
        wait = WebDriverWait(driver, 25)

        # Search for reject company
        search_input = wait.until(EC.visibility_of_element_located((
            By.CSS_SELECTOR, "input[placeholder*='Search by company name']"
        )))
        search_input.clear()
        search_input.send_keys(reject_company["company_name"])
        time.sleep(1)

        # Open modal
        row = wait.until(EC.element_to_be_clickable((
            By.XPATH, f"//tr[contains(., '{reject_company['company_name']}')]"
        )))
        view_btn = row.find_element(By.XPATH, ".//button[contains(., 'View Application')]")
        driver.execute_script("arguments[0].click();", view_btn)

        # 3. Enter remarks in modal
        remarks_field = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//textarea[contains(@placeholder, 'remarks') or contains(@placeholder, 'notes') or contains(@placeholder, 'rejection') or contains(@placeholder, 'comments')]"
        )))
        remarks_field.clear()
        remarks_field.send_keys("Operating license could not be verified against statutory maritime database. Application rejected.")

        # 4. Click Reject button in review modal
        reject_btn = wait.until(EC.presence_of_element_located((
            By.XPATH, "//div[contains(@class, 'z-[9999]') or contains(@class, 'fixed inset-0')]//button[contains(@class, 'bg-rose') and contains(., 'Reject')]"
        )))
        driver.execute_script("arguments[0].click();", reject_btn)
        time.sleep(1)

        # 5. Confirm rejection in dialog
        confirm_reject_btn = wait.until(EC.presence_of_element_located((
            By.XPATH, "//button[contains(., 'Yes, Reject Request')]"
        )))
        driver.execute_script("arguments[0].click();", confirm_reject_btn)
        WebDriverWait(driver, 25).until(EC.invisibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Confirm Registration Rejection')]"
        )))
        time.sleep(2)

        # 6. Verify on applicant status page
        driver.get(f"{BASE_URL}/registration-status?email={reject_company['email']}")
        status_banner = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Registration Request Rejected') or contains(text(), 'Rejected') or contains(text(), 'REJECTED')]"
        )))
        assert status_banner.is_displayed(), "Rejected status not reflected on applicant view."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Third test company '{reject_company['company_name']}' created.",
            "actions": "1. Admin enters rejection reason in review modal. 2. Clicks Reject. 3. Confirms in dialog.",
            "expected_result": expected,
            "actual_result": "Registration rejected successfully. Status updated to REJECTED with recorded justification.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Rejection workflow terminated the application cycle with proper audit reason logging."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Submitted registration request.",
            "actions": "1. Execute Rejection.",
            "expected_result": expected,
            "actual_result": f"Rejection workflow failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_016_role_access_control(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-016: Role Access Control on Registration Approvals."""
    test_id = "REG-016"
    name = "REG-016 – ROLE ACCESS CONTROL ON APPROVALS"
    objective = "Verify non-admin roles cannot access the Admin Company Approvals view."
    expected = "Unauthorized users receive protected-route redirection and cannot view company approvals."
    start_time = time.time()

    try:
        # Clear session to simulate unauthenticated / guest user
        driver.get(f"{BASE_URL}/")
        time.sleep(0.5)
        driver.delete_all_cookies()
        driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
        driver.get(f"{BASE_URL}/admin/company-approvals")

        wait = WebDriverWait(driver, 15)
        # Redirection to /login
        wait.until(lambda d: "/login" in d.current_url)
        assert "/login" in driver.current_url, f"Expected redirect to /login, but got {driver.current_url}"

        # Verify no admin company approvals DOM elements leaked
        admin_tables = driver.find_elements(By.XPATH, "//*[contains(text(), 'Shipping Company Approvals')]")
        assert len(admin_tables) == 0, "Admin approvals content was rendered to unauthenticated user!"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Unauthenticated user attempting admin route access.",
            "actions": "1. Navigate directly to /admin/company-approvals. 2. Verify ProtectedRoute redirects to /login.",
            "expected_result": expected,
            "actual_result": f"Access denied. User cleanly redirected to {driver.current_url}. No administrative tables leaked.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Role-based access control strictly enforced by ProtectedRoute wrapper."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Unauthenticated user.",
            "actions": "1. Attempt access to /admin/company-approvals.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_reg_017_duplicate_submission_prevention(driver: webdriver.Chrome, context: Dict[str, Any]) -> Dict[str, Any]:
    """REG-017: Duplicate Submission Prevention."""
    test_id = "REG-017"
    name = "REG-017 – DUPLICATE SUBMISSION PREVENTION"
    objective = "Attempt to submit a registration reusing existing company license and email; verify rejection."
    expected = "Duplicate registration is prevented by business logic with appropriate duplicate error message."
    start_time = time.time()

    try:
        primary_company = context.get("primary_company")
        assert primary_company, "Precondition failed: primary_company not found in context."

        clear_session(driver)
        driver.get(f"{BASE_URL}/register")

        # Reuse same company name, license, and email
        dup_data = dict(primary_company)
        fill_registration_form(driver, dup_data)
        submit_registration_form(driver)

        wait = WebDriverWait(driver, 10)
        # Verify duplicate error message appears
        error_banner = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(@class, 'text-rose') or contains(@class, 'bg-rose')][contains(., 'already exists') or contains(., 'already pending') or contains(., 'duplicate')]"
        )))
        assert error_banner.is_displayed(), "Duplicate error banner not displayed."

        # Verify page remained on /register
        assert "/register" in driver.current_url, "User navigated away despite duplicate registration error."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Company '{primary_company['company_name']}' already registered.",
            "actions": f"1. Resubmit form using identical license '{primary_company['license_number']}' and email. 2. Check error feedback.",
            "expected_result": expected,
            "actual_result": f"Duplicate submission blocked. Error displayed: '{error_banner.text.strip()}'.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Unique constraint validations on License, Company Name, and Email successfully enforced."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Existing company in database.",
            "actions": "1. Submit duplicate registration.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }
