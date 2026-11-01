# Branch Integration Audit

**Repository:** `no-usefun/quiz-app`  
**Baseline reviewed:** `main` at `37353eeaccfcb3fb7d1129e4a2dd12f164ce179d` (2026-11-01)  
**Branches found:** 16 total, including `main`.

## Summary

The branch review does **not** justify merging all branch tips verbatim. Several are backup snapshots or older, divergent project layouts that delete current backend, AI-service, CI, or frontend files. A blind merge could remove working application components or regress the current API contracts.

The current `main` tree is byte-for-byte identical at the file-tree level to `frontend-integration` and `integration/local-test-ready`. The compatible frontend integration, backend submission/deadline fixes, matching schema, AI proctoring service, CI workflows, and local setup guide are already present in `main`.

The only clear, unique, low-risk documentation artifact selected from the remaining branches is `docs/GOOGLE_OAUTH_ROLE_FLOW.md`; it has been brought forward and corrected to describe the current frontend OAuth preflight and direct backend redirect. Other unique items are either obsolete, incomplete, or require a deliberate feature port and tests.

## Branch-by-branch disposition

| Branch | Finding relative to current `main` | Decision |
|---|---|---|
| `main` | Protected baseline; contains the current integrated application. | Keep as source of truth. |
| `frontend-integration` | Same file tree as `main`; no additional file content to import. | No-op; already integrated. |
| `integration/local-test-ready` | Same file tree as `main`; local guide and CI already present. | No-op; already integrated. |
| `integration/ai-proctoring-v2-main` | Older snapshot, behind the current baseline; lacks newer integration files. | Do not merge backward. |
| `backup/main-frontend-before-feature-integration-2026-10-31` | Pre-integration backup, one commit behind the baseline. | Preserve as recovery point; do not merge. |
| `backup/frontend-non-ai-baseline` | Old baseline, 121 commits behind; omits AI-service files and related tests. | Preserve as recovery point; do not merge. |
| `ci/github-actions-test-gates` | Contains earlier CI and backend submission changes; its workflow and project snapshot are older than current `main`. | Current compatible CI/backend work is already represented; do not overwrite newer files. |
| `docs/google-oauth-role-flow` | Adds an OAuth role-flow guide, but the source snapshot predates current frontend OAuth routing. | Import the guide only after updating its flow description. |
| `feature/backend` | Divergent older backend attempt/submission work overlaps current service and DTO files. | Do not overwrite the current implementation; preserve as reference for future targeted fixes. |
| `feature/frontend-ui-consistency` | Only 72 tracked files versus 278 in current `main`; deletes large parts of backend and AI service. | Do not merge wholesale. |
| `features/DB` | Uses database files at repository root and has no current app tree; merging would replace the project structure. | Do not merge; current schema lives in `database/schema.sql`. |
| `features/ai-proctoring` | Older browser-extension architecture with divergent backend/frontend changes and deletions of current service files. | Keep as a separate legacy feature candidate; port only after API/security review. |
| `features/ai-proctoring-tested` | Similar extension-based snapshot with tests and reports, but removes current AI service and CI/docs. | Do not merge wholesale; port and adapt the extension independently if still required. |
| `features/ai-proctoring-v2` | Older V2 snapshot; differs in backend/frontend contracts and omits current components and local setup files. Its additive migration does not add the current `ai_proctoring_enabled` column. | Keep current `main`; do not copy the migration as-is. |
| `features/ai-proctoring-v2-integrated` | Python AI-service files match current `main`, but backend/frontend files are older and lack the current quiz-level AI-proctoring contract. Its migration is incomplete for the current entity/schema. | AI service is already present; do not replace current backend/frontend or run the old migration. |
| `features/frontend` | Frontend-focused snapshot that omits current backend and AI-service files; handoff documents describe older contracts. | Do not merge wholesale; review handoff requirements against current code before porting. |

## Safety checks and known limits

- No backup or legacy branch was force-pushed, deleted, or rewritten.
- Current `main` retains the `backend/`, `frontend/`, `ai-proctoring/`, `database/`, `.github/workflows/`, and `docs/` structure.
- Current backend already supports `aiProctoringEnabled`, `terminationReason`, `screenshot_attempt`, and idempotent proctoring events; do not replace those paths with older implementations without targeted tests.
- The older additive migration was **not** added because it is incomplete against the current schema and has not been validated against a copy of the deployed database.
- This audit compares branch heads and file trees. It does not prove every historical commit was individually useful or every end-to-end flow works on a developer machine.
- CI and local smoke tests remain the final validation for application behavior. Use `LOCAL_TESTING.md` for the Windows setup.

## Next safe work

1. Merge this documentation-only audit through a pull request after CI.
2. If the browser extension is still a requirement, create a separate feature branch and port its event delivery to the current authenticated/idempotent API contract.
3. If a live-database migration is needed, derive and test a migration specifically against the deployed schema; do not run the older additive script unchanged.
