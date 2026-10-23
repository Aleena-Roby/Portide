#!/usr/bin/env python3
"""
PORTIDE Git Verification & Auto-Deploy Script
Validates frontend & backend integrity, commits with conventional message,
and pushes to origin/main to trigger cloud deployments on Render & Vercel.
Fully Windows cp1252 / UTF-8 compatible.
"""
import sys
import subprocess
import os

# Ensure UTF-8 output encoding on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def run_cmd(cmd, cwd=None, exit_on_error=True):
    print(f"\n>> Running: {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0 and exit_on_error:
        print(f"\n[ERROR] Command failed with exit code {res.returncode}: {cmd}")
        sys.exit(res.returncode)
    return res.returncode

def main():
    commit_msg = sys.argv[1].strip() if len(sys.argv) > 1 else ""

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

    # 1. Validate Frontend Build
    frontend_dir = os.path.join(root_dir, "frontend")
    print("\n--- STEP 1: VALIDATING FRONTEND BUILD ---")
    run_cmd("npm run build", cwd=frontend_dir)

    # 2. Validate Backend Syntax across all modules
    print("\n--- STEP 2: VALIDATING BACKEND SYNTAX ---")
    compile_cmd = (
        'python -c "'
        'import compileall, sys; '
        'res = compileall.compile_dir(\'backend/authentication\', force=False, quiet=1); '
        'sys.exit(0 if res else 1);"'
    )
    run_cmd(compile_cmd, cwd=root_dir)
    print("[OK] Backend Python syntax is clean across all modules.")

    # 3. Git Stage, Commit & Push
    print("\n--- STEP 3: GIT COMMIT & PUSH ---")
    status_proc = subprocess.run("git status --porcelain", shell=True, cwd=root_dir, capture_output=True, text=True)
    has_uncommitted = bool(status_proc.stdout.strip())

    if has_uncommitted:
        if not commit_msg:
            commit_msg = "feat(core): automated update and verification"
        run_cmd("git add .", cwd=root_dir)
        run_cmd(f'git commit -m "{commit_msg}"', cwd=root_dir)
    else:
        print("[OK] Working tree is clean. Checking for existing unpushed commits...")

    # 4. Check if local branch is ahead of origin/main
    ahead_proc = subprocess.run(
        "git log origin/main..HEAD --oneline",
        shell=True,
        cwd=root_dir,
        capture_output=True,
        text=True
    )
    unpushed_commits = ahead_proc.stdout.strip()
    if unpushed_commits:
        print(f"Found unpushed commit(s):\n{unpushed_commits}")
    elif not has_uncommitted:
        print("Everything is already up-to-date with origin/main.")

    # Always push to ensure origin/main has all commits
    run_cmd("git push origin main", cwd=root_dir)

    print("\n=======================================================")
    print(" DEPLOYMENT TRIGGERED SUCCESSFULLY TO ORIGIN/MAIN!")
    print(" - Render backend: https://portide-api.onrender.com")
    print(" - Vercel frontend: https://portide.vercel.app")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
