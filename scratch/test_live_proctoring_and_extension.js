const fs = require("fs");
const path = require("path");

const API_BASE = "http://localhost:8080";
const FRONTEND_BASE = "http://localhost:3000";

async function postJson(url, data, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function putJson(url, data = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function getJson(url, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { method: "GET", headers });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [ASSERTION FAILED]: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

function toLocalIso(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function runLiveE2ETest() {
  console.log("\n==================================================================");
  console.log("🛡️  DYNOQUIZZ FULL AI PROCTORING & EXTENSION E2E TEST RUNNER");
  console.log("==================================================================\n");

  // ─── STAGE 1: Extension Manifest & File Assets ─────────────────────────────
  console.log("▶ STAGE 1: Chrome Extension Manifest V3 & File Integrity Check...");
  const extDir = path.resolve(__dirname, "../extension");
  assert(fs.existsSync(path.join(extDir, "manifest.json")), "manifest.json exists");
  assert(fs.existsSync(path.join(extDir, "background.js")), "background.js service worker exists");
  assert(fs.existsSync(path.join(extDir, "content.js")), "content.js DOM guard exists");
  assert(fs.existsSync(path.join(extDir, "injected.js")), "injected.js DOM realm bridge exists");
  assert(fs.existsSync(path.join(extDir, "popup.html")), "popup.html exists");
  assert(fs.existsSync(path.join(extDir, "popup.css")), "popup.css exists");
  assert(fs.existsSync(path.join(extDir, "popup.js")), "popup.js exists");
  assert(fs.existsSync(path.join(extDir, "icons/icon16.png")), "16x16 icon exists");
  assert(fs.existsSync(path.join(extDir, "icons/icon48.png")), "48x48 icon exists");
  assert(fs.existsSync(path.join(extDir, "icons/icon128.png")), "128x128 icon exists");

  const manifest = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));
  assert(manifest.manifest_version === 3, "Manifest is Version 3 compliant");
  assert(manifest.permissions.includes("system.display"), "Multi-Monitor permission (system.display) declared");
  assert(manifest.permissions.includes("tabs"), "Global Tab monitoring permission (tabs) declared");
  assert(manifest.permissions.includes("windows"), "Window focus permission (windows) declared");
  console.log("  ✓ Extension integrity verified!\n");

  // ─── STAGE 2: Next.js 16 Frontend Connectivity ─────────────────────────────
  console.log("▶ STAGE 2: Next.js 16 Frontend Server Connectivity Check...");
  const feRes = await fetch(FRONTEND_BASE).catch(() => null);
  assert(feRes && feRes.status < 500, `Next.js frontend reachable at ${FRONTEND_BASE}`);
  console.log("  ✓ Frontend server verified live!\n");

  // ─── STAGE 3: Authentication (Teacher & Student) ───────────────────────────
  console.log("▶ STAGE 3: Authenticating Teacher & Candidate on Live Spring Boot Backend...");
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const teacherEmail = `prof_${rand}@dynoquizz.edu`;
  const studentEmail = `student_${rand}@dynoquizz.edu`;
  const password = "Password@123";

  // Register Teacher
  const regTeacher = await postJson(`${API_BASE}/api/v1/auth/signup`, {
    firstName: "Alan",
    lastName: "Turing",
    email: teacherEmail,
    password: password,
    role: "TEACHER",
    college: "MIT",
    department: "Computer Science",
    phone: "9876543210",
  });
  let teacherToken = regTeacher.data?.token;
  if (!teacherToken) {
    const logTeacher = await postJson(`${API_BASE}/api/v1/auth/login`, {
      email: teacherEmail,
      password: password,
    });
    teacherToken = logTeacher.data?.token;
  }
  assert(!!teacherToken, `Teacher authenticated with valid JWT token (status: ${regTeacher.status})`);

  // Register Student
  const regStudent = await postJson(`${API_BASE}/api/v1/auth/signup`, {
    firstName: "Alice",
    lastName: "Candidate",
    email: studentEmail,
    password: password,
    role: "STUDENT",
    registrationNo: `REG${rand}`,
    college: "MIT",
    department: "Computer Science",
    phone: "9876543211",
  });
  let studentToken = regStudent.data?.token;
  if (!studentToken) {
    const logStudent = await postJson(`${API_BASE}/api/v1/auth/login`, {
      email: studentEmail,
      password: password,
    });
    studentToken = logStudent.data?.token;
  }
  assert(!!studentToken, `Candidate authenticated with valid JWT token (status: ${regStudent.status})`);
  console.log("  ✓ Authentication completed!\n");

  // ─── STAGE 4: Proctored Quiz Creation & Publication ────────────────────────
  console.log("▶ STAGE 4: Creating & Publishing Proctored Assessment with Questions...");
  const createQuizRes = await postJson(
    `${API_BASE}/api/v1/teacher/quizzes`,
    {
      title: `AI Proctored Integrity Test ${rand}`,
      description: "Assessment verifying AI proctoring, gaze tracking, and extension guard",
      instructions: "Do not switch tabs, plug dual monitors, or look away from screen.",
      subject: "Computer Systems",
      subjectCode: "CS401",
      totalStudents: 50,
      overallTimerSeconds: 1800,
      negativeMarking: false,
      negativeMarks: 0,
      timeBonusEnabled: false,
      randomQuestionOrder: false,
      randomOptionOrder: false,
      allowReview: true,
      allowResume: true,
      autoSubmit: true,
      startTime: toLocalIso(new Date(Date.now() - 3600000)),
      endTime: toLocalIso(new Date(Date.now() + 86400000)),
      resultVisibility: "BOTH",
      questions: [
        {
          questionText: "What is the time complexity of quicksort in the average case?",
          questionType: "MCQ",
          marks: 4,
          negativeMarks: 0,
          questionTimerSeconds: 60,
          difficulty: "EASY",
          displayOrder: 1,
          options: [
            { optionText: "O(n log n)", optionOrder: 1, isCorrect: true },
            { optionText: "O(n^2)", optionOrder: 2, isCorrect: false },
            { optionText: "O(log n)", optionOrder: 3, isCorrect: false },
            { optionText: "O(1)", optionOrder: 4, isCorrect: false },
          ],
        },
        {
          questionText: "Which Chrome API monitors multiple connected displays in Manifest V3?",
          questionType: "MCQ",
          marks: 4,
          negativeMarks: 0,
          questionTimerSeconds: 60,
          difficulty: "MEDIUM",
          displayOrder: 2,
          options: [
            { optionText: "chrome.system.display", optionOrder: 1, isCorrect: true },
            { optionText: "chrome.screen.multi", optionOrder: 2, isCorrect: false },
            { optionText: "chrome.windows.displays", optionOrder: 3, isCorrect: false },
            { optionText: "chrome.hardware.monitors", optionOrder: 4, isCorrect: false },
          ],
        },
      ],
    },
    teacherToken,
  );
  assert(createQuizRes.ok && (createQuizRes.data?.quizId || createQuizRes.data?.id), `Quiz created successfully (Quiz ID: ${createQuizRes.data?.quizId || createQuizRes.data?.id})`);
  const quizId = createQuizRes.data.quizId || createQuizRes.data.id;
  const testCode = createQuizRes.data.quizCode || createQuizRes.data.code;

  // Publish Quiz
  const publishRes = await putJson(
    `${API_BASE}/api/v1/teacher/quizzes/${quizId}/publish`,
    {},
    teacherToken,
  );
  assert(publishRes.ok, `Quiz published to LIVE status (HTTP ${publishRes.status})`);
  console.log(`  ✓ Quiz ID: #${quizId} | Assessment Access Code: ${testCode}\n`);

  // ─── STAGE 5: Candidate Start Attempt on Neon DB ───────────────────────────
  console.log("▶ STAGE 5: Candidate Starting Assessment Attempt on Neon DB...");
  const startRes = await postJson(
    `${API_BASE}/api/v1/student/quizzes/${testCode}/attempts`,
    {},
    studentToken,
  );
  assert(startRes.ok && (startRes.data?.attemptId || startRes.data?.id), `Candidate attempt started on Neon DB (Attempt ID: ${startRes.data?.attemptId || startRes.data?.id})`);
  const attemptId = startRes.data.attemptId || startRes.data.id;
  console.log(`  ✓ Active Attempt ID: #${attemptId}\n`);

  // ─── STAGE 6: Candidate Face & Student ID Photo Snapshot Upload ────────────
  console.log("▶ STAGE 6: Uploading Candidate Face & ID Photo Snapshot...");
  const mockIdPhotoBase64 = "data:image/jpeg;base64," + Buffer.from("STUDENT_ID_SNAPSHOT_VERIFICATION_E2E").toString("base64");
  const idPhotoRes = await postJson(
    `${API_BASE}/api/v1/attempts/${attemptId}/id-photo`,
    { idPhotoData: mockIdPhotoBase64 },
    studentToken,
  );
  assert(idPhotoRes.ok && idPhotoRes.data?.success, "Candidate ID snapshot saved to Neon DB (quiz_attempts.id_photo_data)");
  console.log("  ✓ ID Verification photo snapshot persisted!\n");

  // ─── STAGE 7: Hardware & Device Footprint Registration ──────────────────────
  console.log("▶ STAGE 7: Registering Hardware & Browser Environment...");
  const deviceRes = await postJson(
    `${API_BASE}/api/v1/attempts/${attemptId}/device`,
    {
      browserName: "Chrome",
      browserVersion: "128.0",
      operatingSystem: "Windows 11",
      deviceType: "LAPTOP",
      screenWidth: 1920,
      screenHeight: 1080,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36 DynoQuizzProctor/1.0",
    },
    studentToken,
  );
  assert(deviceRes.ok && deviceRes.data?.success, "Hardware device footprint registered in attempt record");
  console.log("  ✓ Device environment registered!\n");

  // ─── STAGE 8: Multi-Sensor Telemetry & Auto-Submit Verification ────────────
  console.log("▶ STAGE 8: Simulating Live Multi-Sensor Telemetry Stream...");

  // Event 1: Normal focus (No violation)
  const ev1 = await postJson(
    `${API_BASE}/api/v1/attempts/${attemptId}/activities`,
    {
      activityType: "WINDOW_FOCUS",
      details: "[Extension Shield] Candidate focused assessment arena",
      activityTime: new Date().toISOString(),
    },
    studentToken,
  );
  assert(ev1.ok && ev1.data?.currentWarningsCount === 0, "Event 1: [WINDOW_FOCUS] Warnings = 0/3 (Normal)");

  // Event 2: Tab Switch intercepted by Chrome Extension
  const ev2 = await postJson(
    `${API_BASE}/api/v1/attempts/${attemptId}/activities`,
    {
      activityType: "TAB_SWITCH",
      details: "[Extension Shield] Candidate switched to external browser tab ('ChatGPT - OpenAI')",
      activityTime: new Date().toISOString(),
    },
    studentToken,
  );
  assert(ev2.ok && ev2.data?.currentWarningsCount === 1, "Event 2: [TAB_SWITCH] Warnings incremented to 1/3");

  // Event 3: Multi-Monitor setup detected by Chrome Extension
  const ev3 = await postJson(
    `${API_BASE}/api/v1/attempts/${attemptId}/activities`,
    {
      activityType: "DEVICE_SWITCH",
      details: "[Extension Shield] Multi-monitor detected: 2 displays active (Dell U2720Q, Built-in Display)",
      activityTime: new Date().toISOString(),
    },
    studentToken,
  );
  assert(ev3.ok && ev3.data?.currentWarningsCount === 2, "Event 3: [DEVICE_SWITCH] Warnings incremented to 2/3");

  // Event 4: Looking Away detected by Edge-AI Gaze Tracker (Warning 3 -> Auto Submit!)
  const ev4 = await postJson(
    `${API_BASE}/api/v1/attempts/${attemptId}/activities`,
    {
      activityType: "LOOKING_AWAY",
      details: "[Edge-AI Vision] Optical gaze turned away from center screen (>3.5s)",
      activityTime: new Date().toISOString(),
    },
    studentToken,
  );
  assert(ev4.ok && ev4.data?.currentWarningsCount === 3, "Event 4: [LOOKING_AWAY] Warnings reached 3/3");
  assert(ev4.data?.autoSubmitted === true, "Auto-submit limit triggered! Assessment automatically locked & submitted (HTTP 200)");
  console.log("  ✓ Auto-submit enforcement validated!\n");

  // ─── STAGE 9: Teacher Forensic Summary & Timeline Verification ──────────────
  console.log("▶ STAGE 9: Fetching Forensic Proctoring Summary on Teacher Dashboard...");
  const summaryRes = await getJson(
    `${API_BASE}/api/v1/teacher/attempts/${attemptId}/proctoring-summary`,
    teacherToken,
  );
  assert(summaryRes.ok && summaryRes.data, "Teacher summary retrieved successfully");
  const summary = summaryRes.data;

  assert(summary.status === "AUTO_SUBMITTED", `Attempt status is AUTO_SUBMITTED (actual: ${summary.status})`);
  assert(summary.totalViolations >= 3, `Total violations recorded = ${summary.totalViolations} (>= 3)`);
  assert(summary.isIntegrityFlagged === true, "Integrity flagged boolean is true");
  assert(!!summary.idPhotoData, "Candidate ID Photo snapshot present in forensic summary");
  assert(summary.recentViolations && summary.recentViolations.length >= 3, `Forensic violation feed contains all ${summary.recentViolations?.length} logged violations`);

  console.log("\n==================================================================");
  console.log("🎉 ALL REAL E2E TESTS PASSED 100% CLEANLY ON NEON CLOUD DB!");
  console.log("==================================================================");
  console.log(`• Attempt ID: #${attemptId}`);
  console.log(`• Candidate Name: ${summary.studentName} (${summary.studentEmail})`);
  console.log(`• Final Status: ${summary.status}`);
  console.log(`• Total Violations Incurred: ${summary.totalViolations}`);
  console.log(`• Tab Switches: ${summary.tabSwitches}`);
  console.log(`• Face Warnings: ${summary.faceWarnings}`);
  console.log(`• Integrity Flagged: ${summary.isIntegrityFlagged}`);
  console.log(`• Forensic Violations Feed: ${summary.recentViolations.length} events logged`);
  summary.recentViolations.forEach((act, idx) => {
    console.log(`   ${idx + 1}. [${act.activityType}] ${act.details} (${act.activityTime})`);
  });
  console.log("==================================================================\n");
}

runLiveE2ETest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
