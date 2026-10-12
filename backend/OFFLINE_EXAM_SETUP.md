# LAN-Only Offline Exam Backend

## Architecture

Student/Teacher Browser -> LAN HTTP -> Spring Boot -> Local PostgreSQL

Student devices never connect to PostgreSQL directly.

## Local profile

Use `local-exam` explicitly:

```powershell
$env:SPRING_PROFILES_ACTIVE="local-exam"
.\mvnw.cmd spring-boot:run
```

Required local database variables:

```text
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=online_quiz_exam
DB_USERNAME=postgres
DB_PASSWORD=<local-password>
JWT_SECRET=<local-secret>
JWT_EXPIRATION_MS=3600000
SERVER_ADDRESS=0.0.0.0
PORT=8080
EXAM_TIME_ZONE=Asia/Kolkata
```

Create the database in PostgreSQL/pgAdmin and run `database/schema.sql` before starting Spring Boot. The schema now includes `offline_exams`.

## Online -> local data preparation

The application deliberately does not switch between Neon and local PostgreSQL per request. Therefore the initial data transfer is an infrastructure step performed before the exam. Restore/import the required quiz, questions, options, allowed students, teacher and student accounts into `online_quiz_exam`.

After the local database has the required rows, authenticate as the quiz owner and call:

```http
POST /api/v1/teacher/offline-exams/{quizId}/prepare
```

`prepare` validates that the local snapshot contains the quiz, questions, options/correct answers, allowed students and local password-backed student accounts. It then records the exam as `READY`.

## Exam lifecycle

```text
PREPARING -> READY -> RUNNING -> ENDED
```

Administrative endpoints:

```text
POST /api/v1/teacher/offline-exams/{quizId}/prepare
GET  /api/v1/teacher/offline-exams/{quizId}/status
POST /api/v1/teacher/offline-exams/{quizId}/start
POST /api/v1/teacher/offline-exams/{quizId}/end
```

`start` marks the local exam `RUNNING` and marks the existing quiz exam state `RUNNING`. `end` marks both as ended.

## LAN access

Spring Boot binds to `0.0.0.0` in the local profile. Find the exam laptop LAN/hotspot address with `ipconfig`, allow TCP port 8080 through the private Windows firewall, and have clients use:

```text
http://<BACKEND-LAN-IP>:8080
```

Do not use `localhost` on a student laptop.

## Authentication during exam

Local email/password + BCrypt + JWT remain the authentication path. Google OAuth and email-dependent authentication features are disabled in the `local-exam` profile.

Students should already have local account rows with password hashes before the exam. The JWT format and role checks remain unchanged.

## Health

`GET /api/v1/health` reports backend status, database connectivity, exam mode and the currently running offline exam.

## Important operational test

After preparation and before admitting students:

1. Start PostgreSQL locally.
2. Start Spring Boot with `local-exam`.
3. Confirm `/api/v1/health` reports `LOCAL_EXAM` and database connectivity.
4. Connect student laptops to the exam laptop hotspot/LAN.
5. Confirm students can reach the backend LAN IP.
6. Test login, attempt start, autosave, submission, scoring and results.
7. Disconnect Internet from the exam laptop while leaving the LAN/hotspot active.
8. Repeat the critical exam flow and confirm it still works.
