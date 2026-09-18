# DynoQuizz - Feature & Scope Tracker

_Living document for local development tracking._

## 🚀 App Overview

DynoQuizz is a secure, AI-proctored assessment platform designed to measure both accuracy and speed. It features time-decay scoring to reward quick thinking and utilizes edge-AI and browser telemetry to ensure academic integrity without compromising privacy.

---

## ✅ What The App DOES (In-Scope Features)

### Teacher Module

- **Assessment Creation:** Build quizzes with multiple question types (MCQ, Fill-in-the-blank).
- **Advanced Exam Settings:** Toggle negative marking and automated AI penalty deductions.
- **Live Monitoring:** Watch a real-time leaderboard as students take the test.
- **Live Security Alerts:** See immediate red flags if a student breaches proctoring rules.
- **Analytics & Export:** View class averages, highest scores, and export detailed results to CSV.

### Student Module

- **Secure Entry:** Join assessments using a unique 6-digit test code.
- **Time-Decay Test Arena:** A dynamic UI where the timer visually stresses speed, and points decrease the longer a question takes.
- **Post-Test Review:** View total scores, time-adjusted marks, correct/incorrect breakdowns, and any AI flags triggered during the session.

### AI & Proctoring Engine (Client-Side)

- **Browser Telemetry:** Detects and flags tab-switching, exiting fullscreen, right-clicking, and copy/pasting.
- **Webcam Monitoring:** Uses local face-detection to flag missing faces or multiple people in frame (processed locally, no video saved).

---

## ❌ What The App DOES NOT DO (Out of Scope / Non-Goals)

_To prevent the project from becoming too complex, we explicitly are NOT building:_

- **Video Recording Storage:** We do not record or save webcam video feeds to the database (violates privacy and costs too much storage).
- **Automated Essay Grading:** We do not use LLMs to grade long-form text answers.
- **Complex Math/LaTeX Editors:** Questions are currently standard text/code blocks, no heavy equation editors.
- **Payment/Subscription Gateways:** This is strictly an educational tool, no Stripe integration.

---

## 🔮 Future Wishlist (Post-MVP)

_Cool ideas to add if we finish the main build early:_

- [ ] Dark Mode toggle for the test arena.
- [ ] Question Banks (teachers can save questions to reuse later).
- [ ] Code execution environment for programming questions.
- [ ] Export student reports to PDF.

---

## 🧪 Pending Demo Test Flow (UI Verification Sequence)

_Backend API integration is **stubbed out** (all data is served from `localStorage` + seed data in `src/lib/storage.ts`). These tasks verify that the complete UI flow works end-to-end so that swapping in real API calls requires only changes to `useSession.ts` and the relevant page fetch calls._

- [ ] Enter the website as a Teacher or Student using demo credentials (`suryanshudemo@gmail.com` / `suryanshusaini@gmail.com`).
- [ ] Teacher successfully creates a quiz using the UI (`/dashboard/teacher/create`), verifying it appears on the Teacher Dashboard.
- [ ] Student successfully attempts the created quiz by entering its test code at `/join` and completing the test arena at `/test/[testCode]`.

> **Note:** Once the Spring Boot backend is online, the only files requiring changes to restore real API integration are:
> - `src/hooks/useSession.ts` — replace the demo bypass block with a real `POST /api/v1/auth/login` fetch.
> - `src/app/dashboard/teacher/create/page.tsx` — restore `POST /api/v1/teacher/quizzes` and route to the returned `quizCode`.
> - `src/app/test/[testCode]/lobby/page.tsx` — restore `GET /api/v1/quizzes/code/{quizCode}/package`.
