# PORTIDE: Final Project Presentation Slide Deck

**Maritime Port Operations Intelligence Platform**  
*Cloud-Native Operational Intelligence, Vessel Scheduling, Container Tracking & Gate Logistics*

---

## Slide 1: Title Slide
* **Title:** PORTIDE
* **Subtitle:** Intelligent Maritime Port Operations & Logistics Platform
* **Candidate Name:** Aleena Roby
* **Department:** Department of Computer Applications / Computer Science
* **Academic Year:** 2026
* **Live Web Platform:** https://portide.vercel.app/

---

## Slide 2: Introduction & Industry Context
* **The Global Maritime Backbone:**
  * Over 80% of global trade is transported across oceans via commercial shipping.
  * Modern seaports are complex ecosystems involving shipping lines, marine controllers, customs inspectors, terminal operators, and landside truck fleets.
* **The Need for Digitalization:**
  * Seaports require real-time synchronization between waterside vessel traffic and landside cargo movements to avoid costly vessel demurrage and bottlenecks.

---

## Slide 3: Problem Statement
* **Manual Paperwork & Delays:** Reliance on physical documentation causes delays in vessel clearance and customs inspections.
* **Quayside Congestion:** Inefficient berth scheduling leads to vessel waiting times and tidal navigation risks.
* **Lack of Centralized Tracking:** Disconnected databases between shipping lines, port authorities, and terminal yards create blind spots.
* **Gate Bottlenecks:** Manual gate validation of trucks and cargo creates traffic jams at port entry and exit points.

---

## Slide 4: Project Objectives
* **Unified Single-Window Platform:** Provide a single collaborative web portal for all port stakeholders.
* **Collision-Free Berth Scheduling:** Implement automated conflict detection for arriving vessels based on draft and length.
* **Dual-State Container Visibility:** Track container status simultaneously across active physical locations and immutable audit logs.
* **Regulatory Customs Enforcement:** Ensure containers cannot leave the port without mandatory customs clearance.
* **Digital QR Gate Pass System:** Automate truck gate authorization using secure optical QR code verification.

---

## Slide 5: Proposed System Overview
* **PORTIDE** is an enterprise-grade cloud platform designed to streamline seaport operations end-to-end:
  * **Role-Based Workspaces:** Tailored dashboards for Administrators, Shipping Agents, Operations Officers, Customs, and Gate Security.
  * **Digital Workflow Pipeline:** From initial Vessel Notice of Arrival (NOA) to final container truck exit.
  * **Automated Email Notifications:** Transactional updates for carrier approvals and gate pass issuances.
  * **Real-Time Audit Trail:** Every critical action is timestamped and logged for statutory compliance.

---

## Slide 6: System Architecture
* **3-Tier Cloud-Native Architecture:**
  1. **Frontend Presentation Tier:**
     * React.js + TypeScript + Vite Single Page Application (SPA).
     * Hosted on **Vercel** with global edge CDN delivery.
  2. **Backend Application Logic Tier:**
     * Django REST Framework (DRF) + Python Web Service.
     * Hosted on **Render** running Gunicorn WSGI server.
  3. **Data Persistence & Communications Tier:**
     * **Supabase Managed PostgreSQL 16** with IPv4 transaction connection pooling.
     * **Google Apps Script** serverless HTTPS email relay for reliable, zero-cost notification delivery.

---

## Slide 7: User Personas & Role-Based Access Control (RBAC)
* **Port Administrator:** System governance, shipping company approvals, berth master configuration, user directory, and audit monitoring.
* **Shipping Company / Agent:** Vessel profile management, Notice of Arrival (NOA) submissions, and cargo manifests.
* **Port Operations Officer:** Quayside berth scheduling, arrival review, and harbor navigation clearance.
* **Customs Officer:** Cargo manifest inspection, physical examination findings, and customs clearance certification.
* **Terminal Yard Master:** Container yard block allocation, stacking coordinates (Bay-Row-Tier), and discharge logging.
* **Gate Logistics Officer:** Landside truck entry verification, cryptographic QR gate pass issuance, and boom barrier release.

---

## Slide 8: Module 1 — Carrier Registration & Admin Approval
* **Self-Service Carrier Onboarding:**
  * Commercial shipping lines register online by submitting business licenses, corporate details, and authorized representative credentials.
* **Administrative Governance:**
  * Applications enter a secure `PENDING` review queue on the Port Administrator dashboard.
* **Atomic Activation:**
  * Approval executes an atomic multi-table transaction that activates the company, creates user profiles, enables credentials, and dispatches an automated onboarding email.

---

## Slide 9: Module 2 — Vessel Arrival & Berth Scheduling
* **Notice of Arrival (NOA):**
  * Shipping lines declare upcoming voyages, Estimated Time of Arrival (ETA), Estimated Time of Departure (ETD), and vessel dimensions.
* **Interval Overlap Collision-Avoidance Algorithm:**
  * Automatically calculates whether a requested berth is occupied during the desired window:
    $$\text{Conflict} = (\text{Arrival}_{\text{new}} < \text{Departure}_{\text{existing}}) \land (\text{Departure}_{\text{new}} > \text{Arrival}_{\text{existing}})$$
* **Berth Allocation:**
  * Ensures vessel length and draft depth match berth physical limits, transitioning the berth status to `RESERVED`.

---

## Slide 10: Module 3 — Container Tracking & Yard Management
* **Dual-State Pipeline Architecture:**
  * **Active State (`tbl_container`):** Maintains the current operational status (`DISCHARGED`, `YARD_STORED`, `CLEARED`, `GATE_OUT`).
  * **Immutable Ledger (`tbl_container_tracking_event`):** Append-only audit history of every container touchpoint with timestamp, user ID, and GPS/terminal location.
* **Precise Stacking Coordinates:**
  * Containers are assigned structured 3D storage coordinates: **Bay — Row — Tier** within designated yard blocks.

---

## Slide 11: Module 4 — Customs Inspection & Compliance
* **Regulatory Clearance Prerequisite:**
  * No cargo can exit the seaport without formal customs clearance.
* **Inspection Protocol:**
  * Customs officers review cargo declarations against bill of lading documents.
  * Containers can be marked with `CUSTOMS_HOLD` or `CLEARED`.
* **Security Guardrail:**
  * The backend strictly blocks gate pass generation if any container lacks an authorized `CLEARED` inspection record.

---

## Slide 12: Module 5 — Digital QR Gate Pass & Landside Logistics
* **Cryptographic QR Code Pass:**
  * Generates a unique, tamper-proof gate pass (`GP-YYYY-XXXXX`) containing an encrypted verification token (`VREF-...`).
* **Automated Dispatch:**
  * Dispatches the digital pass directly to the transport company and registered driver's mobile email.
* **Optical Gate Verification:**
  * Security officers scan the QR code at port exit barriers.
  * Validates truck plate, driver ID, and container number before triggering barrier release and logging gate out.

---

## Slide 13: Database Design Highlights
* **24 Normalized Relational Tables:**
  * Full third-normal form (3NF) relational design hosted on PostgreSQL 16.
* **Core Table Hierarchy:**
  * Authentication: `tbl_login`, `tbl_user`, `tbl_role`, `tbl_department`.
  * Marine Infrastructure: `tbl_port`, `tbl_terminal`, `tbl_berth`, `tbl_vessel`, `tbl_vessel_schedule`.
  * Cargo & Yard: `tbl_cargo_manifest`, `tbl_container`, `tbl_yard_block`, `tbl_yard_slot`.
  * Logistics & Security: `tbl_truck`, `tbl_driver`, `tbl_gate_pass`, `tbl_gate_transaction`, `tbl_audit_log`.

---

## Slide 14: Quality Assurance & Selenium Testing
* **End-to-End Automated Testing:**
  * Comprehensive test suite built using **Selenium WebDriver** and **Pytest**.
* **5 Core Functional Test Suites:**
  1. *Authentication Suite:* Valid/invalid logins, session tokens, and role-based redirects.
  2. *Carrier Onboarding Suite:* Registration form validation and administrator approval flow.
  3. *User Management Suite:* Staff directory, role filtering, and user creation modals.
  4. *Vessel Management Suite:* Fleet registry and Notice of Arrival clearance.
  5. *Berth Allocation Suite:* Quayside layout rendering and collision-free scheduling.
* **Result:** 100% test pass rate across headless Chromium and edge browsers.

---

## Slide 15: Cloud Deployment & DevOps
* **Production URLs:**
  * **Frontend (Vercel):** `https://portide.vercel.app`
  * **Backend API (Render):** `https://portide-api.onrender.com`
  * **Database (Supabase):** Tokyo Region (`ap-northeast-1`)
* **CI/CD Automation:**
  * Pushing commits to GitHub `main` branch automatically triggers zero-downtime rolling builds on both Vercel and Render.
* **Cross-Origin Security:**
  * Strict CORS origin validation ensuring only authorized frontend domain requests reach the backend REST API.

---

## Slide 16: Live System Access & QR Code
* **Scan to Visit Live Web Application:**
  * Open mobile camera or QR scanner to inspect the live hosted platform at `https://portide.vercel.app/`.
* **Desktop / Mobile Responsive:**
  * Fully responsive user interface designed for both high-resolution operations center monitors and handheld logistics tablets.

---

## Slide 17: Key Advantages & Impact
* **Efficiency:** Eliminates physical paperwork and accelerates vessel turnaround time.
* **Safety & Accuracy:** Algorithmic berth scheduling prevents quayside allocation conflicts.
* **Compliance & Security:** Guarantees zero containers leave without customs clearance.
* **Traceability:** Complete immutable audit logs for maritime customs and port authority governance.

---

## Slide 18: Conclusion & Future Scope
* **Conclusion:**
  * PORTIDE successfully centralizes complex maritime logistics into a single, high-performance, cloud-native intelligence platform.
* **Future Enhancements:**
  * Automated AIS (Automatic Identification System) live satellite vessel GPS tracking.
  * AI-powered predictive container yard stacking optimization.
  * Blockchain integration for international electronic Bill of Lading (eBL) transfer.

---

## Slide 19: Questions & Answers
* **Thank You!**
* **Project Repository:** https://github.com/Aleena-Roby/Portide
* **Live System:** https://portide.vercel.app
* *Open for Questions & Discussion.*
