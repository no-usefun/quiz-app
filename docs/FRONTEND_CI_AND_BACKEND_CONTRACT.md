# Frontend CI and backend integration notes

Repository: `no-usefun/quiz-app`  
CI workflow: `.github/workflows/ci.yml`

## CI behavior

The workflow runs backend Maven verification against PostgreSQL, frontend TypeScript checking and production build, frontend ESLint, AI-proctoring pytest, and Docker image builds. TypeScript/build and ESLint are separate jobs so a lint failure does not prevent us from seeing whether the frontend typecheck/build passes.

The previous CI run against the older frontend implementation on `main` reported a large ESLint backlog. The current `frontend-integration` branch's Frontend CI run passed on October 31, 2026: https://github.com/no-usefun/quiz-app/actions/runs/41210767788. Re-check the current workflow results for every new commit; a past run is not proof that a later commit passes.

Run checks locally from the repository root:

```powershell
cd frontend
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

Use Node.js 22, matching CI.

## Attempt submission and retries

- Treat the server's attempt status as authoritative.
- Disable duplicate-submit UI while a submission request is in flight.
- If a request times out or the client loses its connection, fetch the attempt/result state before deciding whether to retry.
- The current backend branch updates submission handling to return the committed result for a retry after successful submission. Verify this behavior with the service tests and endpoint-level tests before relying on it in production.
- On a conflict or ambiguous response, refresh attempt/result state and show the server's final state instead of repeatedly resubmitting.

## Deadline and time-zone handling

- Quiz scheduling uses the configured exam time zone; local setup defaults to `Asia/Kolkata`.
- Treat server-provided timestamps as authoritative; do not decide that a quiz is open/closed solely from the browser's local clock.
- Parse timestamps according to the actual response format returned by the API. Do not append a `Z` or assume UTC unless the response includes an offset or the API contract says it is UTC.
- Display the effective deadline in the user's locale, but preserve the server timestamp for comparisons. Avoid comparing a timezone-less local timestamp as if it were UTC.

## Proctoring events

- Send event types and payload fields that match the backend request DTO and event-type allowlist. Do not invent event names.
- Make event delivery resilient to transient network errors, and use an idempotency key when the backend contract supports it.
- Do not treat a successful browser-side event enqueue as proof that the server persisted the event; inspect the server response and logs.

## Error handling

- Handle non-2xx responses using the existing API client's error format.
- Distinguish validation errors, access-denied errors, conflict responses, and transient server/network failures.
- Never interpret a failed submission request as a successful submission. Refresh server state before displaying the final outcome.

## Local end-to-end test

Follow [LOCAL_TESTING.md](../LOCAL_TESTING.md) to initialize PostgreSQL and start the backend, AI service, and frontend. Test teacher quiz creation, student exam access, answer persistence, deadline enforcement, submission retries, browser violations, AI event delivery, and teacher proctoring reports. A successful build alone does not validate cross-service behavior.
