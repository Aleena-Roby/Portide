# PORTIDE Platform Documentation

Welcome to the **PORTIDE (Maritime Port Operations Intelligence Platform)** documentation portal. This repository contains the complete architectural blueprints, database schemas, REST API references, deployment procedures, and user guides for the platform.

---

## Documentation Directory Structure

```
docs/
├── README.md                          # Documentation Portal Index (This Document)
├── architecture/
│   ├── SYSTEM_ARCHITECTURE.md         # High-level architecture, RBAC, dual-state pipeline
│   └── DATABASE_SCHEMA.md             # Supabase PostgreSQL relational schema & constraints
├── api/
│   ├── API_REFERENCE.md               # Complete REST API reference across all modules
│   └── AUTHENTICATION_SECURITY.md     # JWT Auth, session cookies, and security policies
├── deployment/
│   ├── DEPLOYMENT_GUIDE.md            # Live cloud deployment (Render API & Vercel Web)
│   └── SUPABASE_SETUP.md              # Supabase PostgreSQL connection, pooling & RLS
├── user-guides/
│   ├── ROLE_BASED_WORKFLOWS.md        # Comprehensive workflows for all 6 port personas
│   └── TESTING_GUIDE.md               # Selenium E2E & Django test suite execution
└── database/
    ├── README.md                      # Backup restoration and SQL database dump notes
    ├── portide_backup.sql             # SQL snapshot backup
    └── portide_backup_before_backend_dockerization.sql
```

---

## Quick Navigation

### 1. Architecture & Design
* **[System Architecture](architecture/SYSTEM_ARCHITECTURE.md)**: Explains the multi-tier client/server design, Vite + React SPA, Django REST API, and Supabase PostgreSQL persistence layer.
* **[Database Schema](architecture/DATABASE_SCHEMA.md)**: Documents tables, relational foreign keys, indexing, and the dual-state container tracking mechanism.

### 2. API Reference & Integration
* **[API Reference](api/API_REFERENCE.md)**: Exhaustive endpoint documentation for Authentication, Vessels, Berths, Cargo, Customs, Gate Passes, Yard Master, and Audit Logs.
* **[Authentication & Security](api/AUTHENTICATION_SECURITY.md)**: Token lifecycles, role-based request headers (`X-User-Role`), and password change enforcement.

### 3. Cloud Deployment & Setup
* **[Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)**: Step-by-step instructions for deploying the backend web service to Render and the frontend to Vercel.
* **[Supabase Setup](deployment/SUPABASE_SETUP.md)**: How to configure the Supabase IPv4 connection pooler (`port 5432`), Row-Level Security (RLS), and schema grants.

### 4. Operational User Guides
* **[Role-Based Workflows](user-guides/ROLE_BASED_WORKFLOWS.md)**: Step-by-step guides for:
  1. Port Administrator
  2. Shipping Company / Shipping Agent
  3. Port Operations Officer
  4. Customs Authority Officer
  5. Terminal & Logistics Operator
  6. Gate & Truck Security Officer
* **[Testing & QA Guide](user-guides/TESTING_GUIDE.md)**: How to run the automated Selenium suite, backend Django tests, and Vite production bundle builds.

### 5. Database Management
* **[Database Backups & Restoration](database/README.md)**: Instructions on restoring database dumps, executing seed scripts, and verifying PostgreSQL integrity.
