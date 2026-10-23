---
name: db-reset
description: >-
  Wipes all transactional test data (shipping companies, vessels, containers,
  gate passes, audit logs) from Supabase PostgreSQL while preserving the primary
  administrator credentials.
---

# Database Reset & Wipe Skill

Use this skill whenever operational test data must be cleaned for a fresh workflow test.

## Execution

Run the script from the workspace root:

```powershell
python .agents/skills/db-reset/scripts/reset_db.py
```

### Safety Guarantees:
* **Preserves Administrator**:
  * Email: `aleena302005@gmail.com`
  * Password: `Aleena@2005`
  * Role: `port_administrator`
* **Cascades Truncation**: Clears `tbl_shipping_company`, `tbl_registration_request`, `tbl_vessel`, `tbl_container`, `tbl_gate_pass`, `tbl_audit_log`, and all associated relational records.
* **Resets Infrastructure**: Sets berths, yards, and cranes back to `AVAILABLE`.
