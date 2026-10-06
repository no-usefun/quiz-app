"use client";

import React from "react";
import { AlertOctagon, ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";

interface ProctoringWarningModalProps {
  isOpen: boolean;
  warningCount: number;
  maxWarnings?: number;
  reason: string;
  autoSubmitted?: boolean;
  onAcknowledge: () => void;
}

export function ProctoringWarningModal({
  isOpen,
  warningCount,
  maxWarnings = 3,
  reason,
  autoSubmitted = false,
  onAcknowledge,
}: ProctoringWarningModalProps) {
  if (!isOpen) return null;

  const remainingStrikes = Math.max(0, maxWarnings - warningCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-[16px] border border-rose-200 bg-white p-6 shadow-2xl space-y-5 text-center">
        {/* Warning Icon Banner */}
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            autoSubmitted
              ? "bg-rose-100 text-rose-600"
              : "bg-amber-100 text-amber-600 animate-pulse"
          }`}
        >
          {autoSubmitted ? (
            <AlertOctagon className="h-8 w-8" />
          ) : (
            <ShieldAlert className="h-8 w-8" />
          )}
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-[#111111]">
            {autoSubmitted
              ? "Assessment Terminated: Malpractice Limit"
              : `Proctoring Infraction Detected (Warning ${warningCount}/${maxWarnings})`}
          </h2>
          <p className="text-xs text-rose-600 font-bold tracking-wide">
            REASON: {reason || "Proctoring rule violation"}
          </p>
        </div>

        {/* Explanatory Notice */}
        <div className="rounded-[12px] bg-[#f5f5f4] border border-[#d1dee8]/70 p-4 text-xs text-[#78716b] space-y-2 text-left">
          {autoSubmitted ? (
            <p className="font-medium text-rose-700 leading-relaxed">
              Your assessment has reached 3 recorded proctoring violations and has been automatically submitted for teacher investigation.
            </p>
          ) : (
            <>
              <p className="font-medium text-[#111111] leading-relaxed">
                You have received a malpractice warning. Please ensure you adhere strictly to assessment guidelines:
              </p>
              <ul className="list-disc pl-4 space-y-1 font-medium text-[11.5px]">
                <li>Keep your face centered and visible at all times.</li>
                <li>Ensure only you are present in front of the camera.</li>
                <li>Do not use mobile phones or external devices.</li>
                <li>Remain quiet and do not speak or read questions aloud.</li>
              </ul>
              <p className="font-bold text-amber-700 pt-1">
                You have {remainingStrikes} warning{remainingStrikes === 1 ? "" : "s"} remaining before auto-submission.
              </p>
            </>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onAcknowledge}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-[10px] py-3 text-xs font-bold text-white shadow-md active:scale-98 transition-all cursor-pointer ${
            autoSubmitted
              ? "bg-[#111111] hover:bg-[#222222]"
              : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {autoSubmitted ? (
            <>
              View Assessment Summary <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> I Understand &amp; Return to Quiz
            </>
          )}
        </button>
      </div>
    </div>
  );
}
