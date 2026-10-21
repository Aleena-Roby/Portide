# Rule: Git Automation & Continuous Deployment

## Trigger
Applies automatically whenever code modifications, bug fixes, or new features are implemented in the repository.

## Execution Requirements
1. **Pre-commit Validation**:
   - For frontend changes: Run `npm run build` in `frontend/` to verify zero TypeScript errors.
   - For backend changes: Verify syntax with `python -c "import py_compile; py_compile.compile(...)"`.
2. **Git Commit Format**:
   - Use conventional commit messages: `feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`.
3. **PowerShell-Compatible Execution**:
   - In Windows PowerShell, run:
     ```powershell
     git add .
     git commit -m "fix(scope): concise description"
     git push origin main
     ```
   - Do NOT use `&&` chaining in Windows PowerShell. Use sequential commands or `;`.
4. **Cloud Auto-Deployment**:
   - Pushing to `origin/main` automatically triggers Render backend deployment and Vercel frontend rebuilds.
