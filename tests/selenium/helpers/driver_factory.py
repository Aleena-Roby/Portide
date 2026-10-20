import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service


def get_project_root() -> Path:
    """Returns the root directory of the PORTIDE repository."""
    return Path(__file__).resolve().parent.parent.parent.parent


def get_screenshots_dir() -> Path:
    """Returns the screenshots directory path."""
    sc_dir = get_project_root() / "tests" / "selenium" / "screenshots"
    sc_dir.mkdir(parents=True, exist_ok=True)
    return sc_dir


def create_driver(headless: bool = True) -> webdriver.Chrome:
    """Creates and configures a Chrome WebDriver instance."""
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--remote-allow-origins=*")

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(2)
    return driver


def take_screenshot(driver: webdriver.Chrome, test_id: str, status: str) -> str:
    """Captures a screenshot for test evidence and returns the filename."""
    filename = f"{test_id}-{status}.png"
    filepath = get_screenshots_dir() / filename
    driver.save_screenshot(str(filepath))
    return filename
