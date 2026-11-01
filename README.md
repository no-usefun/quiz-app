# Quiz App

Full-stack online examination platform built with a Next.js/React frontend, Spring Boot 4 backend, PostgreSQL, and a Python FastAPI AI-proctoring service.

## Repository layout

- `frontend/` — Next.js UI and same-origin API proxy.
- `backend/` — Spring Boot REST API, authentication, exam lifecycle, scoring, and proctoring policy.
- `database/schema.sql` — PostgreSQL schema for a new local database.
- `database/seed.sql` — required development roles.
- `ai-proctoring/` — FastAPI service for camera-based proctoring and telemetry.

## Run locally on Windows

Follow [LOCAL_TESTING.md](./LOCAL_TESTING.md). It covers database initialization, local environment configuration, and starting the backend, AI service, and frontend in separate PowerShell windows.

## Current validation notes

- The frontend integration branch contains the latest frontend implementation based on the current backend base.
- The CI pipeline runs backend tests, frontend TypeScript/build, frontend ESLint, AI-service tests, and Docker builds as separate checks.
- Frontend lint has previously reported a large set of existing ESLint violations. The lint check remains visible and failing rather than being silently ignored; TypeScript/build checks run independently so their results are still available.
- Local execution does not guarantee that OAuth, AI model downloads, camera access, database configuration, or cross-service networking are configured correctly. Test those flows on the machine and network you intend to use.

Do not commit real credentials, tokens, or personal exam data.
