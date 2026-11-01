# Local testing guide (Windows / PowerShell)

This guide starts all three services locally. Use separate PowerShell windows. Use Java 21, Node.js 22, Python 3.11, and PostgreSQL 16 or newer.

## 1. Initialize PostgreSQL

Create a fresh database named `online_quiz_exam` in pgAdmin or psql. Do not run the clean schema over a database that contains data you need to preserve.

With psql installed, run from the repository root (replace the username if needed):

```powershell
createdb -U postgres online_quiz_exam
psql -U postgres -d online_quiz_exam -v ON_ERROR_STOP=1 -f .\database\schema.sql
psql -U postgres -d online_quiz_exam -v ON_ERROR_STOP=1 -f .\database\seed.sql
```

If you created the database in pgAdmin, skip `createdb` and run the two `psql` commands. The schema is designed for a new empty database. Hibernate is configured with `ddl-auto=validate`, so the SQL schema must match the entity mappings.

## 2. Configure and start Spring Boot

In PowerShell window 1:

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

Set at least these values in `backend/.env` (use your actual local PostgreSQL password):

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=online_quiz_exam
DB_USERNAME=postgres
DB_PASSWORD=YOUR_LOCAL_POSTGRES_PASSWORD
SPRING_PROFILES_ACTIVE=local-exam
JWT_SECRET=local-only-change-this-to-a-long-random-secret-at-least-32-bytes
JWT_EXPIRATION_MS=86400000
EXAM_TIME_ZONE=Asia/Kolkata
AI_PROCTORING_BASE_URL=http://localhost:8000
```

Replace the sample JWT secret with a long random value and never reuse it in production. Save the file, then run:

```powershell
.\mvnw.cmd spring-boot:run
```

The backend should listen on `http://localhost:8080`. The local-exam profile disables Google OAuth and email verification, so use the local password-based account flow. Register a development teacher/student account through the UI; `seed.sql` creates roles only, not demo users.

## 3. Configure and start the AI proctoring service

In PowerShell window 2:

```powershell
cd ai-proctoring
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
$env:SPRING_BOOT_URL = "http://localhost:8080"
$env:PROCTOR_FRONTEND_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
python app.py
```

The AI service should listen on `http://localhost:8000`. Open `http://localhost:8000/health` to check its health endpoint. On first startup, the service may download model files; allow network access and wait for model initialization. If PowerShell blocks virtual-environment activation, use `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.\.venv\Scripts\python.exe app.py` instead.

## 4. Configure and start the frontend

In PowerShell window 3:

```powershell
cd frontend
Copy-Item .env.example .env.local
notepad .env.local
```

For a single-PC setup, ensure the active values are:

```dotenv
NEXT_PUBLIC_EXAM_MODE=LAN
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_AI_PROCTORING_URL=http://localhost:8000
NEXT_PUBLIC_AI_PROCTORING_WS_URL=ws://localhost:8000
ALLOWED_DEV_ORIGINS=localhost:3000,127.0.0.1:3000
```

Make sure only one set of mode/API values is active in `.env.local`. Save it, then run:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`.

The browser calls Spring Boot through the Next.js `/backend` proxy. AI HTTP/WebSocket traffic is direct from the browser to `localhost:8000`, so keep the AI service running for proctoring tests. For testing from a second device on your Wi-Fi, replace localhost with the host PC's LAN IP in the frontend AI/backend URLs and configure the backend and AI origins accordingly.

## 5. First smoke test

1. Confirm PostgreSQL is running and the schema/roles loaded.
2. Confirm the backend starts without Hibernate schema-validation errors.
3. Confirm `http://localhost:8000/health` responds.
4. Open the frontend and create/login with a local account.
5. Create a quiz as a teacher and publish/schedule it.
6. Join as a student and test starting, answering, saving, submitting, and viewing results.
7. If AI proctoring is enabled, grant camera/microphone permission and verify the AI service, browser events, and teacher report.
8. Check the backend and AI service terminals when a request fails; the frontend message alone may not show the upstream cause.

## 6. Useful validation commands

Backend tests (requires the configured test database):

```powershell
cd backend
.\mvnw.cmd clean verify
```

Frontend checks:

```powershell
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

AI service tests:

```powershell
cd ai-proctoring
python -m pytest -q
```

The integrated frontend branch's recorded Frontend CI passed. The broader CI also keeps lint separate from TypeScript/build so each failure is independently visible. Run these checks on your local branch and resolve any failures before treating the application as ready.
