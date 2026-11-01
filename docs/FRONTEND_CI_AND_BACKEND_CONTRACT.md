# Frontend CI Failures and Backend Integration Notes

Audience: frontend developers working on Quiz App  
Repository: `no-usefun/quiz-app`  
CI workflow: `.github/workflows/ci.yml`

## 1. Why the frontend CI job is failing

The workflow's frontend job runs these steps in order:

1. `npm ci`
2. `npm run lint` (runs ESLint)
3. `npm run build` (runs `next build`)

In the recorded failed run, `npm run lint` exited with code 1, so the job failed before the production build step could run. This means the observed failure is currently a **lint failure**, not evidence that `next build` itself fails.

CI log: https://github.com/no-usefun/quiz-app/actions/runs/40736950785  
Frontend job: https://github.com/no-usefun/quiz-app/actions/runs/40736950785

The log reported **263 ESLint errors and 30 warnings**. Main categories include:

- `@typescript-eslint/no-explicit-any`: replace `any` with concrete API types, discriminated unions, `unknown` plus narrowing, or typed error shapes.
- `react-hooks/set-state-in-effect`: avoid synchronously setting state inside an effect when the value can be derived during render or initialized in state. For async loading, model loading/error/data states and update state from the async result rather than using effects only to mirror other state.
- `react-hooks/refs`: do not read or write refs during render. Access refs in event handlers, effects, or callbacks.
- `react-hooks/exhaustive-deps`: make effect dependencies correct; memoize callbacks with `useCallback` only when appropriate and avoid suppressing the rule without justification.
- `react/no-unescaped-entities`: escape literal quotation marks and apostrophes in JSX text (or use appropriate entities).

Unused imports/variables and missing hook dependencies also appear as warnings. Clean them up while touching affected files; do not blanket-disable ESLint rules to make CI green.

## 2. How to reproduce locally

From the repository root:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Fix lint errors first, rerun `npm run lint`, and only then treat the production build result as verified. Use the same Node.js major version as CI (Node 22).

## 3. Backend integration notes for the frontend

These notes describe safe client behavior for the existing student-attempt APIs. Do not infer endpoint paths or request field names from this document; use the API client and controller DTOs in the current branch as the source of truth.

### Attempt submission and retries

- Treat the server's attempt status as authoritative.
- Disable duplicate-submit UI while a submission request is in flight.
- If a request times out or the client loses its connection, fetch the attempt/result state before deciding whether to retry.
- The currently inspected `StudentAttemptService` rejects submissions when the attempt is no longer `IN_PROGRESS` with conflict code `ATTEMPT_ALREADY_SUBMITTED`. Therefore, the frontend must not assume repeated POST submissions are idempotent unless the backend contract is explicitly changed and verified.
- On a conflict, refresh attempt/result state and show the final state rather than repeatedly resubmitting.

### Deadline and time-zone handling

- Quiz scheduling uses the `Asia/Kolkata` time zone in the backend service.
- Treat server-provided timestamps as authoritative; do not decide that a quiz is open/closed solely from the browser's local clock.
- Parse timestamps according to the actual response format returned by the API. Do not append a `Z` or assume UTC unless the response includes an offset or the API contract says it is UTC.
- Display the effective deadline in the user's locale, but preserve the server timestamp for comparisons. Avoid comparing a date-only string or a timezone-less local timestamp as if it were UTC.

### Proctoring events

- Send event types and payload fields that match the backend request DTO and the event-type allowlist. Do not invent event names.
- Make event delivery resilient to transient network errors, but avoid creating duplicate events unless the backend contract defines an idempotency key.
- Do not treat a successful browser-side event enqueue as proof that the server persisted the event; surface or log delivery failures according to the existing UX.

### Error handling

- Handle non-2xx responses using the existing API client's error format.
- Distinguish validation errors, access-denied errors, conflict responses, and transient server/network failures.
- Never interpret a failed submission request as a successful submission. Refresh server state before displaying the final outcome.

## 4. Suggested frontend remediation workflow

1. Run `npm run lint` and group failures by rule and file.
2. Fix high-volume rule families systematically, starting with `no-explicit-any` and invalid effect/ref usage.
3. Add explicit types for API request/response DTOs in one shared module and reuse them in hooks and pages.
4. Review effects for duplicated derived state and missing dependencies; avoid blanket ESLint disable comments.
5. Run `npm run lint` until it exits 0.
6. Run `npm run build` and resolve any separate Next.js/TypeScript build errors.
7. Push the changes and confirm the `Frontend Lint and Build` required status check passes.

## 5. Important distinction

The CI workflow currently gates frontend changes on both lint and production build. Because lint failed first in the captured run, there is not yet a successful CI result proving the frontend production build passes or fails. Once lint is clean, the build step will provide that evidence.

This document records the observed CI output and verified backend behavior; it is not a substitute for checking the current controller/DTO definitions when changing API calls.
