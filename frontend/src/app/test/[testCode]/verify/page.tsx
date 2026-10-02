"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  UserCheck,
  KeyRound,
  AlertCircle,
  Loader2,
  Download,
  Camera,
  Mic,
  Monitor,
  Wifi,
  CheckCircle2,
  RefreshCw,
  Eye,
  Maximize2,
} from "lucide-react";
import { ENDPOINTS } from "@/lib/api/endpoints";

type AvailabilityStatus =
  | "NOT_FOUND"
  | "NOT_PUBLISHED"
  | "NOT_STARTED"
  | "LIVE"
  | "ENDED";

type AvailabilityResponse = {
  quizCode?: string;
  available?: boolean;
  status?: AvailabilityStatus | string;
  startTime?: string | null;
  endTime?: string | null;
};

function getClientAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("dynoquizz_token");
  if (!token || token === "undefined" || token === "null") return null;
  return token.trim();
}

export default function IdentityVerificationPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  const [registrationNo, setRegistrationNo] = useState("");
  const [sessionCode, setSessionCode] = useState(testCode || "");
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hardware & Proctor Verification States
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [displayCount, setDisplayCount] = useState(1);
  const [checkingExtension, setCheckingExtension] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initial Session Availability Check
  useEffect(() => {
    setMounted(true);
    const cleanCode = String(testCode || "").trim().toUpperCase();

    if (!cleanCode) {
      setError("Assessment access code is missing.");
      setLoadingSession(false);
      return;
    }

    const token = getClientAuthToken();
    if (!token) {
      router.push(`/login?role=student&redirect=/test/${encodeURIComponent(cleanCode)}/verify`);
      return;
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem("dynoquizz_user") || "{}");
      const storedRegistration =
        storedUser?.registrationNo ||
        localStorage.getItem("dynoquizz_regNo") ||
        sessionStorage.getItem("dynoquizz_student_reg") ||
        "";

      if (storedRegistration) {
        setRegistrationNo(String(storedRegistration).toUpperCase());
      }
    } catch {
      // ignore
    }

    let cancelled = false;

    const checkAvailability = async () => {
      try {
        setLoadingSession(true);
        setError(null);

        const availabilityRes = await fetch(ENDPOINTS.student.availability(cleanCode), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        const data: AvailabilityResponse = await availabilityRes.json().catch(() => ({}));

        if (!availabilityRes.ok) {
          throw new Error(`Unable to verify assessment (${availabilityRes.status}).`);
        }

        if (cancelled) return;

        if (data.status !== "LIVE" || data.available !== true) {
          switch (data.status as AvailabilityStatus | undefined) {
            case "NOT_STARTED":
              setError("This assessment has not started yet.");
              break;
            case "ENDED":
              setError("This assessment has already ended.");
              break;
            case "NOT_PUBLISHED":
              setError("This assessment is not open yet. Ask your teacher to publish it.");
              break;
            case "NOT_FOUND":
              setError(`Assessment session code "${cleanCode}" was not found.`);
              break;
            default:
              setError("This assessment is not currently available.");
          }
          return;
        }

        setSessionCode(cleanCode);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Could not verify the assessment. Please check your connection and try again.");
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    };

    void checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [router, testCode]);

  // 2. Camera & Microphone Initialization for Face Pre-Flight Check
  useEffect(() => {
    let isMounted = true;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: "user" },
          audio: true,
        });

        if (!isMounted) return;

        streamRef.current = stream;
        setCameraActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Setup Audio Analyser meter
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const interval = setInterval(() => {
              if (!isMounted) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
              if (avg > 5) setMicActive(true);
            }, 200);
          }
        } catch (e) {
          console.warn("Audio meter setup error:", e);
        }
      } catch (err) {
        console.warn("Camera/Mic access denied:", err);
      }
    };

    initMedia();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // 3. Extension Handshake Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).__DYNOQUIZZ_EXTENSION_ACTIVE__) {
      setExtensionDetected(true);
    }

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (
        event.data.type === "DYNOQUIZZ_EXTENSION_PONG" ||
        event.data.type === "DYNOQUIZZ_INIT_ACK"
      ) {
        setExtensionDetected(true);
        if (event.data.displays && Array.isArray(event.data.displays)) {
          setDisplayCount(event.data.displays.length);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    window.postMessage({ type: "DYNOQUIZZ_PING_EXTENSION" }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const pingExtensionCheck = () => {
    setCheckingExtension(true);
    if (typeof window !== "undefined") {
      window.postMessage({ type: "DYNOQUIZZ_PING_EXTENSION" }, "*");
    }
    setTimeout(() => {
      setCheckingExtension(false);
    }, 1200);
  };

  // Capture Photo Handler
  const captureReferencePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedPhoto(dataUrl);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("dynoquizz_candidate_photo", dataUrl);
      }
    }
  };

  const handleVerifyAndProceed = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanCode = sessionCode.trim().toUpperCase();
    const cleanReg = registrationNo.trim().toUpperCase();

    if (!cleanCode) {
      setError("Please enter the assessment access code.");
      return;
    }

    if (!cleanReg) {
      setError("Please enter your student registration number.");
      return;
    }

    const token = getClientAuthToken();
    if (!token) {
      router.push(`/login?role=student&redirect=/test/${encodeURIComponent(cleanCode)}/verify`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      localStorage.setItem("dynoquizz_regNo", cleanReg);
      sessionStorage.setItem("dynoquizz_student_reg", cleanReg);

      // Transition to assessment lobby
      router.push(`/test/${cleanCode}/lobby?reg=${encodeURIComponent(cleanReg)}`);
    } catch (err: any) {
      console.error("Identity verification error:", err);
      setError(err?.message || "Could not verify your examination credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="flex items-center gap-2.5 text-xs font-bold text-[#78716b] bg-white px-6 py-4 rounded-xl border border-[#d1dee8] shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
          Verifying secure assessment environment...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-3 md:p-6 font-sans selection:bg-[#165dfb]/20">
      <motion.div
        initial={mounted ? { opacity: 0, y: 10 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-2xl rounded-[20px] bg-white p-6 md:p-8 text-left border border-[#d1dee8]/80 shadow-2xl relative overflow-hidden space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#165dfb] text-white shadow-xs">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-[#111111]">
                Pre-Exam System &amp; Identity Verification
              </h1>
              <p className="text-[11px] text-[#78716b] font-medium">
                Verify camera, microphone, extension, and student credentials before starting.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-[#165dfb] bg-[#165dfb]/10 px-3 py-1 rounded-full border border-[#165dfb]/20 font-mono">
            {sessionCode.toUpperCase()}
          </span>
        </div>

        {error && (
          <div className="rounded-[12px] border border-rose-300 bg-rose-50 p-3.5 text-left flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold leading-relaxed text-rose-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleVerifyAndProceed} className="space-y-6">
          {/* Section 1: Camera Live Feed & Face Capture */}
          <div className="rounded-[16px] border border-[#d1dee8] p-4 bg-[#fbfbfb] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111111] flex items-center gap-2">
                <Camera className="h-4 w-4 text-[#165dfb]" />
                Camera &amp; Face Alignment Check
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  capturedPhoto
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : cameraActive
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-amber-100 text-amber-700 border border-amber-300"
                }`}
              >
                {capturedPhoto
                  ? "✓ Reference Photo Captured"
                  : cameraActive
                  ? "Camera Active - Capture Photo"
                  : "Allow Camera Access"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Live Video Box */}
              <div className="relative aspect-[4/3] rounded-[12px] bg-black overflow-hidden border border-[#d1dee8] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover transform -scale-x-100"
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 p-4 text-center">
                    <Camera className="h-8 w-8 mb-2 animate-pulse" />
                    <p className="text-[11px] font-medium">Please grant camera permission in your browser.</p>
                  </div>
                )}
                {/* Face Target Outline Overlay */}
                {cameraActive && !capturedPhoto && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-36 h-44 rounded-full border-2 border-dashed border-emerald-400/80 animate-pulse flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white bg-black/50 px-2 py-0.5 rounded">
                        Align Face Here
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Captured Photo / Instructions */}
              <div className="space-y-3">
                {capturedPhoto ? (
                  <div className="space-y-2 text-center md:text-left">
                    <div className="relative inline-block rounded-[10px] overflow-hidden border-2 border-emerald-500 shadow-md">
                      <img
                        src={capturedPhoto}
                        alt="Captured Reference Face"
                        className="h-28 w-36 object-cover"
                      />
                      <span className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        ✓ Verified
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCapturedPhoto(null)}
                      className="block text-xs font-semibold text-[#165dfb] hover:underline cursor-pointer"
                    >
                      Retake Photo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-[#78716b] font-medium leading-relaxed">
                      Position yourself in front of the camera with good lighting. Look directly into the lens and click below to save your reference photo.
                    </p>
                    <button
                      type="button"
                      onClick={captureReferencePhoto}
                      disabled={!cameraActive}
                      className="w-full py-2.5 px-4 rounded-[10px] bg-[#165dfb] hover:bg-[#165dfb]/90 text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 border-0"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Capture Reference Face</span>
                    </button>
                  </div>
                )}

                {/* Microphone Level Meter */}
                <div className="pt-2 border-t border-[#d1dee8]/60">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#111111] mb-1">
                    <span className="flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-[#165dfb]" />
                      Microphone Audio Level:
                    </span>
                    <span className={micActive ? "text-emerald-600" : "text-[#78716b]"}>
                      {micActive ? "Active" : "Testing..."}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-100"
                      style={{ width: `${Math.max(5, micVolume)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Extension & System Compatibility Check */}
          <div className="rounded-[16px] border border-[#d1dee8] p-4 bg-[#fbfbfb] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111111] flex items-center gap-2">
                <Monitor className="h-4 w-4 text-[#165dfb]" />
                System &amp; Extension Sentinel
              </span>
              <button
                type="button"
                onClick={pingExtensionCheck}
                className="text-[10px] font-bold text-[#165dfb] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${checkingExtension ? "animate-spin" : ""}`} />
                Re-check System
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Extension Status Card */}
              <div
                className={`p-3 rounded-[10px] border flex items-center justify-between ${
                  extensionDetected
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className={`h-4 w-4 ${extensionDetected ? "text-emerald-600" : "text-amber-600"}`}
                  />
                  <div>
                    <p className="font-bold text-[11px]">Proctor Shield Extension</p>
                    <p className="text-[10px] opacity-80">
                      {extensionDetected ? "Installed & Active" : "Not detected (Optional/Recommended)"}
                    </p>
                  </div>
                </div>
                {!extensionDetected && (
                  <a
                    href="/dynoquizz-proctor-shield.zip"
                    download="dynoquizz-proctor-shield.zip"
                    className="text-[10px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-1 rounded border border-amber-300 no-underline shrink-0"
                  >
                    Get .zip
                  </a>
                )}
              </div>

              {/* Display Count Status Card */}
              <div
                className={`p-3 rounded-[10px] border flex items-center justify-between ${
                  displayCount === 1
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Monitor
                    className={`h-4 w-4 ${displayCount === 1 ? "text-emerald-600" : "text-rose-600"}`}
                  />
                  <div>
                    <p className="font-bold text-[11px]">Active Monitors</p>
                    <p className="text-[10px] opacity-80">
                      {displayCount === 1 ? "1 Display (Secure)" : `${displayCount} Displays (Disconnect extra)`}
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-[11px]">
                  {displayCount === 1 ? "✓ OK" : "⚠️ ALERT"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Student Roll Number & Credentials */}
          <div className="space-y-3">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                Student Registration / Roll Number
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <UserCheck className="h-4 w-4 text-[#165dfb]" />
                </div>

                <input
                  type="text"
                  value={registrationNo}
                  onChange={(event) => {
                    setRegistrationNo(event.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. 23BCE8830"
                  maxLength={30}
                  className="w-full rounded-[10px] border border-[#d1dee8]/90 bg-[#f5f5f4] py-3 pl-9 pr-3 text-xs font-bold text-[#111111] outline-none uppercase placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/15 shadow-xs"
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit / Proceed Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-[12px] bg-[#165dfb] hover:bg-[#165dfb]/90 text-white font-bold text-xs shadow-md shadow-[#165dfb]/25 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Initializing Assessment Environment...</span>
              </>
            ) : (
              <>
                <span>Proceed to Assessment Arena</span>
                <ArrowRight className="h-4 w-4 text-white" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
