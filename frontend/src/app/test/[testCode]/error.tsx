"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function TestArenaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Test arena error boundary caught an error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
      <div className="w-full max-w-md rounded-[8.8px] bg-white border border-[#d1dee8] p-8 text-center shadow-sm space-y-4 text-left">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#fbeee8] border border-[#d1dee8] text-[#8c381c]">
          <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
        </div>
        <div className="text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
            Exam Session Guard
          </span>
          <h1 className="text-lg font-bold text-[#111111]">
            Temporary Interface Issue
          </h1>
          <p className="text-xs text-[#78716b] leading-relaxed font-medium">
            Your quiz progress and selected answers have been saved in your local session cache. Refreshing will resume your assessment.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Resume Quiz
          </button>
          <Link
            href="/dashboard/student"
            className="flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#f5f5f4] py-2.5 px-4 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] transition-all border border-[#d1dee8]"
          >
            <Home className="h-3.5 w-3.5 text-[#78716b]" />
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
