"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  UserCheck,
  KeyRound,
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Sparkles,
  Lock,
} from "lucide-react";

function getClientAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("dynoquizz_token");
  if (!token) {
    const match = document.cookie.match(/(?:^|;\s*)dynoquizz_token=([^;]+)/);
    if (match) {
      token = match[1];
      try {
        localStorage.setItem("dynoquizz_token", token);
      } catch {
        // ignore
      }
    }
  }
  if (token) return token;
  return null;
}

export default function IdentityVerificationPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [registrationNo, setRegistrationNo] = useState("");
  const [sessionCode, setSessionCode] = useState(testCode || "");
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera & ID capture states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const token = getClientAuthToken();
      if (!token) {
        router.push(`/login?role=student&redirect=/test/${testCode}/verify`);
        return;
      }
      const stored = localStorage.getItem("dynoquizz_regNo");
      if (stored) setRegistrationNo(stored);
    }
  }, [router, testCode]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Initialize camera when advancing to Step 2
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(
        "Camera access was denied or not found. Please allow camera permissions in your browser to proceed with AI proctoring verification."
      );
      setCameraActive(false);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNo.trim()) {
      setError("Please enter your student registration / roll number.");
      return;
    }
    setError(null);
    setStep(2);
    startCamera();
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoData = canvas.toDataURL("image/jpeg", 0.88);
      setCapturedPhoto(photoData);
    }
    setIsCapturing(false);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleConfirmAndProceed = () => {
    if (!capturedPhoto) {
      setCameraError("Please capture your photo holding your student ID before proceeding.");
      return;
    }

    setIsConfirming(true);
    try {
      const cleanCode = (sessionCode || testCode).toUpperCase();
      const cleanReg = registrationNo.trim().toUpperCase();

      localStorage.setItem("dynoquizz_regNo", cleanReg);
      sessionStorage.setItem("dynoquizz_student_reg", cleanReg);
      sessionStorage.setItem(`dynoquizz_id_photo_${cleanCode}`, capturedPhoto);

      // Stop camera before route change
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      router.push(`/test/${cleanCode}`);
    } catch (err) {
      console.error("Navigation error:", err);
      router.push(`/test/${testCode}`);
    }
  };

  const primaryBtn =
    "flex w-full items-center justify-center gap-2 rounded-[12px] bg-signal-green hover:bg-signal-green/90 py-3.5 text-xs font-bold text-white shadow-md shadow-signal-green/20 hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer border-0";

  const secondaryBtn =
    "flex items-center justify-center gap-1.5 rounded-[10px] bg-frost-surface hover:bg-mist-blue/40 py-2.5 px-4 text-xs font-semibold text-midnight-navy border border-mist-blue/60 transition-all duration-200 active:scale-[0.98] cursor-pointer";

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-signal-green/20">
      {/* Hidden offscreen canvas for snapshot rendering */}
      <canvas ref={canvasRef} className="hidden" />

      <motion.div
        initial={mounted ? { opacity: 0, y: 10 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg rounded-[20px] bg-paper-white p-6 md:p-8 text-left border border-mist-blue/80 shadow-2xl relative overflow-hidden"
      >
        {/* Header Bar */}
        <div className="mb-6 flex items-center justify-between border-b border-mist-blue/40 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-signal-green text-white shadow-sm shadow-signal-green/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-tight text-midnight-navy">
                Candidate Verification & Proctor Setup
              </h1>
              <p className="text-[11px] text-steel-blue-gray font-medium">
                Step {step} of 2: {step === 1 ? "Credentials" : "Live Photo & ID Scan"}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-steel-blue-gray bg-frost-surface px-3 py-1 rounded-full border border-mist-blue/60 font-mono shadow-xs">
            {testCode.toUpperCase()}
          </span>
        </div>

        {/* Step 1: Credentials Form */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="mb-2">
              <h2 className="text-sm font-bold text-midnight-navy">
                Enter Examination Credentials
              </h2>
              <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
                Please confirm your student roll number and exam access code to initialize
                the AI identity verification.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
                Session Access Code
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-steel-blue-gray">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  className="w-full rounded-[10px] border border-mist-blue/90 bg-frost-surface py-3 pl-10 pr-3 text-xs font-bold text-midnight-navy outline-none font-mono tracking-widest uppercase focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15 shadow-xs transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
                Student Registration / Roll Number
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-steel-blue-gray">
                  <UserCheck className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => {
                    setRegistrationNo(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. 21BCE1024"
                  className="w-full rounded-[10px] border border-mist-blue/90 bg-frost-surface py-3 pl-10 pr-3 text-xs font-bold text-midnight-navy outline-none uppercase placeholder:text-steel-blue-gray/50 focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15 shadow-xs transition-all"
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button type="submit" className={primaryBtn}>
                <span>Proceed to ID Verification Scan</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Camera & ID Snapshot Verification */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold text-midnight-navy flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-signal-green" />
                Hold Student ID Card & Face Snapshot
              </h2>
              <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
                Hold your physical student ID card clearly next to your face inside the
                guideline box. This photo will be verified by the instructor.
              </p>
            </div>

            {/* Video Preview or Captured Photo */}
            <div className="relative aspect-[4/3] w-full rounded-[14px] bg-midnight-navy/95 overflow-hidden border-2 border-mist-blue/70 shadow-inner flex items-center justify-center">
              {!capturedPhoto ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />

                  {/* ID & Face Target Guideline Box */}
                  <div className="pointer-events-none absolute inset-4 rounded-[12px] border-2 border-dashed border-white/60 flex flex-col items-center justify-between p-3">
                    <div className="flex items-center justify-between w-full text-[10px] font-mono text-white/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                      <span>LIVE PROCTOR FEED</span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-signal-green animate-pulse" />
                        CAM ONLINE
                      </span>
                    </div>

                    <div className="text-center bg-midnight-navy/70 backdrop-blur-xs px-3 py-1.5 rounded-[8px] border border-white/20">
                      <p className="text-[11px] font-bold text-white flex items-center gap-1.5 justify-center">
                        <Camera className="h-3.5 w-3.5 text-signal-green" />
                        Align Face & ID Card Here
                      </p>
                    </div>

                    <div className="text-[10px] text-white/70 font-mono bg-black/40 px-2 py-0.5 rounded">
                      REG: {registrationNo.toUpperCase()}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedPhoto}
                    alt="Captured candidate ID snapshot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-signal-green text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Snapshot Ready
                  </div>
                </>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="rounded-[10px] bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-1.5 text-[11px] font-bold underline hover:text-rose-900 cursor-pointer"
                  >
                    Retry Camera Permission
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 space-y-2.5">
              {!capturedPhoto ? (
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={!cameraActive || isCapturing}
                  className={primaryBtn}
                >
                  <Camera className="h-4 w-4" />
                  <span>{isCapturing ? "Capturing..." : "Capture ID Snapshot"}</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    disabled={isConfirming}
                    className={secondaryBtn}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndProceed}
                    disabled={isConfirming}
                    className={`${primaryBtn} flex-1`}
                  >
                    <Lock className="h-4 w-4" />
                    <span>
                      {isConfirming ? "Entering Exam Arena..." : "Confirm & Enter Assessment"}
                    </span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCapturedPhoto(null);
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                  }
                }}
                disabled={isConfirming}
                className="w-full text-center text-[11px] text-steel-blue-gray font-semibold hover:text-midnight-navy py-1 transition-colors cursor-pointer"
              >
                ← Back to Edit Registration Number
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </main>
  );
}
