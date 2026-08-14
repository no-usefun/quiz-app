"use client";

import Link from "next/link";
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
  params: { testCode: string };
}) {
  // TODO: BACKEND INTEGRATION - Fetch assessment details by code.
  // GET /api/assessments/code/{testCode}  (no auth required for the preview)
  // Expected response: { title, subjectCode, durationMinutes, questionCount, status: 'LIVE'|'ENDED'|'SCHEDULED' }
  // If status !== 'LIVE', show an error card ("Assessment not active") instead of the start button.
  // Replace the hardcoded title, duration, and question count below with this data.

  // TODO: BACKEND INTEGRATION - Validate student auth before showing the Start button.
  // Ensure dynoquizz_token is present; if not, redirect to /login.
  const testId = params.testCode;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3eefc] p-4 font-sans">
      <div className="w-full max-w-2xl rounded-[2.5rem] bg-white p-8 md:p-10 shadow-2xl border border-white/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-50"></div>

        <div className="relative z-10">
          <Link
            href="/join"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to code entry
          </Link>

          <div className="mb-8">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">
              Test Found
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
              {testId}
            </h1>
            <p className="text-slate-500">
              Data Structures & Algorithms - Midterm Assessment
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-slate-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Duration</p>
                <p className="font-bold text-slate-900">10 Minutes</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-slate-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Questions</p>
                <p className="font-bold text-slate-900">20 MCQs</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 mb-10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 mb-1">
                  Strict AI Proctoring is Active
                </h3>
                <p className="text-sm text-amber-800 mb-4 leading-relaxed">
                  By clicking start, you agree to being monitored. Ensure you
                  are in a well-lit room. The system will track the following:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center text-sm font-medium text-amber-900">
                    <Camera className="mr-3 h-4 w-4 text-amber-600" /> Face &
                    Eye Tracking
                  </li>
                  <li className="flex items-center text-sm font-medium text-amber-900">
                    <Monitor className="mr-3 h-4 w-4 text-amber-600" /> Browser
                    Tab Switching & Fullscreen Exit
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <Link
            href={`/test/${testId}`}
            className="group flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-4 text-base font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] hover:bg-blue-700 shadow-lg shadow-blue-600/20"
          >
            I understand, Start Assessment{" "}
            <PlayCircle className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </main>
  );
}
