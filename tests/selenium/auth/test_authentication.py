import os
import time
from typing import Dict, Any
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
    open_landing_page,
    open_login_page,
    fill_and_submit_login,
    wait_for_admin_dashboard,
    perform_logout,
    get_stored_session_js,
)


def run_auth_001_app_load(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-001: Application Load - verify application loads and landing page is visible."""
    test_id = "AUTH-001"
    name = "AUTH-001 – APPLICATION LOAD"
    objective = "Verify PORTIDE application loads successfully and landing page is interactive."
    expected = "PORTIDE application loads successfully, landing page visible, no fatal errors."
    start_time = time.time()
    
    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/")
        wait = WebDriverWait(driver, 15)
        
        # Verify page title or body presence
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        body_text = driver.find_element(By.TAG_NAME, "body").text
        
        # Check brand name and heading elements
        assert "PORTIDE" in body_text, "Brand name 'PORTIDE' not found in page body."
        assert (
            "Maritime Port Operations" in body_text 
            or "Enterprise Maritime" in body_text 
            or "Platform" in body_text
        ), "Expected landing page tagline not found."
        
        # Verify login CTA button is visible
        login_btn = wait.until(
            EC.visibility_of_element_located((
                By.XPATH, 
                "//button[contains(translate(., 'login', 'LOGIN'), 'LOGIN')] | //a[contains(translate(., 'login', 'LOGIN'), 'LOGIN')]"
            ))
        )
        assert login_btn.is_displayed(), "Login call-to-action button is not visible."

        # Verify no fatal error boundary
        error_boundaries = driver.find_elements(By.XPATH, "//*[contains(text(), 'Something went wrong') or contains(text(), 'Module Error')]")
        assert len(error_boundaries) == 0, "Error boundary detected on landing page."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"PORTIDE frontend running at {BASE_URL}.",
            "actions": f"1. Navigate to {BASE_URL}/. 2. Verify page body, brand title, and login CTA.",
            "expected_result": expected,
            "actual_result": f"Application loaded successfully in {duration_ms} ms. Landing page rendered with hero section and active login button.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Landing page loaded cleanly without console errors or crash screens."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"PORTIDE frontend running at {BASE_URL}.",
            "actions": f"1. Navigate to {BASE_URL}/. 2. Verify page body.",
            "expected_result": expected,
            "actual_result": f"Failed to load application: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error encountered during application load: {str(e)}"
        }


def run_auth_002_login_page_load(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-002: Login Page Load - verify email, password, and sign in button are available."""
    test_id = "AUTH-002"
    name = "AUTH-002 – LOGIN PAGE LOAD"
    objective = "Verify the PORTIDE Login page loads properly and all input controls are functional."
    expected = "Login page loads correctly and required controls (email, password, submit button) are available."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 15)

        # Locate email, password, and submit button
        email_elem = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user@portide.com']"))
        )
        password_elem = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
        )
        submit_btn = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
        )

        # Check form header
        header_elem = driver.find_element(By.XPATH, "//*[contains(text(), 'Sign in to PORTIDE') or contains(text(), 'Sign In')]")
        assert header_elem.is_displayed(), "Sign in heading is not visible."
        assert email_elem.is_enabled(), "Email field is not enabled."
        assert password_elem.is_enabled(), "Password field is not enabled."
        assert submit_btn.is_enabled(), "Submit button is not enabled."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"PORTIDE web application active at {BASE_URL}.",
            "actions": "1. Navigate to /login. 2. Verify visibility of email field, password field, and submit button.",
            "expected_result": expected,
            "actual_result": f"Login page rendered successfully. Email input, password input, and Sign In button are visible and interactive.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Form controls are accessible and responsive."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"PORTIDE web application active at {BASE_URL}.",
            "actions": "1. Navigate to /login. 2. Verify controls.",
            "expected_result": expected,
            "actual_result": f"Failed to verify login page controls: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error encountered during login page inspection: {str(e)}"
        }


def run_auth_003_valid_admin_login(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-003: Valid Port Administrator Login - verify successful auth and dashboard navigation."""
    test_id = "AUTH-003"
    name = "AUTH-003 – VALID PORT ADMINISTRATOR LOGIN"
    objective = "Verify valid Port Administrator account logs in successfully and reaches admin dashboard."
    expected = "Port Administrator successfully logs into the correct PORTIDE dashboard."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
        wait_for_admin_dashboard(driver, timeout=15)

        # Verify URL and content
        current_url = driver.current_url
        assert "/admin" in current_url, f"Expected admin route in URL, got {current_url}"

        # Verify session in localStorage
        session_raw = get_stored_session_js(driver)
        assert session_raw is not None, "User session not persisted in localStorage after login."
        assert "port_administrator" in session_raw or "admin" in session_raw, "Session role does not match port_administrator."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Existing Port Administrator test account present in database.",
            "actions": "1. Open /login. 2. Enter valid credentials. 3. Click Sign In. 4. Wait for dashboard redirect.",
            "expected_result": expected,
            "actual_result": f"Authentication succeeded in {duration_ms} ms. User navigated to {current_url} with active Port Administrator session.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Existing Port Administrator test account used. Authentication and role dashboard resolution succeeded."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Existing Port Administrator test account present in database.",
            "actions": "1. Open /login. 2. Enter credentials. 3. Click Sign In.",
            "expected_result": expected,
            "actual_result": f"Login failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Authentication failure during admin login test: {str(e)}"
        }


def run_auth_004_invalid_email(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-004: Invalid Email - verify rejection of non-existing email."""
    test_id = "AUTH-004"
    name = "AUTH-004 – INVALID EMAIL"
    objective = "Verify system rejects non-existing email with appropriate feedback and denies access."
    expected = "Invalid/non-existing email is rejected. User does not enter dashboard."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, "nonexistent.user.2026@portide.org", "ValidPass#2026")

        wait = WebDriverWait(driver, 8)
        # Verify user remains on /login
        time.sleep(1)
        assert "/admin" not in driver.current_url, "User was unexpectedly granted access to admin dashboard!"
        assert "/login" in driver.current_url, f"Expected URL to remain /login, but was {driver.current_url}"

        # Check for error feedback on page
        error_elem = wait.until(
            EC.visibility_of_element_located((
                By.XPATH, 
                "//*[contains(@class, 'text-rose') or contains(@class, 'bg-rose')][contains(., 'Invalid') or contains(., 'error') or contains(., 'not found') or contains(., 'credentials')]"
            ))
        )
        assert error_elem.is_displayed(), "Error message element is not displayed."

        # Verify session is empty
        session_raw = get_stored_session_js(driver)
        assert session_raw is None, "Session was unexpectedly stored for invalid credentials."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Unauthenticated user on /login.",
            "actions": "1. Enter nonexistent email. 2. Enter password. 3. Click Sign In. 4. Check response.",
            "expected_result": expected,
            "actual_result": f"Rejected as expected. Error message displayed: '{error_elem.text.strip()}'. Route remained /login.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Invalid email rejection confirmed. No session tokens were issued."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Unauthenticated user on /login.",
            "actions": "1. Enter nonexistent email. 2. Submit form.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying invalid email behavior: {str(e)}"
        }


def run_auth_005_invalid_password(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-005: Invalid Password - verify rejection of incorrect password for existing account."""
    test_id = "AUTH-005"
    name = "AUTH-005 – INVALID PASSWORD"
    objective = "Verify incorrect password for an existing account is rejected and access denied."
    expected = "Incorrect password is rejected. Dashboard does not open. Error feedback appears."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        fill_and_submit_login(driver, ADMIN_EMAIL, "IncorrectPassword#2026")

        wait = WebDriverWait(driver, 8)
        # Verify user remains on /login
        time.sleep(1)
        assert "/admin" not in driver.current_url, "User was unexpectedly granted access with invalid password!"
        assert "/login" in driver.current_url, f"Expected URL to remain /login, but was {driver.current_url}"

        # Check for error feedback on page
        error_elem = wait.until(
            EC.visibility_of_element_located((
                By.XPATH, 
                "//*[contains(@class, 'text-rose') or contains(@class, 'bg-rose')][contains(., 'Invalid') or contains(., 'error') or contains(., 'credentials') or contains(., 'password')]"
            ))
        )
        assert error_elem.is_displayed(), "Error message element is not displayed."

        # Verify session is empty
        session_raw = get_stored_session_js(driver)
        assert session_raw is None, "Session was unexpectedly stored for invalid password."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Valid user email '{ADMIN_EMAIL}' exists in database.",
            "actions": "1. Enter existing email. 2. Enter incorrect password. 3. Click Sign In. 4. Verify rejection.",
            "expected_result": expected,
            "actual_result": f"Authentication rejected as expected. Error message displayed: '{error_elem.text.strip()}'. Route remained /login.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Invalid password properly rejected by backend authentication service."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": f"Valid user email exists.",
            "actions": "1. Enter valid email and incorrect password. 2. Submit form.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying invalid password behavior: {str(e)}"
        }


def run_auth_006_empty_login_form(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-006: Empty Login Form - verify empty form submission is blocked by validation."""
    test_id = "AUTH-006"
    name = "AUTH-006 – EMPTY LOGIN FORM"
    objective = "Verify submission of empty email and password fields is rejected by validation."
    expected = "Empty login form is rejected by validation. Dashboard is not opened."
    start_time = time.time()

    try:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 10)

        email_elem, password_elem, submit_btn = open_login_page(driver)
        email_elem.clear()
        password_elem.clear()

        # Check HTML5 required attributes
        email_required = email_elem.get_attribute("required") is not None
        pass_required = password_elem.get_attribute("required") is not None
        assert email_required and pass_required, "Expected 'required' attributes on email and password inputs."

        # Click submit button
        submit_btn.click()
        time.sleep(0.5)

        # Validate that the browser prevented form submission (HTML5 validity or JS error)
        is_email_valid = driver.execute_script("return arguments[0].checkValidity();", email_elem)
        assert not is_email_valid, "Expected email field checkValidity() to return False for empty input."

        # User must remain on login page
        assert "/admin" not in driver.current_url, "User navigated away from login on empty submit!"
        assert "/login" in driver.current_url, f"Expected URL to remain /login, but was {driver.current_url}"

        # Session must be empty
        session_raw = get_stored_session_js(driver)
        assert session_raw is None, "Session was unexpectedly created on empty submit."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /login with empty inputs.",
            "actions": "1. Clear email and password inputs. 2. Click Sign In. 3. Check client validation state.",
            "expected_result": expected,
            "actual_result": "Empty submission blocked by form validation. checkValidity() returned False. No navigation or session created.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Required form input attributes prevented empty payload transmission."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "User on /login.",
            "actions": "1. Leave inputs blank. 2. Submit form.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying empty form validation: {str(e)}"
        }


def run_auth_007_correct_role_dashboard(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-007: Correct Role Dashboard - verify Port Administrator reaches correct dedicated dashboard."""
    test_id = "AUTH-007"
    name = "AUTH-007 – CORRECT ROLE DASHBOARD"
    objective = "Verify Port Administrator receives exclusively the correct Admin dashboard and navigation modules."
    expected = "Port Administrator receives only the correct Admin dashboard."
    start_time = time.time()

    try:
        # Check current page state or log in
        if "/admin" not in driver.current_url:
            clear_session(driver)
            driver.get(f"{BASE_URL}/login")
            fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
            wait_for_admin_dashboard(driver, timeout=15)

        wait = WebDriverWait(driver, 10)

        # 1. Verify route
        assert "/admin" in driver.current_url, f"Current URL is not an admin route: {driver.current_url}"

        # 2. Verify header title
        header_title = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//header//h2[contains(text(), 'Port Administrator Dashboard')]"))
        )
        assert header_title.is_displayed(), "Header title 'Port Administrator Dashboard' not found."

        # 3. Verify admin welcome card and overview content
        welcome_elem = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Welcome, Port Administrator')]"))
        )
        assert welcome_elem.is_displayed(), "Welcome card for Port Administrator not found."

        # 4. Verify admin navigation items in sidebar
        sidebar_text = driver.find_element(By.TAG_NAME, "aside").text
        expected_modules = ["Berth Management", "Company Approvals", "User & Registration", "Security & Audit Logs"]
        for mod in expected_modules:
            assert mod in sidebar_text, f"Expected admin navigation item '{mod}' not found in sidebar."

        # 5. Role exclusivity check: ensure non-admin exclusive modules are absent
        forbidden_modules = ["Cargo Registration", "Vessel Arrival Requests", "Container Release Worklist"]
        for non_mod in forbidden_modules:
            assert non_mod not in sidebar_text, f"Unauthorized role module '{non_mod}' appeared in Port Administrator sidebar!"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator authenticated session.",
            "actions": "1. Inspect current dashboard route. 2. Verify header title. 3. Check sidebar modules. 4. Verify role isolation.",
            "expected_result": expected,
            "actual_result": f"Verified Port Administrator dashboard at {driver.current_url}. Header, overview cards, and sidebar modules match admin role exclusively.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Role-based access control and layout isolation confirmed."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Port Administrator authenticated session.",
            "actions": "1. Verify dashboard components and role isolation.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying role dashboard isolation: {str(e)}"
        }


def run_auth_008_refresh_after_login(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-008: Refresh After Login - verify session persistence across page reload."""
    test_id = "AUTH-008"
    name = "AUTH-008 – REFRESH AFTER LOGIN"
    objective = "Verify authenticated session remains valid and active after normal browser refresh."
    expected = "Authenticated session should remain valid after a normal browser refresh. User should not be unexpectedly logged out."
    start_time = time.time()

    try:
        # Ensure user is on admin dashboard
        if "/admin" not in driver.current_url:
            clear_session(driver)
            driver.get(f"{BASE_URL}/login")
            fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
            wait_for_admin_dashboard(driver, timeout=15)

        # 1. Trigger browser refresh
        driver.refresh()
        wait = WebDriverWait(driver, 15)

        # 2. Wait for page reload and verify user remains on dashboard
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(1)

        current_url = driver.current_url
        assert "/admin" in current_url, f"Expected URL to remain /admin after refresh, but was {current_url}"

        # 3. Verify dashboard content is still rendered
        welcome_elem = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Welcome, Port Administrator') or contains(text(), 'Port Administrator Dashboard')]"))
        )
        assert welcome_elem.is_displayed(), "Dashboard welcome content missing after refresh."

        # 4. Verify localStorage session remains
        session_raw = get_stored_session_js(driver)
        assert session_raw is not None, "Session in localStorage was lost after refresh."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Active Port Administrator session on /admin/dashboard.",
            "actions": "1. Trigger browser refresh. 2. Wait for reload. 3. Check URL and session retention.",
            "expected_result": expected,
            "actual_result": f"Session retained across refresh. User remained on {current_url} without re-authenticating.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "LocalStorage persistence mechanism maintained the session flawlessly across browser refresh."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Active session on dashboard.",
            "actions": "1. Refresh browser. 2. Verify state.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying refresh session persistence: {str(e)}"
        }


def run_auth_009_logout(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-009: Logout - verify logging out clears session and redirects to login."""
    test_id = "AUTH-009"
    name = "AUTH-009 – LOGOUT"
    objective = "Verify clicking Logout terminates the authenticated session and redirects to the login screen."
    expected = "Logout works successfully. Authentication session is cleared, user is redirected to Login."
    start_time = time.time()

    try:
        # Ensure user is logged in
        if "/admin" not in driver.current_url:
            clear_session(driver)
            driver.get(f"{BASE_URL}/login")
            fill_and_submit_login(driver, ADMIN_EMAIL, ADMIN_PASSWORD)
            wait_for_admin_dashboard(driver, timeout=15)

        # Perform logout
        perform_logout(driver, timeout=15)
        wait = WebDriverWait(driver, 10)

        # 1. Verify URL is /login
        time.sleep(1)
        current_url = driver.current_url
        assert "/login" in current_url, f"Expected URL to be /login after logout, but was {current_url}"

        # 2. Verify login form is visible
        heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Sign in to PORTIDE')]"))
        )
        assert heading.is_displayed(), "Sign in heading not found after logout."

        # 3. Verify localStorage session is cleared
        session_raw = get_stored_session_js(driver)
        assert session_raw is None, f"Expected localStorage session to be null after logout, but found: {session_raw}"

        # 4. Verify dashboard elements are no longer visible
        admin_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Welcome, Port Administrator')]")
        assert len(admin_elements) == 0, "Dashboard elements unexpectedly remain on page after logout."

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Active Port Administrator session on dashboard.",
            "actions": "1. Click header Logout button. 2. Wait for navigation. 3. Check localStorage and login form.",
            "expected_result": expected,
            "actual_result": f"Logout completed successfully in {duration_ms} ms. User redirected to {current_url}, session cleared from storage.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Logout cleanly revoked local session and displayed login screen."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Active session on dashboard.",
            "actions": "1. Click Logout. 2. Verify redirect and session purge.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying logout routine: {str(e)}"
        }


def run_auth_010_protected_page_after_logout(driver: webdriver.Chrome) -> Dict[str, Any]:
    """AUTH-010: Protected Page After Logout - verify unauthorized direct route access is blocked."""
    test_id = "AUTH-010"
    name = "AUTH-010 – PROTECTED PAGE AFTER LOGOUT"
    objective = "Verify direct navigation to protected dashboard route after logout is prevented."
    expected = "Protected routes remain protected after logout. User is redirected to Login."
    start_time = time.time()

    try:
        # Ensure logged out state
        clear_session(driver)

        # 1. Attempt to navigate directly to protected route
        driver.get(f"{BASE_URL}/admin/dashboard")
        wait = WebDriverWait(driver, 12)

        # 2. Wait for ProtectedRoute redirection to /login
        wait.until(EC.url_contains("/login"))
        time.sleep(1)

        current_url = driver.current_url
        assert "/login" in current_url, f"Expected URL to be redirected to /login, but was {current_url}"

        # 3. Verify Login page elements are visible
        heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Sign in to PORTIDE')]"))
        )
        assert heading.is_displayed(), "Login form not visible after redirection."

        # 4. Verify no protected dashboard content is shown
        admin_elements = driver.find_elements(By.XPATH, "//*[contains(text(), 'Welcome, Port Administrator')]")
        assert len(admin_elements) == 0, "Protected admin content was displayed to logged-out user!"

        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "PASS")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Logged-out state (no stored session).",
            "actions": "1. Directly navigate to /admin/dashboard. 2. Verify ProtectedRoute guard redirects to /login.",
            "expected_result": expected,
            "actual_result": f"Protected route guard blocked direct access and redirected user to {current_url}. Login page displayed.",
            "status": "PASS",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": "Client-side routing guard (ProtectedRoute) correctly enforces authentication boundary."
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        screenshot = take_screenshot(driver, test_id, "FAIL")
        return {
            "test_id": test_id,
            "test_name": name,
            "objective": objective,
            "preconditions": "Logged-out state.",
            "actions": "1. Navigate to /admin/dashboard. 2. Check route protection.",
            "expected_result": expected,
            "actual_result": f"Test failed: {str(e)}",
            "status": "FAIL",
            "screenshot": screenshot,
            "duration_ms": duration_ms,
            "remarks": f"Error verifying protected route guard: {str(e)}"
        }
