# Quality Assurance & Testing Guide

This guide provides test procedures to verify the integrity, performance, and stability of PORTIDE across both frontend and backend environments.

---

## 1. Frontend Build & Type Validation

Run TypeScript type checks and production Vite bundling from the `frontend/` directory:

```powershell
cd frontend
npm run build
```

* **Expected Result**: 0 TypeScript compilation errors and production bundle generated in `frontend/dist/`.
* **Key Artifacts**: `dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js`.

---

## 2. Backend Unit & Regression Testing

Run Django's test runner from the root or `backend/` directory:

```powershell
cd backend
python manage.py test authentication
```

### Running Specific Test Suites:
* **Gate Pass & QR Codes**: `python manage.py test authentication.test_digital_gate_pass`
* **Customs Inspections**: `python manage.py test authentication.test_normal_customs_documents`
* **Password Workflows**: `python manage.py test authentication.test_temporary_password_workflow`

---

## 3. Database Verification & Inspection

To inspect table row counts and verify PostgreSQL pooler connectivity:

```powershell
python -c "
import psycopg2, os
conn = psycopg2.connect('postgresql://postgres.somsgwatpldtmktkzofi:Aleena%40Roby@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor()
for tbl in ['tbl_login', 'tbl_user', 'tbl_shipping_company', 'tbl_container']:
    cur.execute(f'SELECT count(*) FROM {tbl};')
    print(f'{tbl}: {cur.fetchone()[0]}')
conn.close()
"
```

---

## 4. Live Cloud Smoke Testing

### Backend Health Check (Render):
```powershell
python -c "
import urllib.request, json
req = urllib.request.Request('https://portide-api.onrender.com/api/ports/')
res = urllib.request.urlopen(req)
print('Render API Status:', res.status)
"
```

### Email Relay Test (Google Apps Script):
```powershell
python -c "
import urllib.request, json
url = 'https://script.google.com/macros/s/AKfycbzIPSgHMj39fp7_2u5eAnZOMrJ1CN-um_PcoaX-odNSRyvEGNf3nIOkMlCrqRoyJyYN/exec'
req = urllib.request.Request(url, data=json.dumps({'to': 'aleena302005@gmail.com', 'subject': 'Ping', 'message': 'Health Check'}).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
print('Relay Response:', urllib.request.urlopen(req).read().decode('utf-8'))
"
```
