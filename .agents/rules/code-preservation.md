# Rule: Code Preservation, Modularity & Logic Integrity

## Trigger
Applies to all code edits, refactoring, and feature additions across the repository.

## Non-Destructive Code Rules
1. **Never Break Working Logic**:
   - Do NOT delete, break, or fundamentally alter working modules, endpoints, or dashboards.
   - Refactor only by extending or encapsulating existing logic.
2. **Double-Submit Prevention**:
   - Form submission handlers must manage an `isSubmitting` state, disable the submit button immediately upon click, display a loading indicator, and prevent concurrent requests.
3. **Asynchronous Background Tasks**:
   - Long-running network operations (such as outbound email dispatch) must run in daemon threads or async background workers so HTTP endpoints return responses immediately.
4. **Code Reusability (DRY)**:
   - Reuse shared frontend components (`PortideLogo`, `Modal`, `InternationalPhoneInput`, `PasswordRequirementChecklist`).
   - Reuse backend utilities (`create_audit_log`, `send_mail`, standard serializers, permission classes).
   - Avoid creating redundant duplicate copies of components or utility scripts.
