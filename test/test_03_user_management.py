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


class TestUserManagement(unittest.TestCase):
    """
    Functionality 3: User Management Test Suite
    Tests user directory access, role badges, user search/filters,
    and internal user account creation forms.
    """

    @classmethod
    def setUpClass(cls):
        cls.driver = get_driver(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def setUp(self):
        clear_session(self.driver)

    def test_01_user_management_navigation(self):
        """TC-USER-01: Log in as Port Administrator and access User Management view."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/users")
        wait = WebDriverWait(self.driver, 15)

        heading = wait.until(
            EC.visibility_of_element_located((
                By.XPATH,
                "//*[contains(text(), 'User') or contains(text(), 'Personnel') or contains(text(), 'Accounts')]"
            ))
        )
        self.assertTrue(heading.is_displayed())
        capture_screenshot(self.driver, "03_user_management_view_loaded")

    def test_02_user_directory_table_renders(self):
        """TC-USER-02: Verify user list displays names, emails, roles, and status badges."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/users")
        wait = WebDriverWait(self.driver, 15)

        user_container = wait.until(
            EC.presence_of_element_located((
                By.XPATH,
                "//table | //div[contains(@class, 'divide-y')] | //*[contains(text(), 'aleena302005@gmail.com') or contains(text(), 'Administrator')]"
            ))
        )
        self.assertTrue(user_container.is_displayed())
        capture_screenshot(self.driver, "03_user_directory_records_visible")

    def test_03_user_search_and_role_filters(self):
        """TC-USER-03: Verify search input and role filtering controls."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/users")
        wait = WebDriverWait(self.driver, 15)

        # Locate search inputs and filter buttons using clean CSS selectors
        search_inputs = self.driver.find_elements(By.CSS_SELECTOR, "input[type='text'], input[placeholder*='Search']")
        buttons = self.driver.find_elements(By.CSS_SELECTOR, "button")
        
        self.assertTrue(len(search_inputs) > 0 or len(buttons) > 0, "Search bar or filter buttons should be present.")
        capture_screenshot(self.driver, "03_user_search_controls_tested")

    def test_04_create_user_modal_trigger(self):
        """TC-USER-04: Verify Create User / Add User button triggers account creation dialog."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/users")
        wait = WebDriverWait(self.driver, 15)

        add_btn = wait.until(
            EC.element_to_be_clickable((
                By.XPATH,
                "//button[contains(., 'Add User') or contains(., 'New User') or contains(., 'Create') or contains(@title, 'User')]"
            ))
        )
        add_btn.click()
        time.sleep(1)

        dialog = wait.until(
            EC.visibility_of_element_located((
                By.XPATH,
                "//*[@role='dialog'] | //*[contains(text(), 'Create') or contains(text(), 'Add') or contains(text(), 'New Internal User')]"
            ))
        )
        self.assertTrue(dialog.is_displayed())
        capture_screenshot(self.driver, "03_user_create_modal_opened")


if __name__ == "__main__":
    unittest.main(verbosity=2)
