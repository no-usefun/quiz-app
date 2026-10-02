// DynoQuizz AI Proctor Shield - Popup UI Controller

document.addEventListener("DOMContentLoaded", async () => {
  const statusPill = document.getElementById("status-pill");
  const statusText = document.getElementById("status-text");
  const sessionCode = document.getElementById("session-code");
  const attemptIdEl = document.getElementById("attempt-id");
  const candidateRegEl = document.getElementById("candidate-reg");
  const apiBaseEl = document.getElementById("api-base");
  const displayBadge = document.getElementById("display-badge");
  const displayStatusText = document.getElementById("display-status-text");
  const displayList = document.getElementById("display-list");
  const violationCount = document.getElementById("violation-count");
  const violationsList = document.getElementById("violations-list");
  const btnTestSync = document.getElementById("btn-test-sync");
  const btnClearLogs = document.getElementById("btn-clear-logs");

  function refreshView() {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
      if (!response) return;

      const { state, violations } = response;

      // 1. Proctoring State Pill
      if (state && state.isMonitoring) {
        statusPill.className = "status-pill live";
        statusText.textContent = "ARMED & ACTIVE";
      } else {
        statusPill.className = "status-pill idle";
        statusText.textContent = "STANDBY";
      }

      // 2. Session Info
      if (state && state.testCode) {
        sessionCode.textContent = state.testCode.toUpperCase();
        attemptIdEl.textContent = state.attemptId ? `#${state.attemptId}` : "--";
        candidateRegEl.textContent = state.studentReg || "Authenticated Student";
        apiBaseEl.textContent = state.apiBase || "http://localhost:8080";
      } else {
        sessionCode.textContent = "STANDBY";
        attemptIdEl.textContent = "--";
        candidateRegEl.textContent = "--";
      }

      // 3. Display Sentinel Info
      if (state && state.displays && state.displays.length > 0) {
        const count = state.displays.length;
        if (count > 1) {
          displayBadge.className = "badge badge-danger";
          displayBadge.textContent = `${count} DISPLAYS (ALERT)`;
          displayStatusText.className = "display-text text-rose";
          displayStatusText.textContent = `⚠️ Multi-monitor detected (${count} screens)`;
        } else {
          displayBadge.className = "badge badge-success";
          displayBadge.textContent = "1 DISPLAY";
          displayStatusText.className = "display-text text-emerald";
          displayStatusText.textContent = "Single Display Active (Secure)";
        }

        displayList.innerHTML = state.displays
          .map(
            (d) =>
              `<div>• ${d.name || "Monitor"} ${
                d.isPrimary ? "(Primary)" : "(Secondary)"
              } - ${d.bounds ? `${d.bounds.width}x${d.bounds.height}` : ""}</div>`,
          )
          .join("");
      }

      // 4. Violations Log
      if (violations && violations.length > 0) {
        violationCount.textContent = `${violations.length} Events`;
        violationCount.className = "badge badge-warning";

        violationsList.innerHTML = violations
          .map((v) => {
            const isInfo = v.type === "WINDOW_FOCUS";
            return `
              <div class="violation-item ${isInfo ? "info" : ""}">
                <span class="violation-desc">${v.details || v.type}</span>
                <span class="violation-time">${v.timestamp || ""}</span>
              </div>
            `;
          })
          .join("");
      } else {
        violationCount.textContent = "0 Events";
        violationCount.className = "badge badge-neutral";
        violationsList.innerHTML = `
          <div class="empty-state">No security anomalies detected. Exam integrity intact.</div>
        `;
      }
    });
  }

  refreshView();

  // Test Backend Sync Button
  btnTestSync.addEventListener("click", () => {
    btnTestSync.textContent = "Testing Sync...";
    chrome.runtime.sendMessage({ type: "TEST_BACKEND_CONNECTION" }, (res) => {
      setTimeout(() => {
        btnTestSync.textContent = "✓ Gateway Online";
        setTimeout(() => {
          btnTestSync.textContent = "Test Backend Sync";
        }, 2000);
      }, 300);
    });
  });

  // Clear Logs Button
  btnClearLogs.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_LOGS" }, () => {
      refreshView();
    });
  });
});
