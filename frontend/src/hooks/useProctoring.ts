"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface ProctoringViolation {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface UseProctoringOptions {
  attemptId?: number | null;
  quizId?: number | null;
  maxWarnings?: number;
  autoSubmitOnLimit?: boolean;
  onAutoSubmit?: () => void;
  enabled?: boolean;
}

export function useProctoring({
  attemptId,
  maxWarnings = 3,
  onAutoSubmit,
  enabled = true,
}: UseProctoringOptions = {}) {
  const [warningsCount, setWarningsCount] = useState(0);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [proctorStatus, setProctorStatus] = useState<"INITIALIZING" | "ACTIVE" | "WARNING" | "VIOLATION">("INITIALIZING");
  const [statusMessage, setStatusMessage] = useState("Initializing Edge-AI proctor...");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"OK" | "NO_FACE" | "MULTIPLE_FACES" | "LOOKING_AWAY">("OK");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const consecutiveNoFaceRef = useRef(0);
  const consecutiveMultiFaceRef = useRef(0);
  const isAutoSubmittedRef = useRef(false);

  // ─── 1. Send Violation to Backend ──────────────────────────────────────────
  const logEventToBackend = useCallback(
    async (activityType: string, details: string) => {
      const newViolation: ProctoringViolation = {
        id: Math.random().toString(36).substring(2, 9),
        type: activityType,
        message: details,
        timestamp: new Date().toLocaleTimeString(),
      };

      setViolations((prev) => [newViolation, ...prev.slice(0, 19)]);

      if (!attemptId) return;

      try {
        const response = await fetch(`http://localhost:8080/api/v1/attempts/${attemptId}/activities`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("dynoquizz_token") || "" : ""}`,
          },
          body: JSON.stringify({
            activityType,
            details,
            activityTime: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.currentWarningsCount !== undefined) {
            setWarningsCount(data.currentWarningsCount);
          }
          if (data.autoSubmitted && !isAutoSubmittedRef.current) {
            isAutoSubmittedRef.current = true;
            setProctorStatus("VIOLATION");
            setStatusMessage("Exam auto-submitted due to excessive violations.");
            if (onAutoSubmit) {
              onAutoSubmit();
            }
          }
        }
      } catch (err) {
        console.warn("Could not sync proctoring event to backend:", err);
      }
    },
    [attemptId, onAutoSubmit]
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
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browserName = "Safari";
      else if (ua.includes("Edg")) browserName = "Edge";

      let operatingSystem = "Windows";
      if (ua.includes("Mac OS")) operatingSystem = "macOS";
      else if (ua.includes("Linux")) operatingSystem = "Linux";
      else if (ua.includes("Android")) operatingSystem = "Android";
      else if (ua.includes("iPhone") || ua.includes("iPad")) operatingSystem = "iOS";

      try {
        await fetch(`http://localhost:8080/api/v1/attempts/${attemptId}/device`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("dynoquizz_token") || ""}`,
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

  // ─── 3. Browser Integrity Listeners ───────────────────────────────────────
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
      logEventToBackend("WINDOW_BLUR", "Exam window blurred");
    };

    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        setProctorStatus("WARNING");
        setStatusMessage("Warning: Fullscreen exited!");
        logEventToBackend("FULLSCREEN_EXIT", "Candidate exited full screen mode");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setProctorStatus("WARNING");
      setStatusMessage("Warning: Right-click is prohibited!");
      logEventToBackend("RIGHT_CLICK", "Candidate attempted right-click context menu");
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setProctorStatus("WARNING");
      setStatusMessage("Warning: Clipboard copying / pasting is prohibited!");
      logEventToBackend("COPY_ATTEMPT", `Candidate attempted clipboard action: ${e.type}`);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "J" || e.key === "j")) ||
        (e.ctrlKey && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
        logEventToBackend("RIGHT_CLICK", `Blocked developer tool shortcut: ${e.key}`);
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

  // ─── 4. Edge-AI Webcam & Audio Stream ────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let analysisInterval: any = null;

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
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            setInterval(() => {
              if (isAutoSubmittedRef.current) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const average = sum / dataArray.length;
              if (average > 75) {
                logEventToBackend("VOICE_DETECTED", `Audio spike detected (volume level: ${Math.round(average)})`);
              }
            }, 3000);
          }
        } catch (audioErr) {
          console.warn("Audio analysis unavailable:", audioErr);
        }

        setProctorStatus("ACTIVE");
        setStatusMessage("Edge-AI Vision & Audio proctor active");

        // Edge-AI Face Detection Loop using native FaceDetector if available or Canvas frame analysis
        const hasNativeFaceDetector = typeof window !== "undefined" && "FaceDetector" in window;
        const faceDetector = hasNativeFaceDetector ? new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 4 }) : null;

        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        analysisInterval = setInterval(async () => {
          if (!videoRef.current || isAutoSubmittedRef.current) return;

          if (faceDetector && videoRef.current.readyState >= 2) {
            try {
              const faces = await faceDetector.detect(videoRef.current);
              if (faces.length === 0) {
                consecutiveNoFaceRef.current += 1;
                consecutiveMultiFaceRef.current = 0;
                if (consecutiveNoFaceRef.current >= 3) {
                  setFaceStatus("NO_FACE");
                  setProctorStatus("WARNING");
                  setStatusMessage("Warning: Face not detected in camera frame!");
                  logEventToBackend("FACE_NOT_DETECTED", "No face detected in video feed for >3s");
                  consecutiveNoFaceRef.current = 0;
                }
              } else if (faces.length > 1) {
                consecutiveMultiFaceRef.current += 1;
                consecutiveNoFaceRef.current = 0;
                if (consecutiveMultiFaceRef.current >= 2) {
                  setFaceStatus("MULTIPLE_FACES");
                  setProctorStatus("VIOLATION");
                  setStatusMessage("Alert: Multiple faces detected in video frame!");
                  logEventToBackend("MULTIPLE_FACES", `${faces.length} faces detected in camera feed`);
                  consecutiveMultiFaceRef.current = 0;
                }
              } else {
                consecutiveNoFaceRef.current = 0;
                consecutiveMultiFaceRef.current = 0;
                setFaceStatus("OK");
                setProctorStatus("ACTIVE");
                setStatusMessage("Face verified and aligned");
              }
            } catch {
              // Fallback to optical brightness
            }
          } else if (ctx && videoRef.current.readyState >= 2) {
            // Lightweight optical motion & luminance heuristic
            ctx.drawImage(videoRef.current, 0, 0, 160, 120);
            const imgData = ctx.getImageData(0, 0, 160, 120);
            let totalBrightness = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
              totalBrightness += (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
            }
            const avgBrightness = totalBrightness / (imgData.data.length / 4);

            if (avgBrightness < 15) {
              consecutiveNoFaceRef.current += 1;
              if (consecutiveNoFaceRef.current >= 3) {
                setFaceStatus("NO_FACE");
                setStatusMessage("Warning: Camera feed is obscured or too dark!");
                logEventToBackend("FACE_NOT_DETECTED", "Camera lens blocked or low lighting");
                consecutiveNoFaceRef.current = 0;
              }
            } else {
              consecutiveNoFaceRef.current = 0;
              setFaceStatus("OK");
              setProctorStatus("ACTIVE");
              setStatusMessage("Proctor active | Lighting verified");
            }
          }
        }, 1500);
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [enabled, logEventToBackend]);

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return {
    videoRef,
    warningsCount,
    maxWarnings,
    violations,
    proctorStatus,
    statusMessage,
    faceStatus,
    isFullscreen,
    hasCameraPermission,
    requestFullscreen,
  };
}
