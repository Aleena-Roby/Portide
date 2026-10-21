#!/usr/bin/env python3
"""
PORTIDE Database Reset Script
Wipes operational records while preserving primary Port Administrator credentials.
"""
import os
import sys
import psycopg2

SUPABASE_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.somsgwatpldtmktkzofi:Aleena%40Roby@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
)

ADMIN_EMAIL = "aleena302005@gmail.com"
ADMIN_PASSWORD = "Aleena@2005"

TABLES_TO_TRUNCATE = [
    "tbl_audit_log",
    "tbl_gate_release",
    "tbl_gate_pass_container",
    "tbl_gate_pass",
    "tbl_direct_ship_to_truck_transfer",
    "tbl_delivery_order",
    "tbl_driver",
    "tbl_truck",
    "tbl_yard_movement_history",
    "tbl_yard_allocation",
    "tbl_crane_allocation",
    "tbl_customs_inspection",
    "tbl_customs_document",
    "tbl_pre_arrival_customs_declaration",
    "tbl_container_tracking_event",
    "tbl_container",
    "tbl_cargo",
    "tbl_vessel_schedule",
    "tbl_vessel_arrival_request",
    "tbl_vessel",
    "tbl_shipping_company",
    "tbl_registration_request",
    "tbl_password_reset_token",
    "django_session"
]

def main():
    print("Connecting to Supabase PostgreSQL via IPv4 pooler...")
    conn = psycopg2.connect(SUPABASE_DSN)
    conn.autocommit = True
    cur = conn.cursor()

    print("Truncating operational tables...")
    for tbl in TABLES_TO_TRUNCATE:
        try:
            cur.execute(f"TRUNCATE TABLE {tbl} CASCADE;")
            print(f"  ✓ Truncated {tbl}")
        except Exception as e:
            print(f"  Note on {tbl}: {e}")

    # Reset berth and yard statuses
    cur.execute("UPDATE tbl_berth SET berth_status = 'AVAILABLE';")
    cur.execute("UPDATE tbl_yard SET yard_occupied = 0;")
    cur.execute("UPDATE tbl_yard_slot SET yard_slot_status = 'AVAILABLE';")
    cur.execute("UPDATE tbl_crane SET crane_status = 'AVAILABLE';")
    print("  ✓ Reset infrastructure statuses to AVAILABLE")

    # Remove non-admin users and logins
    cur.execute(
        "DELETE FROM tbl_user WHERE login_id NOT IN (SELECT login_id FROM tbl_login WHERE LOWER(login_email) = LOWER(%s));",
        (ADMIN_EMAIL,)
    )
    cur.execute(
        "DELETE FROM tbl_login WHERE LOWER(login_email) != LOWER(%s);",
        (ADMIN_EMAIL,)
    )
    print("  ✓ Removed non-admin accounts")

    # Ensure admin user profile exists
    cur.execute("SELECT login_id FROM tbl_login WHERE LOWER(login_email) = LOWER(%s);", (ADMIN_EMAIL,))
    row = cur.fetchone()
    if row:
        login_id = row[0]
        cur.execute("SELECT user_id FROM tbl_user WHERE login_id = %s;", (login_id,))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO tbl_user (login_id, user_full_name, user_status, user_must_change_password, user_created_at, user_updated_at)
                VALUES (%s, 'Aleena Roby', 'ACTIVE', FALSE, NOW(), NOW());
            """, (login_id,))
            print("  ✓ Verified admin profile linked to login")

    # Print summary counts
    print("\n--- FINAL ROW COUNTS ---")
    for tbl in ["tbl_login", "tbl_user", "tbl_shipping_company", "tbl_vessel", "tbl_container", "tbl_gate_pass"]:
        cur.execute(f"SELECT count(*) FROM {tbl};")
        print(f"  {tbl}: {cur.fetchone()[0]}")

    conn.close()
    print("\nDATABASE RESET COMPLETE! Only administrator remains.\n")

if __name__ == "__main__":
    main()
