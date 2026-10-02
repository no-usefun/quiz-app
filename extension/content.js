// DynoQuizz AI Proctor Shield - Content Script

// Inject injected.js into the webpage DOM realm
try {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
} catch (e) {
  console.warn("[DynoQuizz Content Script] Script injection failed:", e);
}

// ─── 1. Bi-Directional Bridge with React Application ─────────────────────────
window.addEventListener("message", async (event) => {
  if (!event.data || typeof event.data !== "object") return;

  // React App -> Extension: Start Monitoring
  if (event.data.type === "DYNOQUIZZ_INIT") {
    chrome.runtime.sendMessage(
      {
        type: "START_MONITORING",
        attemptId: event.data.attemptId,
        testCode: event.data.testCode,
        token: event.data.token,
        apiBase: event.data.apiBase,
        studentReg: event.data.studentReg,
      },
      (response) => {
        window.postMessage(
          {
            type: "DYNOQUIZZ_INIT_ACK",
            installed: true,
            status: response,
          },
          "*",
        );
      },
    );
  }

  // React App -> Extension: Finish / Stop Monitoring
  if (event.data.type === "DYNOQUIZZ_FINISH") {
    chrome.runtime.sendMessage({ type: "STOP_MONITORING" });
  }

  // React App -> Extension: Heartbeat / Ping Check
  if (event.data.type === "DYNOQUIZZ_PING_EXTENSION") {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
      window.postMessage(
        {
          type: "DYNOQUIZZ_EXTENSION_PONG",
          installed: true,
          version: "1.0.0",
          state: response ? response.state : null,
          displays: response && response.state ? response.state.displays : [],
        },
        "*",
      );
    });
  }
});

// Forward background security events to webpage
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "DYNOQUIZZ_SECURITY_VIOLATION") {
    window.postMessage(
      {
        type: "DYNOQUIZZ_EXTENSION_VIOLATION_ALERT",
        violation: message.violation,
      },
      "*",
    );
  }
});

// ─── 2. DOM Level Safeguards & Anti-Tamper Enforcement ───────────────────────
document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "LOG_VIOLATION",
      activityType: "RIGHT_CLICK",
      details: "Right-click context menu intercepted by Proctor Shield",
    });
  },
  true,
);

document.addEventListener(
  "copy",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "LOG_VIOLATION",
      activityType: "COPY_ATTEMPT",
      details: "Candidate attempted clipboard COPY operation",
    });
  },
  true,
);

document.addEventListener(
  "cut",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "LOG_VIOLATION",
      activityType: "COPY_ATTEMPT",
      details: "Candidate attempted clipboard CUT operation",
    });
  },
  true,
);

document.addEventListener(
  "paste",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      type: "LOG_VIOLATION",
      activityType: "COPY_ATTEMPT",
      details: "Candidate attempted clipboard PASTE operation",
    });
  },
  true,
);

// Keyboard Lockdown: F12, DevTools shortcuts, Print Screen, Alt combinations
document.addEventListener(
  "keydown",
  (e) => {
    const isDevTools =
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
      (e.metaKey && e.altKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
      (e.ctrlKey && ["U", "u", "S", "s", "P", "p", "H", "h"].includes(e.key));

    if (isDevTools) {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "LOG_VIOLATION",
        activityType: "RIGHT_CLICK",
        details: `Restricted shortcut blocked: ${e.ctrlKey ? "Ctrl+" : ""}${
          e.shiftKey ? "Shift+" : ""
        }${e.key}`,
      });
    }
  },
  true,
);

// DevTools Inspection Heuristic based on outer vs inner dimensions
let devToolsWarningLogged = false;
setInterval(() => {
  const widthThreshold = window.outerWidth - window.innerWidth > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;

  if ((widthThreshold || heightThreshold) && !devToolsWarningLogged) {
    devToolsWarningLogged = true;
    chrome.runtime.sendMessage({
      type: "LOG_VIOLATION",
      activityType: "RIGHT_CLICK",
      details: "Browser developer tools panel or inspection window detected open",
    });
  } else if (!widthThreshold && !heightThreshold) {
    devToolsWarningLogged = false;
  }
}, 2000);
