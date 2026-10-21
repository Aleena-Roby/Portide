# PORTIDE AI Agent Operating Guidelines & Autonomous Protocols

This document defines the core operational standards, automation procedures, safety guardrails, and self-healing protocols for AI agents working within the **PORTIDE (Maritime Port Operations Intelligence Platform)** repository.

---

## 1. Automated Git & Continuous Deployment

Whenever code is updated, bug fixes applied, or new features developed:

1. **Verify Integrity Before Commit**:
   * **Frontend Changes**: Run `npm run build` in `frontend/` to confirm 0 TypeScript / bundling errors.
   * **Backend Changes**: Verify syntax with `python -c "import py_compile; py_compile.compile(...)"` and run relevant Django unit tests.
2. **Push to GitHub Immediately**:
   * Stage, commit with conventional commit format (`feat:`, `fix:`, `refactor:`, `docs:`), and push to `origin/main`:
     ```powershell
     git add .
     git commit -m "fix(module): clear description of update"
     git push origin main
     ```
   * *Note for Windows PowerShell*: Execute commands sequentially or separated by semicolons (do not use `&&` in PowerShell).
3. **Trigger Cloud Builds**:
   * Pushing to `origin/main` automatically triggers Render backend builds (`https://portide-api.onrender.com`) and Vercel frontend deployments (`https://portide.vercel.app`).

---

## 2. Cloud Monitoring & Autonomous Self-Healing

The agent must proactively monitor connected cloud infrastructure and auto-heal errors:

| Service | Target URL / Host | Monitored Metric | Self-Healing Action |
| :--- | :--- | :--- | :--- |
| **Vercel** | `https://portide.vercel.app` | Build status, SPA client-side routing | If 404 on refresh, verify `vercel.json` rewrite rules (`/(.*)` -> `/index.html`). |
| **Render** | `https://portide-api.onrender.com` | API uptime, deployment status (`/deploys`), response latency | If deploy fails, check Render env-vars (`DATABASE_URL`, `DEBUG`, `SECRET_KEY`). If cold start timeout, optimize query or restart. |
| **Supabase** | `aws-0-ap-northeast-1.pooler.supabase.com:5432` | IPv4 pooler connection, RLS policies | If connection error, verify IPv4 pooler endpoint and port `5432` (`aws-0-...` instead of direct IPv6 `db....`). |
| **Email Relay** | Google Apps Script (`AKfycb.../exec`) | HTTPS delivery status over Port 443 | If delivery fails, verify `GOOGLE_SCRIPT_EMAIL_URL` and confirm Web App access is set to "Anyone". |

---

## 3. Code Preservation & Non-Destructive Modularity

1. **Never Break Working Logic**:
   * Do NOT rewrite, overwrite, or delete existing working modules, operational endpoints, or database tables.
   * Maintain full backward compatibility for existing port personas and operational workflows.
2. **Preserve System Credentials**:
   * Never alter or delete the primary Port Administrator credentials:
     * **Email**: `aleena302005@gmail.com`
     * **Password**: `Aleena@2005`
     * **Role**: `port_administrator`
3. **Dual-State Pipeline Integrity**:
   * Container tracking relies on synchronization between `tbl_container` (active state) and `tbl_container_tracking_event` (immutable event log). Never bypass this dual-state relationship.

---

## 4. Code Reusability & DRY Architecture

* **Frontend**:
  * Reuse shared UI primitives (`PortideLogo`, `Modal`, `InternationalPhoneInput`, `PasswordRequirementChecklist`).
  * Use the centralized API client in `frontend/src/services/api.ts` (`apiFetch`, `getStoredSession`).
* **Backend**:
  * Reuse standard audit logging (`create_audit_log` in `authentication.audit_service`).
  * Reuse asynchronous email dispatcher (`send_mail` with Google Apps Script relay in `authentication.email_service`).
  * Reuse role permission classes from `authentication.permissions`.

---

## 5. Concise Quality Documentation

* **Concise & Actionable**: Avoid long-winded, verbose, or redundant text. Provide dense, accurate technical references.
* **Keep `docs/` Updated**: When adding an endpoint, modifying schema, or updating cloud settings, update the respective guide in `docs/` (`api/`, `architecture/`, `deployment/`, `user-guides/`).
