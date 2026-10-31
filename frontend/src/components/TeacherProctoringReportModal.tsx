"use client";

import React, { useEffect, useState } from "react";
import SkeletonBlock from "@/components/SkeletonBlock";
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserX,
  Users,
  Volume2,
  Clock,
  AlertCircle,
  EyeOff,
  Maximize2,
  UserCheck,
} from "lucide-react";
import { api, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

interface ProctoringEventDetail {
  id?: number | string;
  eventId?: string;
  clientEventId?: string;
  eventType: string;
  details: string;
  severity: string;
  confidence?: number;
  timestamp: string | number;
  frameTimestamp?: number;
}

interface ProctoringReportData {
  attemptId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  quizCode: string;
  quizTitle: string;
  status: string;
  terminationReason?: string | null;
  warningCount: number;
  totalViolationsCount: number;
  riskScore: number;
  riskLevel: string;
  totalFaceChecks: number;
  identityMatches: number;
  identityMismatches: number;
  faceAbsenceCount: number;
  multipleFacesCount: number;
  multiplePersonsCount: number;
  lookingAwayCount: number;
  phoneDetectionsCount: number;
  voiceDetectionsCount: number;
  tabSwitchesCount: number;
  startedAt: string;
  submittedAt: string | null;
  events: ProctoringEventDetail[];
}

function eventTimestamp(event: ProctoringEventDetail): Date | null {
  const value = event.frameTimestamp ?? event.timestamp;
  if (typeof value === "number") {
    const milliseconds = value < 1e12 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function uniqueEvents(events: ProctoringEventDetail[]): ProctoringEventDetail[] {
  const seen = new Set<string>();
  return events.filter((event, index) => {
    const key = String(
      event.eventId ?? event.clientEventId ?? event.id ??
      `${event.eventType}|${eventTimestamp(event)?.getTime() ?? index}|${event.details}`
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      // Clear data when the modal closes or loses its attempt context.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal lifecycle reset
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
          ENDPOINTS.proctoring.teacherAttemptReport(attemptId),
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
                Attempt #{attemptId} &bull; Biometric &amp; Malpractice Audit
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
            <div className="space-y-5" aria-busy="true" aria-label="Loading proctoring telemetry">
              <p className="sr-only" role="status">Loading proctoring telemetry</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { label: "Risk Assessment", icon: ShieldAlert },
                  { label: "Warnings Issued", icon: AlertCircle },
                  { label: "Identity Integrity", icon: ShieldCheck },
                ].map(({ label, icon: MetricIcon }) => (
                  <section key={label} className="flex min-h-36 flex-col justify-between rounded-[12px] border border-[#d1dee8] bg-[#f5f5f4]/50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#78716b]"><MetricIcon className="h-4 w-4" />{label}</span>
                    <SkeletonBlock className="my-2 h-8 w-20 rounded" />
                    <SkeletonBlock className="h-5 w-24 rounded-full" />
                  </section>
                ))}
              </div>
              <section className="space-y-4 rounded-[12px] border border-[#d1dee8] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#165dfb]" /><SkeletonBlock className="h-4 w-36 rounded" /></div>
                {[1, 2, 3].map((row) => <div key={row} className="flex items-center gap-3 border-t border-[#d1dee8]/60 pt-3 dark:border-slate-700"><Clock className="h-4 w-4 shrink-0 text-[#78716b]" /><div className="flex-1 space-y-2"><SkeletonBlock className="h-3 w-3/4 rounded" /><SkeletonBlock className="h-2.5 w-1/2 rounded" /></div><SkeletonBlock className="h-6 w-16 rounded-full" /></div>)}
              </section>
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
                  </div>
                  <span className="text-[10px] font-semibold text-[#78716b]">
                    {report.terminationReason === "MALPRACTICE_WARNING_LIMIT"
                      ? "Terminated: malpractice warning limit"
                      : "Review recorded warnings and detections"}
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                    Detection Category Breakdown
                  </h3>
                  <span className="text-[10px] font-extrabold text-[#78716b] bg-[#f5f5f4] px-2 py-0.5 rounded-full border border-[#d1dee8]">
                    {report.totalViolationsCount || report.events.length} Total Infractions
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Smartphone className="h-3.5 w-3.5 text-rose-500" /> Phone
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.phoneDetectionsCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <UserX className="h-3.5 w-3.5 text-amber-500" /> Absent
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.faceAbsenceCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-rose-500" /> Multi-Face
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.multipleFacesCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-rose-600" /> Multi-Person
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.multiplePersonsCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <EyeOff className="h-3.5 w-3.5 text-amber-500" /> Gaze / Away
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.lookingAwayCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Volume2 className="h-3.5 w-3.5 text-amber-500" /> Voice
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.voiceDetectionsCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <Maximize2 className="h-3.5 w-3.5 text-purple-500" /> Tab / Fullscreen
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.tabSwitchesCount || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#f5f5f4] flex items-center justify-between">
                    <span className="text-[#78716b] flex items-center gap-1.5 font-medium">
                      <UserCheck className="h-3.5 w-3.5 text-rose-500" /> ID Mismatch
                    </span>
                    <span className="font-bold text-[#111111]">
                      {report.identityMismatches || 0}
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
                    {uniqueEvents(report.events).map((ev, index) => (
                      <div
                        key={String(ev.eventId ?? ev.clientEventId ?? ev.id ?? `${ev.eventType}-${eventTimestamp(ev)?.getTime() ?? index}`)}
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
                            {ev.confidence !== undefined && Number.isFinite(ev.confidence) && (
                              <span className="text-[9px] font-bold text-[#78716b] bg-white px-1.5 py-0.5 rounded border border-[#d1dee8]">
                                Model confidence {Math.round(Math.max(0, Math.min(1, ev.confidence)) * 100)}%
                              </span>
                            )}
                            <span className="text-[10px] text-[#78716b] font-medium">
                              {eventTimestamp(ev)?.toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "medium",
                              }) ?? "Timestamp unavailable"}
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
