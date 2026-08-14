"use client";

import { use, useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const primaryBtn = "flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green hover:bg-signal-green/90 py-2.5 text-xs font-semibold text-white active:scale-[0.98] transition-all duration-200 shadow-none disabled:opacity-40 cursor-pointer border-0";
  const successBtn = "flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green hover:bg-signal-green/90 py-2.5 text-xs font-semibold text-white active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0";

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl relative overflow-hidden text-left"
      >
        {/* Shutter Flash Animation */}
        {isFlashing && (
          <div className="absolute inset-0 z-50 bg-paper-white opacity-90 transition-opacity duration-200 pointer-events-none" />
        )}

        {/* Step Indicator Header */}
        <div className="mb-5 flex items-center justify-between border-b border-mist-blue/30 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-nav bg-signal-green text-white shadow-none">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-bold tracking-tight text-midnight-navy">
              Identity Verification ({testCode})
            </span>
          </div>
          <span className="text-[10px] font-bold text-steel-blue-gray bg-frost-surface px-2.5 py-0.5 rounded-pills border border-mist-blue/30">
            Step {step} of 5
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* Wizard Step 1: System Check */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue text-signal-green shadow-none">
                <Puzzle className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h2 className="text-sm font-bold text-midnight-navy">Step 1: System &amp; Environment Check</h2>
                <p className="mt-0.5 text-xs text-steel-blue-gray leading-relaxed font-medium">
                  DynoQuizz requires the Secure Proctoring Extension to lock your browser environment and enforce exam integrity.
                </p>
              </div>

              {!extensionDetected ? (
                <div className="rounded-inputs border border-pastel-yellow-text/20 bg-pastel-yellow p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pastel-yellow-text">
                    <ShieldAlert className="h-3.5 w-3.5 text-pastel-yellow-text shrink-0" />
                    Proctoring Extension: Not Detected
                  </div>
                  <p className="text-[10px] text-pastel-yellow-text/95 font-semibold leading-normal">
                    Please install or enable the DynoQuizz extension to authorize your browser session.
                  </p>
                </div>
              ) : (
                <div className="rounded-inputs bg-pastel-mint p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-pastel-mint-text">
                    <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
                    Secure Environment Verified
                  </div>
                  <p className="text-[10px] text-pastel-mint-text/95 font-semibold leading-normal">
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
                    <><Puzzle className="h-3.5 w-3.5 text-white" /> Install Extension</>
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue text-signal-green shadow-none">
                <Download className="h-6 w-6 animate-bounce" />
              </div>
              <div className="text-center">
                <h2 className="text-sm font-bold text-midnight-navy">Step 2: Download Exam Package</h2>
                <p className="mt-0.5 text-xs text-steel-blue-gray leading-relaxed font-medium">
                  Caching test questions and encrypted assets locally for offline stability during the assessment.
                </p>
              </div>
              <div className="rounded-inputs border border-mist-blue bg-paper-white p-3.5 text-xs font-medium text-midnight-navy space-y-1 text-left">
                <div className="flex justify-between text-[10px] text-steel-blue-gray font-semibold">
                  <span>Downloading assets…</span>
                  <span className="font-bold text-midnight-navy">100% Cached</span>
                </div>
                <div className="h-1.5 w-full rounded-pills bg-frost-surface overflow-hidden">
                  <div className="h-full bg-signal-green w-full" />
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
                  <><CheckCircle2 className="h-3.5 w-3.5 text-white" /> Package Ready — Next: ID Check</>
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
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue text-signal-green shadow-none">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="text-center">
                <h2 className="text-sm font-bold text-midnight-navy">Step 3: Student ID Card Verification</h2>
                <p className="mt-0.5 text-xs text-steel-blue-gray font-medium">
                  Please hold your Student ID Card up to the camera.
                </p>
              </div>

              {/* Mock Live Webcam Box */}
              <div className="relative mx-auto h-40 w-full rounded-inputs bg-paper-white flex flex-col items-center justify-center overflow-hidden shadow-none border border-mist-blue">
                {/* Active status badge (Live) */}
                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-pills bg-pastel-mint px-2 py-0.5 text-[9px] font-bold text-pastel-mint-text">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pastel-mint-text" />
                  </span>
                  LIVE
                </div>

                {/* ID Card Target Alignment Guide */}
                <div className="w-40 h-24 border border-dashed border-mist-blue rounded-inputs flex flex-col items-center justify-center bg-frost-surface/20 space-y-1">
                  <CreditCard className="h-5 w-5 text-steel-blue-gray opacity-80" />
                  <span className="text-[8px] text-steel-blue-gray font-bold tracking-wide uppercase bg-frost-surface px-2.5 py-0.5 rounded-pills">
                    Align ID Card
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
                  <><Camera className="h-3.5 w-3.5 text-white" /> Capture ID <ArrowRight className="h-3.5 w-3.5" /></>
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
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue text-signal-green shadow-none">
                <ScanFace className="h-5 w-5" />
              </div>
              <div className="text-center">
                <h2 className="text-sm font-bold text-midnight-navy">Step 4: Live Face Match Verification</h2>
                <p className="mt-0.5 text-xs text-steel-blue-gray font-medium">
                  Now look directly at the camera to match your face.
                </p>
              </div>

              {/* Mock Live Webcam Box */}
              <div className="relative mx-auto h-40 w-full rounded-inputs bg-paper-white flex flex-col items-center justify-center overflow-hidden shadow-none border border-mist-blue">
                {/* Active status badge (Live) */}
                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-pills bg-pastel-mint px-2 py-0.5 text-[9px] font-bold text-pastel-mint-text">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pastel-mint-text" />
                  </span>
                  LIVE
                </div>

                {/* Face Alignment Frame Guide */}
                <div className="w-28 h-32 border border-dashed border-pastel-mint-text/40 rounded-[35%] flex flex-col items-center justify-center bg-pastel-mint space-y-1">
                  <ScanFace className="h-7 w-7 text-pastel-mint-text opacity-80" />
                  <span className="text-[8px] text-pastel-mint-text font-bold tracking-wide uppercase bg-white px-2 py-0.5 rounded-pills">
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
                  <><Camera className="h-3.5 w-3.5 text-white" /> Capture Face <ArrowRight className="h-3.5 w-3.5" /></>
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-inputs bg-pastel-mint text-pastel-mint-text shadow-none">
                <CheckCircle2 className="h-6 w-6 text-pastel-mint-text" />
              </div>
              <div className="text-center">
                <h2 className="text-sm font-bold text-midnight-navy">Step 5: Verification Complete!</h2>
                <p className="mt-0.5 text-xs text-steel-blue-gray leading-relaxed font-medium">
                  Environment locked, test package cached &amp; student identity confirmed live. You are authorized to enter the assessment arena.
                </p>
              </div>

              <div className="rounded-inputs bg-pastel-mint p-3 text-xs font-semibold text-pastel-mint-text text-left space-y-1.5 leading-relaxed">
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
                  Browser Proctoring Extension Active &amp; Environment Locked
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
                  Exam Package Downloaded (Offline Ready)
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
                  Live Student ID Card Captured &amp; Verified
                </p>
                <p className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
                  Live Face Detection Calibrated (98% Match Confidence)
                </p>
              </div>

              <button
                onClick={() => router.push(`/test/${testCode}`)}
                className="flex w-full items-center justify-center gap-1.5 rounded-buttons bg-signal-green hover:bg-signal-green/90 py-2.5 text-xs font-semibold text-white active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
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
