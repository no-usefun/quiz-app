# Backend Handoff — Assessment Submission, Answer Persistence & Proctoring

**Backend target:** main (backend team owns implementation)  
**Frontend branch:** features/frontend  
**Scope:** backend-only. Do not modify frontend or database unless the team proves a migration is necessary. Preserve existing API compatibility.

## 1. Findings from current backend main

Inspection of `StudentAttemptService.java` found:
- `recordProctoringEvent` allow-lists tab_switch, fullscreen_exit, right_click, copy_attempt, cut_attempt, paste_attempt, focus_loss, keyboard_attempt, refresh_count and reconnect_count, but rejects `screenshot_attempt` with `INVALID_PROCTORING_EVENT`.
- `submitAttempt` saves the submitted answer sheet, then chooses SUBMITTED or AUTO_SUBMITTED based on the server deadline. This server-authoritative rule should remain, but its response must include a stable termination reason.
- `finalizeAttempt` creates missing UNANSWERED rows and scores persisted answers. This behavior must remain atomic with answer persistence.
- Draft writes, final submission, deadline auto-submit and proctoring-limit termination can race; exactly one terminal transition must win.

## 2. Acceptance criteria

1. No selected answer is lost on manual submit, timer expiry, proctoring-limit termination, or a lost HTTP response after commit.
2. Every quiz question has an answer row after finalization; empty selections are explicitly UNANSWERED.
3. An attempt transitions from IN_PROGRESS to one terminal state exactly once.
4. Manual submit received before the server deadline returns SUBMITTED.
5. Deadline expiry returns AUTO_SUBMITTED with `terminationReason: "DEADLINE_EXCEEDED"`.
6. Browser-policy termination returns AUTO_SUBMITTED with `terminationReason: "BROWSER_VIOLATION_LIMIT"`; AI termination uses a distinct reason such as AI_PROCTORING_LIMIT or IDENTITY_MISMATCH.
7. Duplicate submit/event delivery cannot duplicate scores, answer rows, event counters, or finalization side effects.
8. Leaderboard and proctoring report expose the same status and terminationReason.
9. LAN and ONLINE use the same paths, payloads, enums and semantics.

## 3. Submit API

Existing endpoint: `POST /api/v1/student/attempts/{attemptId}/submit`

The frontend sends one answer item per question, including unanswered questions:

```json
{
  "answers": [
    {"questionId": 101, "selectedOptionIds": [1001], "responseTimeSeconds": 32},
    {"questionId": 102, "selectedOptionIds": [], "responseTimeSeconds": 18}
  ]
}
```

Validate ownership, quiz membership, unique question IDs, option ownership, unique option IDs, MCQ/MSQ/TRUE_FALSE cardinality, and non-negative response time. Empty selectedOptionIds is valid and means unanswered.

Add nullable `terminationReason` to the existing submit response without removing fields:

```json
{
  "attemptId": 123,
  "quizId": 45,
  "status": "AUTO_SUBMITTED",
  "finalScore": 18.0,
  "totalMarks": 20.0,
  "totalTimeTaken": 540,
  "submittedAt": "2026-10-30T10:30:00",
  "terminationReason": "DEADLINE_EXCEEDED"
}
```

For manual submit, return status SUBMITTED and terminationReason null. Use stable values: DEADLINE_EXCEEDED, BROWSER_VIOLATION_LIMIT, AI_PROCTORING_LIMIT, IDENTITY_MISMATCH, TEACHER_TERMINATED (only if supported), OTHER (fallback only). Never infer a reason from status alone.

### Deadline boundary and manual-submit classification

Capture the server-side decision timestamp once using the configured Clock/timezone; use that exact value for deadline comparison and submittedAt. If the request reaches the backend after the deadline, it is deadline auto-submit even if the browser click happened earlier. A client timestamp is untrusted and must never bypass the server deadline. If useful for diagnostics, accept optional `clientSubmissionInitiatedAt`, but do not use it as the authority. This makes any network-delay edge case diagnosable without weakening the deadline.

## 4. Atomic finalization and idempotency

Review `submitAttempt`, `autoSubmitAttempt`, `autoSubmitForProctoring`, and `finalizeAttempt`:
- Lock the attempt row for every state-changing operation (`findByIdForUpdate`).
- Verify authenticated student ownership before reading/writing answers.
- Re-check IN_PROGRESS while holding the lock.
- Persist the complete final answer sheet before scoring.
- In one transaction, finalize answer rows, score, submittedAt, totalTimeTaken, status and terminationReason.
- Concurrent manual/deadline/proctoring paths must not overwrite the first committed terminal state or its reason.
- Repeated submission must not score/finalize twice. Prefer an idempotency key (e.g. Idempotency-Key) or return a documented conflict that the frontend can reconcile through attempt state.
- If the transaction fails before commit, roll back all finalization writes and leave prior drafts intact.
- If commit succeeds but response is lost, subsequent state/result reads must expose the committed terminal attempt and complete answers.

Do not rely solely on a frontend in-memory single-flight guard.

## 5. Draft answer endpoint

Existing endpoint: `PUT /api/v1/student/attempts/{attemptId}/answers/draft`.

Draft saves are full-sheet upserts by (attemptId, questionId). They must:
- be ownership-checked and allowed only for IN_PROGRESS;
- replace prior selected options, including clearing them when selectedOptionIds is empty;
- set empty selections to UNANSWERED;
- never score or finalize;
- serialize on the same attempt lock as final submit;
- reject after finalization with stable 409 `ATTEMPT_NOT_ACTIVE`;
- never allow an older in-flight draft to overwrite a newer final submit.

## 6. Attempt-state endpoint

Existing endpoint: `GET /api/v1/student/attempts/{attemptId}/state`.

Return attemptId, quizId, status, effectiveDeadline, all persisted answers, totalTimeTaken and nullable terminationReason. The state endpoint is the frontend reconciliation source after timeout, 5xx, conflict, or a browser event that may have reached the policy threshold. Do not serve a stale cache.

Example terminal response:

```json
{
  "attemptId": 123,
  "quizId": 45,
  "status": "AUTO_SUBMITTED",
  "effectiveDeadline": "2026-10-30T10:30:00",
  "answers": [
    {"questionId": 101, "selectedOptionIds": [1001], "responseTimeSeconds": 32},
    {"questionId": 102, "selectedOptionIds": [], "responseTimeSeconds": 18}
  ],
  "totalTimeTaken": 540,
  "terminationReason": "DEADLINE_EXCEEDED"
}
```

## 7. Proctoring event endpoint

Existing endpoint: `POST /api/v1/student/attempts/{attemptId}/proctoring/events`.

Frontend event shape:

```json
{
  "type": "screenshot_attempt",
  "clientEventId": "browser-123-screenshot_attempt-1793356200000",
  "metadata": {
    "source": "browser",
    "details": "Screenshot shortcut detected",
    "detectedAt": "2026-10-30T10:30:00.000Z"
  }
}
```

Required event types: tab_switch, fullscreen_exit, right_click, copy_attempt, cut_attempt, paste_attempt, focus_loss, keyboard_attempt, screenshot_attempt, reconnect_count. Keep refresh_count only for compatibility if needed; a refresh should not automatically be malpractice unless policy explicitly says so.

**Immediate gap:** add native `screenshot_attempt` to the backend allow-list and persist it in the event timeline/report. Do not permanently remap it to keyboard_attempt.

Require ownership, active-attempt validation, unique (attempt_id, client_event_id), stored timestamp/type/source/details/metadata, and server-side idempotency. Repeated clientEventId must be a no-op, including a retry after the first event caused finalization. Count only tab_switch and fullscreen_exit toward the combined browser-policy limit unless policy is deliberately changed. On threshold, set BROWSER_VIOLATION_LIMIT, preserve latest answers and finalize atomically. Screenshot events must appear in teacher review but must not count as tab switches.

## 8. Teacher leaderboard and report DTOs

Each leaderboard student record must expose attemptId, status, terminationReason, score, totalMarks, percentage, totalTimeTaken and registration number. The proctoring report must expose matching status/reason plus the event timeline. Map the entity's terminationReason into both response DTOs; do not ask the frontend to infer it from event counts.

Expected UI semantics:
- SUBMITTED → Submitted
- AUTO_SUBMITTED + DEADLINE_EXCEEDED → Auto-submitted · Deadline
- AUTO_SUBMITTED + BROWSER_VIOLATION_LIMIT / AI_PROCTORING_LIMIT / IDENTITY_MISMATCH → Auto-submitted · Proctoring limit
- Missing reason → generic Auto-submitted (never guess).

## 9. Optional 15-second preparation / activation

If the agreed 15-second preparation flow is still required, make it a backend state transition, not a frontend-only timer:
- Decide whether attempt creation reserves an attempt or starts the official timer.
- Define PREPARING/reserved state or explicit activation endpoint and activation timestamp.
- effectiveDeadline begins at activation, not reservation.
- Activation is ownership-checked and idempotent; reload/retry cannot create a second attempt or reset the preparation window.
- Define expiry and resume behavior for a reservation never activated.
- Keep fresh reference-photo validation tied to the exact attempt.
Do not implement this section until product confirms the 15-second requirement remains in scope.

## 10. LAN/ONLINE parity

Same endpoint paths, DTO fields, status/reason enums, event allow-list and semantics in both modes. Use timezone-explicit timestamps where possible. If legacy timezone-less LocalDateTime remains, document that it means Asia/Kolkata and use the configured Clock consistently. No mode-specific submit/finalization logic.

## 11. Required backend tests

**Submission:** manual before deadline; unanswered questions; deadline expiry with latest answers; invalid/duplicate/foreign questions/options rollback; concurrent submit requests; successful commit with dropped response; exact deadline boundary.

**Drafts:** replacing an answer; clearing to unanswered; post-finalization rejection; concurrent stale draft versus final submit (final submit wins).

**Proctoring:** native screenshot event accepted and reported; duplicate clientEventId stored once; tab/fullscreen below threshold; threshold event finalizes once with BROWSER_VIOLATION_LIMIT and preserves answers; retry after finalization is idempotent; AI limit and identity mismatch have distinct reasons.

**Reports/deployments:** leaderboard and report status/reason match; run contract tests under both LAN and ONLINE deployment configurations.

## 12. Implementation order and handoff evidence

1. Add terminationReason to submit/state/leaderboard/report DTOs and mappings.
2. Verify transaction locking and idempotency across submit/draft/deadline/proctoring.
3. Add native screenshot_attempt and report persistence.
4. Verify deadline boundary and timezone behavior.
5. Implement activation only if product confirms it is still required.
6. Run backend unit, integration, controller and migration tests; deploy to staging.
7. Run integrated tests with the frontend features/frontend branch in LAN and ONLINE.

Backend team should return the PR/commit link, API examples, test results, exact termination-reason enum values, confirmation of native screenshot support, and staging evidence for manual submit, deadline auto-submit and proctoring-limit auto-submit.

**Important:** frontend CI only proves frontend TypeScript/lint/build health. It does not prove backend persistence or end-to-end submission correctness.
