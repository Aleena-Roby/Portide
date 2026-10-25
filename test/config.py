import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Base Directories
TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_DIR.parent
SCREENSHOTS_DIR = TEST_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Application URLs and Credentials
BASE_URL = os.environ.get("PORTIDE_URL", "https://portide.vercel.app")
ADMIN_EMAIL = os.environ.get("PORTIDE_ADMIN_EMAIL", "aleena302005@gmail.com")
ADMIN_PASSWORD = os.environ.get("PORTIDE_ADMIN_PASSWORD", "Aleena@2005")

DEFAULT_TIMEOUT = 20


def get_driver(headless: bool = True) -> webdriver.Chrome:
    """
    Initializes and returns a configured Chrome WebDriver.
    Sets headless mode, window resolution, and robust startup arguments.
    """
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--remote-allow-origins=*")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(DEFAULT_TIMEOUT)
    driver.implicitly_wait(4)
    return driver


def capture_screenshot(driver: webdriver.Chrome, name: str) -> str:
    """Captures and saves a full screenshot for audit and test reports."""
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    filepath = SCREENSHOTS_DIR / f"{safe_name}.png"
    driver.save_screenshot(str(filepath))
    return str(filepath)


def clear_session(driver: webdriver.Chrome):
    """Clears localStorage, sessionStorage, and cookies to ensure a fresh session."""
    try:
        driver.get(f"{BASE_URL}/")
        driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
        driver.delete_all_cookies()
    except Exception:
        pass


def login_as_admin(driver: webdriver.Chrome, timeout: int = DEFAULT_TIMEOUT) -> bool:
    """Helper to perform standard login as Port Administrator."""
    clear_session(driver)
    driver.get(f"{BASE_URL}/login")
    wait = WebDriverWait(driver, timeout)

    # Locate inputs
    email_elem = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user@portide.com']"))
    )
    password_elem = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
    )
    submit_btn = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
    )

    email_elem.clear()
    email_elem.send_keys(ADMIN_EMAIL)
    password_elem.clear()
    password_elem.send_keys(ADMIN_PASSWORD)
    submit_btn.click()

    # Wait for admin dashboard URL
    wait.until(EC.url_contains("/admin"))
    time.sleep(1)
    return True


def switch_to_role(driver: webdriver.Chrome, role: str):
    """Sets active role in localStorage session and navigates to the matching root."""
    driver.execute_script(f"""
        const s = JSON.parse(window.localStorage.getItem('portide_user_session') || '{{}}');
        s.role = '{role}';
        window.localStorage.setItem('portide_user_session', JSON.stringify(s));
    """)
    time.sleep(0.5)


def logout_user(driver: webdriver.Chrome):
    """Performs clean sign out via header profile menu or session purge."""
    try:
        profile_btn = WebDriverWait(driver, 4).until(
            EC.element_to_be_clickable((By.XPATH, "//header//button[.//div[contains(@class, 'bg-sky-500')]]"))
        )
        profile_btn.click()
        time.sleep(0.5)
        signout_btn = WebDriverWait(driver, 4).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Sign Out') or contains(., 'Logout')]"))
        )
        signout_btn.click()
        WebDriverWait(driver, 8).until(lambda d: "/login" in d.current_url or d.current_url.rstrip("/").endswith(BASE_URL.rstrip("/")))
    except Exception:
        clear_session(driver)
        driver.get(f"{BASE_URL}/login")
