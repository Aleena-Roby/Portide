# 6.2.4 Hosting

Hosting is the process of providing a platform or service for storing, serving, and managing websites, applications, or data on the internet. Web hosting refers to the process of making a website accessible on the internet. There are various types of web hosting services available, including shared hosting, VPS hosting, dedicated hosting, cloud hosting, and managed hosting. Shared hosting is a cost-effective option where multiple websites share server resources. VPS hosting offers more control and flexibility over server resources, while dedicated hosting provides exclusive use of a server. Cloud hosting is a scalable and flexible hosting option that utilizes multiple servers, while managed hosting involves the hosting provider taking care of the technical aspects of website management. Cloud hosting offers scalability and high availability by leveraging multiple servers to host websites and applications. Managed hosting involves outsourcing the technical aspects of hosting to a third-party provider, allowing businesses to focus on their core activities. Choosing the right hosting provider is crucial, as it affects website performance, security, and uptime. Factors to consider when selecting a hosting provider include cost, reliability, support, scalability, and features. Overall, hosting plays a critical role in enabling businesses and individuals to establish a presence on the internet and reach a global audience.

Some key features of Vercel, Render, and Supabase for PORTIDE include:
* **Frontend Hosting (Vercel)**: Vercel hosts the React.js + Vite Single Page Application (SPA), providing high-speed global CDN delivery, automatic HTTPS encryption, edge routing rewrites, and the production access URL (`https://portide.vercel.app`).
* **Backend API Hosting (Render)**: Render hosts the Django REST Framework backend as a scalable Python Web Service, handling business logic, token-based authentication, transactional workflows, and RESTful API endpoints (`https://portide-api.onrender.com`).
* **Managed Database Hosting (Supabase PostgreSQL)**: Supabase provides a fully managed PostgreSQL 16 database instance with high-throughput IPv4 connection pooling (`aws-0-ap-northeast-1.pooler.supabase.com:5432`) and Row Level Security (RLS) for persistent storage of maritime port data.
* **Serverless Email Relay (Google Apps Script)**: Google Apps Script Web App operates as an HTTPS-based email relay on port 443, bypassing cloud outbound SMTP port restrictions to ensure reliable zero-cost transactional dispatch for account activations and gate passes.
* **Cloud Accessibility**: The PORTIDE platform is accessible worldwide via modern web browsers on desktop terminals and mobile devices without requiring local client installations.
* **Continuous Deployment (CI/CD)**: Direct GitHub repository integration triggers automated builds and deployments on both Vercel and Render immediately upon pushing commits to the `main` branch.

---

### Procedure for Hosting the Website on Vercel, Render, and Supabase:

#### Step 1: Prepare the Project:
Organize the project directory structure into a modular architecture: `frontend/` containing the React.js + TypeScript + Vite Single Page Application, `backend/` containing the Django REST Framework API, and database schema migrations. Configure the environment variables (`.env`) for local development, run unit tests and bundling checks (`npm run build` and `python manage.py check`), and verify that all application workflows function reliably in the local development environment.

#### Step 2: Upload the Project to GitHub:
Create a secure Git repository (`https://github.com/Aleena-Roby/Portide`) and push the project source code to the `main` branch. Utilize `.gitignore` rules to strictly prevent committing sensitive credentials, local virtual environments (`venv/`), Node dependencies (`node_modules/`), compiled bytecode, and environment configuration files (`.env`).

#### Step 3: Deploy the Frontend on Vercel:
Log in to the Vercel dashboard and import the GitHub repository (`Aleena-Roby/Portide`). Set the Framework Preset to **Vite**, designate the root directory as `frontend`, and configure the build command (`vite build`) and output directory (`dist`). Configure client-side SPA routing rewrites in `vercel.json` (`/(.*) -> /index.html`) to prevent 404 errors upon page refresh. Add the environment variable `VITE_API_BASE_URL=https://portide-api.onrender.com` to direct API traffic to the cloud backend, and deploy the application to obtain the live production deployment URL (`https://portide.vercel.app`).

#### Step 4: Deploy the Backend on Render:
Log in to Render and create a new **Web Service** connected to the `Aleena-Roby/Portide` GitHub repository. Set the runtime environment to **Python 3**, set the root directory to `backend`, and configure the automated build and start commands:
* **Build Command**: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
* **Start Command**: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
Set the production environment variables including `DEBUG=False`, `SECRET_KEY`, and `FRONTEND_URL=https://portide.vercel.app` to enable cross-origin resource sharing.

#### Step 5: Host the PostgreSQL Database on Supabase:
Provision a PostgreSQL 16 database project on Supabase hosted in the Asia-Pacific Tokyo region (`ap-northeast-1`). Because cloud app platforms utilize IPv4 networking, configure the Django `DATABASE_URL` using Supabase's transaction connection pooler on port 5432 (`postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require`). Execute the database migrations during backend deployment to create the 24 relational tables, configure primary and foreign key constraints, and establish Row Level Security (RLS) policies.

#### Step 6: Connect the Frontend, Backend, Database, and Email Relay:
Establish secure communication links across all cloud hosting tiers:
1. Configure Django CORS middleware (`django-cors-headers`) with `CORS_ALLOWED_ORIGINS` permitting requests originating from `https://portide.vercel.app`.
2. Configure the React frontend Axios/Fetch client to route all network traffic to `https://portide-api.onrender.com/api/`.
3. Link the Django backend to the Supabase PostgreSQL database via the IPv4 connection string.
4. Configure `GOOGLE_SCRIPT_EMAIL_URL` to route email notifications through Google Apps Script over HTTPS Port 443, ensuring deliverability of account activation links and gate pass confirmations without SMTP firewall restrictions.

#### Step 7: Test the Deployed Application:
Access the live production URL (`https://portide.vercel.app`) in a web browser and systematically validate all port operational workflows:
* **Authentication & RBAC**: Administrator login, officer registration, role-based dashboard redirection, and password reset flows.
* **Vessel Traffic Management**: Vessel arrival request submission, harbor master review, berthing allocation, and scheduling.
* **Container & Manifest Operations**: Dual-state container tracking, discharge logging, and automated status synchronization.
* **Customs Compliance**: Document uploading, inspection booking, officer examination findings, and customs clearance certification.
* **Terminal Yard Operations**: Yard block slot allocation, 3D stacking visualizer, and reefer container monitoring.
* **Gate Security & Landside Logistics**: Truck/driver registration, digital QR gate pass generation, optical verification, and outbound barrier release.
* **Audit Logging**: Confirm that all user actions generate immutable audit log entries in `tbl_audit_log`.

#### Step 8: Monitor and Maintain the Application:
Continuously observe operational health and system logs through the Vercel and Render management consoles. Utilize the automated cloud health monitoring suite (`python .agents/skills/cloud-monitor/scripts/check_all.py`) to verify uptime, network latency, and database pooler responsiveness. Pushing updates to the GitHub repository automatically triggers zero-downtime rolling builds on both Vercel and Render.

---

### Cloud Hosting Summary Table

| Hosting Component | Hosting Provider | Deployment Tier / Service | Endpoint / Production URL | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Application** | Vercel | Global Edge Network (Vite + React) | `https://portide.vercel.app` | **Active / Operational** |
| **Backend REST API** | Render | Managed Python Web Service (Gunicorn + Django) | `https://portide-api.onrender.com` | **Active / Operational** |
| **Relational Database** | Supabase | Managed PostgreSQL 16 (IPv4 Pooler) | `aws-0-ap-northeast-1.pooler.supabase.com:5432` | **Active / Operational** |
| **Email Relay** | Google Apps Script | Serverless HTTPS Web App (Port 443) | `https://script.google.com/macros/s/AKfycb.../exec` | **Active / Operational** |
| **Version Control & CI/CD**| GitHub | Continuous Integration & Automated Triggers | `https://github.com/Aleena-Roby/Portide` | **Active / Operational** |

**Hosted Website:** Vercel (`https://portide.vercel.app`)
