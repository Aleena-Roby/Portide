# PORTIDE Role-Based Workflows Guide

This guide explains the end-to-end operational workflows for each of the 6 roles supported in the PORTIDE Maritime Port Operations Intelligence Platform.

---

## 1. Port Administrator (`port_administrator`)

* **Staff User Provisioning**:
  * Navigate to **User & Registration** (`/admin/users`).
  * Click **Create Staff User**, enter their full name, email, department, and role.
  * System generates a secure initial password and marks `must_change_password=True`.
* **Shipping Company Onboarding**:
  * Navigate to **Company Approvals** (`/admin/company-approvals`).
  * Review submitted business licenses and company registration certificates.
  * Click **Approve Company** (system generates login credentials and emails the applicant) or **Reject** with feedback.
* **Berth Infrastructure Management**:
  * Navigate to **Berth Management** (`/admin/berths`).
  * Add or modify berths (length, max draft, equipment, maintenance toggles).
* **Master Infrastructure & System Rules**:
  * Navigate to **Master Infrastructure Registry** (`/admin/master-data`).
  * Adjust minimum arrival advance booking days, deepwater channel drafts, auto-clearance thresholds, and gate SLA rules.
* **Real-time Telemetry & Performance Analytics**:
  * Navigate to **Port Telemetry & Analytics** (`/admin/analytics`).
  * Monitor live berth occupancy percentage, active fleet numbers, and yard inventory capacity.

---

## 2. Shipping Company / Agent (`shipping_company`)

* **Fleet Registration**:
  * Navigate to **Vessel Management** (`/shipping/vessels`).
  * Register fleet vessels with IMO number, deadweight tonnage, length, and draft.
* **Vessel Arrival Request**:
  * Navigate to **Arrival Requests** (`/shipping/arrival-requests`).
  * Click **Submit Arrival Request**, specify vessel, ETA, ETD, and preferred berth.
* **Cargo Manifest Upload**:
  * Navigate to **Cargo Registration** (`/shipping/cargo`).
  * Upload electronic bills of lading and container manifest lines.
* **Pre-Arrival Customs Document Submission**:
  * Attach commercial invoices, phytosanitary certificates, and packing lists to containers before arrival.

---

## 3. Port Operations Officer (`port_operations_officer`)

* **Berth Availability Matrix**:
  * Navigate to **Berth Availability** (`/operations/berth-availability`).
  * Visual matrix showing current berth occupancy, dimensions, and active vessels.
* **Reviewing Arrival Requests**:
  * Navigate to **Vessel Arrival Requests** (`/operations/arrival-requests`).
  * Review incoming requests, verify draft clearance against berth depth, and approve.
* **Operational Berthing Scheduling**:
  * Navigate to **Berth & Scheduling** (`/operations/scheduling`).
  * Create official vessel schedules, track operational stages (`SCHEDULED` → `ARRIVED` → `AT_BERTH` → `DEPARTED`).

---

## 4. Customs Authority Officer (`customs_officer`)

* **Manifest Review**:
  * Navigate to **Normal Customs Review** (`/customs/normal-review`) or **Pre-Arrival Review** (`/customs/pre-arrival`).
  * Inspect cargo declarations, verify declared values, and cross-reference documents.
* **Initiating Inspection Holds**:
  * Flag high-risk containers for physical x-ray or manual unstuffing inspection.
* **Issuing Clearance Rulings**:
  * Upon document verification or physical clearance, record approval notes and transition container customs status to `CLEARED`.

---

## 5. Terminal & Logistics Operator (`terminal_operator`)

* **Quayside Vessel Unloading**:
  * Navigate to **Unloading Operations** (`/terminal/unloading-operations`).
  * Confirm container discharge from berthed vessels via active quay cranes.
* **Terminal Yard Stacking (Yard Master & Allocation)**:
  * Navigate to **Yard Master** (`/terminal/yard-master`) and **Yard Allocation** (`/terminal/yard-allocation`).
  * Allocate incoming containers to exact yard zones, blocks, and bay-row-tier slots.
* **Crane Dispatch Management**:
  * Navigate to **Crane Management** (`/terminal/crane-management`).
  * Allocate STS gantry cranes and mobile RTG equipment to scheduled vessel berths.

---

## 6. Gate & Truck Security Officer (`gate_officer`)

* **Container Release Worklist**:
  * Navigate to **Gate Operations** (`/gate/gate-operations`).
  * Filter containers that have achieved both physical availability (`IN_YARD` or `UNLOADED`) AND statutory clearance (`CLEARED`).
* **Digital Gate Pass Issuance**:
  * Generate a QR-encoded Gate Pass linking the cleared container, transport truck plate, and authorized driver.
* **QR Verification Desk & Boom Barrier Release**:
  * Navigate to **QR Verification & Release Desk** (`/gate/release-desk`).
  * Scan driver QR pass with camera or optical reader. System validates cryptographic token, verifies appointment window, and logs physical gate departure.
