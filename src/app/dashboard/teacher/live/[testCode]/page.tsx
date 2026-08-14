"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Users,
  Clock,
  Activity,
  AlertTriangle,
  Monitor,
  Copy,
  Eye,
  TrendingUp,
  StopCircle,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuspicionFlag {
  type: "tab_switch" | "fullscreen_exit" | "right_click" | "copy_attempt";
  label: string;
  at: string; // time string e.g. "14:03:22"
}

interface StudentRow {
  id: number;
  name: string;
  avatar: string; // initials
  answered: number;
  total: number;
  score: number; // 0–100
  timeLeft: string; // "MM:SS"
  status: "active" | "submitted" | "disconnected";
  flags: SuspicionFlag[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTime(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function riskLevel(flags: SuspicionFlag[]): "clean" | "warn" | "danger" {
  if (flags.length === 0) return "clean";
  if (flags.length <= 2) return "warn";
  return "danger";
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const FLAG_TEMPLATES: Omit<SuspicionFlag, "at">[] = [
  { type: "tab_switch", label: "Tab switched / window minimized" },
  { type: "fullscreen_exit", label: "Exited fullscreen mode" },
  { type: "right_click", label: "Right-click attempted" },
  { type: "copy_attempt", label: "Copy attempt blocked" },
];

function seedStudents(): StudentRow[] {
  return [
    { id: 1, name: "Aarav Sharma",      avatar: "AS", answered: 14, total: 20, score: 82, timeLeft: "08:41", status: "active",       flags: [] },
    { id: 2, name: "Priya Mehta",       avatar: "PM", answered: 18, total: 20, score: 91, timeLeft: "06:12", status: "active",       flags: [{ type: "tab_switch", label: "Tab switched / window minimized", at: "14:01:33" }] },
    { id: 3, name: "Rohit Verma",       avatar: "RV", answered: 20, total: 20, score: 78, timeLeft: "00:00", status: "submitted",    flags: [{ type: "fullscreen_exit", label: "Exited fullscreen mode", at: "13:58:11" }, { type: "tab_switch", label: "Tab switched / window minimized", at: "13:59:44" }, { type: "copy_attempt", label: "Copy attempt blocked", at: "14:00:05" }] },
    { id: 4, name: "Sneha Iyer",        avatar: "SI", answered: 9,  total: 20, score: 55, timeLeft: "12:07", status: "active",       flags: [] },
    { id: 5, name: "Karan Patel",       avatar: "KP", answered: 16, total: 20, score: 74, timeLeft: "05:55", status: "active",       flags: [{ type: "right_click", label: "Right-click attempted", at: "14:02:19" }] },
    { id: 6, name: "Divya Nair",        avatar: "DN", answered: 20, total: 20, score: 96, timeLeft: "00:00", status: "submitted",    flags: [] },
    { id: 7, name: "Arjun Singh",       avatar: "AR", answered: 3,  total: 20, score: 20, timeLeft: "18:30", status: "disconnected", flags: [{ type: "tab_switch", label: "Tab switched / window minimized", at: "13:55:02" }, { type: "fullscreen_exit", label: "Exited fullscreen mode", at: "13:55:10" }] },
    { id: 8, name: "Meera Krishnan",    avatar: "MK", answered: 11, total: 20, score: 63, timeLeft: "10:14", status: "active",       flags: [] },
  ];
}

// ─── Flag icon map ─────────────────────────────────────────────────────────────

function FlagIcon({ type }: { type: SuspicionFlag["type"] }) {
  const cls = "h-3.5 w-3.5";
  if (type === "tab_switch")      return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt")    return <Copy className={cls} />;
  return <AlertTriangle className={cls} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveLeaderboard({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  const [students, setStudents]   = useState<StudentRow[]>(seedStudents);
  const [elapsed,  setElapsed]    = useState(0); // seconds since page load
  const [isLive,   setIsLive]     = useState(true);
  const [lastSync, setLastSync]   = useState(nowTime());

  // ── Simulated real-time updates (mimics polling the Spring Boot backend) ───
  // TODO: BACKEND INTEGRATION - Replace interval simulation with SSE or WebSocket connection.
  // GET /api/assessments/{testCode}/live-telemetry (or WebSocket /ws/live/{testCode}) with Authorization: Bearer {token}
  // Received stream payload: Array<{ id, name, avatar, answered, total, score, timeLeft, status: 'active'|'submitted'|'disconnected', flags: Array<{ type, label, at }> }>
  useEffect(() => {
    if (!isLive) return;

    const ticker = setInterval(() => {
      setElapsed((s) => s + 1);
      setLastSync(nowTime());

      setStudents((prev) =>
        prev.map((s) => {
          if (s.status !== "active") return s;

          // Occasionally advance answered count
          const newAnswered = Math.min(
            s.total,
            s.answered + (Math.random() < 0.15 ? 1 : 0)
          );

          // Small score drift
          const newScore = Math.min(
            100,
            s.score + (Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0)
          );

          // Randomly add a new flag (low probability to keep it realistic)
          let newFlags = [...s.flags];
          if (Math.random() < 0.03 && newFlags.length < 5) {
            const template =
              FLAG_TEMPLATES[Math.floor(Math.random() * FLAG_TEMPLATES.length)];
            newFlags = [...newFlags, { ...template, at: nowTime() }];
          }

          // Auto-submit when all answered
          const newStatus =
            newAnswered === s.total ? "submitted" : s.status;

          return {
            ...s,
            answered: newAnswered,
            score: newScore,
            status: newStatus,
            flags: newFlags,
          };
        })
      );
    }, 2000);

    return () => clearInterval(ticker);
  }, [isLive]);

  // ── Sort: submitted last, then by score desc ───────────────────────────────
  const sorted = [...students].sort((a, b) => {
    if (a.status === "submitted" && b.status !== "submitted") return 1;
    if (b.status === "submitted" && a.status !== "submitted") return -1;
    return b.score - a.score;
  });

  const activeCount    = students.filter((s) => s.status === "active").length;
  const submittedCount = students.filter((s) => s.status === "submitted").length;
  const flaggedCount   = students.filter((s) => s.flags.length > 0).length;
  const avgScore       = Math.round(students.reduce((acc, s) => acc + s.score, 0) / students.length);

  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-[#f3eefc] p-4 md:p-6 lg:p-8 font-sans">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-[2.5rem] bg-white shadow-2xl border border-white/50 overflow-hidden">

        {/* ── Header ── */}
        <header className="flex w-full items-center justify-between border-b border-slate-100 px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/teacher"
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="text-slate-200">|</span>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                DynoQuizz
              </span>
            </div>
          </div>

          {/* Live badge + controls */}
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                LIVE
              </span>
            )}
            <button
              onClick={() => setIsLive((v) => !v)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                isLive
                  ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              {isLive ? (
                <><StopCircle className="h-4 w-4" /> Pause Updates</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Resume Updates</>
              )}
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-8 p-8 lg:p-10">

          {/* ── Title row ── */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
                Live Monitor
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {testCode}
              </h1>
              <p className="mt-1 text-slate-500">
                Data Structures &amp; Algorithms — Midterm Assessment
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 sm:mt-0">
              <Activity className="h-3.5 w-3.5" />
              <span>Last sync: <span className="font-medium text-slate-600">{lastSync}</span></span>
              <span className="mx-2 text-slate-200">·</span>
              <Clock className="h-3.5 w-3.5" />
              <span>Running: <span className="font-medium text-slate-600">{elapsedLabel}</span></span>
            </div>
          </div>

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: <Users className="h-5 w-5 text-blue-600" />, label: "Active", value: activeCount, bg: "bg-blue-50", border: "border-blue-100" },
              { icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />, label: "Submitted", value: submittedCount, bg: "bg-emerald-50", border: "border-emerald-100" },
              { icon: <AlertTriangle className="h-5 w-5 text-red-500" />, label: "Flagged Students", value: flaggedCount, bg: "bg-red-50", border: "border-red-100" },
              { icon: <TrendingUp className="h-5 w-5 text-purple-600" />, label: "Class Avg Score", value: `${avgScore}%`, bg: "bg-purple-50", border: "border-purple-100" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl border ${stat.border} ${stat.bg} p-5 flex items-center gap-4`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Leaderboard table ── */}
          <div className="flex-1 rounded-[2rem] border border-slate-100 bg-slate-50 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_9rem_9rem_10rem_11rem] items-center gap-4 border-b border-slate-200 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>#</span>
              <span>Student</span>
              <span className="text-center">Progress</span>
              <span className="text-center">Score</span>
              <span className="text-center">Status</span>
              <span className="text-center">Suspicion Flags</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {sorted.map((student, idx) => {
                const risk = riskLevel(student.flags);
                const rowHighlight =
                  risk === "danger"
                    ? "bg-red-50/60 hover:bg-red-50"
                    : risk === "warn"
                    ? "bg-amber-50/40 hover:bg-amber-50/70"
                    : "bg-white hover:bg-slate-50/80";

                return (
                  <li
                    key={student.id}
                    className={`grid grid-cols-[2rem_1fr_9rem_9rem_10rem_11rem] items-center gap-4 px-6 py-4 transition-colors ${rowHighlight}`}
                  >
                    {/* Rank */}
                    <span className="text-sm font-bold text-slate-400">
                      {idx + 1}
                    </span>

                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          risk === "danger"
                            ? "bg-red-100 text-red-700"
                            : risk === "warn"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {student.avatar}
                      </div>
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {student.name}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-700"
                          style={{ width: `${(student.answered / student.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {student.answered}/{student.total} Q
                      </span>
                    </div>

                    {/* Score */}
                    <div className="flex items-center justify-center">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold min-w-[3.5rem] ${
                          student.score >= 80
                            ? "bg-emerald-100 text-emerald-700"
                            : student.score >= 60
                            ? "bg-blue-100 text-blue-700"
                            : student.score >= 40
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {student.score}%
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-center">
                      {student.status === "active" && (
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          Active
                        </span>
                      )}
                      {student.status === "submitted" && (
                        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                          <ShieldCheck className="h-3 w-3" />
                          Submitted
                        </span>
                      )}
                      {student.status === "disconnected" && (
                        <span className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Offline
                        </span>
                      )}
                    </div>

                    {/* Suspicion Flags */}
                    <div className="flex flex-col items-center gap-1.5">
                      {student.flags.length === 0 ? (
                        <span className="text-xs text-slate-300 font-medium">—</span>
                      ) : (
                        <div className="flex flex-col gap-1 w-full">
                          {student.flags.slice(-3).map((flag, fi) => (
                            <div
                              key={fi}
                              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${
                                flag.type === "tab_switch" || flag.type === "fullscreen_exit"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              <FlagIcon type={flag.type} />
                              <span className="truncate">{flag.label}</span>
                              <span className="ml-auto shrink-0 font-mono text-[9px] opacity-70">{flag.at}</span>
                            </div>
                          ))}
                          {student.flags.length > 3 && (
                            <span className="text-[10px] text-slate-400 text-center">
                              +{student.flags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Footer note ── */}
          <p className="text-center text-xs text-slate-400">
            Flags are detected client-side by the <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-500">useProctoring</code> hook and reported to the backend in real time · Updates every 2 s
          </p>
        </div>
      </div>
    </main>
  );
}
