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
PYTHON_VERSION=3.13.0
DJANGO_SECRET_KEY=your_production_secret_key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=portide-api.onrender.com,127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=https://portide.vercel.app,http://localhost:5173,http://localhost:3000

# Supabase IPv4 Pooler Connection String (Crucial for Render IPv4 compatibility)
DATABASE_URL=postgresql://postgres.somsgwatpldtmktkzofi:Aleena%40Roby@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# SMTP Credentials for Email Notifications
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=portide.system@gmail.com
EMAIL_HOST_PASSWORD=your_gmail_app_password
DEFAULT_FROM_EMAIL=portide.system@gmail.com
```

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
