#!/usr/bin/env python3
"""
PORTIDE Cloud Health Monitor Script
Tests Render, Vercel, Supabase IPv4 Pooler, and Google Apps Script Email Relay.
"""
import urllib.request
import urllib.error
import json
import time
import sys

SERVICES = {
    "Vercel Frontend": "https://portide.vercel.app",
    "Render Backend API": "https://portide-api.onrender.com/api/ports/",
    "Google Apps Script Relay": "https://script.google.com/macros/s/AKfycbzIPSgHMj39fp7_2u5eAnZOMrJ1CN-um_PcoaX-odNSRyvEGNf3nIOkMlCrqRoyJyYN/exec",
}

SUPABASE_DSN = "postgresql://postgres.somsgwatpldtmktkzofi:Aleena%40Roby@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

def check_http_service(name, url):
    start = time.time()
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "PORTIDE-HealthMonitor/1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            elapsed = time.time() - start
            return {
                "service": name,
                "status": "HEALTHY",
                "code": resp.status,
                "latency_sec": round(elapsed, 2),
                "details": f"Responded with HTTP {resp.status}"
            }
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        # Google script might return 405 on GET but still indicates the endpoint exists
        if name == "Google Apps Script Relay" and e.code in [401, 405]:
            return {
                "service": name,
                "status": "HEALTHY",
                "code": e.code,
                "latency_sec": round(elapsed, 2),
                "details": f"Web App active (HTTP {e.code})"
            }
        return {
            "service": name,
            "status": "DEGRADED",
            "code": e.code,
            "latency_sec": round(elapsed, 2),
            "details": f"HTTP Error {e.code}"
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "service": name,
            "status": "OFFLINE",
            "code": None,
            "latency_sec": round(elapsed, 2),
            "details": str(e)
        }

def check_supabase():
    start = time.time()
    try:
        import psycopg2
        conn = psycopg2.connect(SUPABASE_DSN, connect_timeout=10)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM tbl_login;")
        login_count = cur.fetchone()[0]
        conn.close()
        elapsed = time.time() - start
        return {
            "service": "Supabase PostgreSQL (IPv4 Pooler)",
            "status": "HEALTHY",
            "code": 200,
            "latency_sec": round(elapsed, 2),
            "details": f"Connected. {login_count} active login account(s)"
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "service": "Supabase PostgreSQL (IPv4 Pooler)",
            "status": "OFFLINE",
            "code": None,
            "latency_sec": round(elapsed, 2),
            "details": str(e)
        }

def main():
    print("\n" + "="*70)
    print(" PORTIDE CLOUD INFRASTRUCTURE HEALTH AUDIT")
    print("="*70)

    results = []

    # 1. Check HTTP Endpoints
    for name, url in SERVICES.items():
        res = check_http_service(name, url)
        results.append(res)

    # 2. Check Supabase
    results.append(check_supabase())

    # Format Output Table
    print(f"\n{'Service':<35} | {'Status':<10} | {'Latency':<8} | {'Details'}")
    print("-" * 75)
    all_healthy = True
    for r in results:
        status_display = r['status']
        if r['status'] != "HEALTHY":
            all_healthy = False
        print(f"{r['service']:<35} | {status_display:<10} | {str(r['latency_sec']) + 's':<8} | {r['details']}")

    print("-" * 75)
    if all_healthy:
        print("ALL SERVICES 100% OPERATIONAL & HEALTHY\n")
        return 0
    else:
        print("WARNING: One or more services are degraded or offline.\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
