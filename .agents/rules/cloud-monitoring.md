# Rule: Cloud Infrastructure Monitoring & Self-Healing

## Trigger
Applies when deploying, testing, debugging, or verifying the live platform.

## Monitored Services & Healing Procedures

### 1. Render API (`https://portide-api.onrender.com`)
* **Endpoint Check**: `GET /api/ports/` must return HTTP `200 OK` with port directory data.
* **Deploy Monitoring**: Query `https://api.render.com/v1/services/{SERVICE_ID}/deploys?limit=1`.
* **Common Issue & Fix**:
  * *Render free tier blocks SMTP port 587/465*: Do NOT use raw SMTP sockets. Ensure `GOOGLE_SCRIPT_EMAIL_URL` is configured so emails route via HTTPS port 443.
  * *IPv6 timeout on database*: Ensure `DATABASE_URL` uses the IPv4 pooler (`aws-0-ap-northeast-1.pooler.supabase.com:5432`) rather than direct IPv6 host.

### 2. Vercel Frontend (`https://portide.vercel.app`)
* **Live Check**: Web app loads and Portide logo renders cleanly.
* **Routing Issue & Fix**:
  * If deep links (e.g. `/register`, `/login`, `/dashboard`) return 404 on hard refresh, verify that `vercel.json` contains:
    ```json
    { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
    ```

### 3. Supabase PostgreSQL (`somsgwatpldtmktkzofi`)
* **Connection Routing**: Must connect via IPv4 Transaction Pooler: `aws-0-ap-northeast-1.pooler.supabase.com:5432`.
* **Credential Preservation**: Never alter or delete administrator `aleena302005@gmail.com` with role `port_administrator`.
* **Data Wipe Protocol**: Always use `scratch/wipe_and_reset.py` which truncates operational tables while keeping the primary administrator intact.
