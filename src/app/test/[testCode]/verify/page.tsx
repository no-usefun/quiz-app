"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanFace,
  Download,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Camera,
  ArrowRight,
  Loader2,
  Puzzle,
} from "lucide-react";

export default function VerificationGateway({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  // 1: Extension Check, 2: Download Package, 3: Live ID Capture, 4: Live Face Scan, 5: Ready Room
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);

  const handleInstallExtension = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setExtensionDetected(true);
    }, 1200);
  };

  const triggerCameraCapture = (nextStep: number) => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 250);

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(nextStep);
    }, 1200);
  };

  const primaryBtn = "flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-bold text-white active:scale-95 transition-all shadow-xs disabled:opacity-40";
  const successBtn = "flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white active:scale-95 transition-all shadow-xs";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-850 p-4 font-sans selection:bg-blue-105 selection:text-blue-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 text-center border border-slate-200 shadow-xs relative overflow-hidden"
      >
        {/* Shutter Flash Animation */}
        {isFlashing && (
          <div className="absolute inset-0 z-50 bg-white opacity-90 transition-opacity duration-200 pointer-events-none" />
        )}

        {/* Step Indicator Header */}
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold tracking-tight text-slate-900">
              Identity Verification ({testCode})
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
            Step {step} of 5
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* Wizard Step 1: System & Environment Check (Extension Verification) */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-700 shadow-xs">
                <Puzzle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Step 1: System &amp; Environment Check</h2>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed font-medium">
                  DynoQuizz requires the Secure Proctoring Extension to lock your browser environment and enforce exam integrity.
                </p>
              </div>

              {!extensionDetected ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    Proctoring Extension: Not Detected
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium">
                    Please install or enable the DynoQuizz extension to authorize your browser session.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-250/60 bg-emerald-50 p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-605 shrink-0" />
                    Secure Environment Verified
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    DynoQuizz Extension Active · Browser Locked · Clipboard &amp; Multi-Display Monitoring Ready
                  </p>
                </div>
              )}

              {!extensionDetected ? (
                <button
                  onClick={handleInstallExtension}
                  disabled={isProcessing}
                  className={primaryBtn}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying Manifest…</>
                  ) : (
                    <><Puzzle className="h-3.5 w-3.5" /> Install Extension</>
                  )}
                </button>
              ) : (
                <button onClick={() => setStep(2)} className={successBtn}>
                  Extension Verified — Continue <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          )}

          {/* Wizard Step 2: Package Download */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-700 shadow-xs">
                <Download className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Step 2: Download Exam Package</h2>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed font-medium">
                  Caching test questions and encrypted assets locally for offline stability during the assessment.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-medium text-slate-700 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>Downloading assets…</span>
                  <span className="font-bold text-slate-900">100% Cached</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-blue-600 w-full" />
                </div>
              </div>
              <button
                onClick={() => {
                  setIsProcessing(true);
                  setTimeout(() => {
                    setIsProcessing(false);
                    setStep(3);
                  }, 800);
                }}
                disabled={isProcessing}
                className={primaryBtn}
              >
                {isProcessing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying Package…</>
                ) : (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Package Ready — Next: ID Check</>
                )}
              </button>
            </motion.div>
          )}

          {/* Wizard Step 3: Live ID Verification */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-700 shadow-xs">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Step 3: Student ID Card Verification</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-medium">
                  Please hold your Student ID Card up to the camera.
                </p>
              </div>

              {/* Sleek Mock Live Webcam Box */}
              <div className="relative mx-auto h-40 w-full rounded-xl bg-slate-900 flex flex-col items-center justify-center overflow-hidden shadow-xs border border-slate-700">
                {/* Pulsing Live Camera Indicator */}
                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  LIVE
                </div>

                {/* ID Card Target Alignment Guide */}
                <div className="w-40 h-24 border border-dashed border-slate-650 rounded-xl flex flex-col items-center justify-center bg-slate-800/30 space-y-1">
                  <CreditCard className="h-5 w-5 text-slate-500 opacity-80" />
                  <span className="text-[8px] text-slate-400 font-bold tracking-wide uppercase bg-black/60 px-2.5 py-0.5 rounded-full">
                    Align ID Card Within Frame
                  </span>
                </div>
              </div>

              <button
                onClick={() => triggerCameraCapture(4)}
                disabled={isProcessing}
                className={primaryBtn}
              >
                {isProcessing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Capturing ID…</>
                ) : (
                  <><Camera className="h-3.5 w-3.5" /> Capture ID <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
            </motion.div>
          )}

          {/* Wizard Step 4: Live Face Verification */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-700 shadow-xs">
                <ScanFace className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Step 4: Live Face Match Verification</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-medium">
                  Now look directly at the camera to match your face.
                </p>
              </div>

              {/* Sleek Mock Live Webcam Box */}
              <div className="relative mx-auto h-40 w-full rounded-xl bg-slate-900 flex flex-col items-center justify-center overflow-hidden shadow-xs border border-slate-700">
                {/* Pulsing Live Camera Indicator */}
                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  LIVE
                </div>

                {/* Face Alignment Frame Guide */}
                <div className="w-28 h-32 border border-dashed border-emerald-500/40 rounded-[35%] flex flex-col items-center justify-center bg-emerald-950/20 space-y-1">
                  <ScanFace className="h-7 w-7 text-emerald-450 opacity-80" />
                  <span className="text-[8px] text-emerald-300 font-bold tracking-wide uppercase bg-black/80 px-2 py-0.5 rounded-full">
                    Center Face Here
                  </span>
                </div>
              </div>

              <button
                onClick={() => triggerCameraCapture(5)}
                disabled={isProcessing}
                className={primaryBtn}
              >
                {isProcessing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching Face Pattern…</>
                ) : (
                  <><Camera className="h-3.5 w-3.5" /> Capture Face <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
            </motion.div>
          )}

          {/* Wizard Step 5: Ready Room */}
          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 shadow-xs">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Step 5: Verification Complete!</h2>
                <p className="mt-0.5 text-xs text-slate-505 leading-relaxed font-medium">
                  Environment locked, test package cached &amp; student identity confirmed live. You are authorized to enter the assessment arena.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-semibold text-emerald-800 text-left space-y-1.5">
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Browser Proctoring Extension Active &amp; Environment Locked
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Exam Package Downloaded (Offline Ready)
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Live Student ID Card Captured &amp; Verified
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  Live Face Detection Calibrated (98% Match Confidence)
                </p>
              </div>

              <button
                onClick={() => router.push(`/test/${testCode}`)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white active:scale-95 transition-all shadow-xs"
              >
                Enter Test Arena <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
