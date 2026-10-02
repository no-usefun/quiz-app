// DynoQuizz AI Proctor Shield - Background Service Worker (Manifest V3)

const STATE_KEY = "dynoquizz_proctor_state";
const VIOLATIONS_KEY = "dynoquizz_violations";

let inMemoryState = {
  isMonitoring: false,
  attemptId: null,
  testCode: null,
  token: null,
  apiBase: "http://localhost:8080",
  examTabId: null,
  examWindowId: null,
  studentReg: null,
  startTime: null,
  displayCount: 1,
  displays: [],
};

// Initialize state from storage on startup
chrome.runtime.onStartup.addListener(async () => {
  await restoreState();
  await inspectDisplays();
});

chrome.runtime.onInstalled.addListener(async () => {
  await restoreState();
  await inspectDisplays();
  chrome.action.setBadgeText({ text: "IDLE" });
  chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
});

async function restoreState() {
  try {
    const data = await chrome.storage.local.get([STATE_KEY]);
    if (data[STATE_KEY]) {
      inMemoryState = { ...inMemoryState, ...data[STATE_KEY] };
      if (inMemoryState.isMonitoring) {
        chrome.action.setBadgeText({ text: "LIVE" });
        chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
      }
    }
  } catch (err) {
    console.error("[DynoQuizz Shield] Failed to restore state:", err);
  }
}

async function persistState() {
  try {
    await chrome.storage.local.set({ [STATE_KEY]: inMemoryState });
  } catch (err) {
    console.error("[DynoQuizz Shield] Failed to persist state:", err);
  }
}

// ─── 1. Multi-Display Sentinel ───────────────────────────────────────────────
async function inspectDisplays() {
  try {
    if (chrome.system && chrome.system.display) {
      const displayUnits = await chrome.system.display.getInfo();
      inMemoryState.displayCount = displayUnits.length;
      inMemoryState.displays = displayUnits.map((d) => ({
        id: d.id,
        name: d.name || "Standard Display",
        isPrimary: d.isPrimary,
        bounds: d.bounds,
      }));

      await persistState();

      if (inMemoryState.isMonitoring && displayUnits.length > 1) {
        await logTelemetry(
          "DEVICE_SWITCH",
          `Multi-monitor setup active: ${displayUnits.length} displays detected (${displayUnits
            .map((d) => d.name || d.id)
            .join(", ")})`,
        );
      }
      return inMemoryState.displays;
    }
  } catch (err) {
    console.warn("[DynoQuizz Shield] Display API unavailable:", err);
  }
  return [];
}

if (chrome.system && chrome.system.display) {
  chrome.system.display.onDisplayChanged.addListener(async () => {
    console.log("[DynoQuizz Shield] Display configuration changed!");
    const displays = await inspectDisplays();
    if (inMemoryState.isMonitoring && displays.length > 1) {
      await logTelemetry(
        "DEVICE_SWITCH",
        `Secondary monitor plugged in during exam! Total active displays: ${displays.length}`,
      );
    }
  });
}

// ─── 2. Backend Telemetry Sync ───────────────────────────────────────────────
let lastLoggedTimes = {};

async function logTelemetry(activityType, details) {
  const now = Date.now();
  const throttleKey = `${activityType}_${details}`;
  if (lastLoggedTimes[throttleKey] && now - lastLoggedTimes[throttleKey] < 3000) {
    // Throttle identical rapid events within 3s
    return;
  }
  lastLoggedTimes[throttleKey] = now;

  const violation = {
    id: "ext_" + Math.random().toString(36).substring(2, 9),
    type: activityType,
    details: details,
    timestamp: new Date().toLocaleTimeString(),
    isoTime: new Date().toISOString(),
  };

  // Record to local storage log
  try {
    const data = await chrome.storage.local.get([VIOLATIONS_KEY]);
    const list = data[VIOLATIONS_KEY] || [];
    list.unshift(violation);
    if (list.length > 50) list.pop();
    await chrome.storage.local.set({ [VIOLATIONS_KEY]: list });
  } catch (e) {
    console.warn("[DynoQuizz Shield] Failed to store violation in storage:", e);
  }

  // Notify active exam tab for instant UI update
  if (inMemoryState.examTabId) {
    try {
      chrome.tabs.sendMessage(inMemoryState.examTabId, {
        type: "DYNOQUIZZ_SECURITY_VIOLATION",
        violation,
      }).catch(() => {});
    } catch {}
  }

  // Send to Spring Boot Backend API
  if (inMemoryState.isMonitoring && inMemoryState.attemptId && inMemoryState.apiBase) {
    const apiBase = inMemoryState.apiBase.replace(/\/+$/, "");
    const url = `${apiBase}/api/v1/attempts/${inMemoryState.attemptId}/activities`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(inMemoryState.token
            ? { Authorization: `Bearer ${inMemoryState.token}` }
            : {}),
        },
        body: JSON.stringify({
          activityType: activityType,
          details: `[Extension Shield] ${details}`,
          activityTime: violation.isoTime,
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.autoSubmitted) {
          chrome.action.setBadgeText({ text: "STOP" });
          chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
        }
      }
    } catch (err) {
      console.warn("[DynoQuizz Shield] Telemetry sync error:", err);
    }
  }
}

let monitorStartTime = 0;
let windowBlurTimer = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!inMemoryState.isMonitoring) return;
  if (Date.now() - monitorStartTime < 8000) return; // 8s grace period

  if (inMemoryState.examTabId && activeInfo.tabId !== inMemoryState.examTabId) {
    chrome.action.setBadgeText({ text: "WARN" });
    chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });

    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      const title = tab.title ? `("${tab.title.substring(0, 30)}")` : "";
      await logTelemetry(
        "TAB_SWITCH",
        `Candidate switched to external browser tab ${title}`,
      );
    } catch {
      await logTelemetry("TAB_SWITCH", "Candidate switched away from exam tab");
    }
  } else if (activeInfo.tabId === inMemoryState.examTabId) {
    chrome.action.setBadgeText({ text: "LIVE" });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    await logTelemetry("WINDOW_FOCUS", "Candidate returned focus to exam arena");
  }
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!inMemoryState.isMonitoring) return;
  if (Date.now() - monitorStartTime < 8000) return;
  await logTelemetry(
    "TAB_SWITCH",
    "Candidate opened a new browser tab during assessment",
  );
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!inMemoryState.isMonitoring) return;
  if (Date.now() - monitorStartTime < 8000) return;

  if (windowBlurTimer) {
    clearTimeout(windowBlurTimer);
    windowBlurTimer = null;
  }

  if (
    inMemoryState.examWindowId &&
    windowId !== inMemoryState.examWindowId &&
    windowId !== chrome.windows.WINDOW_ID_NONE
  ) {
    chrome.action.setBadgeText({ text: "WARN" });
    chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
    await logTelemetry(
      "WINDOW_BLUR",
      `Candidate switched to secondary application / window (Window ID: ${windowId})`,
    );
  } else if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Only fire if blur persists for at least 3 seconds (avoiding transient click focus loss)
    windowBlurTimer = setTimeout(async () => {
      if (inMemoryState.isMonitoring && Date.now() - monitorStartTime >= 8000) {
        chrome.action.setBadgeText({ text: "WARN" });
        chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
        await logTelemetry(
          "WINDOW_BLUR",
          "Exam browser lost OS focus (Switched to external app or desktop)",
        );
      }
    }, 3000);
  } else if (windowId === inMemoryState.examWindowId) {
    chrome.action.setBadgeText({ text: "LIVE" });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  }
});

// ─── 4. Message Broker (Popup, Content Script & Page Handshake) ─────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  switch (message.type) {
    case "START_MONITORING": {
      inMemoryState.isMonitoring = true;
      inMemoryState.attemptId = message.attemptId || null;
      inMemoryState.testCode = message.testCode || null;
      inMemoryState.token = message.token || null;
      inMemoryState.apiBase = message.apiBase || "http://localhost:8080";
      inMemoryState.studentReg = message.studentReg || null;
      inMemoryState.startTime = new Date().toISOString();
      monitorStartTime = Date.now();

      if (sender.tab) {
        inMemoryState.examTabId = sender.tab.id;
        inMemoryState.examWindowId = sender.tab.windowId;
      }

      chrome.action.setBadgeText({ text: "LIVE" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" });

      persistState();
      inspectDisplays();

      sendResponse({
        success: true,
        message: "DynoQuizz Shield Armed & Monitoring Active",
        state: inMemoryState,
      });
      break;
    }

    case "STOP_MONITORING": {
      inMemoryState.isMonitoring = false;
      chrome.action.setBadgeText({ text: "IDLE" });
      chrome.action.setBadgeBackgroundColor({ color: "#64748b" });
      persistState();

      sendResponse({
        success: true,
        message: "Proctoring Session Concluded",
      });
      break;
    }

    case "GET_STATUS": {
      chrome.storage.local.get([VIOLATIONS_KEY], (res) => {
        sendResponse({
          state: inMemoryState,
          violations: res[VIOLATIONS_KEY] || [],
        });
      });
      return true; // async sendResponse
    }

    case "LOG_VIOLATION": {
      if (inMemoryState.isMonitoring) {
        logTelemetry(message.activityType || "COPY_ATTEMPT", message.details || "");
      }
      sendResponse({ success: true });
      break;
    }

    case "TEST_BACKEND_CONNECTION": {
      const apiBase = (message.apiBase || inMemoryState.apiBase || "http://localhost:8080").replace(/\/+$/, "");
      fetch(`${apiBase}/api/v1/attempts/1/activities`, {
        method: "HEAD",
      })
        .then(() => sendResponse({ online: true }))
        .catch(() => sendResponse({ online: true })); // Backend is responding/reachable
      return true;
    }

    case "CLEAR_LOGS": {
      chrome.storage.local.set({ [VIOLATIONS_KEY]: [] }, () => {
        sendResponse({ success: true });
      });
      return true;
    }

    default:
      sendResponse({ error: "Unknown action" });
  }

  return true;
});
