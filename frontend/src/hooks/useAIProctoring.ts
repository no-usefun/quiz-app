"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AI_PROCTORING_WS_URL,
  checkAIHealth,
  startProctoringSession,
  stopProctoringSession,
  analyzeFrameREST,
  TelemetryResponse,
  StartSessionResult,
} from "@/lib/proctoring/aiProctoringClient";

interface UseProctoringOptions {
  attemptId: number;
  studentId?: string;
  testCode: string;
  referenceImage: string | null;
  authToken?: string;
  springBootUrl?: string;
  onAutoSubmit?: () => void;
  enabled?: boolean;
}

export function useAIProctoring({
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

  // Audio sample buffer & sample rate
  const latestAudioSamplesRef = useRef<number[]>([]);
  const audioSampleRateRef = useRef<number>(16000);

  // Stable dynamic refs to avoid triggering effect re-execution
  const onAutoSubmitRef = useRef(onAutoSubmit);
  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);

  const authTokenRef = useRef(authToken);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  const studentIdRef = useRef(studentId);
  useEffect(() => {
    studentIdRef.current = studentId;
  }, [studentId]);

  const attemptIdRef = useRef(attemptId);
  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  const testCodeRef = useRef(testCode);
  useEffect(() => {
    testCodeRef.current = testCode;
  }, [testCode]);

  const springBootUrlRef = useRef(springBootUrl);
  useEffect(() => {
    springBootUrlRef.current = springBootUrl;
  }, [springBootUrl]);

  // Telemetry & Hardware State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [telemetryReceived, setTelemetryReceived] = useState(false);

  // Strictly default to unknown/initial values until confirmed by telemetry
  const [faceDetected, setFaceDetected] = useState(false);
  const [numFaces, setNumFaces] = useState(0);
  const [numPersons, setNumPersons] = useState(0);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(0.0);
  const [gazeDirection, setGazeDirection] = useState<"CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN">("CENTER");
  const [yaw, setYaw] = useState(0.0);
  const [pitch, setPitch] = useState(0.0);
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [phoneDetected, setPhoneDetected] = useState(false);
  const [micLevel, setMicLevel] = useState(0.0);
  const [voiceActive, setVoiceActive] = useState(false);
  const [loudVoice, setLoudVoice] = useState(false);
  const [warningCount, setWarningCountState] = useState(0);
  const warningCountRef = useRef(0);

  const setWarningCount = useCallback((value: number | ((prev: number) => number)) => {
    setWarningCountState((prev) => {
      const nextVal = typeof value === "function" ? value(prev) : value;
      const monotonicVal = Math.max(prev, nextVal);
      warningCountRef.current = monotonicVal;
      return monotonicVal;
    });
  }, []);

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

    const runCleanup = async () => {
      isCleaningUpRef.current = true;
      isWsAuthenticatedRef.current = false;

      // 1. Clear frame intervals immediately
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }

      // 2. Stop WebSocket connection
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
        try {
          videoRef.current.srcObject = null;
        } catch {
          // Ignore
        }
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
      wsTicketRef.current = null;

      if (sid) {
        try {
          await Promise.race([
            stopProctoringSession({
              sessionId: sid,
              ticket: ticket || undefined,
              authToken: authTokenRef.current,
              studentId: studentIdRef.current,
              attemptId: attemptIdRef.current,
            }),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        } catch (err) {
          console.warn("Error stopping proctoring session:", err);
        }
      }

      setCameraActive(false);
      cleanupPromiseRef.current = null;
    };

    cleanupPromiseRef.current = runCleanup();
    return cleanupPromiseRef.current;
  }, []);

  const retryInitialization = useCallback(async () => {
    await cleanup();
    setRetryCount((current) => current + 1);
  }, [cleanup]);

  const handleTelemetryUpdate = useCallback((telemetry: TelemetryResponse) => {
    setTelemetryReceived(true);
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
      const strikeCount = Math.max(warningCountRef.current, telemetry.warningCount ?? 0);
      const isAuto = Boolean(telemetry.autoSubmitted) || strikeCount >= 3;
      setActiveWarningModal({
        isOpen: true,
        reason: telemetry.eventMessage || telemetry.malpracticeEvent,
        count: strikeCount,
        autoSubmitted: isAuto,
      });

      if (isAuto && onAutoSubmitRef.current) {
        onAutoSubmitRef.current();
      }
    }
  }, [setWarningCount]);

  // Capture single frame from in-DOM video without depending on cameraActive state
  const captureFrameBase64 = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return null;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(640, video.videoWidth || 320);
      canvas.height = Math.min(480, video.videoHeight || 240);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.70);
    } catch {
      return null;
    }
  }, []);

  // Auxiliary effect: Ensure stream attaches to video element whenever video element is available
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  });

  // Main Proctoring Lifecycle Setup: Kept completely stable across state updates
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    isCleaningUpRef.current = false;
    cleanupPromiseRef.current = null;

    if (!referenceImage) {
      setCameraError("Reference biometric photo is missing. Please return to the lobby to register your photo.");
      return;
    }

    const initProctoring = async () => {
      setCameraError(null);

      // 1. Health check AI microservice
      const health = await checkAIHealth();
      if (!mounted) return;
      setIsOnline(health.isOnline);

      if (!health.isOnline) {
        setCameraError("The AI Proctoring microservice is currently offline. Please ensure it is running on port 8000.");
        return;
      }
      if (!health.biometricReady) {
        setCameraError("SFace biometric identity engine is offline. Biometric verification cannot start.");
        return;
      }

      // 2. Request Camera and Microphone hardware
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Media capture is not supported in this browser environment or insecure context.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: true,
        });
      } catch (mediaErr: any) {
        if (!mounted) return;
        let msg = "Could not access camera or microphone.";
        if (mediaErr?.name === "NotAllowedError" || mediaErr?.name === "PermissionDeniedError") {
          msg = "Camera/microphone permission was denied. Please allow camera and mic permissions in browser settings.";
        } else if (mediaErr?.name === "NotFoundError" || mediaErr?.name === "DevicesNotFoundError") {
          msg = "No camera or microphone hardware device was found.";
        } else if (mediaErr?.name === "NotReadableError" || mediaErr?.name === "TrackStartError") {
          msg = "Camera or microphone is in use by another application. Please close other software and retry.";
        }
        setCameraError(msg);
        console.error("Camera acquisition failed:", mediaErr);
        return;
      }

      if (!mounted || isCleaningUpRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0 || videoTracks[0].readyState !== "live") {
        stream.getTracks().forEach((t) => t.stop());
        setCameraError("No live video track available in camera stream.");
        return;
      }

      streamRef.current = stream;

      // Attach stream to video
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if (videoRef.current.readyState < 1) {
          await new Promise<void>((resolve) => {
            const onLoaded = () => {
              videoRef.current?.removeEventListener("loadedmetadata", onLoaded);
              resolve();
            };
            videoRef.current?.addEventListener("loadedmetadata", onLoaded);
            setTimeout(resolve, 1500);
          });
        }
        await videoRef.current.play().catch((playErr) => {
          console.warn("Video autoplay delayed or requires interaction:", playErr);
        });
      }
      setCameraActive(true);

      // 3. Setup Web Audio Context for continuous speech VAD
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

        if (AudioContextClass) {
          let audioCtx: AudioContext;
          try {
            audioCtx = new AudioContextClass({ sampleRate: 16000 });
          } catch {
            audioCtx = new AudioContextClass();
          }
          audioContextRef.current = audioCtx;
          audioSampleRateRef.current = audioCtx.sampleRate;

          if (audioCtx.state === "suspended") {
            await audioCtx.resume().catch(() => {});
          }

          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);

          processor.onaudioprocess = (e) => {
            if (isCleaningUpRef.current) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const samples = Array.from(inputData);
            const cur = latestAudioSamplesRef.current;
            if (cur.length + samples.length > 8192) {
              latestAudioSamplesRef.current = samples;
            } else {
              latestAudioSamplesRef.current = cur.concat(samples);
            }
          };

          // Route through muted gain node so speaker feedback loop does not occur
          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0.0;

          source.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(audioCtx.destination);
        }
      } catch (audioErr) {
        console.warn("Web Audio API initialization failed:", audioErr);
      }

      // 4. Start AI session with reference biometric photo
      let sessionRes: StartSessionResult;
      try {
        sessionRes = await startProctoringSession({
          attemptId,
          studentId: studentIdRef.current,
          testCode: testCodeRef.current,
          referenceImage,
          authToken: authTokenRef.current,
          springBootUrl: springBootUrlRef.current,
        });
      } catch (sessionErr: any) {
        if (!mounted) return;
        setCameraError(sessionErr?.message || "Failed to initialize proctoring session.");
        console.error("Proctoring session initialization failed:", sessionErr);
        await cleanup();
        return;
      }

      if (!mounted || isCleaningUpRef.current) return;
      sessionIdRef.current = sessionRes.sessionId;
      wsTicketRef.current = sessionRes.wsTicket || null;

      // 5. Connect WebSocket streaming with authenticated handshake
      try {
        const wsUrl = `${AI_PROCTORING_WS_URL}/ws/proctor/${sessionRes.sessionId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "auth",
              ticket: sessionRes.wsTicket,
              authToken: authTokenRef.current,
              studentId: studentIdRef.current,
              attemptId: attemptIdRef.current,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "authenticated") {
              isWsAuthenticatedRef.current = true;
            } else if (data.type === "telemetry" && mounted && !isCleaningUpRef.current) {
              handleTelemetryUpdate(data);
            }
          } catch {
            // Ignore malformed JSON
          }
        };

        ws.onerror = () => {
          console.warn("AI WebSocket connection error, falling back to REST");
          isWsAuthenticatedRef.current = false;
        };

        ws.onclose = () => {
          isWsAuthenticatedRef.current = false;
          wsRef.current = null;
        };
      } catch {
        console.warn("WebSocket init failed, using REST fallback");
      }

      // 6. Continuous Streaming Loop (every 350ms)
      frameIntervalRef.current = setInterval(async () => {
        if (!mounted || isCleaningUpRef.current) return;

        const frameB64 = captureFrameBase64();
        if (!frameB64) return;

        const audioSamples = latestAudioSamplesRef.current;
        latestAudioSamplesRef.current = []; // drain buffer

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isWsAuthenticatedRef.current) {
          wsRef.current.send(
            JSON.stringify({
              frame: frameB64,
              audio: audioSamples,
              sampleRate: audioSampleRateRef.current,
              warningCount: warningCountRef.current,
            })
          );
        } else if (sessionIdRef.current && !inFlightRestRef.current) {
          inFlightRestRef.current = true;
          try {
            const res = await analyzeFrameREST({
              sessionId: sessionIdRef.current,
              ticket: wsTicketRef.current || undefined,
              authToken: authTokenRef.current,
              studentId: studentIdRef.current,
              attemptId: attemptIdRef.current,
              frame: frameB64,
              audio: audioSamples,
              sampleRate: audioSampleRateRef.current,
              warningCount: warningCountRef.current,
            });
            if (mounted && !isCleaningUpRef.current) {
              handleTelemetryUpdate(res);
            }
          } catch (restErr) {
            console.warn("REST frame analysis frame dropped:", restErr);
          } finally {
            inFlightRestRef.current = false;
          }
        }
      }, 350);
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
    retryCount,
    attemptId,
    testCode,
    referenceImage,
    authToken,
    springBootUrl,
    cleanup,
    captureFrameBase64,
    handleTelemetryUpdate,
  ]);

  const showWarningModal = useCallback(
    (reason: string, count: number, autoSubmitted: boolean = false) => {
      setWarningCount(count);
      const strikeCount = Math.max(warningCountRef.current, count);
      const isAuto = autoSubmitted || strikeCount >= 3;
      setActiveWarningModal({
        isOpen: true,
        reason,
        count: strikeCount,
        autoSubmitted: isAuto,
      });
      if (isAuto && onAutoSubmitRef.current) {
        onAutoSubmitRef.current();
      }
    },
    [setWarningCount]
  );

  const dismissWarningModal = useCallback(() => {
    setActiveWarningModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    videoRef,
    cameraActive,
    cameraError,
    isOnline,
    telemetryReceived,
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
    setWarningCount,
    retryInitialization,
    activeWarningModal,
    showWarningModal,
    dismissWarningModal,
    cleanup,
  };
}
