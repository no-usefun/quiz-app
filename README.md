# Quiz App

A full-stack online examination platform with separate teacher and student experiences, server-authoritative quiz attempts, and optional AI-assisted exam proctoring.

## Features

- **Teacher workflows:** create and configure quizzes, manage access, and review submissions and results.
- **Student workflows:** join assessments, save answers, submit attempts, and view results and leaderboards when enabled.
- **Authentication:** account-based authentication and Google OAuth integration.
- **Exam integrity:** server-side attempt validation, deadline enforcement, and persisted proctoring events.
- **AI-assisted proctoring:** a Python service for camera/audio analysis and proctoring telemetry, with Spring Boot remaining authoritative for attempt state, warning counts, persistence, and auto-submission policy.
- **Offline exam support:** supporting backend endpoints and setup guidance.
- **Automated checks:** CI covers backend tests, frontend type-check/build and lint, AI-service tests, and Docker image builds.

> AI-proctoring behavior depends on runtime configuration, camera/microphone permissions, model availability, and connectivity between services. A passing build alone does not verify the full exam flow.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Backend API | Java, Spring Boot, Maven |
| Database | PostgreSQL |
| AI proctoring service | Python, FastAPI |
| CI | GitHub Actions |

## Repository structure

```text
.
├── .github/workflows/   # CI workflows
├── ai-proctoring/       # Python AI-proctoring API, detection modules and tests
├── backend/             # Spring Boot API, business logic and Java tests
├── database/            # PostgreSQL schema, seed data and migrations
├── docs/                # Architecture, integration and branch-audit notes
├── frontend/            # Next.js application
├── LOCAL_TESTING.md     # Local setup and end-to-end testing guide
└── README.md
```

## Run locally

The project has multiple services and a PostgreSQL dependency. Use the setup guide for the required environment variables and the correct startup order.

**Start here:** [Local testing guide](./LOCAL_TESTING.md)

The guide covers database initialization, environment configuration, and running the frontend, backend, and AI service in separate PowerShell windows on Windows.

### Configuration

Use the example environment files as templates:

- [Backend environment example](./backend/.env.example)
- [Frontend environment example](./frontend/.env.example)
- [Frontend LAN environment example](./frontend/.env.lan.example)

Set real credentials and service URLs in your local environment. Do not commit secrets, access tokens, OAuth credentials, private keys, or real exam/student data.

## Developer documentation

- [AI-proctoring integration map](./backend/AI_PROCTORING_INTEGRATION.md)
- [Frontend/backend contract and CI notes](./docs/FRONTEND_CI_AND_BACKEND_CONTRACT.md)
- [Google OAuth role flow](./docs/GOOGLE_OAUTH_ROLE_FLOW.md)
- [Offline exam setup](./backend/OFFLINE_EXAM_SETUP.md)
- [Branch integration audit](./docs/BRANCH_INTEGRATION_AUDIT.md)
- [Frontend deployment notes](./frontend/DEPLOYMENT.md)

## Validation

GitHub Actions runs the repository's automated checks on supported changes. Check the latest run in [Actions](https://github.com/no-usefun/quiz-app/actions) for the current result.

Before treating a change as ready, validate the affected components and perform a local smoke test of the actual flows you depend on. In particular, OAuth redirects, database configuration, AI model loading, camera/microphone permissions, and cross-service networking require environment-level verification.

## Security

Report vulnerabilities privately to the repository maintainer rather than posting credentials or exploitable details in public issues. Never commit production secrets or personal exam data.
