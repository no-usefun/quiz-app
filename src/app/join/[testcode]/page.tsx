"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  PlayCircle,
  Camera,
  Clock,
  Monitor,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export default function TestLandingPage({
  params,
}: {
  params: Promise<{ testcode: string }>;
}) {
  const { testcode } = use(params);
  const testId = testcode;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-xl rounded-cards bg-paper-white p-6 md:p-8 border border-mist-blue shadow-xl text-left"
      >
        <Link
          href="/join"
          className="inline-flex items-center text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors mb-5"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Change Access Code
        </Link>

        <div className="mb-5 text-left">
          <span className="inline-flex items-center gap-1 rounded-pills bg-pastel-mint text-pastel-mint-text px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text" /> Assessment Found
          </span>
          <h1 className="text-xl font-bold tracking-tight text-midnight-navy mb-0.5">
            {testId}
          </h1>
          <p className="text-xs text-steel-blue-gray font-medium">
            Data Structures &amp; Algorithms — Midterm Assessment
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-left">
          <div className="rounded-inputs border border-mist-blue bg-paper-white p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-inputs bg-frost-surface text-signal-green border border-mist-blue/30 shadow-none">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">Time Limit</p>
              <p className="font-bold text-midnight-navy text-xs">60 Minutes</p>
            </div>
          </div>
          <div className="rounded-inputs border border-mist-blue bg-paper-white p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-inputs bg-pastel-mint text-pastel-mint-text border border-mist-blue/35 shadow-none">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">Questions</p>
              <p className="font-bold text-midnight-navy text-xs">20 MCQs</p>
            </div>
          </div>
        </div>

        <div className="rounded-inputs border border-pastel-yellow-text/20 bg-pastel-yellow p-4 mb-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-inputs bg-white/40 text-pastel-yellow-text border border-pastel-yellow-text/25">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-pastel-yellow-text text-xs mb-0.5">
                AI Proctoring &amp; Identity Verification Active
              </h3>
              <p className="text-xs text-pastel-yellow-text/90 leading-relaxed mb-2 font-medium">
                Before entering the assessment arena, you must complete the identity check sequence.
              </p>
              <ul className="space-y-1 text-xs text-pastel-yellow-text font-bold">
                <li className="flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-pastel-yellow-text" /> Student ID Photo &amp; Webcam Scan
                </li>
                <li className="flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-pastel-yellow-text" /> Browser Tab &amp; Copy Event Monitoring
                </li>
              </ul>
            </div>
          </div>
        </div>

        <Link
          href={`/test/${testId}/verify`}
          className="flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green px-4 py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
        >
          Proceed to Verification <PlayCircle className="h-4 w-4 text-white" />
        </Link>
      </motion.div>
    </main>
  );
}
