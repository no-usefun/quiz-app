"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserX,
  Users,
  Volume2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api, getAuthToken } from "@/lib/api/client";

interface ProctoringEventDetail {
  id: number;
  eventType: string;
  details: string;
  severity: string;
  timestamp: string;
}

interface ProctoringReportData {
  attemptId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  quizCode: string;
  quizTitle: string;
  status: string;
  warningCount: number;
  riskScore: number;
  riskLevel: string;
  totalFaceChecks: number;
  identityMatches: number;
  identityMismatches: number;
  faceAbsenceCount: number;
  multipleFacesCount: number;
  phoneDetectionsCount: number;
  voiceDetectionsCount: number;
  tabSwitchesCount: number;
  startedAt: string;
  submittedAt: string | null;
  events: ProctoringEventDetail[];
}

interface TeacherProctoringReportModalProps {
  isOpen: boolean;
  attemptId: number | null;
  onClose: () => void;
}

export function TeacherProctoringReportModal({
  isOpen,
  attemptId,
  onClose,
}: TeacherProctoringReportModalProps) {
  const [report, setReport] = useState<ProctoringReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !attemptId) {
      setReport(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        const data = await api.get<ProctoringReportData>(
          `/api/v1/teacher/proctoring/attempts/${attemptId}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (isMounted) {
          setReport(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load proctoring audit report."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchReport();

    return () => {
      isMounted = false;
    };
  }, [isOpen, attemptId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[16px] border border-[#d1dee8] bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d1dee8]/70 px-6 py-4 bg-[#f5f5f4]/50">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-[#165dfb]" />
            <div>
              <h2 className="text-sm font-extrabold text-[#111111]">
                AI Proctoring Integrity Report
              </h2>
              <p className="text-[11px] text-[#78716b] font-semibold">
                Attempt #{attemptId} &bull; Biometric &amp; Device Malpractice Audit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-stone-500">
              <Loader2 className="h-6 w-6 animate-spin text-[#165dfb]" />
              <span className="text-xs font-semibold">Loading Proctoring Telemetry...</span>
            </div>
          )}

          {error && (
            <div className="rounded-[10px] bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Risk Score */}
                <div
                  className={`rounded-[12px] p-4 border flex flex-col justify-between ${
                    report.riskScore >= 65
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : report.riskScore >= 30
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Risk Assessment
                  </span>
                  <div className="my-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold">{report.riskScore}</span>
                    <span className="text-xs font-semibold">/100</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full w-fit bg-white/80 border border-current shadow-xs">
                    {report.riskLevel} RISK
                  </span>
                </div>

                {/* Warnings Strikes */}
                <div className="rounded-[12px] p-4 border border-[#d1dee8] bg-[#f5f5f4]/50 flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#78716b]">
                    Warnings Issued
                  </span>
                  <div className="my-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#111111]">
                      {report.warningCount}
                    </span>
                    <span className="text-xs font-semibold text-[#78716b]">/ 3</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#78716b]">
                    {report.status === "AUTO_SUBMITTED"
                      ? "Terminated by Malpractice Limit"
                      : "Within Allowed Threshold"}
                  </span>
                </div>

                {/* Biometric Verification */}
                <div className="rounded-[12px] p-4 border border-[#d1dee8] bg-[#f5f5f4]/50 flex flex-col justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#78716b]">
                    Identity Integrity
                  </span>
                  <div className="my-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-emerald-600">
                      {report.identityMatches}
                    </span>
                    <span className="text-xs font-semibold text-[#78716b]">
                      / {report.totalFaceChecks} matches
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-rose-600">
                    {report.identityMismatches} mismatch alerts
                  </span>
                </div>
              </div>

              {/* Infraction Breakdown Grid */}
              <div className="rounded-[12px] border border-[#d1dee8] p-4 space-y-3 bg-white">
                <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                  Detection Category Breakdown
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Smartphone className="h-3.5 w-3.5 text-rose-500" /> Phone
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.phoneDetectionsCount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <UserX className="h-3.5 w-3.5 text-amber-500" /> Absent
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.faceAbsenceCount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-rose-500" /> Multi-Face
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.multipleFacesCount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Volume2 className="h-3.5 w-3.5 text-amber-500" /> Voice
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.voiceDetectionsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chronological Event Audit Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#165dfb]" />
                  Authoritative Infraction Log ({report.events.length})
                </h3>

                {report.events.length === 0 ? (
                  <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-4 text-center text-xs text-emerald-800 font-medium flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Clean session: No malpractice infractions recorded during this assessment.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {report.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-[10px] border border-[#d1dee8]/80 bg-[#f5f5f4]/40 p-3 text-xs flex items-start justify-between gap-3 hover:bg-[#f5f5f4] transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                ev.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {ev.eventType}
                            </span>
                            <span className="text-[10px] text-[#78716b] font-medium">
                              {new Date(ev.timestamp).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[#111111] font-semibold text-[11px]">
                            {ev.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#d1dee8]/70 px-6 py-3 bg-[#f5f5f4]/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] bg-[#111111] px-4 py-2 text-xs font-bold text-white hover:bg-[#222222] active:scale-95 shadow-xs transition-all cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
