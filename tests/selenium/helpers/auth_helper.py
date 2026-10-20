import os
import time
from typing import Optional, Tuple
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get("PORTIDE_FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("PORTIDE_BACKEND_URL", "http://localhost:8000")
ADMIN_EMAIL = os.environ.get("PORTIDE_ADMIN_EMAIL", "admin@portide.com")
ADMIN_PASSWORD = os.environ.get("PORTIDE_ADMIN_PASSWORD", "Test@12345")


def clear_session(driver: webdriver.Chrome) -> None:
    """Clears localStorage, sessionStorage, and browser cookies reliably."""
    try:
        driver.get(f"{BASE_URL}/")
        time.sleep(0.5)
        driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
        driver.delete_all_cookies()
        driver.get(f"{BASE_URL}/")
        time.sleep(0.5)
    except Exception:
        pass


def open_landing_page(driver: webdriver.Chrome, timeout: int = 15) -> bool:
    """Navigates to the PORTIDE root landing page."""
    driver.get(f"{BASE_URL}/")
    wait = WebDriverWait(driver, timeout)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    return True


def open_login_page(driver: webdriver.Chrome, timeout: int = 15) -> Tuple[webdriver.remote.webelement.WebElement, webdriver.remote.webelement.WebElement, webdriver.remote.webelement.WebElement]:
    """Navigates to the Login page and returns (email_field, password_field, submit_button)."""
    driver.get(f"{BASE_URL}/login")
    wait = WebDriverWait(driver, timeout)
    
    # Locate email input
    email_elem = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[placeholder*='user@portide.com']"))
    )
    
    # Locate password input
    password_elem = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']"))
    )
    
    # Locate submit button
    submit_btn = wait.until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']"))
    )
    
    return email_elem, password_elem, submit_btn


def fill_and_submit_login(driver: webdriver.Chrome, email: str, password: str, timeout: int = 10) -> None:
    """Fills the email and password fields and clicks Sign In."""
    wait = WebDriverWait(driver, timeout)
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
    if email:
        email_elem.send_keys(email)

    password_elem.clear()
    if password:
        password_elem.send_keys(password)

    submit_btn.click()


def wait_for_admin_dashboard(driver: webdriver.Chrome, timeout: int = 15) -> bool:
    """Waits for successful Port Administrator dashboard navigation and content load."""
    wait = WebDriverWait(driver, timeout)
    # Check URL contains /admin
    wait.until(EC.url_contains("/admin"))
    # Check header or welcome text
    wait.until(
        EC.visibility_of_element_located((
            By.XPATH, 
            "//*[contains(text(), 'Port Administrator') or contains(text(), 'Welcome, Port Administrator')]"
        ))
    )
    return True


def perform_logout(driver: webdriver.Chrome, timeout: int = 15) -> bool:
    """Finds and clicks the Logout button in the header, then verifies redirection to /login."""
    wait = WebDriverWait(driver, timeout)
    
    # Try finding the direct header Logout button
    logout_buttons = driver.find_elements(By.XPATH, "//button[@title='Logout' or (contains(., 'Logout') and not(ancestor::div[contains(@class, 'lg:hidden')]))]")
    
    clicked = False
    for btn in logout_buttons:
        if btn.is_displayed():
            try:
                btn.click()
                clicked = True
                break
            except Exception:
                continue

    if not clicked:
        # Fallback: try opening user profile menu then clicking logout
        profile_triggers = driver.find_elements(By.XPATH, "//button[contains(@class, 'hover:bg-slate-100')]//div[contains(@class, 'bg-sky-500')]")
        if profile_triggers and profile_triggers[0].is_displayed():
            profile_triggers[0].click()
            time.sleep(0.5)
            dropdown_logout = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Logout') and contains(@class, 'text-rose-600')]"))
            )
            dropdown_logout.click()
            clicked = True

    # Wait for redirection to login
    wait.until(EC.url_contains("/login"))
    return True


def get_stored_session_js(driver: webdriver.Chrome) -> Optional[str]:
    """Retrieves portide_user_session from localStorage via JavaScript."""
    return driver.execute_script("return window.localStorage.getItem('portide_user_session');")
