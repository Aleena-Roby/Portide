import sys
import time
import unittest
from pathlib import Path

# Ensure both project root and test directory are on sys.path
TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_DIR.parent
for p in (str(PROJECT_ROOT), str(TEST_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

try:
    from test.config import (
        BASE_URL,
        get_driver,
        capture_screenshot,
        clear_session,
        login_as_admin,
        logout_user
    )
except (ImportError, ModuleNotFoundError):
    from config import (
        BASE_URL,
        get_driver,
        capture_screenshot,
        clear_session,
        login_as_admin,
        logout_user
    )


class TestAuthentication(unittest.TestCase):
    """
    Functionality 1: Authentication Test Suite
    Tests portal accessibility, form validation, valid/invalid logins,
    role-based dashboard redirection, and session termination.
    """

    @classmethod
    def setUpClass(cls):
        cls.driver = get_driver(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def setUp(self):
        clear_session(self.driver)

    def test_01_portal_landing_and_login_navigation(self):
        """TC-AUTH-01: Verify portal loads and login page is accessible."""
        self.driver.get(f"{BASE_URL}/login")
        WebDriverWait(self.driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        self.assertIn("PORTIDE", self.driver.title)
        
        heading = WebDriverWait(self.driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Sign in to PORTIDE') or contains(text(), 'Sign In')]"))
        )
        self.assertTrue(heading.is_displayed())
        capture_screenshot(self.driver, "01_auth_login_page_loaded")

    def test_02_login_form_elements_present(self):
        """TC-AUTH-02: Verify email input, password input, and submit button exist."""
        self.driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(self.driver, 10)

        email_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user@portide.com']"))
        )
        password_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
        )
        submit_btn = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "button[type='submit']"))
        )

        self.assertTrue(email_input.is_displayed())
        self.assertTrue(password_input.is_displayed())
        self.assertTrue(submit_btn.is_displayed())
        capture_screenshot(self.driver, "01_auth_form_elements_verified")

    def test_03_invalid_login_rejection(self):
        """TC-AUTH-03: Verify system rejects incorrect password with error message."""
        self.driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(self.driver, 10)

        email_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user@portide.com']"))
        )
        password_input = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
        )
        submit_btn = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
        )

        email_input.clear()
        email_input.send_keys("aleena302005@gmail.com")
        password_input.clear()
        password_input.send_keys("WrongPassword@999")
        submit_btn.click()

        # Wait for either response banner or alert indicating failure
        time.sleep(2)
        has_error = False
        try:
            error_elem = WebDriverWait(self.driver, 15).until(
                EC.visibility_of_element_located((
                    By.CSS_SELECTOR,
                    "div.text-rose-700, [class*='text-rose'], [class*='rose-'], [class*='border-rose']"
                ))
            )
            has_error = error_elem.is_displayed()
        except Exception:
            # Check if login button returned to active state without navigating away
            has_error = "/login" in self.driver.current_url

        self.assertTrue(has_error, "System should reject invalid password and retain user on login screen.")
        capture_screenshot(self.driver, "01_auth_invalid_credentials_rejected")

    def test_04_valid_admin_login_and_dashboard_redirect(self):
        """TC-AUTH-04: Verify valid Port Administrator credentials succeed and redirect to /admin."""
        login_as_admin(self.driver)
        
        self.assertIn("/admin", self.driver.current_url)
        
        wait = WebDriverWait(self.driver, 15)
        admin_badge = wait.until(
            EC.visibility_of_element_located((
                By.XPATH,
                "//*[contains(text(), 'Port Administrator') or contains(text(), 'Overview') or contains(text(), 'Dashboard')]"
            ))
        )
        self.assertTrue(admin_badge.is_displayed())
        capture_screenshot(self.driver, "01_auth_admin_dashboard_loaded")

    def test_05_session_persistence_and_logout(self):
        """TC-AUTH-05: Verify session persistence in localStorage and clean logout."""
        login_as_admin(self.driver)
        
        session_token = self.driver.execute_script("return window.localStorage.getItem('portide_user_session');")
        self.assertIsNotNone(session_token)

        logout_user(self.driver)
        self.assertTrue(
            "/login" in self.driver.current_url or self.driver.current_url.rstrip("/").endswith(BASE_URL.rstrip("/")),
            "Logout should redirect user to login or landing page."
        )
        capture_screenshot(self.driver, "01_auth_logged_out_successfully")


if __name__ == "__main__":
    unittest.main(verbosity=2)
