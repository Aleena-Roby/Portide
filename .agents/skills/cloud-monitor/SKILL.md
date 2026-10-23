---
name: cloud-monitor
description: >-
  Proactively checks the live health and status of Render API, Vercel frontend,
  Supabase IPv4 database connection, and Google Apps Script email relay.
---

# Cloud Monitor Skill

Use this skill to diagnose cloud infrastructure, verify deployment status, and test external integrations.

## Available Automation Script

Execute the health check script from the workspace root:

```powershell
python .agents/skills/cloud-monitor/scripts/check_all.py
```

### What It Tests:
1. **Render API Backend**: Pings `https://portide-api.onrender.com/api/ports/` to verify HTTP 200 and response latency.
2. **Vercel Frontend**: Pings `https://portide.vercel.app` to verify SPA deployment and asset delivery.
3. **Supabase PostgreSQL**: Tests connection pooler at `aws-0-ap-northeast-1.pooler.supabase.com:5432` and queries row counts.
4. **Google Apps Script Email Relay**: Sends a non-intrusive ping to the Google Apps Script Web App URL over HTTPS port 443.
