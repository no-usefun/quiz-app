# Quizly AI Proctoring — Backend Team Requirements

**Status:** Frontend integration contract / implementation checklist  
**Frontend integration branch:** `integrate-frontend-into-main`  
**Reference implementation:** `features/ai-proctoring-v2`  
**Scope of this document:** Spring Boot API, Python AI service integration, security, data persistence, deployment, and acceptance tests.  
**Important:** This document does not mean backend/database code has been changed in the frontend integration branch. The backend team should review and confirm this contract before merging or deploying backend changes.

---

## 1. Goal and expected user journey

AI proctoring is required for every student assessment attempt. The student should:

1. Open the assessment lobby and pass the existing server-side availability/eligibility checks.
2. See a clear disclosure that the camera and microphone are used for proctoring.
3. Capture a reference photo in the lobby.
4. Grant camera and microphone permissions and enter the assessment only after AI proctoring initializes and the reference identity is verified.
5. See live proctoring status and any confirmed warnings while attempting the assessment.
6. Have all browser and AI events associated with the same authenticated attempt.
7. Have AI resources stopped and a final summary saved on submission, auto-submission, or termination.

If the AI service is unavailable, the student must receive a clear retry/error path; the UI must not silently present the attempt as AI-proctored. The backend must be the authoritative source for attempt ownership, event persistence, warning count, warning threshold, and final attempt status.

## 2. Current contract versus V2 contract: resolve before release

The current application already has an event endpoint:

- `POST /api/v1/student/attempts/{attemptId}/proctoring/events`
- The current frontend sends `{ type, metadata: { source: "browser" } }`.

The V2 frontend/AI service expects a unified attempt-level contract, including:

- `GET /api/v1/attempts/{attemptId}/verify-access`
- `POST /api/v1/attempts/{attemptId}/events`
- `POST /api/v1/attempts/{attemptId}/proctoring-summary`

The current endpoint and V2 event endpoint are **not automatically interchangeable**: request fields, response semantics, and security requirements differ. Please choose and document one canonical contract. The frontend branch is being adapted to the V2 contract; the backend team may implement these routes or agree with the frontend owner on a compatibility adapter. Do not allow two independent warning counters.

## 3. Spring Boot APIs required by the V2 frontend / AI service

### 3.1 Verify access to an active attempt

**Endpoint:** `GET /api/v1/attempts/{attemptId}/verify-access`

**Purpose:** The Python AI service calls this before it starts processing frames. It must validate the authenticated student and the server-owned attempt; request-body claims must never establish identity.

Expected response fields (exact envelope to be confirmed by backend team):

```json
{
  "valid": true,
  "attemptId": 123,
  "studentId": "456",
  "testCode": "ABC123",
  "status": "IN_PROGRESS",
  "warningCount": 0,
  "maxWarnings": 3
}
```

Requirements:

- Validate the JWT and ensure the authenticated student owns the attempt.
- Confirm the attempt is still active and belongs to the supplied quiz/test code.
- Return the persisted warning count and configured warning limit.
- Reject submitted, expired, unauthorized, or nonexistent attempts using consistent status codes and error codes.
- Do not trust the student's `studentId`, `attemptId`, or test code merely because the browser sent them.
- Define a secure service-to-service strategy if forwarding a student's bearer token to the AI service is not acceptable. Never expose service secrets to the browser.

### 3.2 Record a proctoring event (single source of truth)

**Endpoint:** `POST /api/v1/attempts/{attemptId}/events`

**V2 request shape:**

```json
{
  "eventType": "TAB_SWITCH",
  "details": "Candidate switched away from the assessment window",
  "severity": "HIGH",
  "confidence": 1.0
}
```

Recommended response shape:

```json
{
  "recorded": true,
  "warningCount": 1,
  "maxWarnings": 3,
  "warningExceeded": false,
  "autoSubmitted": false,
  "message": "Proctoring event recorded"
}
```

Requirements:

- Support the event types already emitted by V2: `TAB_SWITCH`, `FULLSCREEN_EXIT`, and confirmed AI findings such as face-not-detected, multiple faces/persons, identity mismatch, sustained looking-away, voice activity, or suspicious device/phone detection.
- Confirm the exact allowed enum values with the AI service and frontend before implementation.
- Store event time, attempt ID, type, severity/confidence where available, source (browser or AI), and safe diagnostic details.
- Use one persisted authoritative warning counter for both browser and AI events. Return the persisted counter from each countable event.
- De-duplicate simultaneous browser signals (e.g. `visibilitychange` plus `blur`) and prevent duplicate AI events from repeated frames. A repeated telemetry frame must not automatically create another warning.
- Apply the agreed threshold/auto-submit rule on the server. The V2 UI defaults to three warnings, but the backend must return/configure the actual limit and remain authoritative.
- Enforce event ordering/idempotency where practical. Retried HTTP calls must not produce duplicate strikes for the same event ID.
- If an event is received after the attempt has ended, return a clear error and do not reopen or modify the attempt.
- Keep the existing endpoint compatible during transition or explicitly migrate all callers; do not silently break current browser event logging.

### 3.3 Save final AI summary

**Endpoint:** `POST /api/v1/attempts/{attemptId}/proctoring-summary`

The Python service calls this when an AI session stops or is finalized. Define a validated request DTO containing, as appropriate:

- AI session ID (opaque identifier, not a secret).
- Total analyzed frames / verifications.
- Identity matches and mismatches.
- Confirmed warning count and maximum warning threshold.
- A bounded list or reference to recorded findings (avoid sending raw video/audio blobs).
- Session start/end timestamps and a terminal reason (submitted, auto-submitted, disconnected, cancelled).

Requirements:

- Validate that the authenticated/service caller is authorized for this attempt.
- Make finalization idempotent.
- Persist summary metadata against the same attempt and make it available to the authorized teacher report API.
- Do not overwrite the canonical event history or reduce a persisted warning count when a late summary arrives.
- Return a success response only after the summary is persisted (or clearly document asynchronous persistence).

### 3.4 Leaderboard response must expose attempt ID

The teacher assessment page may list a student ID/rank in the leaderboard row, but the AI audit report endpoint is keyed by **attempt ID**. These identifiers are not interchangeable.

Requirements:

- Add a numeric `attemptId` field to each eligible leaderboard entry, sourced from that student's actual `QuizAttempt` record.
- Keep `studentId` as a distinct field. Do not relabel `studentId`, `rank`, or an array index as `attemptId`.
- The frontend shows the **AI Audit** action only when a valid `attemptId` is present.
- The report endpoint must confirm that the requested attempt belongs to the specified quiz and that the authenticated teacher is authorized to view it.
- If a row represents no attempt (or the backend cannot resolve one), omit `attemptId`; the frontend must not guess.

### 3.5 Teacher reports

The V2 branch includes a teacher report UI referencing:

- `GET /api/v1/teacher/proctoring/quizzes/{quizCode}/report`
- `GET /api/v1/teacher/proctoring/attempts/{attemptId}`

Requirements:

- Restrict both endpoints to an authenticated teacher who owns or is authorized to manage the quiz.
- Return per-attempt summaries and a quiz-level overview, without exposing raw biometric material by default.
- Use stable DTO schemas and return empty collections rather than null for list fields.
- Prevent student access to other candidates' reports.

### 3.6 AI service routes (Python FastAPI)

The existing V2 client expects the following service routes:

| Route | Method | Purpose |
|---|---|---|
| `/health` | GET | AI service and model readiness |
| `/proctor/start` | POST | Validate the active attempt, register reference photo, create session |
| `/proctor/analyze-frame` | POST | REST fallback for one frame/audio sample |
| `/proctor/stop` | POST | Stop session and finalize summary |
| `/ws/proctor/{session_id}` | WebSocket | Authenticated streaming telemetry |

The V2 browser client uses a WebSocket authentication handshake as the first message:

```json
{
  "type": "auth",
  "ticket": "<short-lived-session-ticket>",
  "authToken": "<student-bearer-token>",
  "studentId": "456",
  "attemptId": 123
}
```

Subsequent frames carry a base64-encoded JPEG frame and optional bounded PCM audio samples, sample rate, and the latest warning count. The service returns telemetry including face/identity/gaze/person/phone/voice signals, warning count, and any confirmed malpractice event.

Requirements:

- Validate the session ticket and bind it to the already verified student, attempt, and test code.
- Use short-lived, single-session tickets and reject replayed/expired tickets.
- Never allow the browser to choose an arbitrary Spring Boot URL for privileged server-to-server calls. The service must use its server-side `SPRING_BOOT_URL` configuration.
- Validate payload sizes/rates and bound frame/audio processing queues to prevent resource exhaustion.
- Reject malformed frames/sessions safely and close WebSocket sessions after attempt termination.
- Do not log bearer tokens, reference photos, raw audio, or raw video.
- Make `/health` report real model readiness rather than merely reporting that the HTTP process is alive.

## 4. Attempt lifecycle and fail-closed requirements

The current frontend creates/resumes an attempt in the lobby, then initializes AI proctoring in the exam page. That sequencing can consume the server assessment deadline while the camera/model/service is still initializing.

Before release, please agree on a backend-supported lifecycle that meets all of the following:

1. A student cannot answer questions until the AI service has initialized for that exact active attempt and the first valid telemetry/identity check has succeeded.
2. An unavailable AI service or denied required camera/microphone permission must not silently permit an unmonitored attempt.
3. The user sees a clear retry path and an explanation of the required permissions.
4. The assessment's authoritative timer is not unfairly consumed during AI initialization. Prefer an explicit server-side prepare/start transition or another server-enforced initialization state, rather than trusting a browser-only boolean.
5. The backend remains authoritative for whether the attempt can transition to active, remain active, or be auto-submitted.
6. A resumed attempt cannot accidentally start a second AI session with duplicate event counting.

Please propose an explicit state/endpoint contract, for example a server-controlled proctoring-initialization state plus a finalization endpoint to activate timing after a valid AI session handshake. Agree on the state names and transitions with the frontend owner before implementation; do not introduce uncoordinated enum values.

## 5. Warning counts and automatic submission

- PostgreSQL/Spring Boot is the authoritative source of truth for warning count and attempt status.
- Python's session counter must initialize from the backend verification response and reconcile with the persisted maximum on each frame/event response.
- Frontend state must be monotonic: a stale telemetry packet must never reduce the warning count.
- The warning modal and HUD should display the same count.
- At the configured threshold, the backend must atomically mark the attempt auto-submitted if policy requires it, record the auto-submit event, and reject later answers/events.
- Define how normal submit and auto-submit race; only one terminal transition should win.
- Return enough information for the frontend to reconcile attempt state after a timeout/network failure without submitting answers twice.

## 6. Security, privacy, and retention

- Authenticate every Spring Boot attempt/event/report endpoint and authorize by attempt ownership / quiz ownership.
- Do not accept student IDs or attempt IDs from the client without checking them against the principal and database.
- Apply payload size limits, rate limits, timeouts, and request validation.
- Require HTTPS/WSS for deployed environments; permit plain HTTP/WS only for local development.
- Restrict CORS to configured frontend origins. Do not use wildcard origins with credentials.
- Ask for camera/microphone permissions only with a clear disclosure.
- The frontend stores the reference photo in session-scoped browser storage for the current flow. Do not introduce persistent server-side storage of raw imagery without an explicit requirement and retention policy.
- Prefer storing event metadata and numeric telemetry over raw audio/video. Define deletion/retention periods for reference images and reports.
- Limit teacher report access and avoid including biometric templates or raw camera/audio in ordinary report responses.
- Log identifiers and error codes for diagnosis, not credentials or media payloads.

## 7. Database review and migration requirements

The V2 branch contains an additive schema migration with multiple tables and schema changes, not all necessarily required for this feature. **Do not blindly apply the entire V2 migration to the current database.**

The backend/database team should:

1. Compare the current `main` schema/entities with V2's entities and the existing `quiz_attempt_proctoring_events` table.
2. Confirm whether the existing attempt already has warning count, max-warning configuration, terminal status, and event storage.
3. Produce a reviewed, idempotent, additive migration containing only missing objects/columns/indexes required for the agreed proctoring contract.
4. Preserve current quiz, attempt, result, and authentication records.
5. Test the migration against a copy of the current schema and existing data.
6. Provide a rollback/forward-repair plan and verify deployment startup against the migrated schema.

Suggested indexes should support lookups by attempt and event time/type; exact DDL is for the backend/database team to determine after schema review.

## 8. Configuration and deployment

### Frontend environment variables

The V2 frontend client reads:

- `NEXT_PUBLIC_AI_PROCTORING_URL` — local default `http://localhost:8000`; production must use the HTTPS URL of the deployed AI service.
- `NEXT_PUBLIC_AI_PROCTORING_WS_URL` — local default `ws://localhost:8000`; production must use the WSS URL.

These are browser-visible URLs, not secrets. Do not put service credentials in `NEXT_PUBLIC_*` variables.

### Python service variables

The V2 service reads server-side configuration including:

- `SPRING_BOOT_URL` — Spring Boot base URL reachable from the Python runtime.
- `PROCTOR_FRONTEND_ORIGINS` — comma-separated allowed frontend origins.
- `HOST` / `PORT` — bind configuration.
- Model paths and model download configuration for YuNet/SFace and optional YOLO detectors.

The exact deployed values, service URL, health URL, model-cache location, and runtime resource limits must be supplied by the deployment owner.

### Local test topology

- Next.js frontend: `http://localhost:3000`
- Spring Boot backend: `http://localhost:8080`
- Python AI service: `http://localhost:8000`
- PostgreSQL: typically `localhost:5432`

All three services must be started and configured together for end-to-end proctoring. A frontend-only build does not establish that the backend/AI contract works.

## 9. Acceptance test checklist

### Security and attempt ownership
- Student A cannot initialize AI or log events for Student B's attempt.
- Teacher A cannot read Teacher B's proctoring reports.
- Invalid, expired, or replayed WebSocket tickets are rejected.
- Ended/submitted attempts cannot emit new countable warnings or accept answers.

### AI initialization and permissions
- Camera/microphone denied, missing, busy, or unsupported.
- Reference image missing, malformed, or no face detected.
- AI service offline, model unavailable, or backend verification rejected.
- WebSocket disconnects and REST fallback recovers.
- Student cannot interact with questions until required proctoring initialization succeeds.
- Retry after transient failure does not leak camera tracks, audio contexts, sockets, or duplicate server sessions.

### Event correctness
- Tab switch + window blur from one action creates no duplicate strike.
- Fullscreen exit is recorded separately when appropriate.
- Sustained confirmed AI finding produces one governed warning rather than one warning per frame.
- HUD, modal, Python, and persisted backend warning counts never move backwards.
- Warning threshold and normal-submit race results in one authoritative terminal state.

### Assessment regression
- Existing answer selection, multi-select questions, marked-for-review state, answer persistence, question navigation, overall timer, and manual submission still work.
- A timed-out attempt reconciles with backend state correctly.
- Results and leaderboard access remain unchanged.
- AI cleanup runs on manual submit, timeout, auto-submit, component unmount, and navigation.

### Build and deployment
- Backend unit/integration tests pass.
- Python service tests pass with model-dependent tests clearly identified.
- Frontend lint/build pass.
- Local end-to-end test passes using the configured local services.
- Staging test passes over HTTPS/WSS before production rollout.

## 10. Implementation ownership

| Area | Owner |
|---|---|
| AI HUD, lobby reference capture, frontend lifecycle, UI error/retry states | Frontend team |
| Spring Boot controllers/services/DTOs/security and event contract | Backend team |
| Python detection runtime/session handling/model readiness | AI service owner |
| PostgreSQL schema review and additive migration | Backend/database team |
| Cross-service contract tests and staging rollout | Joint |

## 11. Source references

- V2 verification and architecture report: `AI_PROCTORING_TEST_REPORT.md` on `features/ai-proctoring-v2`
- Python route and WebSocket implementation: `ai-proctoring/api/routes.py` and `ai-proctoring/api/websocket.py`
- Frontend HTTP/WebSocket client: `frontend/src/lib/proctoring/aiProctoringClient.ts`
- Frontend AI hook: `frontend/src/hooks/useProctoring.ts`
- Frontend reference capture, HUD, and warning modal: `frontend/src/components/CameraReferenceCapture.tsx`, `AIProctoringHUD.tsx`, and `ProctoringWarningModal.tsx`
- Spring Boot reference implementation: `backend/src/main/java/com/quiz_app/backend/controller/ProctoringController.java` and `ProctoringService.java`
- V2 additive migration to review—not blindly apply: `database/additive_schema_migration.sql`

Backend team: please confirm the endpoint/request/response contract in Section 3 and the initialization/timer transition in Section 4 before making implementation changes. Any required contract changes should be coordinated with the frontend team first.
