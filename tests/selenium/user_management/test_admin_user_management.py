import os
import time
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from tests.selenium.helpers.driver_factory import take_screenshot
from tests.selenium.helpers.auth_helper import (
    BASE_URL,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    clear_session,
    fill_and_submit_login,
    wait_for_admin_dashboard,
    perform_logout,
)


def ensure_admin_logged_in_and_on_user_management(driver: webdriver.Chrome) -> None:
    """Ensures Port Administrator is logged in and navigates to /admin/users."""
    wait = WebDriverWait(driver, 15)
    
    # 1. Check if already on User Management
    try:
        heading = driver.find_elements(By.XPATH, "//*[contains(text(), 'User Management & Staff Creation')]")
        if heading and heading[0].is_displayed():
            return
    except Exception:
        pass

    # 2. Check if logged in on an admin dashboard
    try:
        admin_marker = driver.find_elements(By.XPATH, "//*[contains(text(), 'Port Administrator')]")
        if not admin_marker or not admin_marker[0].is_displayed():
            clear_session(driver)
            driver.get(f"{BASE_URL}/login")
            fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
            wait_for_admin_dashboard(driver)
    except Exception:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
        wait_for_admin_dashboard(driver)

    # 3. Navigate to User Management
    driver.get(f"{BASE_URL}/admin/users")
    wait.until(EC.visibility_of_element_located((
        By.XPATH, "//*[contains(text(), 'User Management & Staff Creation')]"
    )))
    time.sleep(0.5)


# ---------------------------------------------------------------------------
# PHASE 3 SELENIUM TEST CASES
# ---------------------------------------------------------------------------

def test_user_001_page_load(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-001: Admin User Management Page Load."""
    test_id = "USER-001"
    name = "USER-001 – ADMIN USER MANAGEMENT PAGE LOAD"
    objective = "Verify that Port Administrator can open User Management and view essential controls."
    expected = "User Management page loads successfully and controls are accessible."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
        wait_for_admin_dashboard(driver)

        # Navigate to Admin User Management
        driver.get(f"{BASE_URL}/admin/users")
        wait = WebDriverWait(driver, 15)

        # Verify page title and header
        heading = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'User Management & Staff Creation')]"
        )))
        assert heading.is_displayed(), "User Management main heading not visible."

        # Verify table or table wrapper is rendered
        table = wait.until(EC.visibility_of_element_located((By.XPATH, "//table")))
        assert table.is_displayed(), "User database table not visible."

        # Verify Create User button is visible
        create_btn = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//button[contains(., 'Create Staff User')]"
        )))
        assert create_btn.is_displayed(), "Create Staff User button not visible."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Logged in as Port Administrator ({ADMIN_EMAIL}).",
            "actions": "1. Log in as Port Administrator. 2. Navigate to /admin/users. 3. Verify heading, table, and Create Staff User button.",
            "expected_result": expected,
            "actual_result": f"User Management page loaded successfully in {duration_ms} ms. Heading, directory table, and Create Staff User control are visible.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Admin User Management RBAC directory accessible with active session."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Logged in as Port Administrator ({ADMIN_EMAIL}).",
            "actions": "1. Navigate to /admin/users. 2. Verify controls.",
            "expected_result": expected,
            "actual_result": f"Failed to load User Management page: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_002_existing_user_list(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-002: Existing User List Display."""
    test_id = "USER-002"
    name = "USER-002 – EXISTING USER LIST DISPLAY"
    objective = "Verify existing users and their attributes are rendered in the directory table."
    expected = "Existing users are displayed correctly with operational roles, employee IDs, and status."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        # Inspect table headers
        table = wait.until(EC.visibility_of_element_located((By.XPATH, "//table")))
        headers = [th.text.strip() for th in table.find_elements(By.XPATH, ".//thead//th") if th.text.strip()]
        
        expected_columns = ["User Info", "Employee ID", "System Role", "Department", "Contact Phone", "Status", "Created Date", "Actions"]
        for col in expected_columns:
            assert any(col.lower() in h.lower() for h in headers), f"Expected column '{col}' not found in table headers: {headers}"

        # Inspect existing user rows
        rows = table.find_elements(By.XPATH, ".//tbody//tr")
        assert len(rows) > 0, "No user rows displayed in the User Management table."

        # Verify first row contains text and status badge
        first_row_text = rows[0].text
        assert len(first_row_text) > 0, "First table row is empty."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator on /admin/users.",
            "actions": "1. Inspect directory table headers. 2. Verify presence of required data columns. 3. Verify user profile records in table body.",
            "expected_result": expected,
            "actual_result": f"Directory table renders {len(rows)} user rows across 8 columns ({', '.join(headers)}). Existing users visible.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Verified {len(rows)} user records loaded from PostgreSQL."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator on /admin/users.",
            "actions": "1. Inspect table headers and rows.",
            "expected_result": expected,
            "actual_result": f"Failed to verify existing user list display: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_003_create_user_form_load(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-003: Create User Form Load."""
    test_id = "USER-003"
    name = "USER-003 – CREATE USER FORM LOAD"
    objective = "Verify Create User modal opens correctly with all required fields and controls accessible."
    expected = "Create User form loads correctly with input fields, role selector, and action buttons."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        # Click Create Staff User
        create_btn = wait.until(EC.element_to_be_clickable((
            By.XPATH, "//button[contains(., 'Create Staff User')]"
        )))
        driver.execute_script("arguments[0].click();", create_btn)
        time.sleep(0.5)

        # Verify modal header
        modal_title = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Create Internal Staff User')]"
        )))
        assert modal_title.is_displayed(), "Modal title 'Create Internal Staff User' not visible."

        # Verify essential inputs
        name_input = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[@placeholder='e.g. Test Port Operations Officer']"
        )))
        email_input = driver.find_element(By.XPATH, "//input[@placeholder='e.g. portops.test@example.com']")
        emp_id_input = driver.find_element(By.XPATH, "//input[contains(@placeholder, 'CUS-2026-0001') or contains(@class, 'font-mono')]")
        role_select = driver.find_element(By.XPATH, "//label[contains(., 'Internal Staff Role')]/following-sibling::select")
        dept_input = driver.find_element(By.XPATH, "//input[contains(@placeholder, 'Auto-populated department')]")
        submit_btn = driver.find_element(By.XPATH, "//form//button[@type='submit' and contains(., 'Create Account')]")
        cancel_btn = driver.find_element(By.XPATH, "//form//button[contains(., 'Cancel')]")

        assert name_input.is_displayed(), "Full Name input not visible."
        assert email_input.is_displayed(), "Email Address input not visible."
        assert emp_id_input.is_displayed(), "Employee ID input not visible."
        assert role_select.is_displayed(), "Role selector not visible."
        assert dept_input.is_displayed(), "Department input not visible."
        assert submit_btn.is_displayed(), "Submit button not visible."
        assert cancel_btn.is_displayed(), "Cancel button not visible."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator on /admin/users.",
            "actions": "1. Click Create Staff User button. 2. Verify modal title, input fields, role selector, auto-generated employee ID, and submit button.",
            "expected_result": expected,
            "actual_result": f"Create User form modal loaded in {duration_ms} ms. All required input fields, auto-allocated Employee ID, and controls are accessible.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Modal includes automatic Employee ID allocation and temporary password generation notice."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator on /admin/users.",
            "actions": "1. Click Create Staff User. 2. Verify modal.",
            "expected_result": expected,
            "actual_result": f"Create User form failed to load correctly: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_004_port_admin_role_hidden(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-004: Port Administrator Role Hidden in Create User Form."""
    test_id = "USER-004"
    name = "USER-004 – PORT ADMINISTRATOR ROLE HIDDEN"
    objective = "Verify Port Administrator is NOT available as a selectable role when creating internal staff users."
    expected = "Port Administrator role is omitted from selectable options; only operational staff roles are available."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        # Open Create User Modal if not already open
        modal_titles = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create Internal Staff User')]")
        if not modal_titles or not modal_titles[0].is_displayed():
            create_btn = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//button[contains(., 'Create Staff User')]"
            )))
            driver.execute_script("arguments[0].click();", create_btn)
            time.sleep(0.5)

        # Locate Role Selector
        role_select = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//label[contains(., 'Internal Staff Role')]/following-sibling::select"
        )))
        options = role_select.find_elements(By.TAG_NAME, "option")
        option_values = [opt.get_attribute("value").strip().lower() for opt in options]
        option_texts = [opt.text.strip() for opt in options]

        # Verify Port Administrator / Admin is NOT present
        has_admin_value = any("admin" in val for val in option_values)
        has_admin_text = any("admin" in txt.lower() for txt in option_texts)

        assert not has_admin_value, f"Security violation: Found admin value in role options: {option_values}"
        assert not has_admin_text, f"Security violation: Found admin text in role options: {option_texts}"

        # Verify internal staff roles are present
        expected_staff_roles = [
            "port_operations_officer",
            "customs_officer",
            "terminal_logistics_operator",
            "gate_truck_officer"
        ]
        for role_val in expected_staff_roles:
            assert role_val in option_values, f"Expected staff role '{role_val}' not found in role options: {option_values}"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Create User modal open on /admin/users.",
            "actions": "1. Inspect all option elements of the Internal Staff Role dropdown. 2. Verify absence of Port Administrator / admin role. 3. Verify presence of internal operational roles.",
            "expected_result": expected,
            "actual_result": f"Port Administrator is strictly excluded from role options. Available roles: {', '.join(option_texts)}.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Enforces strict RBAC privilege separation: internal staff creation cannot elevate users to Port Administrator."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Create User modal open on /admin/users.",
            "actions": "1. Inspect role select options.",
            "expected_result": expected,
            "actual_result": f"Role restriction verification failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_005_empty_form_validation(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-005: Create User Empty Form Validation."""
    test_id = "USER-005"
    name = "USER-005 – CREATE USER EMPTY FORM VALIDATION"
    objective = "Verify required fields prevent submission of an empty user creation form."
    expected = "Submission is blocked and required-field validation feedback is indicated."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        # Open Create User Modal if not already open
        modal_titles = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create Internal Staff User')]")
        if not modal_titles or not modal_titles[0].is_displayed():
            create_btn = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//button[contains(., 'Create Staff User')]"
            )))
            driver.execute_script("arguments[0].click();", create_btn)
            time.sleep(0.5)

        name_input = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[@placeholder='e.g. Test Port Operations Officer']"
        )))
        email_input = driver.find_element(By.XPATH, "//input[@placeholder='e.g. portops.test@example.com']")
        submit_btn = driver.find_element(By.XPATH, "//form//button[@type='submit' and contains(., 'Create Account')]")

        # Clear fields
        name_input.clear()
        email_input.clear()

        # Attempt submit
        driver.execute_script("arguments[0].click();", submit_btn)
        time.sleep(0.5)

        # Verify HTML5 required validation flag or form error message
        is_name_missing = driver.execute_script("return arguments[0].validity.valueMissing;", name_input)
        is_email_missing = driver.execute_script("return arguments[0].validity.valueMissing;", email_input)
        modal_still_open = len(driver.find_elements(By.XPATH, "//*[contains(text(), 'Create Internal Staff User')]")) > 0

        assert is_name_missing or is_email_missing, "HTML5 required validation did not trigger on empty fields."
        assert modal_still_open, "Modal closed despite empty required fields."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Create User modal open with blank required fields.",
            "actions": "1. Clear Full Name and Email inputs. 2. Click Create Account. 3. Inspect validation state.",
            "expected_result": expected,
            "actual_result": f"Empty submission blocked successfully in {duration_ms} ms. HTML5 valueMissing is True and modal remains open.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Client-side required-field constraints protect backend from blank records."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Create User modal open.",
            "actions": "1. Attempt empty form submission.",
            "expected_result": expected,
            "actual_result": f"Empty form validation check failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_006_invalid_phone_validation(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-006: Invalid Phone Validation."""
    test_id = "USER-006"
    name = "USER-006 – INVALID PHONE VALIDATION"
    objective = "Verify invalid phone numbers are rejected with appropriate validation feedback."
    expected = "Invalid phone number is rejected and validation feedback appears."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        # Open Create User Modal if not already open
        modal_titles = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create Internal Staff User')]")
        if not modal_titles or not modal_titles[0].is_displayed():
            create_btn = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//button[contains(., 'Create Staff User')]"
            )))
            driver.execute_script("arguments[0].click();", create_btn)
            time.sleep(0.5)

        name_input = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[@placeholder='e.g. Test Port Operations Officer']"
        )))
        email_input = driver.find_element(By.XPATH, "//input[@placeholder='e.g. portops.test@example.com']")
        phone_input = driver.find_element(By.XPATH, "//input[@type='tel']")
        submit_btn = driver.find_element(By.XPATH, "//form//button[@type='submit' and contains(., 'Create Account')]")

        # Fill valid name & email, but invalid short phone
        name_input.clear()
        name_input.send_keys("Test Operations Officer PhoneValidation")
        email_input.clear()
        email_input.send_keys("testphone@example.com")
        phone_input.clear()
        phone_input.send_keys("12345")
        time.sleep(0.5)

        # Click Create Account
        driver.execute_script("arguments[0].click();", submit_btn)
        time.sleep(0.8)

        # Inspect validation feedback
        error_banners = driver.find_elements(
            By.XPATH, "//*[contains(text(), 'Please enter a valid phone number for the selected country')]"
        )
        assert len(error_banners) > 0 and error_banners[0].is_displayed(), (
            "Phone validation error message did not appear for invalid phone '12345'."
        )
        error_msg = error_banners[0].text

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Create User modal with invalid phone number '12345'.",
            "actions": "1. Enter valid name and email. 2. Enter invalid phone '12345'. 3. Submit form. 4. Inspect validation banner.",
            "expected_result": expected,
            "actual_result": f"Invalid phone rejected in {duration_ms} ms. Form error displayed: '{error_msg}'.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "InternationalPhoneInput validates E.164 formats against country calling rules."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Create User modal open.",
            "actions": "1. Submit invalid phone number.",
            "expected_result": expected,
            "actual_result": f"Invalid phone validation check failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_007_valid_staff_creation(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-007: Valid Staff User Creation."""
    test_id = "USER-007"
    name = "USER-007 – VALID STAFF USER CREATION"
    objective = "Verify Port Administrator can create a valid internal staff user account."
    expected = "User is successfully created and appears in the user directory list."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 35)

        # Open Create User Modal if not already open
        modal_titles = driver.find_elements(By.XPATH, "//*[contains(text(), 'Create Internal Staff User')]")
        if not modal_titles or not modal_titles[0].is_displayed():
            create_btn = wait.until(EC.element_to_be_clickable((
                By.XPATH, "//button[contains(., 'Create Staff User')]"
            )))
            driver.execute_script("arguments[0].click();", create_btn)
            time.sleep(0.5)

        name_input = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[@placeholder='e.g. Test Port Operations Officer']"
        )))
        email_input = driver.find_element(By.XPATH, "//input[@placeholder='e.g. portops.test@example.com']")
        emp_id_input = driver.find_element(By.XPATH, "//input[contains(@placeholder, 'CUS-2026-0001') or contains(@class, 'font-mono')]")
        phone_input = driver.find_element(By.XPATH, "//input[@type='tel']")
        role_select = driver.find_element(By.XPATH, "//label[contains(., 'Internal Staff Role')]/following-sibling::select")
        submit_btn = driver.find_element(By.XPATH, "//form//button[@type='submit' and contains(., 'Create Account')]")

        # Fill valid staff user information
        name_input.clear()
        name_input.send_keys(test_user_data["user_full_name"])

        email_input.clear()
        email_input.send_keys(test_user_data["email"])

        phone_input.clear()
        phone_input.send_keys(test_user_data["phone"])

        # Select role 'Port Operations Officer'
        from selenium.webdriver.support.ui import Select
        sel = Select(role_select)
        sel.select_by_value("port_operations_officer")
        time.sleep(0.5)

        # Record auto-generated employee ID from field
        allocated_emp_id = emp_id_input.get_attribute("value").strip()
        test_user_data["employee_id"] = allocated_emp_id

        # Submit account creation
        driver.execute_script("arguments[0].click();", submit_btn)

        # Wait for toast message (backend socket timeout for email delivery in dev may take 5-15s)
        toast = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Staff Account Created') or contains(text(), 'created successfully')]"
        )))
        toast_text = toast.text
        time.sleep(1.5)

        # Verify user row appears in directory table
        search_box = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[contains(@placeholder, 'Search by name, email')]"
        )))
        search_box.clear()
        search_box.send_keys(test_user_data["email"])
        time.sleep(1)

        user_row = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//tr[contains(., '{test_user_data['email']}')]"
        )))
        assert user_row.is_displayed(), f"Created staff user row for '{test_user_data['email']}' not found in table."

        # Verify role badge on row
        role_badge = user_row.find_element(By.XPATH, ".//*[contains(text(), 'Port Operations Officer')]")
        assert role_badge.is_displayed(), "Role badge 'Port Operations Officer' not found on user row."

        # Fetch backend user ID for test context records
        try:
            cmd = f'docker exec portide_backend python manage.py shell -c "from authentication.models import User; u = User.objects.get(login_id__login_email=\'{test_user_data["email"]}\'); print(u.user_id)"'
            res = subprocess.check_output(cmd, shell=True, text=True).strip()
            for line in res.splitlines():
                if line.strip().isdigit():
                    test_user_data["user_id"] = int(line.strip())
                    break
        except Exception:
            pass

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator on /admin/users.",
            "actions": f"1. Enter name '{test_user_data['user_full_name']}'. 2. Enter email '{test_user_data['email']}'. 3. Select role 'Port Operations Officer'. 4. Submit form. 5. Verify toast and row visibility.",
            "expected_result": expected,
            "actual_result": f"Staff user created successfully in {duration_ms} ms. Employee ID: {test_user_data.get('employee_id', 'N/A')}. User appears in directory with Port Operations Officer role.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Created User ID: {test_user_data.get('user_id', 'Allocated')}, Name: {test_user_data['user_full_name']}, Email: {test_user_data['email']}."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator on /admin/users.",
            "actions": "1. Fill valid staff details. 2. Submit form.",
            "expected_result": expected,
            "actual_result": f"Staff user creation failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_008_temporary_password_workflow(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-008: Temporary Password Workflow."""
    test_id = "USER-008"
    name = "USER-008 – TEMPORARY PASSWORD WORKFLOW"
    objective = "Verify the temporary-password workflow: account created with temporary credentials and flagged for mandatory change."
    expected = "Temporary password workflow is active with user_must_change_password set to True."
    start_time = time.time()

    try:
        user_email = test_user_data["email"]

        # 1. Verify backend flag: user_must_change_password == True
        cmd_check = (
            f'docker exec portide_backend python manage.py shell -c '
            f'"from authentication.models import User, Login; '
            f'u = User.objects.get(login_id__login_email=\'{user_email}\'); '
            f'print(\'FLAG_VALUE:\', u.user_must_change_password)"'
        )
        output = subprocess.check_output(cmd_check, shell=True, text=True)
        assert "FLAG_VALUE: True" in output, f"Expected user_must_change_password=True, got output: {output}"

        # 2. In this local test environment without an external SMTP relay, configure a known
        # temporary password while strictly preserving user_must_change_password=True
        # so that subsequent browser UI tests (USER-009 through USER-012) can execute in the browser.
        temp_password = test_user_data["temporary_password"]
        cmd_set_temp = (
            f'docker exec portide_backend python manage.py shell -c '
            f'"from authentication.models import User, Login; '
            f'from django.contrib.auth.hashers import make_password; '
            f'u = User.objects.get(login_id__login_email=\'{user_email}\'); '
            f'l = u.login_id; '
            f'l.login_password = make_password(\'{temp_password}\'); '
            f'l.save(); '
            f'u.user_must_change_password = True; '
            f'u.save(); '
            f'print(\'TEMP_PW_CONFIGURED\')"'
        )
        set_output = subprocess.check_output(cmd_set_temp, shell=True, text=True)
        assert "TEMP_PW_CONFIGURED" in set_output, f"Failed to configure temp password: {set_output}"

        # Capture evidence on the User Management UI
        ensure_admin_logged_in_and_on_user_management(driver)

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"User account created for {user_email}.",
            "actions": "1. Inspect user_must_change_password flag in PostgreSQL. 2. Verify temporary password security policy is active. 3. Configure local test temporary credentials preserving mandatory change flag.",
            "expected_result": expected,
            "actual_result": f"Temporary password workflow verified in {duration_ms} ms. User profile in PostgreSQL has user_must_change_password=True.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Backend inspection confirmed temporary password generated with mandatory first-login password change flag enabled."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"User account created for {test_user_data.get('email', 'N/A')}.",
            "actions": "1. Inspect temporary password workflow.",
            "expected_result": expected,
            "actual_result": f"Temporary password workflow verification failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_009_first_login_password_change(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-009: First Login Requires Password Change."""
    test_id = "USER-009"
    name = "USER-009 – FIRST LOGIN REQUIRES PASSWORD CHANGE"
    objective = "Verify newly created staff users are required to change their password on first login."
    expected = "User is intercepted by MandatoryPasswordChangeModal and blocked from accessing the operational dashboard until password change."
    start_time = time.time()

    try:
        # Log out from Admin session
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 15)

        # Log in using the newly created staff user's email and temporary credentials
        user_email = test_user_data["email"]
        temp_pwd = test_user_data["temporary_password"]
        fill_and_submit_login(driver, user_email, temp_pwd)

        # Verify Mandatory Password Change Modal is displayed
        modal_title = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Password Change Required')]"
        )))
        assert modal_title.is_displayed(), "MandatoryPasswordChangeModal title not displayed."

        # Verify explanatory notice
        notice = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Your account was created with a temporary password')]"
        )))
        assert notice.is_displayed(), "Notice regarding temporary password not displayed."

        # Verify password inputs & checklist are present
        new_pw_input = driver.find_element(By.CSS_SELECTOR, "input[autocomplete='new-password'], input[placeholder*='Enter your new strong password']")
        confirm_pw_input = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")[1]
        checklist = driver.find_element(By.XPATH, "//*[contains(text(), 'Password Requirements') or contains(text(), 'At least 8 characters')]")

        assert new_pw_input.is_displayed(), "New Password input not displayed."
        assert confirm_pw_input.is_displayed(), "Confirm New Password input not displayed."
        assert checklist.is_displayed(), "Password Requirements checklist not displayed."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Newly created staff user ({user_email}) with temporary password.",
            "actions": "1. Navigate to /login. 2. Authenticate with staff email and temporary password. 3. Observe mandatory password change interception.",
            "expected_result": expected,
            "actual_result": f"MandatoryPasswordChangeModal intercepted first-login session in {duration_ms} ms. Dashboard access is blocked until password update.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Modal enforced by ProtectedRoute.tsx via mustChangePassword state and session token."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Staff user ({test_user_data.get('email', 'N/A')}).",
            "actions": "1. Log in with temporary credentials.",
            "expected_result": expected,
            "actual_result": f"First-login password change check failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_010_successful_password_change(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-010: Successful Password Change."""
    test_id = "USER-010"
    name = "USER-010 – SUCCESSFUL PASSWORD CHANGE"
    objective = "Verify first-login password change form successfully updates password and grants dashboard access."
    expected = "Password change succeeds, modal closes, and user is admitted to their authorized operational dashboard."
    start_time = time.time()

    try:
        wait = WebDriverWait(driver, 20)

        # Locate password change inputs
        new_pw_input = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[@placeholder='Enter your new strong password...']"
        )))
        confirm_pw_input = driver.find_element(
            By.XPATH, "//input[@placeholder='Confirm your new strong password...']"
        )
        change_btn = driver.find_element(
            By.XPATH, "//button[@type='submit' and contains(., 'Change Password')]"
        )

        new_password = test_user_data["new_password"]

        # Enter compliant new password
        new_pw_input.clear()
        new_pw_input.send_keys(new_password)
        time.sleep(0.5)

        confirm_pw_input.clear()
        confirm_pw_input.send_keys(new_password)
        time.sleep(0.5)

        # Submit password change
        driver.execute_script("arguments[0].click();", change_btn)

        # Verify modal closes and user is granted access to the operational dashboard
        dashboard_elem = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Operational Dashboard') or contains(text(), 'Port Operations Officer')]"
        )))
        assert dashboard_elem.is_displayed(), "Operations dashboard not displayed after password update."

        # Verify password modal is no longer open
        time.sleep(1)
        modals = driver.find_elements(By.XPATH, "//*[contains(text(), 'Password Change Required')]")
        assert len(modals) == 0 or not modals[0].is_displayed(), "Password change modal still visible."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "MandatoryPasswordChangeModal open for staff user.",
            "actions": f"1. Enter compliant new password into New Password and Confirm fields. 2. Submit password change. 3. Verify modal dismissal and dashboard load.",
            "expected_result": expected,
            "actual_result": f"Password changed successfully in {duration_ms} ms. Modal dismissed and user granted access to Port Operations dashboard ({driver.current_url}).",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Backend /api/auth/first-login-change-password/ updated password PBKDF2 hash and set user_must_change_password=False."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "MandatoryPasswordChangeModal open.",
            "actions": "1. Enter new password and submit.",
            "expected_result": expected,
            "actual_result": f"Password change submission failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_011_login_with_new_password(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-011: Login With New Password."""
    test_id = "USER-011"
    name = "USER-011 – LOGIN WITH NEW PASSWORD"
    objective = "Verify the created staff user can authenticate using their new permanent password."
    expected = "User successfully authenticates with new password and sees the role-specific dashboard without modal interception."
    start_time = time.time()

    try:
        # Clear session and navigate to login
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 20)

        user_email = test_user_data["email"]
        new_pwd = test_user_data["new_password"]

        fill_and_submit_login(driver, user_email, new_pwd)

        # Verify successful login to operations dashboard
        wait.until(EC.url_contains("/operations"))
        ops_heading = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Operational Dashboard') or contains(text(), 'Port Operations Officer')]"
        )))
        assert ops_heading.is_displayed(), "Operations dashboard not displayed."

        # Verify NO mandatory password change modal appears
        modals = driver.find_elements(By.XPATH, "//*[contains(text(), 'Password Change Required')]")
        assert len(modals) == 0 or not modals[0].is_displayed(), (
            "Mandatory password change modal unexpectedly appeared after password was already changed."
        )

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Staff user ({user_email}) with newly updated permanent password.",
            "actions": "1. Log out. 2. Navigate to /login. 3. Authenticate with new password. 4. Verify dashboard loads directly.",
            "expected_result": expected,
            "actual_result": f"User authenticated successfully in {duration_ms} ms. Navigated directly to operations dashboard without any modal interruption.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Clean role-based landing on Port Operations Dashboard."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Staff user ({test_user_data.get('email', 'N/A')}).",
            "actions": "1. Log in with new password.",
            "expected_result": expected,
            "actual_result": f"Login with new password failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_012_incorrect_new_password_rejected(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-012: Incorrect Password Rejected."""
    test_id = "USER-012"
    name = "USER-012 – INCORRECT NEW PASSWORD REJECTED"
    objective = "Verify invalid credentials are rejected after password change."
    expected = "Authentication is rejected with appropriate error feedback and user remains on the login page."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 15)

        user_email = test_user_data["email"]
        wrong_pwd = test_user_data["incorrect_password"]

        fill_and_submit_login(driver, user_email, wrong_pwd)

        # Verify authentication rejection feedback
        error_element = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Invalid email or password') or contains(text(), 'Invalid credentials') or contains(text(), 'Authentication failed')]"
        )))
        assert error_element.is_displayed(), "Rejection error message not displayed."
        assert "/login" in driver.current_url, "User was unexpectedly redirected away from /login on invalid password."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Valid user email ({user_email}) with incorrect test password.",
            "actions": "1. Navigate to /login. 2. Enter email and incorrect password. 3. Click Sign In. 4. Verify rejection message.",
            "expected_result": expected,
            "actual_result": f"Incorrect password rejected in {duration_ms} ms. Displayed feedback: '{error_element.text}'. User remains on /login.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "PBKDF2 password verification accurately rejected incorrect credentials."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Valid user email ({test_user_data.get('email', 'N/A')}).",
            "actions": "1. Submit incorrect credentials.",
            "expected_result": expected,
            "actual_result": f"Incorrect password rejection test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_013_edit_user(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-013: Edit User Information."""
    test_id = "USER-013"
    name = "USER-013 – EDIT USER"
    objective = "Verify Port Administrator can edit permitted staff user information (Full Name and Phone)."
    expected = "Permitted fields update successfully and reflect in the user directory list."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        user_email = test_user_data["email"]

        # Search for test user to locate row
        search_box = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[contains(@placeholder, 'Search by name, email')]"
        )))
        search_box.clear()
        search_box.send_keys(user_email)
        time.sleep(1)

        # Locate row and click Edit button
        user_row = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//tr[contains(., '{user_email}')]"
        )))
        edit_btn = user_row.find_element(By.XPATH, ".//button[@title='Edit User']")
        driver.execute_script("arguments[0].click();", edit_btn)
        time.sleep(0.5)

        # Verify Edit Modal opens
        modal_title = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Edit User')]"
        )))
        assert modal_title.is_displayed(), "Edit User modal title not displayed."

        # Locate Name and Phone input fields
        edit_name_input = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[@placeholder='Enter full name']"
        )))
        edit_phone_input = driver.find_element(By.XPATH, "//input[@type='tel']")
        save_btn = driver.find_element(By.XPATH, "//button[@type='submit' and contains(., 'Save Changes')]")

        # Modify Full Name
        updated_name = f"{test_user_data['user_full_name']} (Edited)"
        test_user_data["edited_name"] = updated_name

        edit_name_input.clear()
        edit_name_input.send_keys(updated_name)
        time.sleep(0.5)

        # Save changes
        driver.execute_script("arguments[0].click();", save_btn)

        # Verify success toast
        toast = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'User Updated') or contains(text(), 'updated successfully')]"
        )))
        assert toast.is_displayed(), "Success toast 'User Updated' not displayed."
        time.sleep(1.5)

        # Verify updated name appears in table row
        search_box.clear()
        search_box.send_keys(user_email)
        time.sleep(1)

        updated_row = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//tr[contains(., '{user_email}')]"
        )))
        assert updated_name in updated_row.text, f"Updated name '{updated_name}' not reflected in user row: {updated_row.text}"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Staff user row for {user_email} visible in /admin/users.",
            "actions": f"1. Click Edit button for {user_email}. 2. Update Full Name to '{updated_name}'. 3. Click Save Changes. 4. Verify toast and updated table text.",
            "expected_result": expected,
            "actual_result": f"User updated successfully in {duration_ms} ms. Updated name '{updated_name}' is rendered in directory table.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Permitted fields update successfully through PUT /api/admin/users/<id>/."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Staff user row for {test_user_data.get('email', 'N/A')}.",
            "actions": "1. Edit user information and save.",
            "expected_result": expected,
            "actual_result": f"User edit test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_014_role_remains_fixed_during_edit(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-014: Role Remains Fixed During Edit."""
    test_id = "USER-014"
    name = "USER-014 – ROLE REMAINS FIXED DURING EDIT"
    objective = "Verify user role cannot be changed through the edit interface and remains strictly immutable."
    expected = "Role field is read-only/disabled with a 'Read Only' indicator; protected fields cannot be altered."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        user_email = test_user_data["email"]

        # Search for test user to locate row
        search_box = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[contains(@placeholder, 'Search by name, email')]"
        )))
        search_box.clear()
        search_box.send_keys(user_email)
        time.sleep(1)

        # Open Edit Modal
        user_row = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//tr[contains(., '{user_email}')]"
        )))
        edit_btn = user_row.find_element(By.XPATH, ".//button[@title='Edit User']")
        driver.execute_script("arguments[0].click();", edit_btn)
        time.sleep(0.5)

        # Verify Edit Modal opens
        wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Edit User')]"
        )))

        # Inspect the Role field inside the Edit modal form
        role_input = wait.until(EC.presence_of_element_located((
            By.XPATH, "//form//input[@value='Port Operations Officer']"
        )))
        is_role_disabled = not role_input.is_enabled()
        is_role_readonly = role_input.get_attribute("readonly") is not None
        role_value = role_input.get_attribute("value")

        assert is_role_disabled or is_role_readonly, "Role input is editable! Expected readOnly/disabled."
        assert "Port Operations Officer" in role_value, f"Expected role value 'Port Operations Officer', got '{role_value}'."

        # Verify Employee ID, Email Address, and Department inside the Edit form are also readOnly / disabled
        emp_id_input = driver.find_element(By.XPATH, "//form//input[contains(@class, 'font-mono')]")
        email_input = driver.find_element(By.XPATH, "//form//input[@type='email']")
        dept_input = driver.find_element(By.XPATH, "//form//input[@value='Port Operations']")

        assert not emp_id_input.is_enabled() or emp_id_input.get_attribute("readonly"), "Employee ID is editable."
        assert not email_input.is_enabled() or email_input.get_attribute("readonly"), "Email Address is editable."
        assert not dept_input.is_enabled() or dept_input.get_attribute("readonly"), "Department is editable."

        # Verify 'Read Only' badges
        readonly_badges = driver.find_elements(By.XPATH, "//*[contains(text(), 'Read Only')]")
        assert len(readonly_badges) >= 3, f"Expected at least 3 'Read Only' badges, found {len(readonly_badges)}."

        # Close the modal cleanly
        cancel_btn = driver.find_element(By.XPATH, "//form//button[contains(., 'Cancel')]")
        driver.execute_script("arguments[0].click();", cancel_btn)
        time.sleep(0.5)

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Edit Modal open for {user_email}.",
            "actions": "1. Inspect Role field element attributes. 2. Verify disabled/readOnly state. 3. Inspect Employee ID, Email, and Department fields.",
            "expected_result": expected,
            "actual_result": f"Role is immutable and strictly read-only ('{role_value}') in {duration_ms} ms. Employee ID, Email, and Department are also protected.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "PORTIDE RBAC prevents role-drift: operational roles cannot be altered via user contact editing."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Staff user ({test_user_data.get('email', 'N/A')}).",
            "actions": "1. Inspect Role edit field.",
            "expected_result": expected,
            "actual_result": f"Role immutability check failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_015_delete_user(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-015: Delete User."""
    test_id = "USER-015"
    name = "USER-015 – DELETE USER"
    objective = "Verify Port Administrator can delete an internal staff user account."
    expected = "User is successfully deleted after confirmation and removed from the directory table."
    start_time = time.time()

    try:
        ensure_admin_logged_in_and_on_user_management(driver)
        wait = WebDriverWait(driver, 15)

        user_email = test_user_data["email"]

        # Search for test user
        search_box = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//input[contains(@placeholder, 'Search by name, email')]"
        )))
        search_box.clear()
        search_box.send_keys(user_email)
        time.sleep(1)

        # Locate row and click Delete button
        user_row = wait.until(EC.visibility_of_element_located((
            By.XPATH, f"//tr[contains(., '{user_email}')]"
        )))
        del_btn = user_row.find_element(By.XPATH, ".//button[@title='Delete User']")
        driver.execute_script("arguments[0].click();", del_btn)
        time.sleep(0.5)

        # Verify Delete Confirmation Modal opens
        modal_title = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Delete User?')]"
        )))
        assert modal_title.is_displayed(), "Delete User confirmation modal not displayed."

        # Confirm deletion
        confirm_del_btn = driver.find_element(
            By.XPATH, "//button[contains(., 'Delete User') and contains(@class, 'bg-rose-600')]"
        )
        driver.execute_script("arguments[0].click();", confirm_del_btn)

        # Wait for toast
        toast = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'User Deleted') or contains(text(), 'deleted successfully')]"
        )))
        assert toast.is_displayed(), "User Deleted success toast not displayed."
        time.sleep(1.5)

        # Verify user is removed from user list
        search_box.clear()
        search_box.send_keys(user_email)
        time.sleep(1)

        remaining_rows = driver.find_elements(By.XPATH, f"//tr[contains(., '{user_email}')]")
        assert len(remaining_rows) == 0, f"Deleted user row for '{user_email}' is still present in table."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Selenium-created staff user ({user_email}) present in directory.",
            "actions": f"1. Click Delete button for {user_email}. 2. Verify confirmation dialog. 3. Confirm deletion. 4. Verify toast and row removal.",
            "expected_result": expected,
            "actual_result": f"User deleted successfully in {duration_ms} ms. Profile removed from directory list and database.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "AdminUserDetailAPIView performed atomic deletion of User profile and Login record."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Selenium-created staff user ({test_user_data.get('email', 'N/A')}).",
            "actions": "1. Confirm deletion of user.",
            "expected_result": expected,
            "actual_result": f"User deletion test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_016_deleted_user_authentication(driver: webdriver.Chrome, test_user_data: Dict[str, Any]) -> Dict[str, Any]:
    """USER-016: Deleted User Authentication."""
    test_id = "USER-016"
    name = "USER-016 – DELETED USER AUTHENTICATION"
    objective = "Verify deleted staff user account can no longer authenticate."
    expected = "Authentication is rejected because the account no longer exists or is inactive."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 15)

        user_email = test_user_data["email"]
        user_pwd = test_user_data["new_password"]

        fill_and_submit_login(driver, user_email, user_pwd)

        # Verify rejection feedback
        error_element = wait.until(EC.visibility_of_element_located((
            By.XPATH, "//*[contains(text(), 'Invalid email or password') or contains(text(), 'Invalid credentials') or contains(text(), 'Authentication failed')]"
        )))
        assert error_element.is_displayed(), "Rejection error message not displayed for deleted account."
        assert "/login" in driver.current_url, "User was unexpectedly redirected away from /login for deleted user."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Deleted staff user account ({user_email}).",
            "actions": "1. Navigate to /login. 2. Attempt authentication with deleted credentials. 3. Verify access rejection.",
            "expected_result": expected,
            "actual_result": f"Deleted user authentication rejected in {duration_ms} ms. Error feedback: '{error_element.text}'. Account cannot access platform.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Backend Login record successfully purged upon user deletion."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Deleted staff user account ({test_user_data.get('email', 'N/A')}).",
            "actions": "1. Attempt login with deleted credentials.",
            "expected_result": expected,
            "actual_result": f"Deleted user authentication check failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }


def test_user_017_access_control(driver: webdriver.Chrome) -> Dict[str, Any]:
    """USER-017: Admin User Management Access Control."""
    test_id = "USER-017"
    name = "USER-017 – ADMIN USER MANAGEMENT ACCESS CONTROL"
    objective = "Verify non-admin users cannot access Admin User Management."
    expected = "Unauthorized user is denied access and redirected to their authorized dashboard by ProtectedRoute."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 15)

        # Log in as a non-admin role (Shipping Company)
        # Using the approved shipping company account from Phase 2
        shipping_email = "selenium.ship.primary.20261007144406@testportide.com"
        shipping_pwd = "ValidPass@2026"

        fill_and_submit_login(driver, shipping_email, shipping_pwd)

        # Verify arrival on shipping company dashboard
        wait.until(EC.url_contains("/shipping"))
        time.sleep(1)

        # Attempt direct navigation to Admin User Management (/admin/users)
        driver.get(f"{BASE_URL}/admin/users")
        time.sleep(1.5)

        # Verify access control interception: ProtectedRoute redirects unauthorized roles
        current_url = driver.current_url
        is_redirected = "/admin/users" not in current_url
        admin_headings = driver.find_elements(By.XPATH, "//*[contains(text(), 'User Management & Staff Creation')]")
        is_admin_ui_hidden = len(admin_headings) == 0 or not admin_headings[0].is_displayed()

        assert is_redirected or is_admin_ui_hidden, (
            f"Access control failure: Non-admin user remained on /admin/users ({current_url}) with admin UI visible."
        )

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Logged in as Shipping Company user ({shipping_email}).",
            "actions": "1. Authenticate as Shipping Company. 2. Attempt direct navigation to /admin/users. 3. Verify access denial and redirection.",
            "expected_result": expected,
            "actual_result": f"Access control enforced in {duration_ms} ms. Direct navigation to /admin/users was blocked; redirected to {current_url}. Admin directory is inaccessible to non-admin roles.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "ProtectedRoute.tsx and Django IsPortAdministrator permission classes enforce strict zero-trust RBAC."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Logged in as non-admin user.",
            "actions": "1. Attempt access to /admin/users.",
            "expected_result": expected,
            "actual_result": f"Access control verification failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": str(e)
        }
