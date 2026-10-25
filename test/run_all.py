import os
import sys
import time
import unittest
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from test.config import BASE_URL, ADMIN_EMAIL, SCREENSHOTS_DIR
from test.test_01_authentication import TestAuthentication
from test.test_02_shipping_company import TestShippingCompanyRegistrationAndApproval
from test.test_03_user_management import TestUserManagement
from test.test_04_vessel_arrival import TestVesselArrivalManagement
from test.test_05_berth_scheduling import TestBerthScheduling


def run_all_selenium_tests():
    print("=" * 80)
    print("  PORTIDE MARITIME INTELLIGENCE PLATFORM — SELENIUM TEST AUTOMATION SUITE")
    print("=" * 80)
    print(f" Target Application URL : {BASE_URL}")
    print(f" Port Administrator User: {ADMIN_EMAIL}")
    print(f" Screenshots Directory  : {SCREENSHOTS_DIR}")
    print("=" * 80)
    print(" Testing 5 Core Functionalities:")
    print("   1. Authentication")
    print("   2. Shipping Company Registration & Approval")
    print("   3. User Management")
    print("   4. Vessel Management & Arrival Requests")
    print("   5. Berth Management & Scheduling")
    print("=" * 80)
    print()

    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestAuthentication))
    suite.addTests(loader.loadTestsFromTestCase(TestShippingCompanyRegistrationAndApproval))
    suite.addTests(loader.loadTestsFromTestCase(TestUserManagement))
    suite.addTests(loader.loadTestsFromTestCase(TestVesselArrivalManagement))
    suite.addTests(loader.loadTestsFromTestCase(TestBerthScheduling))

    start_time = time.time()
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    total_time = time.time() - start_time

    print()
    print("=" * 80)
    print("                         TEST EXECUTION SUMMARY")
    print("=" * 80)
    print(f" Tests Executed : {result.testsRun}")
    print(f" Passed         : {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f" Failures       : {len(result.failures)}")
    print(f" Errors         : {len(result.errors)}")
    print(f" Total Duration : {total_time:.2f} seconds")
    print("=" * 80)

    if result.wasSuccessful():
        print("  ALL 5 FUNCTIONALITIES TESTED AND PASSED SUCCESSFULLY!")
        print("=" * 80)
        return 0
    else:
        print("  SOME TESTS REPORTED FAILURES OR ERRORS. CHECK LOGS ABOVE.")
        print("=" * 80)
        return 1


if __name__ == "__main__":
    sys.exit(run_all_selenium_tests())
