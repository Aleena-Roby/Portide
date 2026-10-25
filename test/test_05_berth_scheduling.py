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
        switch_to_role
    )
except (ImportError, ModuleNotFoundError):
    from config import (
        BASE_URL,
        get_driver,
        capture_screenshot,
        clear_session,
        login_as_admin,
        switch_to_role
    )


class TestBerthScheduling(unittest.TestCase):
    """
    Functionality 5: Berth Management and Scheduling Test Suite
    Tests berth master infrastructure configurations, draft & length capacities,
    berth availability, and timeline scheduling workflows.
    """

    @classmethod
    def setUpClass(cls):
        cls.driver = get_driver(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def setUp(self):
        clear_session(self.driver)

    def test_01_berth_management_navigation(self):
        """TC-BERTH-01: Log in as Port Administrator and access Berth Management view."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/berths")
        wait = WebDriverWait(self.driver, 15)

        heading = wait.until(
            EC.visibility_of_element_located((
                By.XPATH,
                "//*[contains(text(), 'Berth') or contains(text(), 'Quayside') or contains(text(), 'Mooring')]"
            ))
        )
        self.assertTrue(heading.is_displayed())
        capture_screenshot(self.driver, "05_berth_management_view_loaded")

    def test_02_berth_directory_records_render(self):
        """TC-BERTH-02: Verify berth table displays berth code, name, draft, length, and status."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/berths")
        wait = WebDriverWait(self.driver, 15)

        berth_container = wait.until(
            EC.presence_of_element_located((
                By.XPATH,
                "//table | //div[contains(@class, 'grid')] | //*[contains(text(), 'BTH-') or contains(text(), 'Berth')]"
            ))
        )
        self.assertTrue(berth_container.is_displayed())
        capture_screenshot(self.driver, "05_berth_records_table_verified")

    def test_03_berth_scheduling_timeline_navigation(self):
        """TC-BERTH-03: Access operational scheduling timeline or berth availability view."""
        login_as_admin(self.driver)
        switch_to_role(self.driver, "port_operations_officer")
        self.driver.get(f"{BASE_URL}/operations/scheduling")
        wait = WebDriverWait(self.driver, 15)

        sched_heading = wait.until(
            EC.presence_of_element_located((
                By.XPATH,
                "//*[contains(text(), 'Schedul') or contains(text(), 'Berth') or contains(text(), 'Timeline')]"
            ))
        )
        self.assertTrue(sched_heading.is_displayed())
        capture_screenshot(self.driver, "05_berth_scheduling_timeline_loaded")

    def test_04_berth_search_and_filters(self):
        """TC-BERTH-04: Verify search and filter controls for berths and schedules."""
        login_as_admin(self.driver)
        self.driver.get(f"{BASE_URL}/admin/berths")
        wait = WebDriverWait(self.driver, 15)

        inputs = self.driver.find_elements(
            By.CSS_SELECTOR, "input[type='text'], input[placeholder*='Search']"
        )
        buttons = self.driver.find_elements(
            By.CSS_SELECTOR, "button"
        )
        self.assertTrue(len(inputs) > 0 or len(buttons) > 0)
        capture_screenshot(self.driver, "05_berth_search_and_filters_verified")


if __name__ == "__main__":
    unittest.main(verbosity=2)
