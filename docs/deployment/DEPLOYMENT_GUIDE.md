# PORTIDE Cloud Deployment Guide

This guide details how PORTIDE is hosted in production across **Render** (Django REST API backend), **Vercel** (React Vite frontend), and **Supabase** (Managed PostgreSQL database).

---

## 1. Architecture Map

* **Frontend**: Hosted on Vercel at `https://portide.vercel.app`
* **Backend API**: Hosted on Render as a Python Web Service at `https://portide-api.onrender.com`
* **Database**: Hosted on Supabase (PostgreSQL 16) in the Tokyo region (`ap-northeast-1`)

---

## 2. Render Backend Deployment

### Service Settings
* **Repository**: `https://github.com/Aleena-Roby/Portide`
* **Branch**: `main`
* **Root Directory**: `backend`
* **Environment**: `Python 3`
* **Build Command**:
  ```bash
  pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
  ```
* **Start Command**:
  ```bash
  gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
  ```

### Environment Variables on Render
```ini
PYTHON_VERSION=3.11.9
DEBUG=False
SECRET_KEY=django-insecure-ilu2@_(%iijbz%j!g951u+h=j(l6gnedz^gv55#@fu!k+1qs)&
FRONTEND_URL=https://portide.vercel.app

# Supabase IPv4 Pooler Connection String (Crucial for Render IPv4 compatibility)
DATABASE_URL=postgresql://postgres.somsgwatpldtmktkzofi:Aleena%40Roby@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# Google Apps Script HTTPS Email Relay (Bypasses Render Free Tier Outbound Port 587 Block)
GOOGLE_SCRIPT_EMAIL_URL=https://script.google.com/macros/s/AKfycbzIPSgHMj39fp7_2u5eAnZOMrJ1CN-um_PcoaX-odNSRyvEGNf3nIOkMlCrqRoyJyYN/exec

# Fallback SMTP Credentials (Used during local development)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=portide.system@gmail.com
EMAIL_HOST_PASSWORD=eyrjphdwwpzxjldf
DEFAULT_FROM_EMAIL=portide.system@gmail.com
```

> [!IMPORTANT]
> **Why Google Apps Script Relay is Used in Production**:
> Render's free tier firewall blocks outbound network traffic on standard SMTP ports (`25`, `465`, `587`). To ensure email delivery without requiring paid third-party subscriptions, PORTIDE dispatches emails via an HTTPS POST request over port `443` to a lightweight Google Apps Script Web App. The script invokes native `MailApp.sendEmail()` directly within Google's cloud infrastructure, delivering emails seamlessly from `portide.system@gmail.com`.


---

## 3. Vercel Frontend Deployment

### Project Settings
* **Framework Preset**: `Vite`
* **Root Directory**: `frontend`
* **Build Command**: `vite build`
* **Output Directory**: `dist`

### Environment Variables on Vercel
```ini
VITE_API_BASE_URL=https://portide-api.onrender.com
VITE_SUPABASE_URL=https://somsgwatpldtmktkzofi.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Routing Rewrite Rules (`vercel.json`)
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 4. Supabase PostgreSQL Configuration

1. **IPv4 Connection Pooling**:
   * Direct connection (`db.<ref>.supabase.co:5432`) is IPv6-only.
   * On cloud platforms (Render, GitHub Actions), always connect using the transaction pooler on port `5432`:
     `aws-0-<region>.pooler.supabase.com:5432` with username `postgres.<ref>`.
2. **Row Level Security (RLS)**:
   * Enabled on all tables (`tbl_login`, `tbl_user`, `tbl_container`, etc.) with full CRUD grants for `service_role` and `postgres`.
