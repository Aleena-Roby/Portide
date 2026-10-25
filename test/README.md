# PORTIDE Selenium Automated Testing Suite

This directory contains automated end-to-end browser tests using **Python** and **Selenium WebDriver** for the 5 core functionalities of the **PORTIDE (Maritime Port Operations Intelligence Platform)**:

1. **Authentication** (`test_01_authentication.py`)
2. **Shipping Company Registration & Approval** (`test_02_shipping_company.py`)
3. **User Management** (`test_03_user_management.py`)
4. **Vessel Management & Arrival Requests** (`test_04_vessel_arrival.py`)
5. **Berth Management & Scheduling** (`test_05_berth_scheduling.py`)

---

## Prerequisites

1. **Python 3.10+** (using `backend/venv` or global python).
2. **Google Chrome** or **Microsoft Edge** browser installed.
3. Required Python packages:
   ```powershell
   pip install selenium webdriver-manager
   ```

---

## Directory Structure

```
test/
├── config.py                     # WebDriver initialization, URLs, credentials, and helpers
├── test_01_authentication.py     # Functionality 1: Login, form validation, logout
├── test_02_shipping_company.py   # Functionality 2: Registration portal & admin approvals
├── test_03_user_management.py    # Functionality 3: Staff directory, role filters, user creation
├── test_04_vessel_arrival.py     # Functionality 4: Vessel registry & arrival requests
├── test_05_berth_scheduling.py   # Functionality 5: Berth infrastructure & scheduling
├── run_all.py                    # Master test runner for all 5 functionalities
├── screenshots/                  # Automatically generated visual test evidence
└── README.md                     # Documentation and terminal commands
```

---

## Terminal Commands to Run Tests

### Run All 5 Functionalities Together:
```powershell
backend\venv\Scripts\python.exe test\run_all.py
```

### Run Individual Functionality Test Cases:

1. **Test Functionality 1 (Authentication)**:
   ```powershell
   backend\venv\Scripts\python.exe test\test_01_authentication.py
   ```

2. **Test Functionality 2 (Shipping Company Registration & Approval)**:
   ```powershell
   backend\venv\Scripts\python.exe test\test_02_shipping_company.py
   ```

3. **Test Functionality 3 (User Management)**:
   ```powershell
   backend\venv\Scripts\python.exe test\test_03_user_management.py
   ```

4. **Test Functionality 4 (Vessel Management & Arrival Requests)**:
   ```powershell
   backend\venv\Scripts\python.exe test\test_04_vessel_arrival.py
   ```

5. **Test Functionality 5 (Berth Management & Scheduling)**:
   ```powershell
   backend\venv\Scripts\python.exe test\test_05_berth_scheduling.py
   ```

---

## Configuration Options

You can override the target URL or credentials by setting environment variables in PowerShell before running the tests:

```powershell
# Run against local development server instead of production Vercel
$env:PORTIDE_URL = "http://localhost:5173"
backend\venv\Scripts\python.exe test\run_all.py

# Run against custom credentials
$env:PORTIDE_ADMIN_EMAIL = "aleena302005@gmail.com"
$env:PORTIDE_ADMIN_PASSWORD = "YourPassword"
```
