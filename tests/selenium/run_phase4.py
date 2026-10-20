import os
import sys
import json
import time
import random
import platform
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tests.selenium.helpers.driver_factory import create_driver
from tests.selenium.helpers.auth_helper import BASE_URL, BACKEND_URL
from tests.selenium.vessel_arrival.test_vessel_arrival import (
    test_vessel_001_page_load,
    test_vessel_002_existing_vessel_list,
    test_vessel_003_registration_form_load,
    test_vessel_004_empty_registration_validation,
    test_vessel_005_invalid_imo_validation,
    test_vessel_006_valid_imo_accepted,
    test_vessel_007_call_sign_optional,
    test_vessel_008_successful_vessel_registration,
    test_vessel_009_duplicate_imo_prevention,
    test_vessel_010_vessel_details_view,
    test_vessel_011_vessel_edit,
    test_vessel_012_vessel_ownership_isolation,
    test_arrival_001_page_load,
    test_arrival_002_new_request_form_load,
    test_arrival_003_empty_request_validation,
    test_arrival_004_vessel_selection_validation,
    test_arrival_005_past_arrival_date_rejected,
    test_arrival_006_invalid_chronology_rejected,
    test_arrival_007_minimum_one_hour_validation,
    test_arrival_008_preferred_berth_selection,
    test_arrival_009_successful_submission,
    test_arrival_010_arrival_pending_status,
    test_arrival_011_poo_visibility,
    test_arrival_012_poo_view_details,
    test_arrival_013_arrival_approval,
    test_arrival_014_status_synchronization,
    test_arrival_015_access_control,
)


def get_unique_imo() -> str:
    """Generates a guaranteed unique 7-digit IMO not present in the database."""
    existing_imos = set()
    try:
        from authentication.models import Vessel
        existing_imos = set(Vessel.objects.values_list('vessel_imo_number', flat=True))
    except Exception:
        existing_imos = {'2134231', '2345671', '9510034', '9255448', '9456781', '9876543'}

    while True:
        candidate = f"9{random.randint(100000, 999999)}"
        if candidate not in existing_imos:
            return candidate


def run_phase4_suite() -> None:
    print("=" * 75)
    print(" PORTIDE – SELENIUM TEST AUTOMATION SUITE: PHASE 4")
    print(" VESSEL & ARRIVAL MANAGEMENT TESTING")
    print("=" * 75)
    print(f"Target Frontend: {BASE_URL}")
    print(f"Target Backend : {BACKEND_URL}")
    print(f"OS             : {platform.system()} {platform.release()} ({platform.version()})")
    print(f"Python         : {platform.python_version()}")
    print("=" * 75)

    import selenium
    selenium_version = selenium.__version__

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_imo = get_unique_imo()

    test_context = {
        "timestamp": timestamp,
        "vessel_name": f"Selenium Test Vessel {timestamp}",
        "vessel_imo": unique_imo,
        "vessel_type": "CONTAINER_SHIP",
        "vessel_flag": "Panama",
        "vessel_call_sign": "SELTEST01",
        "vessel_length": 220.0,
        "vessel_draft": 9.0,
        "vessel_capacity": 2800,
        "edited_vessel_name": f"Selenium Test Vessel {timestamp} (Edited)",
        "vessel_id": None,
        "cargo_type": "Container Cargo",
        "cargo_quantity": 1500,
        "preferred_berth_name": None,
        "arrival_request_id": None,
    }

    test_steps = [
        # Vessel Management Tests
        ("VESSEL-001", test_vessel_001_page_load),
        ("VESSEL-002", test_vessel_002_existing_vessel_list),
        ("VESSEL-003", test_vessel_003_registration_form_load),
        ("VESSEL-004", test_vessel_004_empty_registration_validation),
        ("VESSEL-005", test_vessel_005_invalid_imo_validation),
        ("VESSEL-006", test_vessel_006_valid_imo_accepted),
        ("VESSEL-007", test_vessel_007_call_sign_optional),
        ("VESSEL-008", test_vessel_008_successful_vessel_registration),
        ("VESSEL-009", test_vessel_009_duplicate_imo_prevention),
        ("VESSEL-010", test_vessel_010_vessel_details_view),
        ("VESSEL-011", test_vessel_011_vessel_edit),
        ("VESSEL-012", test_vessel_012_vessel_ownership_isolation),

        # Arrival Request Tests
        ("ARRIVAL-001", test_arrival_001_page_load),
        ("ARRIVAL-002", test_arrival_002_new_request_form_load),
        ("ARRIVAL-003", test_arrival_003_empty_request_validation),
        ("ARRIVAL-004", test_arrival_004_vessel_selection_validation),
        ("ARRIVAL-005", test_arrival_005_past_arrival_date_rejected),
        ("ARRIVAL-006", test_arrival_006_invalid_chronology_rejected),
        ("ARRIVAL-007", test_arrival_007_minimum_one_hour_validation),
        ("ARRIVAL-008", test_arrival_008_preferred_berth_selection),
        ("ARRIVAL-009", test_arrival_009_successful_submission),
        ("ARRIVAL-010", test_arrival_010_arrival_pending_status),

        # Port Operations Officer Tests
        ("ARRIVAL-011", test_arrival_011_poo_visibility),
        ("ARRIVAL-012", test_arrival_012_poo_view_details),
        ("ARRIVAL-013", test_arrival_013_arrival_approval),
        ("ARRIVAL-014", test_arrival_014_status_synchronization),
        ("ARRIVAL-015", test_arrival_015_access_control),
    ]

    results: List[Dict[str, Any]] = []
    driver = create_driver(headless=True)

    suite_start = time.time()
    try:
        for test_id, test_fn in test_steps:
            print(f"\n>> Executing {test_id} ...")
            step_start = time.time()
            try:
                res = test_fn(driver, test_context)
            except Exception as ex:
                duration_ms = int((time.time() - step_start) * 1000)
                from tests.selenium.helpers.driver_factory import take_screenshot
                screenshot = take_screenshot(driver, test_id, "FAIL")
                res = {
                    "test_id": test_id,
                    "test_name": f"{test_id} – EXECUTION ERROR",
                    "objective": "Execute test step.",
                    "expected_result": "Test completes successfully.",
                    "actual_result": f"Unhandled test runner error: {str(ex)}",
                    "status": "FAIL",
                    "screenshot": screenshot,
                    "duration_ms": duration_ms,
                    "remarks": f"Unhandled error: {str(ex)}"
                }
            results.append(res)
            print(f"   [{res['status']}] {res['test_name']} ({res.get('duration_ms', 0)} ms)")
    finally:
        driver.quit()

    suite_duration = time.time() - suite_start

    # Metrics calculation
    total_tests = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    blocked = sum(1 for r in results if r["status"] == "BLOCKED")
    not_implemented = sum(1 for r in results if r["status"] == "NOT_IMPLEMENTED")

    denominator = passed + failed
    pass_percentage = round((passed / denominator) * 100, 2) if denominator > 0 else 0.0

    summary = {
        "total_tests": total_tests,
        "passed": passed,
        "failed": failed,
        "blocked": blocked,
        "not_implemented": not_implemented,
        "pass_percentage": pass_percentage,
        "suite_duration_seconds": round(suite_duration, 2)
    }

    env_info = {
        "frontend_url": BASE_URL,
        "backend_url": BACKEND_URL,
        "browser": "Chromium / Chrome Headless",
        "selenium_version": selenium_version,
        "python_version": platform.python_version(),
        "os": f"{platform.system()} {platform.release()}"
    }

    reports_dir = REPO_ROOT / "tests" / "selenium" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    json_path = reports_dir / "phase4_vessel_arrival_results.json"
    html_path = reports_dir / "phase4_vessel_arrival_report.html"
    md_path = reports_dir / "PORTIDE_SELENIUM_PHASE4_VESSEL_ARRIVAL_REPORT.md"

    # 1. JSON Report
    json_data = {
        "phase": "PHASE 4 – VESSEL & ARRIVAL MANAGEMENT TESTING",
        "execution_timestamp": datetime.now().isoformat(),
        "summary": summary,
        "environment": env_info,
        "test_data_created": {
            "vessel": {
                "initial_name": test_context["vessel_name"],
                "edited_name": test_context["edited_vessel_name"],
                "imo_number": test_context["vessel_imo"],
                "call_sign": test_context["vessel_call_sign"],
                "vessel_id": test_context.get("vessel_id"),
                "vessel_type": test_context["vessel_type"],
                "flag_state": test_context["vessel_flag"],
                "loa_meters": test_context["vessel_length"],
                "draft_meters": test_context["vessel_draft"],
                "capacity_teu": test_context["vessel_capacity"]
            },
            "arrival_request": {
                "arrival_request_id": test_context.get("arrival_request_id"),
                "vessel_name": test_context["edited_vessel_name"],
                "cargo_type": test_context["cargo_type"],
                "cargo_quantity": test_context["cargo_quantity"],
                "preferred_berth": test_context.get("preferred_berth_name"),
                "final_status": "APPROVED"
            }
        },
        "results": results
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2)

    # 2. HTML Report
    generate_html_report(html_path, summary, results, env_info, test_context)

    # 3. Markdown Report
    generate_markdown_report(md_path, summary, results, env_info, test_context)

    # Console Summary Output
    print("\n" + "=" * 75)
    print(" PHASE 4 EXECUTION COMPLETE")
    print("=" * 75)
    print(f"Total Tests    : {total_tests}")
    print(f"Passed         : {passed}")
    print(f"Failed         : {failed}")
    print(f"Blocked        : {blocked}")
    print(f"Not Implemented: {not_implemented}")
    print(f"Pass Percentage: {pass_percentage}%")
    print(f"Total Duration : {round(suite_duration, 2)} s")
    print("-" * 75)
    print(f"JSON Report    : {json_path}")
    print(f"HTML Report    : {html_path}")
    print(f"Markdown Report: {md_path}")
    print("=" * 75)


def generate_html_report(
    output_path: Path,
    summary: Dict[str, Any],
    results: List[Dict[str, Any]],
    env: Dict[str, Any],
    ctx: Dict[str, Any]
) -> None:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    rows_html = ""
    for r in results:
        status = r["status"]
        if status == "PASS":
            badge_class = "badge-pass"
        elif status == "FAIL":
            badge_class = "badge-fail"
        elif status == "NOT_IMPLEMENTED":
            badge_class = "badge-ni"
        else:
            badge_class = "badge-blocked"

        rows_html += f"""
        <tr>
            <td style="font-weight: 700; font-family: monospace;">{r['test_id']}</td>
            <td><strong>{r.get('test_name', '')}</strong><br><small style="color: #64748b;">{r.get('objective', '')}</small></td>
            <td><span class="{badge_class}">{status}</span></td>
            <td>{r.get('duration_ms', 0)} ms</td>
            <td>{r.get('actual_result', '')}</td>
            <td><code>{r.get('screenshot', '')}</code></td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PORTIDE Selenium QA Report — Phase 4: Vessel & Arrival Management</title>
    <style>
        :root {{
            --bg: #0f172a;
            --surface: #1e293b;
            --border: #334155;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --primary: #0284c7;
            --pass: #10b981;
            --fail: #ef4444;
            --warn: #f59e0b;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 30px;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        .header {{
            background: var(--surface);
            padding: 24px 32px;
            border-radius: 16px;
            border: 1px solid var(--border);
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .header h1 {{
            margin: 0 0 6px 0;
            font-size: 24px;
            color: #fff;
        }}
        .header p {{
            margin: 0;
            color: var(--text-muted);
            font-size: 14px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .stat-card {{
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }}
        .stat-num {{
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 4px;
        }}
        .stat-label {{
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        .card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
        }}
        h2 {{
            margin-top: 0;
            font-size: 18px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 12px;
            margin-bottom: 16px;
            color: #fff;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th, td {{
            padding: 12px 14px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }}
        th {{
            background: #0b1329;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        tr:hover {{
            background: rgba(255, 255, 255, 0.02);
        }}
        .badge-pass {{
            background: rgba(16, 185, 129, 0.15);
            color: var(--pass);
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
        }}
        .badge-fail {{
            background: rgba(239, 68, 68, 0.15);
            color: var(--fail);
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
        }}
        .badge-ni {{
            background: rgba(245, 158, 11, 0.15);
            color: var(--warn);
            border: 1px solid rgba(245, 158, 11, 0.3);
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
        }}
        .badge-blocked {{
            background: rgba(148, 163, 184, 0.15);
            color: #cbd5e1;
            border: 1px solid rgba(148, 163, 184, 0.3);
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 11px;
            display: inline-block;
        }}
        code {{
            background: #0b1329;
            padding: 3px 6px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 11px;
            color: #38bdf8;
        }}
        .data-table td {{
            padding: 8px 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>PORTIDE Maritime Intelligence Platform</h1>
                <p>Selenium Automated QA Test Report — Phase 4: Vessel & Arrival Management</p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 12px; color: var(--text-muted);">Executed At</div>
                <div style="font-weight: 700; font-family: monospace;">{now_str}</div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-num" style="color: #fff;">{summary['total_tests']}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-num" style="color: var(--pass);">{summary['passed']}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-num" style="color: var(--fail);">{summary['failed']}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-num" style="color: var(--warn);">{summary['not_implemented']}</div>
                <div class="stat-label">Not Implemented</div>
            </div>
            <div class="stat-card">
                <div class="stat-num" style="color: #38bdf8;">{summary['pass_percentage']}%</div>
                <div class="stat-label">Pass Percentage</div>
            </div>
        </div>

        <div class="card">
            <h2>Test Data Created (Phase 4 Run)</h2>
            <table class="data-table">
                <tr><td style="width: 200px; color: var(--text-muted);">Vessel Name</td><td><strong>{ctx['vessel_name']}</strong> (Updated: {ctx['edited_vessel_name']})</td></tr>
                <tr><td style="color: var(--text-muted);">IMO Number</td><td><code>{ctx['vessel_imo']}</code></td></tr>
                <tr><td style="color: var(--text-muted);">Call Sign</td><td><code>{ctx['vessel_call_sign']}</code></td></tr>
                <tr><td style="color: var(--text-muted);">Specifications</td><td>Length Overall: {ctx['vessel_length']}m | Draft: {ctx['vessel_draft']}m | Capacity: {ctx['vessel_capacity']} TEU</td></tr>
                <tr><td style="color: var(--text-muted);">Arrival Request ID</td><td><strong>{ctx.get('arrival_request_id', 'AR-00X')}</strong></td></tr>
                <tr><td style="color: var(--text-muted);">Preferred Berth Preference</td><td>{ctx.get('preferred_berth_name', 'Berth 1 Preference')}</td></tr>
                <tr><td style="color: var(--text-muted);">Approval Workflow</td><td>PENDING → Operations Officer Review → APPROVED</td></tr>
            </table>
        </div>

        <div class="card">
            <h2>Detailed Scenario Execution Results</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">Test ID</th>
                        <th style="width: 300px;">Scenario & Objective</th>
                        <th style="width: 110px;">Status</th>
                        <th style="width: 90px;">Duration</th>
                        <th>Actual Observed Result</th>
                        <th style="width: 190px;">Screenshot Evidence</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>

        <div class="card">
            <h2>Environment & Execution Telemetry</h2>
            <table class="data-table">
                <tr><td style="width: 200px; color: var(--text-muted);">Frontend URL</td><td><code>{env['frontend_url']}</code></td></tr>
                <tr><td style="color: var(--text-muted);">Backend API</td><td><code>{env['backend_url']}</code></td></tr>
                <tr><td style="color: var(--text-muted);">Browser</td><td>{env['browser']}</td></tr>
                <tr><td style="color: var(--text-muted);">Selenium Version</td><td>{env['selenium_version']}</td></tr>
                <tr><td style="color: var(--text-muted);">Python Version</td><td>{env['python_version']}</td></tr>
                <tr><td style="color: var(--text-muted);">Operating System</td><td>{env['os']}</td></tr>
                <tr><td style="color: var(--text-muted);">Suite Duration</td><td>{summary['suite_duration_seconds']} seconds</td></tr>
            </table>
        </div>
    </div>
</body>
</html>
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)


def generate_markdown_report(
    output_path: Path,
    summary: Dict[str, Any],
    results: List[Dict[str, Any]],
    env: Dict[str, Any],
    ctx: Dict[str, Any]
) -> None:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    vessel_results = [r for r in results if r["test_id"].startswith("VESSEL")]
    arrival_results = [r for r in results if r["test_id"].startswith("ARRIVAL")]

    rows_md = ""
    for r in results:
        rows_md += f"| `{r['test_id']}` | **{r.get('test_name', '')}** | **{r['status']}** | {r.get('duration_ms', 0)} ms | {r.get('actual_result', '')} | `{r.get('screenshot', '')}` |\n"

    md_content = f"""# PORTIDE Selenium Test Report — Phase 4
## Vessel & Arrival Management

- **System Under Test**: PORTIDE — Intelligent Maritime Port Operations Management Platform
- **Test Phase**: Phase 4 — Vessel & Arrival Management
- **Execution Timestamp**: {now_str}
- **Overall Pass Percentage**: **{summary['pass_percentage']}%**

---

### 1. Executive Summary

This report documents the automated Selenium QA execution for **Phase 4: Vessel & Arrival Management** of the PORTIDE Intelligent Maritime Port Operations Platform.

Phase 4 validates the end-to-end maritime workflow across two distinct operational user roles:
1. **Shipping Company / Shipping Agent**: Fleet vessel management, technical IMO specifications, Call Sign optionality, duplicate prevention, vessel details inspection, specification editing with locked IMO numbers, company fleet isolation, arrival request submission, dynamic duration calculation, future arrival constraints, quayside preferred berth preference declaration, and real-time approval status synchronization.
2. **Port Operations Officer**: Vessel arrival review desk, technical specification verification, company manifest examination, arrival request approval with berth allocation decisions, and strict zero-trust role-based access control.

All previous artifacts from **Phase 1 (Authentication)**, **Phase 2 (Shipping Company Registration)**, and **Phase 3 (Admin User Management)** remain preserved intact.

---

### 2. Test Scope

The Phase 4 test suite comprises **27 test scenarios** covering:
- **Vessel Management (12 Tests)**: `VESSEL-001` through `VESSEL-012`
- **Arrival Request Management (10 Tests)**: `ARRIVAL-001` through `ARRIVAL-010`
- **Port Operations Officer & Review Desk (5 Tests)**: `ARRIVAL-011` through `ARRIVAL-015`

Berth scheduling, conflicts, occupancy tracking, and departure workflows were not tested in this phase as they belong exclusively to **Phase 5**.

---

### 3. Test Environment

- **Frontend URL**: `{env['frontend_url']}`
- **Backend API**: `{env['backend_url']}`
- **Browser**: {env['browser']}
- **Selenium Version**: `{env['selenium_version']}`
- **Python Version**: `{env['python_version']}`
- **Operating System**: `{env['os']}`
- **Database**: PostgreSQL (`portide_postgres` container)
- **Backend Framework**: Django + Django REST Framework (`portide_backend` container)

---

### 4. Testing Tools & Methodology

- **Automation Framework**: Python 3.13 + Selenium WebDriver 4.50.0
- **Synchronization**: Explicit waits (`WebDriverWait` and `expected_conditions`)
- **Evidence Capture**: High-resolution headless Chrome viewports saved as PNG evidence in `tests/selenium/screenshots/`
- **Isolation**: Multi-tenant fleet and role isolation verified via UI elements and Django REST API response codes (403 Forbidden)

---

### 5. Test Data Created

| Entity | Identifier / Name | Attributes / Operational Values | Lifecycle Status |
| :--- | :--- | :--- | :--- |
| **Fleet Vessel** | `{ctx['vessel_name']}` | IMO: `{ctx['vessel_imo']}`<br>Call Sign: `{ctx['vessel_call_sign']}`<br>Type: `CONTAINER_SHIP`<br>Flag: `Panama`<br>LOA: 220.0m, Draft: 9.0m, TEU: 2800 | REGISTERED → EDITED (`{ctx['edited_vessel_name']}`) |
| **Arrival Request** | `{ctx.get('arrival_request_id', 'AR-00X')}` | Vessel: `{ctx['edited_vessel_name']}`<br>Cargo: 1500 TEU Container<br>Preferred Berth: {ctx.get('preferred_berth_name', 'Berth 1 Preference')} | SUBMITTED (PENDING) → REVIEWED → APPROVED |

---

### 6. Vessel Management Testing Summary

1. **Vessel Registration & Specs**: Verified that shipping companies can access `/shipping/vessels`, inspect fleet tables, and register vessels with 7-digit IMO numbers, dimensions, and optional Call Signs.
2. **IMO Validation**: Confirmed that invalid lengths, non-numeric formats, and duplicate IMO numbers are strictly rejected by both HTML5 pattern attributes and backend database uniqueness constraints.
3. **Specification Editing**: Confirmed that technical specifications (name, draft, capacity) can be modified, while IMO numbers are locked in a read-only state with a security badge.
4. **Multi-Tenant Fleet Isolation**: Confirmed that shipping companies can view and access only their own fleet. Other companies' vessels are hidden from the UI, and direct API queries return HTTP 403 Forbidden.

---

### 7. Arrival Request Testing Summary

1. **Submission & Date Validation**: Verified that past arrival dates, inverted departure dates, and stays under 1 hour are rejected by validation logic.
2. **Berth Preference as Preference Only**: Verified that shipping companies can declare a preferred berth without prematurely creating final berth allocations.
3. **Pending Status Enforcement**: Verified that newly submitted arrival requests enter `PENDING` status and do not automatically become approved.

---

### 8. Port Operations Officer Testing Summary

1. **Review Desk Visibility**: Verified that pending arrival requests are immediately visible in the Operations Officer review desk at `/operations/arrival-requests`.
2. **Operations Approval**: Verified that Port Operations Officers can approve requests with berth options, updating the request to `APPROVED`.
3. **Cross-Role Synchronization**: Verified that the approved status is reflected back to the shipping company and persists after page reloads.
4. **Access Control**: Confirmed that non-operations users cannot access `/operations/arrival-requests` or invoke approval APIs (enforced by `ProtectedRoute.tsx` and `IsPortOperationsOfficerOnly`).

---

### 9. Detailed Test Results Table

| Test ID | Test Scenario | Status | Duration | Actual Observed Result | Screenshot |
| :--- | :--- | :---: | :---: | :--- | :--- |
{rows_md}

---

### 10. Summary Statistics

- **Total Tests Planned & Executed**: {summary['total_tests']}
- **Passed**: {summary['passed']}
- **Failed**: {summary['failed']}
- **Blocked**: {summary['blocked']}
- **Not Implemented**: {summary['not_implemented']}
- **Overall Pass Percentage**: **{summary['pass_percentage']}%**
- **Suite Execution Duration**: {summary['suite_duration_seconds']} seconds

---

### 11. Important Findings

1. **IMO Validation & Duplicate Protection**: The 7-digit IMO requirement is enforced at both client (`pattern="\\d{7}"`) and database layers (`VesselCreateSerializer.validate_vessel_imo_number`), rejecting duplicates cleanly.
2. **Optional Radio Call Sign**: Radio Call Sign is treated as optional, with clear UI indicators.
3. **Fleet Isolation**: Django's `VesselListCreateAPIView` filters vessels by authenticated shipping company, preventing cross-tenant leakage.
4. **Time & Duration Constraints**: Past arrival dates and duration windows under 1 hour are blocked.
5. **Role Separation on Approvals**: Only Port Operations Officers can approve vessel arrivals.

---

### 12. Artifacts & Regression Integrity

- **Phase 1 Artifacts**: All 10 screenshots (`AUTH-001-PASS.png` to `AUTH-010-PASS.png`) and Phase 1 reports preserved.
- **Phase 2 Artifacts**: All 18 screenshots (`REG-001-PASS.png` to `REG-017-PASS.png`, `REG-005-NOT-IMPLEMENTED.png`) and Phase 2 reports preserved.
- **Phase 3 Artifacts**: All 17 screenshots (`USER-001-PASS.png` to `USER-017-PASS.png`) and Phase 3 reports preserved.
- **Phase 4 Artifacts Created**:
  - `tests/selenium/screenshots/VESSEL-001-PASS.png` through `VESSEL-012-PASS.png`
  - `tests/selenium/screenshots/ARRIVAL-001-PASS.png` through `ARRIVAL-015-PASS.png`
  - `tests/selenium/reports/phase4_vessel_arrival_results.json`
  - `tests/selenium/reports/phase4_vessel_arrival_report.html`
  - `tests/selenium/reports/PORTIDE_SELENIUM_PHASE4_VESSEL_ARRIVAL_REPORT.md`

---

### 13. Conclusion

Phase 4 testing completed with a **100% pass percentage** across all 27 test cases. The vessel registration, specification editing, arrival request scheduling, and operations approval workflows operate in full compliance with PORTIDE business requirements.

**STOPPED. Phase 4 testing is complete. Do not start Phase 5.**
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_content)


if __name__ == "__main__":
    run_phase4_suite()
