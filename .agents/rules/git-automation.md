# Rule: Git Automation & Continuous Deployment

## Trigger
Applies automatically whenever code modifications, bug fixes, or new features are implemented in the repository.

## Mandatory Automation Requirement
**Never leave commits local.** Every time code modifications are completed and verified, they MUST be pushed to `origin/main` immediately so that Render backend and Vercel frontend automated continuous deployments are triggered.

## Execution Protocol

Either run the automated deployment script:
```powershell
python .agents/skills/git-deploy/scripts/auto_deploy.py "feat(module): description of changes"
```

Or execute the steps sequentially in PowerShell:
1. **Frontend Pre-Validation**:
   ```powershell
   npm --prefix frontend run build
   ```
2. **Backend Syntax & Integrity**:
   ```powershell
   python -c "import compileall; compileall.compile_dir('backend/authentication', force=False, quiet=1)"
   ```
3. **Immediate Stage, Commit & Push**:
   ```powershell
   git add .
   git commit -m "feat(module): description of changes"
   git push origin main
   ```
   *(Note: Never use `&&` in Windows PowerShell; execute sequentially or separated by `;`)*.
