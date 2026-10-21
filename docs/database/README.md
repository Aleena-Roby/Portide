# Database Dumps and Restoration Notes

This directory contains standalone PostgreSQL database snapshots for the PORTIDE Maritime Port Operations Intelligence Platform.

---

## 1. File Inventory

* **`portide_backup.sql`**: Full PostgreSQL database backup containing table structures, seed users (admin, sample shipping companies, customs, operations officers), initial quayside berths, yard coordinates, and audit trail data.
* **`portide_backup_before_backend_dockerization.sql`**: Baseline backup taken prior to containerization and IPv4 pooler migration.

---

## 2. Restoring to Local PostgreSQL

To restore `portide_backup.sql` to a local PostgreSQL instance:

```bash
# 1. Create target database
createdb -U postgres portide_local

# 2. Restore schema and data
psql -U postgres -d portide_local -f portide_backup.sql
```

---

## 3. Restoring to Supabase Cloud

To restore to a Supabase project via the connection pooler:

```bash
psql "postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require" -f portide_backup.sql
```

> **Note**: Supabase automatically manages connection pooling on port 5432. When executing DDL restorations, ensure grants are provided to `authenticated`, `service_role`, and `postgres`.
