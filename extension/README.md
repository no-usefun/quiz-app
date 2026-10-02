# DynoQuizz AI Proctor Shield (Chrome Extension - Manifest V3)

Enterprise-grade browser proctoring extension for high-assurance online assessments in DynoQuizz.

---

## 🚀 Key Security Capabilities

1. **Dual / Multi-Monitor Sentinel (`chrome.system.display`)**:
   - Queries hardware display topology at test start.
   - Detects external monitors, secondary displays, Sidecar, HDMI splitters, and wireless casting.
   - Immediately records `DEVICE_SWITCH` violation if $>1$ monitor is active.

2. **Global Tab & Window Isolation (`chrome.tabs` & `chrome.windows`)**:
   - Monitors tab switching (`onActivated`), new tab opening (`onCreated`), and window unfocus (`onFocusChanged`).
   - Captures attempt even if candidates open new background tabs or switch windows.

3. **DOM & Keyboard Lockdown (`content.js`)**:
   - Intercepts and suppresses Right-Click (`contextmenu`).
   - Blocks Clipboard operations: Copy, Cut, Paste.
   - Blocks DevTools shortcuts: `F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`, `Ctrl+U`.
   - Blocks Print Screen / Save PDF shortcuts: `Ctrl+P`, `Ctrl+S`.
   - DevTools viewport delta detection.

4. **Real-Time Telemetry Streaming**:
   - Communicates bidirectionally with Next.js exam arena.
   - Streams every violation directly to Spring Boot backend: `POST /api/v1/attempts/{id}/activities`.
   - Stored in Neon PostgreSQL `activity_logs`.

---

## 🛠️ How to Load and Test in Chrome / Edge

### Step 1: Open Chrome Extensions
- Open Google Chrome, Edge, or Brave.
- Navigate to: `chrome://extensions/` (or `edge://extensions/`).
- Toggle **Developer mode** (top right corner) to **ON**.

### Step 2: Load the Extension
- Click **"Load unpacked"** (top left).
- Select the `extension` folder located at:
  `C:\Users\tanuj\OneDrive\Desktop\quizappDB\database\extension`
- The extension **"DynoQuizz AI Proctor Shield"** will appear with its shield icon.

### Step 3: Pin and Verify
- Click the Extension puzzle piece icon in Chrome toolbar and **Pin** "DynoQuizz AI Proctor Shield".
- Click the icon to inspect the popup:
  - Displays: Single vs Multi-Display status.
  - Test Backend Sync button.
  - Active Attempt & Candidate metadata.

### Step 4: Run Assessment
- Start frontend: `npm run dev` (in `frontend/` directory).
- Start backend: `./mvnw spring-boot:run` (in `backend/` directory).
- Open `http://localhost:3000/test/[testCode]`.
- The Next.js arena automatically handshakes with the extension:
  - Shield pill turns **LIVE / ARMED** (Emerald green).
  - Multi-screen and tab isolation are actively monitored.
