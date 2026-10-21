# Authentication & Security Architecture

This document describes the authentication mechanisms, Role-Based Access Control (RBAC), password governance, and security headers implemented in PORTIDE.

---

## 1. Authentication Architecture

PORTIDE uses an authoritative server-side session and header verification model backed by PostgreSQL:

```
[ Frontend SPA (Vite/React) ]
             │
   (HTTPS REST Requests)
   Headers:
   • X-User-Role: <role_code>
   • X-User-Email: <user_email>
   • X-User-Id: <login_id>
             │
             ▼
[ Django Backend API (Render) ]
   • Validates credentials & role status
   • PBKDF2 with SHA-256 password verification
   • Permission classes enforce granular role boundaries
             │
             ▼
[ Supabase PostgreSQL (Tokyo Pooler) ]
   • tbl_login (Master credentials & activation status)
   • tbl_user (Profile & department links)
   • tbl_audit_log (Immutable audit trail)
```

---

## 2. Role-Based Access Control (RBAC)

PORTIDE defines 6 specialized personas:

| Role Code | Display Name | Permissions & Scope |
| :--- | :--- | :--- |
| `port_administrator` | Port Administrator | System settings, user staff provisioning, company approval/rejection, audit logs |
| `shipping_company` | Shipping Company / Agent | Vessel registration, arrival requests, cargo manifests, gate pass generation |
| `port_operations_officer` | Port Operations Officer | Vessel arrival approval, berth scheduling, quay crane allocation |
| `customs_officer` | Customs Officer | Import/export manifest review, physical inspections, clearance & holds |
| `terminal_logistics_operator`| Terminal & Logistics Operator | Container yard slot allocation, relocation, crane loading/unloading |
| `gate_truck_officer` | Gate & Truck Security Officer | QR code verification, RFID truck/driver check, gate release authorization |

---

## 3. Password Governance & Hashing

1. **Hashing Standard**: Django's default `PBKDF2PasswordHasher` with `SHA-256` iterations. Passwords are never stored in plain text.
2. **Staff Provisioning**: When the administrator creates an internal staff account, a temporary password is generated. The account is flagged with `user_must_change_password = True`.
3. **Mandatory First Login**: Accounts with `must_change_password = True` are intercepted on login and forced to set a compliant password before accessing operational dashboards.

---

## 4. Shipping Company Registration Flow

1. **Submission**: Public applicants submit company credentials, license number, and authorization documents at `/register`.
2. **Double-Submit Prevention**: The frontend locks the submit button (`isSubmitting = true`) and displays a loading spinner to prevent concurrent submissions.
3. **Async Email Delivery**: A confirmation email with assigned tracking reference `REG-2026-XXX` is dispatched asynchronously via Google Apps Script HTTPS relay over port 443.
4. **Approval**: Upon Administrator approval, the account status transitions to `ACTIVE`, and an instant notification is sent with login instructions.
