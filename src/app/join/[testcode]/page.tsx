"use client";

import { use } from "react";
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-850 p-4 font-sans selection:bg-blue-100 selection:text-blue-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-xl rounded-2xl bg-white p-6 md:p-8 border border-slate-200 shadow-xs"
      >
        <Link
          href="/join"
          className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-5"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Change Access Code
        </Link>

        <div className="mb-5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Assessment Found
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5">
            {testId}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Data Structures &amp; Algorithms — Midterm Assessment
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-blue-600 border border-slate-200 shadow-xs">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Time Limit</p>
              <p className="font-bold text-slate-900 text-xs">60 Minutes</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-600 border border-slate-200 shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Questions</p>
              <p className="font-bold text-slate-900 text-xs">20 MCQs</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/50 text-amber-700 border border-amber-200">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-xs mb-0.5">
                AI Proctoring &amp; Identity Verification Active
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed mb-2 font-medium">
                Before entering the assessment arena, you must complete the identity check sequence.
              </p>
              <ul className="space-y-1 text-xs text-amber-900 font-medium">
                <li className="flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-amber-700" /> Student ID Photo &amp; Webcam Scan
                </li>
                <li className="flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-amber-700" /> Browser Tab &amp; Copy Event Monitoring
                </li>
              </ul>
            </div>
          </div>
        </div>

        <Link
          href={`/test/${testId}/verify`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
        >
          Proceed to Verification <PlayCircle className="h-4 w-4" />
        </Link>
      </motion.div>
    </main>
  );
}
