# Online Quiz & Examination Platform

A full-stack online assessment platform with separate teacher and student workflows, server-authoritative quiz attempts, and an optional AI-assisted proctoring service. The repository contains the web application, backend API, database-related code, and the Python proctoring service.

## Core capabilities

### Teacher
- Create and configure quizzes, questions, options, schedules, and availability.
- Control student access using allowed-student rules.
- Review submissions, results, leaderboards, and proctoring summaries.
- Manage exam settings and result visibility.

### Student
- Discover and access available quizzes.
- Join assessments and complete timed attempts.
- Save answers and submit attempts.
- View results and leaderboard information when enabled.
- Use QR-based access flows supported by the frontend.

### Exam integrity and proctoring
- Spring Boot validates exam access and remains authoritative for attempt state and submission rules.
- Proctoring events are persisted by the backend for review.
- The Python service provides AI-assisted camera/audio analysis and event telemetry, including face, identity, gaze, person, phone, and audio-related detection modules.
- The platform includes offline-exam support.

> AI-assisted proctoring depends on camera/microphone permissions, model availability, runtime configuration, and connectivity between services. Detection output should be reviewed in context; it is not a substitute for human judgement.

## Architecture

```text
                 Student / Teacher Browser
                           |
                           v
                 Next.js + React + TypeScript
                           |
                           | REST / HTTPS
                           v
                 Spring Boot Backend (Java)
                    |              |
                    v              v
                PostgreSQL     AI Proctoring API
                                  (FastAPI / Python)
                                       |
                                       v
                              Detection modules
                         (face, gaze, person, phone,
                              audio, identity)
```

The backend owns authentication, authorization, quiz lifecycle, attempt validation, persistence, and final submission decisions. The AI service supplies proctoring analysis and events; it does not replace backend exam-access validation.

## Technology stack

| Component | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS, Framer Motion, Lucide |
| Backend | Java, Spring Boot, Maven |
| Persistence | PostgreSQL, Spring Data JPA / Hibernate |
| Authentication | Spring Security, JWT, OAuth 2.0 / Google sign-in |
| AI service | Python, FastAPI, OpenCV, NumPy, Ultralytics |
| Testing | JUnit, Node test runner, pytest |
| Delivery | Docker, GitHub Actions |

## Repository structure

```text
.
├── .github/workflows/  # GitHub Actions workflows
├── ai-proctoring/      # FastAPI service, detection modules and tests
├── backend/            # Spring Boot API, domain logic and Java tests
├── database/           # Database assets and scripts
├── docs/               # Architecture and integration documentation
├── frontend/           # Next.js application
├── LOCAL_TESTING.md    # Local setup and test guide
└── README.md
```

## Run locally

This project runs as multiple services and requires PostgreSQL. Follow the repository's setup guide for the complete environment-variable list, database preparation, service startup order, and local testing procedure.

**Start here:** [LOCAL_TESTING.md](./LOCAL_TESTING.md)

### Prerequisites

- Java 21
- Node.js and npm
- Python compatible with `ai-proctoring/requirements.txt`
- PostgreSQL
- Git

### Service entry points

| Service | Directory | Development command |
| --- | --- | --- |
| Frontend | `frontend/` | `npm install` then `npm run dev` |
| Backend | `backend/` | `./mvnw spring-boot:run` |
| AI proctoring | `ai-proctoring/` | Install `requirements.txt`, then run the FastAPI app with Uvicorn |

On Windows, use `mvnw.cmd` in place of `./mvnw`. Configure service URLs, credentials, OAuth settings, and database connection values using the example environment files and the local testing guide. Never commit real credentials or student/exam data.

## Developer documentation

- [Local setup and testing](./LOCAL_TESTING.md)
- [AI-proctoring integration map](./backend/AI_PROCTORING_INTEGRATION.md)
- [Frontend/backend contract and CI notes](./docs/FRONTEND_CI_AND_BACKEND_CONTRACT.md)
- [Google OAuth role flow](./docs/GOOGLE_OAUTH_ROLE_FLOW.md)
- [Offline exam setup](./backend/OFFLINE_EXAM_SETUP.md)
- [Branch integration audit](./docs/BRANCH_INTEGRATION_AUDIT.md)
- [Frontend deployment notes](./frontend/DEPLOYMENT.md)

## Validation

Use the repository's GitHub Actions workflows and component-specific tests when changing code. A successful build does not, by itself, verify the full exam experience. Before deployment, smoke-test authentication, role-based access, quiz creation, student attempts, submission/result visibility, database connectivity, and (when enabled) camera/microphone permissions and AI-service communication.

See the [Actions tab](https://github.com/no-usefun/quiz-app/actions) for workflow runs.

## Security and privacy

- Keep database credentials, JWT secrets, OAuth credentials, API tokens, and private keys out of version control.
- Do not commit real student records, exam submissions, identity images, or proctoring media.
- Restrict access to proctoring reports and student assessment data according to the deployment's authorization policy.
- Report security issues privately to the repository maintainer.

## Project

Maintained by **Harsh Agarwal** and contributors.  
[GitHub repository](https://github.com/no-usefun/quiz-app)
