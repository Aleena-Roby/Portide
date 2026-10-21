# Supabase PostgreSQL Configuration Guide

This document outlines the setup, network architecture, and security configuration of the managed **Supabase PostgreSQL** database for PORTIDE.

---

## 1. Project Overview & Credentials

* **Project Reference ID**: `somsgwatpldtmktkzofi`
* **Region**: Tokyo (`ap-northeast-1`)
* **PostgreSQL Engine**: 16.x
* **Supabase Project URL**: `https://somsgwatpldtmktkzofi.supabase.co`

### Environment Variables
```ini
# Supabase IPv4 Pooler Connection String (Used by Render & Local Backend)
DATABASE_URL=postgresql://postgres.somsgwatpldtmktkzofi:Aleena%40Roby@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# Supabase API Keys (Used by Frontend)
VITE_SUPABASE_URL=https://somsgwatpldtmktkzofi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 2. Network Routing: IPv4 Connection Pooler

> [!IMPORTANT]
> **Direct vs. Pooler Connection**:
> * **Direct (`db.<ref>.supabase.co:5432`)**: Resolves exclusively to an **IPv6** address. Cloud platforms without IPv6 egress (such as Render free web services) will fail with connection timeout errors.
> * **IPv4 Pooler (`aws-0-<region>.pooler.supabase.com:5432`)**: Provides dedicated IPv4 routing. Always connect using this endpoint with the user format `postgres.<project_ref>`.

---

## 3. Row-Level Security (RLS) & Permissions

All operational tables have RLS enabled with explicit grants:

1. **Table Permissions**:
   * Full `ALL` permissions are granted to `postgres`, `service_role`, and `authenticated` roles.
2. **Public Data Protection**:
   * Direct unauthorized public reads are restricted.
   * Client applications interact through the Django REST API or authenticated Supabase JWT sessions.

---

## 4. Reset & Data Wipe Operations

To wipe transactional test data while preserving the administrator account:

* **Administrator Credentials Preserved**:
  * **Email**: `aleena302005@gmail.com`
  * **Password**: `Aleena@2005`
  * **Role**: `port_administrator`
  * **Status**: `ACTIVE`

* **Clean Wipe Command**:
  ```powershell
  python scratch/wipe_and_reset.py
  ```
  This cascades truncates on all operational tables (`tbl_shipping_company`, `tbl_vessel`, `tbl_cargo`, `tbl_container`, `tbl_gate_pass`, `tbl_audit_log`, etc.) while ensuring the primary administrator user and login remain intact.
