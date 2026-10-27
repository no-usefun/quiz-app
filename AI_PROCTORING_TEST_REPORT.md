# AI Proctoring V2 Verification & Architecture Report

**Branch**: `features/ai-proctoring-v2`  
**Repository**: `https://github.com/no-usefun/quiz-app`  
**Date**: October 11, 2026  

---

## 1. Executive Summary

This report validates the end-to-end AI Proctoring V2 architecture, resolves reported defects regarding false-positive gaze warnings and warning count desynchronization, hardens client-side exam integrity controls (fullscreen enforcement, tab-switch coalescing, right-click suppression), and confirms full automated test suite completion across the Python AI service, Java Spring Boot backend, and Next.js frontend.

---

## 2. Authoritative Architecture & Event Contract

### 2.1 Single Source of Truth
- **Authoritative Store**: PostgreSQL `QuizAttempt.warnings_count` managed exclusively by Spring Boot backend (`/api/v1/attempts/{id}/events`).
- **Python AI Microservice**:
  - Initializes `session.warning_count` on `/proctor/start` directly from Spring Boot's `/api/v1/attempts/{id}/verify-access` response.
  - Synchronizes `session.warning_count = max(session.warning_count, client_warning_count)` on every analyzed frame (REST and WebSocket).
  - Updates `session.warning_count` upon confirmed malpractice event dispatch to Spring Boot.
- **Next.js Frontend**:
  - Enforces strictly monotonic state updates: `setWarningCount((prev) => Math.max(prev, next))`.
  - Dispatches current `warningCount` with every streaming frame to keep the Python worker synchronized.
  - Ensures HUD badge and Proctoring Warning Modal display the synchronized maximum authoritative strike count (`Math.max(proctoring.warningCount, proctoring.activeWarningModal.count)`).

### 2.2 Event Dispatch Pipeline
```
[Candidate Browser]
   │
   ├─► Video / Audio Frames (every 350ms with current warningCount)
   │     │
   │     ▼
   │  [Python FastAPI AI Microservice (:8000)]
   │     │ (YuNet detection, SQPnP pose estimation, SFace biometrics, VAD)
   │     │
   │     ▼ (On confirmed infraction streak)
   │  POST /api/v1/attempts/{attemptId}/events
   │     │
   │     ▼
   │  [Spring Boot Backend (:8080)]
   │     │ (Validates JWT, increments QuizAttempt.warnings_count in PostgreSQL)
   │     │
   │     ▼ (Returns { recorded: true, warningCount: N, autoSubmitted: boolean })
   │  [Python AI Microservice]
   │     │
   │     ▼ (Returns telemetry to browser with updated warningCount)
   │  [Candidate HUD & Warning Modal]
   │
   └─► Browser Events (TAB_SWITCH, FULLSCREEN_EXIT)
         │ (Coalesced via 3500ms debounce across visibilitychange / blur / fullscreenexit)
         ▼
      POST /api/v1/attempts/{attemptId}/events (Spring Boot)
         │
         ▼
      Updates local warningCount monotonically & prompts Warning Modal
```

---

## 3. Defects Identified & Corrected

### Defect 1: False-Positive Gaze Warnings While Looking at Screen
- **Root Cause**:
  1. The canonical 3D facial model defined nose tip at `Z = +3.0` while chin was at `Z = 0.0`. In camera coordinate space (+Z pointing away from camera into depth), facial features closer to the camera must have negative Z relative to the face center. A positive nose Z inverted the pitch gradient.
  2. EPnP solver (`cv2.SOLVEPNP_EPNP`) produced unstable planar degeneracies for frontal 5-point landmark geometry.
  3. Strict pitch thresholds (`[-18°, 22°]`) were narrower than natural ergonomic screen reading bounds (`[-25°, 30°]`).
- **Resolution**:
  - Corrected 3D facial model depth geometry (`nose: (0.0, 0.0, 0.0)`, `chin: (0.0, -11.0, -4.5)`, `eyes: (±6.0, 4.5, -4.0)`, `mouth: (±3.5, -4.5, -3.5)`).
  - Adopted `cv2.SOLVEPNP_SQPNP` with geometric landmark aspect-ratio & inter-ocular distance validation.
  - Calibrated sustained infraction streaks (`STREAK_LOOKING_AWAY = 8` consecutive valid frames, ~2.8 seconds).

### Defect 2: Warning Count Desynchronization (HUD vs Modal)
- **Root Cause**:
  - When candidate triggered a tab switch, Spring Boot recorded `warningCount = 1`.
  - Python's isolated `session.warning_count` remained at `0`.
  - On the next frame, Python emitted telemetry with `warningCount: 0`.
  - Frontend `useProctoring` blindly set state to `0`.
  - Upon a subsequent gaze event, Spring Boot returned `2`. HUD jumped to `2` while modal retained `1`.
- **Resolution**:
  - Spring Boot `ProctoringAccessVerificationResponse` now exposes current `warningCount` and `maxWarnings`.
  - Python initializes `session.warning_count` from backend response and syncs incoming client frame warnings.
  - Frontend `setWarningCount` enforces `Math.max(prev, next)` monotonicity.
  - Warning modal displays `Math.max(proctoring.warningCount, proctoring.activeWarningModal.count)`.

### Defect 3: Non-Functional Fullscreen Exit & Duplicate Browser Warnings
- **Root Cause**:
  - `const isFullscreen = true;` was hardcoded in `page.tsx`, completely disabling the fullscreen exit overlay and banner.
  - `visibilitychange` and `blur` fired concurrently on Alt-Tab/minimize, causing duplicate strikes.
- **Resolution**:
  - Implemented reactive `isFullscreen` state tracking `document.fullscreenElement`.
  - Rendered fullscreen exit backdrop overlay with interactive "Re-enter Fullscreen" user-gesture trigger.
  - Coalesced all browser violation signals (`TAB_SWITCH`, `FULLSCREEN_EXIT`) under a unified 3500ms debounce cooldown.
  - Context menu (`contextmenu`) and copy/paste (`copy`, `cut`, `paste`) events are suppressed via `e.preventDefault()` without dispatching fake strikes to the backend.

---

## 4. Test Verification Results

### 4.1 AI Proctoring Microservice (Python FastAPI)
Command: `pytest -q`
```
77 passed, 1 warning in 20.47s
Exit Code: 0
```
- Includes unit tests for start authentication, token validation, student/attempt authorization, frame analysis, stop session, session details sanitization, gaze pose estimation, synthetic geometry fixtures, audio VAD, and malpractice streaks.

### 4.2 Backend Service (Java Spring Boot)
Command: `mvn test`
```
Tests run: 227, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Total time: 29.444 s
Exit Code: 0
```
- Validated attempt security, event recording, warning strike incrementation, automatic submission thresholds, summary aggregation, and access verification.

### 4.3 Frontend Client (Next.js TypeScript Turbopack)
Commands: `npm run lint` & `npm run build`
```
Lint: 0 errors, 32 warnings (preexisting hook warnings)
Build: Compiled successfully in 10.8s
Static page generation: 16/16 completed
Exit Code: 0
```

---

## 5. Local Testing Runbook

To run and test the complete system locally:

1. **Start PostgreSQL Database**:
   - Ensure PostgreSQL is active on `localhost:5432`.

2. **Start Backend**:
   ```powershell
   cd backend
   mvn spring-boot:run
   ```
   - Running at: `http://localhost:8080`

3. **Start AI Proctoring Microservice**:
   ```powershell
   cd ai-proctoring
   python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   - Running at: `http://localhost:8000`
   - Health check: `http://localhost:8000/health`

4. **Start Frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```
   - Running at: `http://localhost:3000`

5. **Test Scenarios**:
   - **Student Login & Lobby**: `http://localhost:3000/test/<TEST_CODE>/lobby`
   - **Biometric Photo Baseline**: Register webcam reference snapshot in lobby.
   - **Exam Arena**: Enter fullscreen and navigate to assessment.
   - **Gaze Verification**: Look naturally at screen questions; verify HUD stays at `CENTER`, `0/3 warnings`, green indicator.
   - **Browser Controls**:
     - Right-click on assessment questions: context menu blocked, 0 strikes.
     - Press `Esc` to exit fullscreen: overlay appears; click "Re-enter Fullscreen" to resume.
     - Alt-Tab / Switch tab: Exactly 1 `TAB_SWITCH` strike registered; HUD and Modal consistently show `Warning 1/3`.
