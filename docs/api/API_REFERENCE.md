# PORTIDE REST API Reference

Base Production URL: `https://portide-api.onrender.com`
Base Local URL: `http://localhost:8000`

All API endpoints accept and return `application/json` unless handling multipart document uploads.

---

## 1. Authentication & Session Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login/` | Authenticate user with email and password | Public |
| `POST` | `/api/auth/logout/` | Sign out and invalidate session | Yes |
| `GET` | `/api/auth/me/` | Fetch authenticated user profile and roles | Yes |
| `POST` | `/api/auth/registration/` | Public registration for shipping companies | Public |
| `GET` | `/api/auth/registration/status/?email=...` | Check status of company application | Public |
| `POST` | `/api/auth/first-login-change-password/` | Mandatory first login password change | Yes |
| `POST` | `/api/auth/change-password/` | Regular user password change | Yes |
| `POST` | `/api/auth/forgot-password/` | Request password reset email | Public |
| `POST` | `/api/auth/reset-password/` | Complete reset with email token | Public |

---

## 2. Port Administration & User Management

| Method | Endpoint | Description | Authorized Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/staff-users/` | List internal port authority staff | Port Administrator |
| `POST` | `/api/admin/staff-users/create/` | Provision new staff account with role | Port Administrator |
| `GET` | `/api/admin/company-approvals/` | List pending company applications | Port Administrator |
| `POST` | `/api/admin/company-approvals/{id}/action/` | Approve or reject company registration | Port Administrator |
| `GET` | `/api/admin/berths/` | List all berths with infrastructure specs | Port Administrator |
| `POST` | `/api/admin/berths/` | Create new quayside berth | Port Administrator |
| `GET` | `/api/settings/port-config/` | Retrieve global port operational parameters | All |
| `PATCH` | `/api/settings/port-config/` | Update port operational parameters | Port Administrator |
| `GET` | `/api/audit-logs/` | Query real-time platform security audit logs | Admin, Customs |

---

## 3. Vessel Fleet & Operations Scheduling

| Method | Endpoint | Description | Authorized Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/vessels/` | List vessels (filtered by company for agents) | All Authenticated |
| `POST` | `/api/vessels/` | Register commercial vessel into fleet | Shipping Company |
| `GET` | `/api/arrival-requests/` | List vessel arrival requests | Shipping, Operations |
| `POST` | `/api/arrival-requests/` | Submit new vessel arrival request | Shipping Company |
| `POST` | `/api/arrival-requests/{id}/approve/` | Approve arrival and assign berth | Port Operations |
| `POST` | `/api/arrival-requests/{id}/reject/` | Reject arrival request with explanation | Port Operations |
| `GET` | `/api/berths/` | Public berth status and operational schedule | All |
| `GET` | `/api/schedules/` | List active vessel berthing schedules | Port Operations |
| `POST` | `/api/schedules/` | Create scheduled berth allocation | Port Operations |
| `POST` | `/api/schedules/{id}/status/` | Update vessel movement status (`ARRIVED`, etc.) | Port Operations |

---

## 4. Customs Inspection & Regulatory Clearance

| Method | Endpoint | Description | Authorized Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customs/containers/` | List containers subject to customs oversight | Customs Officer |
| `POST` | `/api/customs/containers/{id}/start-inspection/` | Place container on inspection hold | Customs Officer |
| `POST` | `/api/customs/containers/{id}/submit-inspection/` | Issue clearance ruling or seizure notice | Customs Officer |
| `GET` | `/api/customs/containers/{id}/documents/` | View uploaded customs documents | Shipping, Customs |
| `POST` | `/api/customs/documents/upload/` | Upload bill of lading or import manifest | Shipping, Customs |
| `POST` | `/api/customs/documents/{id}/review/` | Approve or reject supporting document | Customs Officer |
| `GET` | `/api/customs/decision-history/` | View audit trail of customs rulings | Customs Officer |

---

## 5. Terminal Yard & Crane Operations

| Method | Endpoint | Description | Authorized Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/terminal/yards/` | List terminal yard zones & capacity | Terminal Operator |
| `GET` | `/api/terminal/yards/{id}/` | Drilldown yard blocks and slot occupancy | Terminal Operator |
| `GET` | `/api/terminal/cranes/` | List STS quay cranes & RTG equipment | Terminal Operator |
| `POST` | `/api/terminal/crane-allocations/` | Assign cranes to berthed vessel | Terminal Operator |
| `GET` | `/api/terminal/unloading/eligible-vessels/` | List berthed vessels eligible for discharge | Terminal Operator |
| `GET` | `/api/terminal/unloading/active-cranes/?vessel_schedule_id={id}` | List active cranes for vessel discharge | Terminal Operator |
| `GET` | `/api/terminal/unloading/manifest-containers/?vessel_schedule_id={id}` | List manifested containers awaiting discharge | Terminal Operator |
| `POST` | `/api/terminal/unloading/discharge/` | Atomically discharge container into yard slot | Terminal Operator |
| `GET` | `/api/terminal/unloading/history/` | View vessel discharge history log | Terminal Operator |
| `GET` | `/api/terminal/loading/eligible-vessels/` | List berthed vessels eligible for container loading | Terminal Operator |
| `GET` | `/api/terminal/loading/active-cranes/?vessel_schedule_id={id}` | List active cranes for vessel loading | Terminal Operator |
| `GET` | `/api/terminal/loading/yard-containers/?vessel_schedule_id={id}` | List yard export containers ready for loading | Terminal Operator |
| `POST` | `/api/terminal/loading/load/` | Atomically load container onto vessel & free slot | Terminal Operator |
| `GET` | `/api/terminal/loading/history/` | View vessel loading (stowage) history log | Terminal Operator |
| `POST` | `/api/terminal/direct-transfer/execute/` | Quayside direct vessel-to-truck discharge | Terminal Operator |
| `GET` | `/api/containers/` | Query containers across the terminal | Terminal Operator |
| `POST` | `/api/containers/{id}/status/` | Transition container terminal status | Terminal Operator |
| `GET` | `/api/containers/track/?number={num}` | Public real-time container tracker | Public |

---

## 6. Gate Security & Vehicle Verification

| Method | Endpoint | Description | Authorized Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/gate/passes/` | List generated digital gate passes | Gate Officer |
| `POST` | `/api/gate/passes/generate/` | Generate cryptographic QR gate pass | Gate Officer |
| `POST` | `/api/gate/passes/verify/` | Scan QR code & verify clearance | Gate Officer |
| `POST` | `/api/gate/passes/{id}/release/` | Log departure & release boom barrier | Gate Officer |
| `POST` | `/api/gate/passes/{id}/resend-email/` | Re-dispatch digital pass PDF to driver | Gate Officer |
