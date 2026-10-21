#!/usr/bin/env python3
"""
PORTIDE Git Verification & Auto-Deploy Script
Validates builds, commits with conventional message, and pushes to origin/main.
"""
import sys
import subprocess
import os

def run_cmd(cmd, cwd=None, exit_on_error=True):
    print(f"\n>> Running: {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0 and exit_on_error:
        print(f"\n[ERROR] Command failed with exit code {res.returncode}: {cmd}")
        sys.exit(res.returncode)
    return res.returncode

def main():
    if len(sys.argv) < 2:
        print("Usage: python auto_deploy.py \"<commit-message>\"")
        print("Example: python auto_deploy.py \"fix(auth): update session headers\"")
        sys.exit(1)

    commit_msg = sys.argv[1].strip()
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

    # 1. Validate Frontend Build
    frontend_dir = os.path.join(root_dir, "frontend")
    print("\n--- STEP 1: VALIDATING FRONTEND BUILD ---")
    run_cmd("npm run build", cwd=frontend_dir)

    # 2. Validate Backend Syntax
    print("\n--- STEP 2: VALIDATING BACKEND SYNTAX ---")
    run_cmd(
        'python -c "import py_compile; py_compile.compile(\'backend/authentication/views.py\', doraise=True); py_compile.compile(\'backend/authentication/email_service.py\', doraise=True); print(\'Python Syntax Clean!\')"',
        cwd=root_dir
    )

    # 3. Git Stage, Commit & Push
    print("\n--- STEP 3: GIT COMMIT & PUSH ---")
    run_cmd("git add .", cwd=root_dir)
    run_cmd(f'git commit -m "{commit_msg}"', cwd=root_dir)
    run_cmd("git push origin main", cwd=root_dir)

    print("\n=======================================================")
    print(" DEPLOYMENT TRIGGERED SUCCESSFULLY TO ORIGIN/MAIN!")
    print(" Render backend & Vercel frontend builds running.")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
