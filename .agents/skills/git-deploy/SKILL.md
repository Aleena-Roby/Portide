---
name: git-deploy
description: >-
  Verifies frontend Vite bundling and backend Python syntax, formats a conventional
  git commit, and pushes to origin/main to trigger cloud deployments on Render & Vercel.
---

# Git Deploy Skill

Use this skill to automatically test and push updates to GitHub.

## Execution

Run from the workspace root:

```powershell
python .agent/skills/git-deploy/scripts/auto_deploy.py "feat(module): describe changes"
```

### Steps Executed Automatically:
1. Runs `npm run build` in `frontend/` to confirm 0 compilation errors.
2. Compiles backend Python files with `py_compile`.
3. Stages modified files (`git add .`).
4. Commits using conventional format.
5. Pushes to `origin/main` to trigger continuous deployment.
