# Quiz App

Full-stack online examination platform built with a Next.js/React frontend, Spring Boot 4 backend, PostgreSQL, and a Python FastAPI AI-proctoring service.

## Repository layout

- `frontend/` — Next.js UI and same-origin API proxy.
- `backend/` — Spring Boot REST API, authentication, exam lifecycle, scoring, and proctoring policy.
- `database/schema.sql` — PostgreSQL schema for a new local database.
- `database/seed.sql` — required development roles.
- `ai-proctoring/` — FastAPI service for camera-based proctoring and telemetry.

## Run locally on Windows

Follow [LOCAL_TESTING.md](./LOCAL_TESTING.md) for PostgreSQL initialization, environment configuration, and starting the backend, AI service, and frontend in separate PowerShell windows.

## Validation notes

- The integrated frontend branch's Frontend CI run passed on October 31, 2026: https://github.com/no-usefun/quiz-app/actions/runs/41210767788
- An older CI run against the previous frontend on `main` reported extensive ESLint errors. The current CI keeps ESLint as an independent visible check and runs TypeScript/build checks separately, so one result does not hide another.
- The full application still requires a local smoke test with the required runtimes, PostgreSQL, AI model files, camera permissions, and correctly configured service URLs.
- A successful build does not prove that OAuth, AI model downloads, database configuration, or cross-service networking work in your environment.

Do not commit real credentials, tokens, or personal exam data.
