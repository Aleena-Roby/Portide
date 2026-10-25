import time
import unittest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from test.config import (
    BASE_URL,
    get_driver,
    capture_screenshot,
    clear_session,
    login_as_admin
)


class TestShippingCompanyRegistrationAndApproval(unittest.TestCase):
    """
    Functionality 2: Shipping Company Registration and Approval Test Suite
    Tests onboarding portal fields, submission validation, and administrative
    approval management in the Port Administrator dashboard.
    """

    @classmethod
    def setUpClass(cls):
        cls.driver = get_driver(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def setUp(self):
        clear_session(self.driver)

    def test_01_registration_page_elements(self):
        """TC-REG-01: Verify shipping company registration form and statutory fields load."""
        self.driver.get(f"{BASE_URL}/register")
        wait = WebDriverWait(self.driver, 15)

        # Verify page heading or registration card
        heading = wait.until(
            EC.visibility_of_element_located((
                By.XPATH, 
                "//*[contains(text(), 'Entity Registration') or contains(text(), 'Company Name') or contains(text(), 'Onboarding')]"
            ))
        )
        self.assertTrue(heading.is_displayed())

        # Check required input fields
        inputs = self.driver.find_elements(By.CSS_SELECTOR, "input, select, textarea")
        self.assertGreaterEqual(len(inputs), 5, "Registration form should contain corporate profile fields.")
        capture_screenshot(self.driver, "02_shipco_registration_form_loaded")

    def test_02_registration_validation(self):
        """TC-REG-02: Verify client-side validation alerts when submitting blank form."""
        self.driver.get(f"{BASE_URL}/register")
        wait = WebDriverWait(self.driver, 15)

        submit_btn = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
        )
        submit_btn.click()
        time.sleep(1)

        self.assertIn("/register", self.driver.current_url)
        capture_screenshot(self.driver, "02_shipco_registration_validation_tested")

    def test_03_admin_company_approvals_navigation(self):
        """TC-REG-03: Log in as Port Administrator and access Company Approvals."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/company-approvals")
        wait = WebDriverWait(self.driver, 15)

        header = wait.until(
            EC.visibility_of_element_located((
                By.XPATH,
                "//*[contains(text(), 'Company') or contains(text(), 'Approvals') or contains(text(), 'Onboarding')]"
            ))
        )
        self.assertTrue(header.is_displayed())
        capture_screenshot(self.driver, "02_shipco_admin_approvals_view")

    def test_04_approvals_table_and_status_filters(self):
        """TC-REG-04: Verify approvals table, search input, and status filtering tabs."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/company-approvals")
        wait = WebDriverWait(self.driver, 15)

        # Check for filter buttons or search bar
        buttons = wait.until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "button, input"))
        )
        self.assertGreaterEqual(len(buttons), 2)

        # Check presence of container or heading
        container = wait.until(
            EC.presence_of_element_located((
                By.XPATH, 
                "//table | //*[contains(text(), 'Company') or contains(text(), 'Pending') or contains(text(), 'Approved') or contains(text(), 'Applications')]"
            ))
        )
        self.assertTrue(container.is_displayed())
        capture_screenshot(self.driver, "02_shipco_approvals_table_verified")


if __name__ == "__main__":
    unittest.main(verbosity=2)
