# PORTIDE Relational Database Schema

## Overview
PORTIDE uses a PostgreSQL 16 relational database hosted on Supabase. All primary entity tables utilize strict foreign key constraints, automatic timestamps, and indexed lookup fields.

---

## Core Entities & Relational Map

### 1. Authentication & Organizations
* **`tbl_login`**: Master authentication records (email, hashed password, role, active status, mandatory password change flag).
* **`tbl_user`**: Internal port authority personnel profile (full name, phone, employee ID, department, login reference).
* **`tbl_shipping_company`**: Commercial fleet operators (company name, registration number, licensing documents, approval status).
* **`tbl_system_setting`**: Global port configuration key-value store (minimum arrival advance days, port timezone, channel draft).

### 2. Vessel Fleet & Scheduling
* **`tbl_vessel`**: Commercial fleet registry (IMO number, name, vessel type, gross tonnage, max draft, carrier shipping company reference).
* **`tbl_berth`**: Quayside infrastructure assets (berth code, max length, max draft, status: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
* **`tbl_vessel_arrival_request`**: Port entry applications submitted by shipping agents (ETA, ETD, preferred berth, cargo manifest summary, status: `PENDING`, `APPROVED`, `REJECTED`).
* **`tbl_vessel_schedule`**: Operational berthing schedules allocated by port operations officers.

### 3. Cargo & Container Logistics
* **`tbl_cargo`**: Cargo consignment declarations linked to approved vessel arrivals.
* **`tbl_container`**: Individual ISO shipping containers (container number, size/type: 20ft/40ft/Reefer, weight, physical status, customs status).
* **`tbl_customs_document`**: Regulatory declarations, bills of lading, and inspection reports uploaded for containers.

### 4. Terminal & Yard Logistics
* **`tbl_yard`**: Terminal yard zones (Yard Code: Yard A, Yard B; capacity, occupied count).
* **`tbl_yard_block`**: Sub-sections of terminal storage yards.
* **`tbl_yard_slot`**: Exact bay-row-tier slot coordinates for stacked containers.
* **`tbl_crane`**: Heavy lifting equipment (STS Quay Cranes, RTG Gantry Cranes, Reach Stackers).
* **`tbl_crane_allocation`**: Assignment of cranes to berthed vessels for loading/unloading operations.

### 5. Gate Security & Vehicle Access
* **`tbl_gate`**: Physical port perimeter gates (Inbound Lane 1, Outbound Lane 2).
* **`tbl_truck`**: Commercial freight transport vehicles (license plate number, transport company).
* **`tbl_driver`**: Authorized transport truck drivers (full name, driver license number, phone).
* **`tbl_gate_pass`**: Cryptographic QR-enabled movement authorizations linking a cleared container, transport truck, driver, and time-bounded appointment window.
* **`tbl_audit_log`**: Immutable chronological security trail recording all user transactions.
