"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/api/client";
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
  testCode: string;
  referenceImage: string | null;
  authToken?: string;
  onAutoSubmit?: () => void;
  enabled?: boolean;
}


const AI_EVENT_TYPE_MAP: Record<string, string> = {
  FACE_NOT_DETECTED: "FACE_NOT_DETECTED",
  FACE_MISSING: "FACE_NOT_DETECTED",
  NO_FACE: "FACE_NOT_DETECTED",
  MULTIPLE_FACES: "MULTIPLE_FACES",
  MULTIPLE_FACE: "MULTIPLE_FACES",
  MULTIPLE_FACES_DETECTED: "MULTIPLE_FACES",
  MULTIPLE_PERSONS: "MULTIPLE_PERSONS",
  MULTIPLE_PERSON: "MULTIPLE_PERSONS",
  MULTIPLE_PEOPLE: "MULTIPLE_PERSONS",
  LOOKING_AWAY: "LOOKING_AWAY",
  GAZE_AWAY: "LOOKING_AWAY",
  PHONE_DETECTED: "PHONE_DETECTED",
  PHONE: "PHONE_DETECTED",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
  FACE_MISMATCH: "IDENTITY_MISMATCH",
  IDENTITY_NOT_VERIFIED: "IDENTITY_MISMATCH",
  VOICE_ACTIVITY: "VOICE_ACTIVITY",
  VOICE_DETECTED: "VOICE_ACTIVITY",
  LOUD_VOICE: "LOUD_VOICE",
};

function normalizeAIEventType(value: string): string | null {
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return AI_EVENT_TYPE_MAP[key] ?? null;
}

export function useAIProctoring({
  attemptId,
  testCode,
  referenceImage,
  authToken,
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
  const autoSubmitHandledAttemptRef = useRef<number | null>(null);
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

  const attemptIdRef = useRef(attemptId);
  useEffect(() => {
    const previousAttemptId = Number(attemptIdRef.current);
    attemptIdRef.current = attemptId;
    if (previousAttemptId !== Number(attemptId)) {
      autoSubmitHandledAttemptRef.current = null;
      autoSubmitModalAttemptRef.current = null;
      serverAutoSubmittedRef.current = false;
      setServerAutoSubmitted(false);
      setIdentityHoldSnapshot(enabled, enabled ? "INITIALIZING" : null);
      setReferenceRegistered(false);
    }
  }, [attemptId, enabled, setIdentityHoldSnapshot]);

  const testCodeRef = useRef(testCode);
  useEffect(() => {
    testCodeRef.current = testCode;
  }, [testCode]);

  // Telemetry & Hardware State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const displayedCameraError =
    enabled && !referenceImage
      ? "Reference biometric photo is missing. Please return to the lobby to register your photo."
      : cameraError;
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [telemetryReceived, setTelemetryReceived] = useState(false);
  // Fail closed: keep the assessment locked until telemetry explicitly releases
  // the identity hold. A missing/legacy field is not interpreted as "verified".
  const [identityHold, setIdentityHold] = useState(enabled);
  const [identityHoldReason, setIdentityHoldReason] = useState<string | null>(
    enabled ? "INITIALIZING" : null,
  );
  const identityHoldRef = useRef(enabled);
  const [referenceRegistered, setReferenceRegistered] = useState(false);
  const [serverAutoSubmitted, setServerAutoSubmitted] = useState(false);
  const serverAutoSubmittedRef = useRef(false);
  const autoSubmitModalAttemptRef = useRef<number | null>(null);

  const setIdentityHoldSnapshot = useCallback((held: boolean, reason?: string | null) => {
    identityHoldRef.current = held;
    setIdentityHold(held);
    setIdentityHoldReason(held ? (reason?.trim() || "IDENTITY_VERIFICATION_PENDING") : null);
  }, []);

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
          // The Python service's /proctor/stop handler persists the final
          // summary to Spring Boot before it closes and scrubs the session.
          // Avoid posting the same summary a second time from the browser.
          await Promise.race([
            stopProctoringSession({
              sessionId: sid,
              ticket: ticket || undefined,
              authToken: authTokenRef.current,
              attemptId: Number(attemptIdRef.current),
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
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

  const reportedAiEventsRef = useRef<Map<string, number>>(new Map());

  const markServerAutoSubmitted = useCallback((reason?: string | null) => {
    const currentAttemptId = Number(attemptIdRef.current);
    const isFirstForAttempt =
      autoSubmitHandledAttemptRef.current !== currentAttemptId;

    autoSubmitHandledAttemptRef.current = currentAttemptId;
    serverAutoSubmittedRef.current = true;
    setServerAutoSubmitted(true);
    setIdentityHoldSnapshot(true, reason || "AUTO_SUBMITTED");

    if (isFirstForAttempt) {
      onAutoSubmitRef.current?.();
    }
  }, [setIdentityHoldSnapshot]);

  const handleTelemetryUpdate = useCallback((telemetry: TelemetryResponse) => {
    setTelemetryReceived(true);
    setFaceDetected(Boolean(telemetry.faceDetected));
    setNumFaces(Number.isFinite(Number(telemetry.numFaces)) ? Number(telemetry.numFaces) : 0);
    if (telemetry.numPersons !== undefined) {
      setNumPersons(Number.isFinite(Number(telemetry.numPersons)) ? Number(telemetry.numPersons) : 0);
    }
    setIdentityVerified(Boolean(telemetry.identityVerified));
    setSimilarityScore(Number.isFinite(Number(telemetry.similarityScore)) ? Number(telemetry.similarityScore) : 0);
    if (telemetry.gazeDirection) {
      setGazeDirection(telemetry.gazeDirection);
    }
    if (telemetry.yaw !== undefined) setYaw(Number(telemetry.yaw) || 0);
    if (telemetry.pitch !== undefined) setPitch(Number(telemetry.pitch) || 0);
    if (telemetry.isLookingAway !== undefined) setIsLookingAway(Boolean(telemetry.isLookingAway));
    setPhoneDetected(Boolean(telemetry.phoneDetected));
    setMicLevel(Number.isFinite(Number(telemetry.micLevel)) ? Number(telemetry.micLevel) : 0);
    setVoiceActive(Boolean(telemetry.voiceActive));
    setLoudVoice(Boolean(telemetry.loudVoice));

    // Never unlock on a missing/invalid hold field. The V2 service must explicitly
    // return identityHold=false before a held assessment can resume.
    if (!serverAutoSubmittedRef.current) {
      if (typeof telemetry.identityHold === "boolean") {
        setIdentityHoldSnapshot(
          telemetry.identityHold,
          telemetry.identityHold
            ? telemetry.identityHoldReason || "IDENTITY_VERIFICATION_PENDING"
            : null,
        );
      } else {
        setIdentityHoldSnapshot(true, "IDENTITY_HOLD_STATUS_UNAVAILABLE");
      }
    }

    // Counts and auto-submission are backend-authoritative; the browser never
    // creates its own warning count or infers submission from a threshold.
    if (typeof telemetry.warningCount === "number" && Number.isFinite(telemetry.warningCount)) {
      setWarningCount(telemetry.warningCount);
    }

    const currentAttemptId = Number(attemptIdRef.current);
    const isAutoSubmitted = telemetry.autoSubmitted === true;
    const rawEvent = typeof telemetry.malpracticeEvent === "string"
      ? telemetry.malpracticeEvent.trim()
      : "";
    const eventMessage = typeof telemetry.eventMessage === "string"
      ? telemetry.eventMessage.trim()
      : "";
    const eventKey = rawEvent
      ? (normalizeAIEventType(rawEvent) || rawEvent.toUpperCase().replace(/[\\s-]+/g, "_"))
      : "";
    const authoritativeCount = Math.max(
      warningCountRef.current,
      typeof telemetry.warningCount === "number" && Number.isFinite(telemetry.warningCount)
        ? telemetry.warningCount
        : 0,
    );
    const eventReason = [rawEvent, eventMessage].filter(Boolean).join(": ").slice(0, 1000);

    // Process this flag even when malpracticeEvent is null. The backend's
    // explicit autoSubmitted response is final and must not trigger a duplicate
    // browser submission request.
    if (isAutoSubmitted) {
      markServerAutoSubmitted(eventReason || "The backend automatically submitted this assessment.");
      if (autoSubmitModalAttemptRef.current !== currentAttemptId) {
        autoSubmitModalAttemptRef.current = currentAttemptId;
        setActiveWarningModal({
          isOpen: true,
          reason: eventReason || "The backend automatically submitted this assessment.",
          count: authoritativeCount,
          autoSubmitted: true,
        });
      }
      return;
    }

    if (!rawEvent) return;

    if (!eventKey) {
      console.warn("[Proctoring] Empty AI malpractice event was ignored.");
      return;
    }

    const now = Date.now();
    const lastReportedAt = reportedAiEventsRef.current.get(eventKey) ?? 0;
    const eventCooldownMs = 10000;
    if (now - lastReportedAt < eventCooldownMs) return;
    reportedAiEventsRef.current.set(eventKey, now);

    setActiveWarningModal({
      isOpen: true,
      reason: eventReason || rawEvent,
      count: authoritativeCount,
      autoSubmitted: false,
    });
  }, [markServerAutoSubmitted, setIdentityHoldSnapshot, setWarningCount]);

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

  // Fail visibly if the camera is active but the AI service never returns
  // its first telemetry packet. This enables the existing Retry action instead
  // of leaving the student behind an indefinite verification screen.
  useEffect(() => {
    if (!enabled || !cameraActive || telemetryReceived || cameraError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCameraError(
        "The AI service did not return verification data in time. Check your connection and retry.",
      );
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, cameraActive, telemetryReceived, cameraError, retryCount]);

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
      return;
    }

    const initProctoring = async () => {
      setCameraError(null);
      setIsOnline(false);
      setReferenceRegistered(false);
      setServerAutoSubmitted(false);
      serverAutoSubmittedRef.current = false;
      setIdentityHoldSnapshot(enabled, enabled ? "INITIALIZING" : null);
      // A retry starts a new session; never let telemetry from the previous
      // session satisfy the readiness gate before fresh telemetry arrives.
      setTelemetryReceived(false);
      setFaceDetected(false);
      setNumFaces(0);
      setNumPersons(0);
      setIdentityVerified(false);
      setSimilarityScore(0);
      setIsLookingAway(false);
      setPhoneDetected(false);
      setMicLevel(0);
      setVoiceActive(false);
      setLoudVoice(false);

      // 1. Health check AI microservice
      const health = await checkAIHealth();
      if (!mounted) return;
      setIsOnline(health.isOnline);

      if (!health.isOnline) {
        setCameraError("The AI Proctoring service is unavailable. Verify the configured service URL and that the service is healthy.");
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
      } catch (mediaErr: unknown) {
        if (!mounted) return;
        const errorName =
          mediaErr instanceof Error ? mediaErr.name : "";
        let msg = "Could not access camera or microphone.";
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          msg = "Camera/microphone permission was denied. Please allow camera and mic permissions in browser settings.";
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          msg = "No camera or microphone hardware device was found.";
        } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
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

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack?.addEventListener(
        "ended",
        () => {
          if (isCleaningUpRef.current || !mounted) return;
          setCameraActive(false);
          setIdentityHoldSnapshot(true, "CAMERA_UNAVAILABLE");
          setCameraError(
            "Camera access was interrupted during the assessment. Restore camera permission, then return to the lobby and restart with a fresh reference photo.",
          );
        },
        { once: true },
      );

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

      // 4. Start AI session with reference biometric photo. Reuse the single
      // application token helper; never start proctoring without authentication.
      const sessionToken = authTokenRef.current || getAuthToken();
      if (!sessionToken) {
        setCameraError("Your login session is missing or expired. Please sign in again before starting this assessment.");
        await cleanup();
        if (mounted) {
          window.location.assign(`/login?role=student&redirect=${encodeURIComponent(`/test/${testCodeRef.current}/lobby`)}`);
        }
        return;
      }

      let sessionRes: StartSessionResult;
      try {
        sessionRes = await startProctoringSession({
          attemptId,
          testCode: testCodeRef.current,
          referenceImage,
          authToken: sessionToken,
        });
      } catch (sessionErr: unknown) {
        if (!mounted) return;
        setCameraError(
          sessionErr instanceof Error && sessionErr.message
            ? sessionErr.message
            : "Failed to initialize proctoring session.",
        );
        console.error("Proctoring session initialization failed:", sessionErr);
        await cleanup();
        return;
      }

      if (!mounted || isCleaningUpRef.current) {
        // React Strict Mode can clean up an effect while session creation is
        // still in flight. Stop that orphaned remote session instead of leaking
        // it or opening a WebSocket for an unmounted assessment.
        await stopProctoringSession({
          sessionId: sessionRes.sessionId,
          ticket: sessionRes.wsTicket,
          authToken: authTokenRef.current,
          attemptId: attemptIdRef.current,
        });
        return;
      }

      // startProctoringSession rejects unless the backend explicitly confirms
      // referenceRegistered=true and biometricReady=true. Only then may the
      // registered baseline be treated as successful by the UI.
      if (sessionRes.referenceRegistered !== true || sessionRes.biometricReady !== true) {
        setCameraError(
          sessionRes.message ||
            "The backend did not confirm reference registration. Return to the lobby and capture a new photo.",
        );
        await cleanup();
        return;
      }
      setReferenceRegistered(true);
      sessionStorage.removeItem(`dynoquizz_pending_proctor_attempt_${String(testCodeRef.current || "").trim().toUpperCase()}`);
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
              frame: frameB64,
              audio: audioSamples,
              sampleRate: audioSampleRateRef.current,
              warningCount: warningCountRef.current,
            });
            if (mounted && !isCleaningUpRef.current) {
              handleTelemetryUpdate(res);
            }
          } catch (restErr) {
            // Fail closed on telemetry transport/inference errors. The loop
            // continues retrying frames; a later explicit identityHold=false
            // response is required before interaction can resume.
            if (!serverAutoSubmittedRef.current) {
              setIdentityHoldSnapshot(true, "PROCTORING_TELEMETRY_UNAVAILABLE");
            }
            console.warn("REST frame analysis frame dropped; identity hold enabled:", restErr);
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
    cleanup,
    captureFrameBase64,
    handleTelemetryUpdate,
  ]);

  const showWarningModal = useCallback(
    (reason: string, count: number, autoSubmitted: boolean = false) => {
      setWarningCount(count);
      const strikeCount = Math.max(warningCountRef.current, count);
      const isAuto = autoSubmitted;
      setActiveWarningModal({
        isOpen: true,
        reason,
        count: strikeCount,
        autoSubmitted: isAuto,
      });
      if (isAuto) {
        markServerAutoSubmitted(reason);
      }
    },
    [markServerAutoSubmitted, setWarningCount]
  );

  const dismissWarningModal = useCallback(() => {
    setActiveWarningModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    videoRef,
    cameraActive,
    cameraError: displayedCameraError,
    isOnline,
    telemetryReceived,
    identityHold,
    identityHoldReason,
    identityHoldRef,
    referenceRegistered,
    serverAutoSubmitted,
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
