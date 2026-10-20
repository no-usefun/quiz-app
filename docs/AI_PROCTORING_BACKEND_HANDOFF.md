# Backend Handoff: AI Proctoring Setting Is Not Reliably Enforced

**Repository:** `no-usefun/quiz-app`  
**Frontend branch reviewed:** `features/frontend`  
**Audience:** Spring Boot/backend team  
**Priority:** High — this affects whether an assessment configured as AI-proctored is actually treated as AI-proctored by the student flow.

## 1. Executive summary

The teacher-facing frontend exposes an **AI Proctoring** toggle and sends `aiProctoringEnabled` in the quiz create and settings-update payloads. The student lobby attempts to read this setting from the student availability endpoint and, as a fallback, the student quiz-package endpoint.

The frontend currently cannot reliably know the configured policy if the backend does not persist and return the flag consistently. In the reviewed frontend, when both student responses omit the flag, the lobby treats the assessment as not AI-proctored and writes `false` to session storage. The exam page then trusts that session-storage value and disables the AI-proctoring hook and readiness gate. This can silently turn an intended AI-proctored assessment into the standard path.

**Backend objective:** persist the teacher's setting, expose the same canonical boolean through all relevant API responses, and enforce the policy on the server when an attempt starts and proceeds. Frontend checks are not a security boundary.

> This handoff describes the contract required by the frontend. The branch reviewed is frontend-focused and does not contain the backend Java source files at the paths previously inspected on another integration branch, so the backend file names below are likely targets to locate in the backend team's active branch rather than claims that those exact files exist in this branch.

## 2. Observed frontend behavior and impact

Relevant frontend files on `features/frontend`:

- `frontend/src/app/dashboard/teacher/create/page.tsx`
  - Teacher toggle state defaults to `true`.
  - Create payload includes `aiProctoringEnabled`.
  - Settings-update payloads include `aiProctoringEnabled`.
  - Edit hydration reads the direct field or `settings.aiProctoringEnabled`.
- `frontend/src/app/test/[testCode]/lobby/page.tsx`
  - Reads the flag from `GET /api/v1/student/quizzes/{quizCode}/availability`.
  - Also tries `GET /api/v1/student/quizzes/code/{quizCode}/package`.
  - Understands `aiProctoringEnabled`, `ai_proctoring_enabled`, and `proctoringEnabled`, including under `settings`.
  - If neither response provides a boolean, `aiRequired` evaluates to `false` and the lobby stores `false` in `sessionStorage`.
- `frontend/src/app/test/[testCode]/page.tsx`
  - Reads `dynoquizz_ai_proctoring_{quizCode}` from session storage.
  - When the value is `false`, the AI-proctoring hook is disabled and the AI readiness lock is bypassed.
  - It does not currently treat the backend package response as the authoritative policy that corrects a missing or stale session-storage value.
- `frontend/src/lib/types.ts`
  - `QuizAvailabilityResponse.aiProctoringEnabled` and `QuizPackageResponse.aiProctoringEnabled` are optional today. They should be present as non-null booleans in the backend contract once the migration is complete.

### User-visible symptom

A teacher enables AI proctoring, but if create/update silently drops the field or the student endpoints omit it, the student can reach the exam through the standard path without camera/identity readiness checks. Conversely, a stale or inconsistent response can make the lobby and exam page disagree.

## 3. Required backend changes

### A. Persist the setting as quiz configuration

Locate the quiz persistence entity/model and its migration/schema. Add or confirm a persisted boolean property:

- Canonical API/property name: `aiProctoringEnabled`
- Database column suggestion: `ai_proctoring_enabled`
- Type: non-null boolean
- Default for existing records: choose and document a deliberate migration default. Do not rely on Java primitive defaults or an absent JSON property to decide the policy at runtime.

The product needs a defined default. The current teacher UI initializes the toggle to enabled for new assessments, but existing database rows need an explicit migration/backfill decision. Confirm whether existing assessments should remain standard mode or become AI-proctored; do not silently enable/disable historical quizzes without product approval.

### B. Accept it on create and update

Find the DTOs/commands and service mapping for:

- `POST /api/v1/teacher/quizzes`
- `PUT /api/v1/teacher/quizzes/{quizId}/settings`

Both request contracts must accept `aiProctoringEnabled` as a boolean. Both service paths must map it into the persisted quiz entity. The settings-update path must update the value rather than ignore it, and the create path must persist it from the initial request.

Request example:

```json
{
  "title": "Sample assessment",
  "aiProctoringEnabled": true
}
```

This is a contract excerpt, not the complete create DTO; retain all existing required fields and validation.

Requirements:
1. Missing-field behavior must be explicit (create default or validation; update preserve existing value or validation).
2. Explicit `false` must be preserved. Avoid logic such as `value || defaultValue`, which would overwrite `false`.
3. Validate the field as a boolean and return a clear 4xx response for invalid input.
4. Ensure create, update, draft-save, publish, and edit/reload paths all preserve the setting.

### C. Return it from teacher detail/list responses

Ensure the teacher quiz response and quiz-detail/edit response include the persisted value as a top-level `aiProctoringEnabled` boolean. This is needed so editing an existing quiz displays the saved value rather than a frontend default.

If the backend uses a nested `settings` object for other settings, do not make this field available only in that nested object. The canonical contract should be top-level; legacy aliases may be supported temporarily if necessary.

### D. Return it from both student endpoints

The frontend checks these two endpoints:

1. `GET /api/v1/student/quizzes/{quizCode}/availability`
2. `GET /api/v1/student/quizzes/code/{quizCode}/package`

Both must return the same persisted boolean:

```json
{
  "quizCode": "ABCD12",
  "available": true,
  "status": "LIVE",
  "aiProctoringEnabled": true
}
```

And the package should include:

```json
{
  "quizId": 123,
  "title": "Sample assessment",
  "aiProctoringEnabled": true,
  "questions": []
}
```

The package example is abbreviated. Preserve its existing fields and question data.

Implementation notes:
- The availability response/record must include the field and its constructor/service mapping must pass the persisted value.
- The quiz-package response DTO and its assembler/service mapping must include the same field.
- Do not hardcode `false`, use an unrelated default, or calculate this from quiz status.
- Both endpoints must derive the value from the same quiz record so they cannot disagree.
- Include the field even when it is `false`; omission is not equivalent to `false`.
- Ensure serializers emit JSON boolean values, not strings such as `"true"`.

### E. Enforce policy server-side

The backend must not trust the browser's session storage, a client-supplied flag, or the fact that the frontend has opened the AI UI.

At minimum:
- When creating an attempt, load the quiz's persisted `aiProctoringEnabled` setting server-side.
- If AI proctoring is enabled, require the configured proctoring initialization/registration workflow before allowing the attempt to begin or submit, according to the agreed architecture.
- If the AI service is unavailable or registration fails, return a clear error and do not silently downgrade the attempt to standard mode.
- Reject client attempts to bypass the policy by modifying browser storage or calling endpoints directly.
- Keep standard-mode behavior available only when the persisted quiz setting is explicitly `false`.
- Bind proctoring sessions/summaries to the authenticated student and attempt; authorize summary submission and prevent one student from updating another attempt.
- Define how an AI-service outage affects already-started attempts and document the policy (block, pause, or controlled failover); do not silently change modes.

If the architecture intentionally permits attempt creation before AI registration, persist a server-side attempt/proctoring state and prevent exam progression/submission until the required initialization is complete.

### F. API error contract

Return structured, actionable errors for configuration/policy failures. Suggested shape:

```json
{
  "code": "AI_PROCTORING_REQUIRED",
  "message": "AI proctoring must be initialized before this assessment can begin."
}
```

Suggested cases:
- `AI_PROCTORING_REQUIRED`: required session/registration missing.
- `AI_PROCTORING_UNAVAILABLE`: required service unavailable.
- `AI_PROCTORING_NOT_READY`: biometric registration/models not ready.
- `AI_PROCTORING_POLICY_MISMATCH`: client or attempt state conflicts with persisted quiz policy.

Use the project's existing error-envelope conventions if they differ; keep the stable error code and suitable HTTP status.

## 4. Contract consistency checklist

| Flow | Required behavior |
|---|---|
| Create quiz with `true` | Persist true; teacher response/detail returns true |
| Create quiz with `false` | Persist false; all responses return false |
| Update true → false | Persist false; no truthy fallback overrides it |
| Update false → true | Persist true |
| Teacher edit/reload | Toggle reflects persisted value |
| Availability endpoint | Always returns the persisted boolean |
| Student package endpoint | Always returns the same persisted boolean |
| Availability/package disagree | Treat as a backend defect; investigate and fix common source |
| Existing quiz migration | Explicitly backfill values and document default |
| AI required but service offline | Do not downgrade to standard mode |
| Client tampers with session storage | Server policy remains enforced |
| Direct API call bypasses UI | Server policy remains enforced |

## 5. Acceptance tests requested

Please add automated tests at DTO/service/controller/integration level, as appropriate:

1. Create request with `aiProctoringEnabled=true` persists true.
2. Create request with `false` persists false.
3. Settings update can switch both directions, true → false and false → true.
4. Teacher detail/list response returns the persisted value.
5. Availability returns the persisted value for both true and false.
6. Quiz package returns the persisted value for both true and false.
7. Availability and package return identical values for the same quiz.
8. Missing-field semantics for create and update are tested and documented.
9. Existing-row migration/backfill is tested or verified in migration tests.
10. Required AI session absent: attempt progression is rejected for an AI-enabled quiz.
11. Required AI service unavailable: no automatic downgrade.
12. Standard quiz with persisted false continues through the existing non-AI path.
13. Unauthorized student cannot submit proctoring data for another student's attempt.
14. Existing endpoint response fields and current frontend flows remain backward-compatible.

## 6. Definition of done

- [ ] `aiProctoringEnabled` is persisted on the quiz.
- [ ] Create and update DTOs and service mappings preserve true and false.
- [ ] Teacher detail/list and both student endpoints return a non-null boolean.
- [ ] The two student endpoints return the same persisted value.
- [ ] Existing quiz migration/default behavior is agreed and documented.
- [ ] Backend enforces AI policy independently of frontend/session storage.
- [ ] Automated tests above are added and passing.
- [ ] API docs/OpenAPI examples are updated.
- [ ] The backend team shares example JSON responses for both AI-enabled and standard assessments so the frontend team can verify integration.

## 7. Coordination / frontend dependency

The frontend will be changed to **fail closed on an unknown policy**: if the backend does not return an explicit boolean, the student must see a configuration/verification error instead of silently entering standard mode. This is safer but means the backend contract must be deployed before AI-enabled assessments can be launched through this frontend. Please coordinate deployment/testing against a backend that returns the field consistently.

**Ownership:** Backend team owns persistence, API contract, authorization, and server-side enforcement. Frontend team owns displaying the configuration state and enforcing client-side readiness UX. Neither side's UI checks replace server-side authorization and policy enforcement.
