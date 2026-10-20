# AI Proctoring Integration Map (Spring Boot)

## Architecture boundary

The Python AI proctoring service owns biometric inference and media-session lifecycle. The Spring Boot backend remains authoritative for attempt ownership, persistence, warning counts, auto-submission, and teacher reports. The browser currently sends frames/audio directly to the Python service; Spring Boot does not proxy media frames.

## File map

| Concern | Spring Boot file | Responsibility |
|---|---|---|
| AI service URL | `src/main/resources/application.properties` | Configures `app.ai-proctoring.base-url` via `AI_PROCTORING_BASE_URL`; set it to the reachable Python service URL in each environment. |
| AI service health client | `src/main/java/com/quiz_app/backend/service/AiProctoringClient.java` | Calls Python `GET /health`, parses status, biometric readiness and model status; returns DOWN/INVALID_RESPONSE rather than failing application startup. |
| Health API response | `src/main/java/com/quiz_app/backend/dto/proctoring/AiProctoringHealthResponse.java` | Stable response contract for reachability, service status, biometric availability and models. |
| Health endpoint | `src/main/java/com/quiz_app/backend/controller/AiProctoringHealthController.java` | Exposes `GET /api/v1/proctoring/ai-health`; returns 200 when Python reports UP/DEGRADED, otherwise 503. |
| Attempt access validation | `src/main/java/com/quiz_app/backend/controller/ProctoringController.java` and `service/ProctoringService.java` | Authenticated student verifies ownership and active attempt status. |
| Persist a violation | `ProctoringController.java`, `ProctoringService.java`, `dto/proctoring/ProctoringEventRequest.java` | `POST /api/v1/attempts/{attemptId}/events` validates event type, ownership, event idempotency, records event metadata, increments warnings and triggers server-side auto-submit at the configured threshold. |
| Session summary | Same controller/service plus `ProctoringSummaryRequest.java` | `POST /api/v1/attempts/{attemptId}/proctoring-summary` stores summary counters. |
| Teacher reports | `TeacherProctoringController.java`, `ProctoringService.java`, report DTOs and event repository | Teacher-owned quiz/attempt reports and risk summaries. |
| Database mapping | `QuizAttemptProctoringEvent.java`, `QuizAttemptProctoringEventRepository.java`, `database/proctoring_event_idempotency.sql` | Persists event type, timestamp, metadata and optional client event ID; unique attempt/event ID pair supports deduplication. |

## AI event contract

The AI frontend receives telemetry from the Python service. When telemetry confirms a malpractice event, the frontend must POST it to the Spring Boot event endpoint using the authenticated student's bearer token. The request must use the backend DTO's JSON field names:

```json
{
  "eventType": "FACE_NOT_DETECTED",
  "details": "Face was not detected across the configured checks",
  "severity": "HIGH",
  "confidence": 0.91,
  "eventId": "stable-client-generated-event-id"
}
```

Supported event types are currently: `FACE_NOT_DETECTED`, `MULTIPLE_FACES`, `MULTIPLE_PERSONS`, `LOOKING_AWAY`, `PHONE_DETECTED`, `IDENTITY_MISMATCH`, `VOICE_ACTIVITY`, `LOUD_VOICE`, `TAB_SWITCH`, and `FULLSCREEN_EXIT`. The browser must map the AI service's `malpracticeEvent` values to this allow-list and must not send every telemetry frame as a violation.

## Important scope and verification notes

- The new Spring Boot health endpoint checks service reachability only. It does not start/stop an AI session, proxy camera frames, or prove that inference works end-to-end.
- The AI frontend currently talks directly to the Python service. Backend persistence of AI detections depends on the frontend explicitly sending confirmed detections to `POST /api/v1/attempts/{attemptId}/events`.
- Send a stable `eventId` for retries. Without it, the backend cannot deduplicate retried events.
- If supplied, `frameTimestamp` must be Unix epoch seconds from 2000-01-01 onward and no more than five minutes in the future. Omit it if the client has no epoch timestamp; the backend records the current server time.
- `severity` may be omitted (the backend applies an event-based default), but a supplied severity must be `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. Confidence must be between 0 and 1.
- Summary counters must be non-negative, and `identityMatches + identityMismatches` cannot exceed `totalFaceChecks`.
- Configure `CORS_ALLOWED_ORIGINS` as a comma-separated list of exact frontend origins (for example, `https://frontend.example.com`). If unset, the backend falls back to `FRONTEND_URL`; do not use a wildcard when credentials are enabled.
- Keep the backend's persisted warning count and attempt status authoritative. A client-side warning count alone must not auto-submit an attempt.
- Configure `AI_PROCTORING_BASE_URL` to the reachable Python service URL in each environment. For local development, the default is `http://localhost:8000`.
- The health endpoint and Java changes have not been built or tested in this GitHub-only edit. Run the backend test suite and an integration test against the running Python service before marking the integration verified.
