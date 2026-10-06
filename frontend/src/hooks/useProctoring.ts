"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AI_PROCTORING_WS_URL,
  checkAIHealth,
  startProctoringSession,
  stopProctoringSession,
  analyzeFrameREST,
  TelemetryResponse,
} from "@/lib/proctoring/aiProctoringClient";

interface UseProctoringOptions {
  attemptId: number;
  studentId: string;
  testCode: string;
  referenceImage: string | null;
  authToken?: string;
  springBootUrl?: string;
  onAutoSubmit?: () => void;
  enabled?: boolean;
}

export function useProctoring({
  attemptId,
  studentId,
  testCode,
  referenceImage,
  authToken,
  springBootUrl,
  onAutoSubmit,
  enabled = true,
}: UseProctoringOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const wsTicketRef = useRef<string | null>(null);
  const isCleaningUpRef = useRef(false);
  const cleanupPromiseRef = useRef<Promise<void> | null>(null);
  const isWsAuthenticatedRef = useRef(false);
  const inFlightRestRef = useRef(false);

  // Audio PCM buffer
  const latestAudioSamplesRef = useRef<number[]>([]);

  // Telemetry state
  const [cameraActive, setCameraActive] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);
  const [numFaces, setNumFaces] = useState(1);
  const [numPersons, setNumPersons] = useState(1);
  const [identityVerified, setIdentityVerified] = useState(false); // Strict: Initial false until first verification
  const [similarityScore, setSimilarityScore] = useState(0.0);
  const [gazeDirection, setGazeDirection] = useState<"CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN">("CENTER");
  const [yaw, setYaw] = useState(0.0);
  const [pitch, setPitch] = useState(0.0);
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [phoneDetected, setPhoneDetected] = useState(false);
  const [micLevel, setMicLevel] = useState(0.0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [loudVoice, setLoudVoice] = useState(false);
  const [warningCount, setWarningCount] = useState(0);

  // Warning modal state
  const [activeWarningModal, setActiveWarningModal] = useState<{
    isOpen: boolean;
    reason: string;
    count: number;
    autoSubmitted: boolean;
  }>({
    isOpen: false,
    reason: "",
    count: 0,
    autoSubmitted: false,
  });

  // Thorough Hardware & Resource Cleanup (Idempotent Async Finalization)
  const cleanup = useCallback((): Promise<void> => {
    if (cleanupPromiseRef.current) {
      return cleanupPromiseRef.current;
    }

    cleanupPromiseRef.current = (async () => {
      isCleaningUpRef.current = true;
      isWsAuthenticatedRef.current = false;

      // 1. Clear frame processing intervals immediately
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }

      // 2. Stop WebSocket connection immediately
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }

      // 3. Stop all camera & microphone MediaStream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore
          }
        });
        streamRef.current = null;
      }

      // 4. Detach video element stream
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // 5. Close Web Audio Context
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          await audioContextRef.current.close();
        } catch {
          // Ignore
        }
        audioContextRef.current = null;
      }

      // 6. Stop remote AI proctoring session and await summary dispatch with timeout
      const sid = sessionIdRef.current;
      const ticket = wsTicketRef.current;
      sessionIdRef.current = null;
      if (sid) {
        try {
          await Promise.race([
            stopProctoringSession({
              sessionId: sid,
              ticket: ticket || undefined,
              authToken,
              studentId,
              attemptId,
            }),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        } catch (err) {
          console.warn("Error stopping proctoring session:", err);
        }
      }

      setCameraActive(false);
    })();

    return cleanupPromiseRef.current;
  }, [authToken, studentId, attemptId]);

  const handleTelemetryUpdate = useCallback(
    (telemetry: TelemetryResponse) => {
      setFaceDetected(telemetry.faceDetected);
      setNumFaces(telemetry.numFaces);
      if (telemetry.numPersons !== undefined) {
        setNumPersons(telemetry.numPersons);
      }
      setIdentityVerified(telemetry.identityVerified);
      setSimilarityScore(telemetry.similarityScore);
      if (telemetry.gazeDirection) {
        setGazeDirection(telemetry.gazeDirection);
      }
      if (telemetry.yaw !== undefined) {
        setYaw(telemetry.yaw);
      }
      if (telemetry.pitch !== undefined) {
        setPitch(telemetry.pitch);
      }
      if (telemetry.isLookingAway !== undefined) {
        setIsLookingAway(telemetry.isLookingAway);
      }
      setPhoneDetected(telemetry.phoneDetected);
      setMicLevel(telemetry.micLevel);
      setVoiceActive(telemetry.voiceActive);
      setLoudVoice(telemetry.loudVoice);

      if (telemetry.warningCount !== undefined) {
        setWarningCount(telemetry.warningCount);
      }

      // If a confirmed malpractice event occurred
      if (telemetry.malpracticeEvent) {
        setActiveWarningModal({
          isOpen: true,
          reason: telemetry.eventMessage || telemetry.malpracticeEvent,
          count: telemetry.warningCount,
          autoSubmitted: telemetry.autoSubmitted,
        });

        if (telemetry.autoSubmitted && onAutoSubmit) {
          onAutoSubmit();
        }
      }
    },
    [onAutoSubmit]
  );

  // Capture single frame from in-DOM video
  const captureFrameBase64 = useCallback((): string | null => {
    if (!videoRef.current || !cameraActive) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.70);
    } catch {
      return null;
    }
  }, [cameraActive]);

  // Main lifecycle setup
  useEffect(() => {
    if (!enabled || !referenceImage) return;

    let mounted = true;
    isCleaningUpRef.current = false;

    const initProctoring = async () => {
      // 1. Health check
      const health = await checkAIHealth();
      if (!mounted) return;
      setIsOnline(health.isOnline);

      if (!health.isOnline || !health.biometricReady) {
        console.warn("AI Proctoring service or biometric model is unavailable.");
        return;
      }

      try {
        // 2. Start AI session with reference biometric photo
        const sessionRes = await startProctoringSession({
          attemptId,
          studentId,
          testCode,
          referenceImage,
          authToken,
          springBootUrl,
        });

        if (!mounted) return;
        sessionIdRef.current = sessionRes.sessionId;
        wsTicketRef.current = sessionRes.wsTicket || null;

        // 3. Request Camera and Microphone hardware
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: true,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);

        // 4. Setup Audio Context for continuous VAD samples
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            latestAudioSamplesRef.current = Array.from(inputData);
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);
        } catch (audioErr) {
          console.warn("Web Audio API initialization failed:", audioErr);
        }

        // 5. Connect WebSocket streaming with authenticated handshake
        try {
          const wsUrl = `${AI_PROCTORING_WS_URL}/ws/proctor/${sessionRes.sessionId}`;
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            // Send mandatory authentication handshake as the first message
            ws.send(
              JSON.stringify({
                type: "auth",
                ticket: sessionRes.wsTicket,
                authToken: authToken,
                studentId: studentId,
                attemptId: attemptId,
              })
            );
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "authenticated") {
                isWsAuthenticatedRef.current = true;
              } else if (data.type === "telemetry" && mounted) {
                handleTelemetryUpdate(data);
              }
            } catch {
              // Ignore invalid JSON
            }
          };

          ws.onerror = () => {
            console.warn("AI WebSocket connection error, fallback to REST");
          };
        } catch {
          console.warn("WebSocket init failed, using REST fallback");
        }

        // 6. Continuous Streaming Loop (every 350ms) with in-flight guard
        frameIntervalRef.current = setInterval(async () => {
          if (!mounted || isCleaningUpRef.current) return;

          const frameB64 = captureFrameBase64();
          if (!frameB64) return;

          const audioSamples = latestAudioSamplesRef.current;
          latestAudioSamplesRef.current = []; // drain

          // If WebSocket is open and authenticated, send over WS
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isWsAuthenticatedRef.current) {
            wsRef.current.send(
              JSON.stringify({
                frame: frameB64,
                audio: audioSamples,
              })
            );
          } else if (sessionIdRef.current && !inFlightRestRef.current) {
            inFlightRestRef.current = true;
            try {
              const res = await analyzeFrameREST({
                sessionId: sessionIdRef.current,
                ticket: wsTicketRef.current || undefined,
                authToken,
                studentId,
                attemptId,
                frame: frameB64,
                audio: audioSamples,
              });
              if (mounted && !isCleaningUpRef.current) {
                handleTelemetryUpdate(res);
              }
            } catch {
              // Frame dropped
            } finally {
              inFlightRestRef.current = false;
            }
          }
        }, 350);
      } catch (err) {
        console.error("Failed to initialize proctoring session:", err);
      }
    };

    void initProctoring();

    const handleBeforeUnload = () => {
      void cleanup();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void cleanup();
    };
  }, [
    enabled,
    attemptId,
    studentId,
    testCode,
    referenceImage,
    authToken,
    springBootUrl,
    cleanup,
    captureFrameBase64,
    handleTelemetryUpdate,
  ]);

  const dismissWarningModal = useCallback(() => {
    setActiveWarningModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    videoRef,
    cameraActive,
    isOnline,
    faceDetected,
    numFaces,
    numPersons,
    identityVerified,
    similarityScore,
    gazeDirection,
    yaw,
    pitch,
    isLookingAway,
    phoneDetected,
    micLevel,
    voiceActive,
    loudVoice,
    warningCount,
    activeWarningModal,
    dismissWarningModal,
    cleanup,
  };
}
