"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface ProctoringViolation {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface UseProctoringOptions {
  attemptId?: number | string | null;
  quizId?: number | string | null;
  testCode?: string;
  studentReg?: string;
  maxWarnings?: number;
  autoSubmitOnLimit?: boolean;
  onAutoSubmit?: () => void;
  enabled?: boolean;
}

export type ProctoringFlags = {
  tab_switch: number;
  fullscreen_exit: number;
  right_click: number;
  copy_attempt: number;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export function useProctoring(options: UseProctoringOptions = {}) {
  const {
    attemptId,
    testCode,
    studentReg,
    maxWarnings = 3,
    onAutoSubmit,
    enabled = true,
  } = options;

  const [micLevel, setMicLevel] = useState(0);
  const [warningsCount, setWarningsCount] = useState(0);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [proctorStatus, setProctorStatus] = useState<
    "INITIALIZING" | "ACTIVE" | "WARNING" | "VIOLATION"
  >("INITIALIZING");
  const [statusMessage, setStatusMessage] = useState(
    "Initializing Edge-AI proctor & background gaze analyzer...",
  );
  const [currentWarningMessage, setCurrentWarningMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [faceStatus, setFaceStatus] = useState<
    "OK" | "NO_FACE" | "MULTIPLE_FACES" | "LOOKING_AWAY"
  >("OK");

  // Extension Integration State
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [isExtensionActive, setIsExtensionActive] = useState(false);
  const [displayCount, setDisplayCount] = useState(1);

  const [flags, setFlags] = useState<ProctoringFlags>({
    tab_switch: 0,
    fullscreen_exit: 0,
    right_click: 0,
    copy_attempt: 0,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const consecutiveNoFaceRef = useRef(0);
  const consecutiveMultiFaceRef = useRef(0);
  const consecutiveLookingAwayRef = useRef(0);
  const isAutoSubmittedRef = useRef(false);
  const lastAudioSpikeTimeRef = useRef(0);
  const lastSnapshotTimeRef = useRef(0);
  const mountTimeRef = useRef<number>(Date.now());
  const lastFocusViolationTimeRef = useRef<number>(0);

  // Dismiss banner
  const dismissWarning = useCallback(() => {
    setCurrentWarningMessage(null);
  }, []);

  // Video attachment ref
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.play().catch(() => {});
    }
  }, []);

  // ─── 1. Send Violation to Backend & Trigger Warnings ─────────────────────────
  const logEventToBackend = useCallback(
    async (activityType: string, details: string) => {
      const now = Date.now();
      const isInitialGracePeriod = now - mountTimeRef.current < 5000;

      // During initial 5-second grace period, suppress focus/blur false alarms on page load
      if (
        isInitialGracePeriod &&
        ["TAB_SWITCH", "WINDOW_BLUR", "WINDOW_FOCUS", "FULLSCREEN_EXIT"].includes(
          activityType,
        )
      ) {
        return;
      }

      // Throttle countable violations strictly to 1 per 4 seconds
      const isCountableViolation = [
        "TAB_SWITCH",
        "WINDOW_BLUR",
        "DEVTOOLS_OPEN",
        "MULTI_DISPLAY",
      ].includes(activityType);

      if (isCountableViolation) {
        if (now - lastFocusViolationTimeRef.current < 4000) {
          return;
        }
        lastFocusViolationTimeRef.current = now;

        setWarningsCount((prev) => {
          const next = prev + 1;
          if (next >= maxWarnings && !isAutoSubmittedRef.current) {
            isAutoSubmittedRef.current = true;
            setProctorStatus("VIOLATION");
            setStatusMessage("Exam limit exceeded. Auto-submitting assessment...");
            if (onAutoSubmit) {
              setTimeout(() => onAutoSubmit(), 800);
            }
          }
          return next;
        });
      }

      const newViolation: ProctoringViolation = {
        id: Math.random().toString(36).substring(2, 9),
        type: activityType,
        message: details,
        timestamp: new Date().toLocaleTimeString(),
      };

      setViolations((prev) => [newViolation, ...prev.slice(0, 19)]);
      if (activityType !== "WINDOW_FOCUS") {
        setCurrentWarningMessage(`⚠️ Warning: ${details}`);
      }

      // Update flags
      setFlags((prev) => {
        if (activityType === "TAB_SWITCH" || activityType === "WINDOW_BLUR") {
          return { ...prev, tab_switch: prev.tab_switch + 1 };
        }
        if (activityType === "FULLSCREEN_EXIT") {
          return { ...prev, fullscreen_exit: prev.fullscreen_exit + 1 };
        }
        if (activityType === "RIGHT_CLICK") {
          return { ...prev, right_click: prev.right_click + 1 };
        }
        if (activityType === "COPY_ATTEMPT") {
          return { ...prev, copy_attempt: prev.copy_attempt + 1 };
        }
        return prev;
      });

      if (!attemptId) return;

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("dynoquizz_token") || ""
            : "";

        const response = await fetch(
          `${API_BASE}/api/v1/attempts/${attemptId}/activities`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              activityType,
              details,
              activityTime: new Date().toISOString(),
            }),
          },
        );

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.currentWarningsCount !== undefined) {
            setWarningsCount(data.currentWarningsCount);
          }
          if (data.autoSubmitted && !isAutoSubmittedRef.current) {
            isAutoSubmittedRef.current = true;
            setProctorStatus("VIOLATION");
            setStatusMessage("Exam auto-submitted due to excessive integrity violations.");
            if (onAutoSubmit) {
              onAutoSubmit();
            }
          }
        }
      } catch (err) {
        console.warn("Could not sync proctoring event to backend:", err);
      }
    },
    [attemptId, maxWarnings, onAutoSubmit],
  );

  // ─── 2. Register Device Footprint ─────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !attemptId) return;

    const registerDevice = async () => {
      const ua = navigator.userAgent;
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      const isTablet = /Tablet|iPad/i.test(ua);
      const deviceType = isTablet ? "TABLET" : isMobile ? "MOBILE" : "LAPTOP";

      let browserName = "Chrome";
      if (ua.includes("Firefox")) browserName = "Firefox";
      else if (ua.includes("Safari") && !ua.includes("Chrome"))
        browserName = "Safari";
      else if (ua.includes("Edg")) browserName = "Edge";

      let operatingSystem = "Windows";
      if (ua.includes("Mac OS")) operatingSystem = "macOS";
      else if (ua.includes("Linux")) operatingSystem = "Linux";
      else if (ua.includes("Android")) operatingSystem = "Android";
      else if (ua.includes("iPhone") || ua.includes("iPad"))
        operatingSystem = "iOS";

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("dynoquizz_token") || ""
            : "";

        await fetch(`${API_BASE}/api/v1/attempts/${attemptId}/device`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            browserName,
            browserVersion: "Latest",
            operatingSystem,
            deviceType,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            userAgent: ua,
          }),
        });
      } catch (e) {
        console.warn("Device registration sync error:", e);
      }
    };

    registerDevice();
  }, [attemptId, enabled]);

  // ─── 2.5 Chrome Proctoring Extension Handshake & Telemetry Bridge ──────────
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    if ((window as any).__DYNOQUIZZ_EXTENSION_ACTIVE__) {
      setIsExtensionInstalled(true);
      setIsExtensionActive(true);
    }

    const handleCustomReady = () => {
      setIsExtensionInstalled(true);
      setIsExtensionActive(true);
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      if (
        event.data.type === "DYNOQUIZZ_EXTENSION_PONG" ||
        event.data.type === "DYNOQUIZZ_INIT_ACK"
      ) {
        setIsExtensionInstalled(true);
        setIsExtensionActive(true);
        if (event.data.displays && Array.isArray(event.data.displays)) {
          setDisplayCount(event.data.displays.length);
          if (event.data.displays.length > 1) {
            setProctorStatus("WARNING");
            setStatusMessage(
              `Alert: ${event.data.displays.length} displays detected by Proctor Shield!`,
            );
            logEventToBackend("MULTI_DISPLAY", `${event.data.displays.length} displays detected`);
          }
        }
      }

      if (event.data.type === "DYNOQUIZZ_EXTENSION_VIOLATION_ALERT") {
        const v = event.data.violation;
        if (v) {
          const newViolation: ProctoringViolation = {
            id: v.id || Math.random().toString(36).substring(2, 9),
            type: v.type || "VIOLATION",
            message: `[Proctor Shield] ${v.details || v.type}`,
            timestamp: v.timestamp || new Date().toLocaleTimeString(),
          };
          setViolations((prev) => [newViolation, ...prev.slice(0, 19)]);
          if (v.type !== "WINDOW_FOCUS") {
            setProctorStatus("WARNING");
            setStatusMessage(`Shield Alert: ${v.details || v.type}`);
            logEventToBackend(v.type || "EXTENSION_VIOLATION", v.details || "Extension alert");
          }
        }
      }
    };

    window.addEventListener("dynoquizz-extension-ready", handleCustomReady);
    window.addEventListener("message", handleWindowMessage);

    // Initial ping to extension
    window.postMessage({ type: "DYNOQUIZZ_PING_EXTENSION" }, "*");

    // Arm the extension with attempt metadata when attemptId is active
    if (attemptId) {
      const token = localStorage.getItem("dynoquizz_token") || "";
      window.postMessage(
        {
          type: "DYNOQUIZZ_INIT",
          attemptId,
          testCode,
          studentReg,
          token,
          apiBase: API_BASE,
        },
        "*",
      );
    }

    // Periodic heartbeat ping to verify extension is alive
    const pingInterval = setInterval(() => {
      window.postMessage({ type: "DYNOQUIZZ_PING_EXTENSION" }, "*");
    }, 4000);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener("dynoquizz-extension-ready", handleCustomReady);
      window.removeEventListener("message", handleWindowMessage);
      window.postMessage({ type: "DYNOQUIZZ_FINISH" }, "*");
    };
  }, [attemptId, enabled, testCode, studentReg, logEventToBackend]);

  // ─── 3. Browser Integrity Listeners (Tab switch, Blur, ContextMenu, Keydown) ──
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctorStatus("WARNING");
        setStatusMessage("Warning: Tab switch / Window minimized detected!");
        logEventToBackend("TAB_SWITCH", "Candidate switched away from exam tab");
      } else {
        logEventToBackend("WINDOW_FOCUS", "Candidate returned to exam tab");
      }
    };

    const handleBlur = () => {
      setProctorStatus("WARNING");
      setStatusMessage("Warning: Window lost focus!");
      logEventToBackend("WINDOW_BLUR", "Exam window lost focus / tab switched");
    };

    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        setProctorStatus("WARNING");
        setStatusMessage("Warning: Fullscreen mode exited!");
        logEventToBackend("FULLSCREEN_EXIT", "Candidate exited full screen mode");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setProctorStatus("WARNING");
      setStatusMessage("Warning: Right-click context menu is prohibited!");
      logEventToBackend(
        "RIGHT_CLICK",
        "Candidate attempted right-click context menu",
      );
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setProctorStatus("WARNING");
      setStatusMessage("Warning: Clipboard copying / pasting is prohibited!");
      logEventToBackend(
        "COPY_ATTEMPT",
        `Candidate attempted clipboard action: ${e.type}`,
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey &&
          e.shiftKey &&
          (e.key === "I" ||
            e.key === "i" ||
            e.key === "C" ||
            e.key === "c" ||
            e.key === "J" ||
            e.key === "j")) ||
        (e.ctrlKey && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
        logEventToBackend("DEVTOOLS_OPEN", `Blocked developer tool shortcut: ${e.key}`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, logEventToBackend]);

  // ─── 4. Edge-AI Background Webcam, Periodic Snapshots & Gaze Analysis ────────
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let analysisInterval: any = null;
    let snapshotInterval: any = null;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: true,
        });

        if (!isMounted) return;

        streamRef.current = stream;
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Setup Audio Analyser for voice spikes
        try {
          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const audioInterval = setInterval(() => {
              if (isAutoSubmittedRef.current || !isMounted) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              setMicLevel(Math.min(100, Math.round((average / 128) * 100)));
              const now = Date.now();
              if (average > 75 && now - lastAudioSpikeTimeRef.current > 4000) {
                lastAudioSpikeTimeRef.current = now;
                setProctorStatus("WARNING");
                setStatusMessage(`Audio detected (level: ${Math.round(average)})`);
                logEventToBackend(
                  "VOICE_DETECTED",
                  `Audio spike detected (volume level: ${Math.round(average)})`,
                );
              }
            }, 300);
          }
        } catch (audioErr) {
          console.warn("Audio analysis unavailable:", audioErr);
        }

        setProctorStatus("ACTIVE");
        setStatusMessage("Background Edge-AI Vision & Gaze proctor active");

        // Client-side AI face/gaze analysis.
        // We prefer MediaPipe FaceLandmarker because the browser FaceDetector API
        // is not consistently available in desktop browsers.
        let aiFaceLandmarker: any = null;
        let aiInitFailed = false;

        try {
                    const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",
          );

          aiFaceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 2,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          setStatusMessage("AI face & gaze detector initialized");
        } catch (aiError) {
          aiInitFailed = true;
          console.warn("MediaPipe AI initialization failed; trying native detector:", aiError);
        }

        let nativeFaceDetector: any = null;
        if (!aiFaceLandmarker && "FaceDetector" in window) {
          try {
            nativeFaceDetector = new (window as any).FaceDetector({
              fastMode: true,
              maxDetectedFaces: 5,
            });
          } catch {
            nativeFaceDetector = null;
          }
        }

        if (!aiFaceLandmarker && !nativeFaceDetector) {
          setProctorStatus("WARNING");
          setStatusMessage(
            aiInitFailed
              ? "AI face detector unavailable. Camera monitoring remains active, but face analysis is unavailable."
              : "Face detector unavailable. Camera monitoring remains active.",
          );
        }

        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let totalGazeDeviations = 0;
        let lastFaceEventAt = 0;

        const logFaceViolation = (type: string, details: string) => {
          const now = Date.now();
          if (now - lastFaceEventAt < 5000) return;
          lastFaceEventAt = now;
          setProctorStatus("WARNING");
          setStatusMessage(details);
          logEventToBackend(type, details);
        };

        const analyzeFrame = async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || isAutoSubmittedRef.current || !isMounted) {
            return;
          }

          try {
            if (aiFaceLandmarker) {
              const result = aiFaceLandmarker.detectForVideo(video, performance.now());
              const faces = result?.faceLandmarks || [];

              if (faces.length === 0) {
                consecutiveNoFaceRef.current += 1;
                consecutiveMultiFaceRef.current = 0;
                if (consecutiveNoFaceRef.current >= 3) {
                  setFaceStatus("NO_FACE");
                  logFaceViolation("FACE_NOT_DETECTED", "No face detected in camera frame");
                  consecutiveNoFaceRef.current = 0;
                }
                return;
              }

              if (faces.length > 1) {
                consecutiveMultiFaceRef.current += 1;
                consecutiveNoFaceRef.current = 0;
                if (consecutiveMultiFaceRef.current >= 2) {
                  setFaceStatus("MULTIPLE_FACES");
                  logFaceViolation(
                    "MULTIPLE_FACES",
                    `Multiple faces (${faces.length}) detected in camera frame`,
                  );
                  consecutiveMultiFaceRef.current = 0;
                }
                return;
              }

              consecutiveNoFaceRef.current = 0;
              consecutiveMultiFaceRef.current = 0;
              const landmarks = faces[0];

              // Lightweight head/gaze-direction heuristic from stable facial landmarks.
              // This is intentionally described as "looking away", not identity recognition.
              const nose = landmarks[1];
              const leftEye = landmarks[33];
              const rightEye = landmarks[263];

              if (nose && leftEye && rightEye) {
                const eyeMidX = (leftEye.x + rightEye.x) / 2;
                const eyeDistance = Math.max(Math.abs(rightEye.x - leftEye.x), 0.001);
                const horizontalOffset = (nose.x - eyeMidX) / eyeDistance;

                if (Math.abs(horizontalOffset) > 0.42) {
                  consecutiveLookingAwayRef.current += 1;
                  if (consecutiveLookingAwayRef.current >= 3) {
                    totalGazeDeviations += 1;
                    setFaceStatus("LOOKING_AWAY");
                    logFaceViolation(
                      "LOOKING_AWAY",
                      `Candidate appears to be looking away (event #${totalGazeDeviations})`,
                    );
                    consecutiveLookingAwayRef.current = 0;
                  }
                } else {
                  consecutiveLookingAwayRef.current = 0;
                  setFaceStatus("OK");
                  setProctorStatus("ACTIVE");
                  setStatusMessage("Face detected & gaze aligned");
                }
              }
              return;
            }

            if (nativeFaceDetector) {
              const faces = await nativeFaceDetector.detect(video);
              if (faces.length === 0) {
                consecutiveNoFaceRef.current += 1;
                if (consecutiveNoFaceRef.current >= 3) {
                  setFaceStatus("NO_FACE");
                  logFaceViolation("FACE_NOT_DETECTED", "No face detected in camera frame");
                  consecutiveNoFaceRef.current = 0;
                }
              } else if (faces.length > 1) {
                consecutiveMultiFaceRef.current += 1;
                if (consecutiveMultiFaceRef.current >= 2) {
                  setFaceStatus("MULTIPLE_FACES");
                  logFaceViolation(
                    "MULTIPLE_FACES",
                    `Multiple faces (${faces.length}) detected in camera frame`,
                  );
                  consecutiveMultiFaceRef.current = 0;
                }
              } else {
                consecutiveNoFaceRef.current = 0;
                consecutiveMultiFaceRef.current = 0;
                setFaceStatus("OK");
                setProctorStatus("ACTIVE");
                setStatusMessage("Face detected");
              }
            }
          } catch (analysisError) {
            console.warn("AI frame analysis failed:", analysisError);
          }
        };

        analysisInterval = setInterval(() => {
          void analyzeFrame();
        }, 1200);

        // Periodic snapshot capture & candidate identity analysis every 30 seconds
        snapshotInterval = setInterval(() => {
          if (!videoRef.current || isAutoSubmittedRef.current || !isMounted) return;
          try {
            if (ctx && videoRef.current.readyState >= 2) {
              ctx.drawImage(videoRef.current, 0, 0, 320, 240);
              const snapshotData = canvas.toDataURL("image/jpeg", 0.6);
              
              if (typeof window !== "undefined" && attemptId) {
                // Store candidate exam snapshots
                const existingSnapshots = JSON.parse(
                  sessionStorage.getItem(`dynoquizz_exam_snaps_${attemptId}`) || "[]"
                );
                existingSnapshots.push({
                  time: new Date().toLocaleTimeString(),
                  data: snapshotData,
                });
                if (existingSnapshots.length > 30) existingSnapshots.shift();
                sessionStorage.setItem(
                  `dynoquizz_exam_snaps_${attemptId}`,
                  JSON.stringify(existingSnapshots)
                );
              }
            }
          } catch (e) {
            // ignore snapshot frame capture errors
          }
        }, 30000);

      } catch (mediaErr) {
        console.warn("Camera or microphone permission denied:", mediaErr);
        setProctorStatus("WARNING");
        setStatusMessage("Camera/Microphone permission required for AI proctoring");
      }
    };

    startMedia();

    return () => {
      isMounted = false;
      if (analysisInterval) clearInterval(analysisInterval);
      if (snapshotInterval) clearInterval(snapshotInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [enabled, attemptId, logEventToBackend]);

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen is optional and may be denied by the browser.
    }
  }, []);

  const warnings = useMemo(() => {
    return violations.map((v) => `${v.timestamp} - ${v.message}`);
  }, [violations]);

  return {
    videoRef,
    attachVideo,
    micLevel,
    warningsCount,
    maxWarnings,
    violations,
    proctorStatus,
    statusMessage,
    currentWarningMessage,
    dismissWarning,
    faceStatus,
    isFullscreen,
    hasCameraPermission,
    isExtensionInstalled,
    isExtensionActive,
    displayCount,
    requestFullscreen,
    // Backward-compatibility properties:
    warnings,
    violationCount: warningsCount,
    flags,
  };
}
