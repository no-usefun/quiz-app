"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
import { getTestByCode } from "@/lib/storage";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Logo } from "@/components/Logo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuspicionFlag {
  type: "tab_switch" | "fullscreen_exit" | "right_click" | "copy_attempt";
  label: string;
  at: string;
}

interface StudentRow {
  id: number;
  name: string;
  avatar: string;
  answered: number;
  total: number;
  score: number;
  timeLeft: string;
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

function FlagIcon({ type }: { type: SuspicionFlag["type"] }) {
  const cls = "h-3 w-3";
  if (type === "tab_switch")      return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt")    return <Copy className={cls} />;
  return <AlertTriangle className={cls} />;
}

export default function LiveLeaderboard({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const [testTitle, setTestTitle] = useState("Proctored Assessment");

  const [students, setStudents]   = useState<StudentRow[]>(seedStudents);
  const [elapsed,  setElapsed]    = useState(0);
  const [isLive,   setIsLive]     = useState(true);
  const [lastSync, setLastSync]   = useState(nowTime());
  const [mounted, setMounted]     = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded = getTestByCode(testCode);
    if (loaded) {
      setTestTitle(loaded.quizName);
    }
  }, [testCode]);

  useEffect(() => {
    if (!isLive) return;

    const ticker = setInterval(() => {
      setElapsed((s) => s + 1);
      setLastSync(nowTime());

      setStudents((prev) =>
        prev.map((s) => {
          if (s.status !== "active") return s;

          const newAnswered = Math.min(
            s.total,
            s.answered + (Math.random() < 0.15 ? 1 : 0)
          );

          const newScore = Math.min(
            100,
            s.score + (Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0)
          );

          let newFlags = [...s.flags];
          if (Math.random() < 0.03 && newFlags.length < 5) {
            const template =
              FLAG_TEMPLATES[Math.floor(Math.random() * FLAG_TEMPLATES.length)];
            newFlags = [...newFlags, { ...template, at: nowTime() }];
          }

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
    <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy selection:bg-frost-surface selection:text-signal-green">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-paper-white border-b border-mist-blue px-6 py-3.5 shadow-none">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/teacher"
            className="flex items-center gap-2 text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <span className="text-mist-blue/30">|</span>
          <Logo />
        </div>

        <div className="flex items-center gap-2.5">
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-pills bg-pastel-mint px-3 py-1 text-xs font-bold text-pastel-mint-text">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-pastel-mint-text" />
              </span>
              LIVE STREAM
            </span>
          )}
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-2 rounded-buttons px-3.5 py-1.5 text-xs font-bold transition-all duration-200 border cursor-pointer ${
              isLive
                ? "bg-pastel-pink border-transparent text-pastel-pink-text hover:bg-pastel-pink/90"
                : "bg-pastel-mint border-transparent text-pastel-mint-text hover:bg-pastel-mint/90"
            }`}
          >
            {isLive ? (
              <><StopCircle className="h-3.5 w-3.5" /> Pause Stream</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Resume Stream</>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-left">
        {/* Title row */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-signal-green">
              Real-time Proctoring Telemetry
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-midnight-navy">
              {testCode}
            </h1>
            <p className="mt-0.5 text-xs text-steel-blue-gray font-medium">
              {testTitle}
            </p>
          </div>
          <div className="flex items-center gap-3.5 text-xs text-steel-blue-gray font-medium bg-paper-white border border-mist-blue px-3.5 py-1.5 rounded-pills shadow-sm mt-2 sm:mt-0">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-signal-green" />
              Last sync: <strong className="text-midnight-navy font-bold">{lastSync}</strong>
            </span>
            <span className="text-mist-blue/30">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-signal-green" />
              Duration: <strong className="text-midnight-navy font-bold">{elapsedLabel}</strong>
            </span>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            { icon: <Users className="h-4 w-4 text-signal-green" />, label: "Active Candidates", value: activeCount },
            { icon: <ShieldCheck className="h-4 w-4 text-pastel-mint-text" />, label: "Submitted", value: submittedCount },
            { icon: <AlertTriangle className="h-4 w-4 text-pastel-pink-text" />, label: "Flagged Students", value: flaggedCount },
            { icon: <TrendingUp className="h-4 w-4 text-signal-green" />, label: "Class Avg Score", value: `${avgScore}%` },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={mounted ? { opacity: 0, y: 8 } : false}
              animate={mounted ? { opacity: 1, y: 0 } : false}
              className="rounded-cards bg-paper-white p-4 flex items-center gap-3 border border-mist-blue shadow-xl text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-inputs bg-frost-surface text-signal-green border border-mist-blue/20">
                {stat.icon}
              </div>
              <div>
                <p className="text-lg font-bold text-midnight-navy">{stat.value}</p>
                <p className="text-[10px] text-steel-blue-gray font-bold uppercase tracking-wider">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Leaderboard table */}
        <div className="rounded-cards bg-paper-white border border-mist-blue overflow-hidden shadow-xl text-left">
          <div className="grid grid-cols-[2rem_1fr_8rem_7rem_8rem_12rem] items-center gap-4 bg-paper-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-steel-blue-gray border-b border-mist-blue/30">
            <span>#</span>
            <span>Student</span>
            <span className="text-center">Progress</span>
            <span className="text-center">Score</span>
            <span className="text-center">Status</span>
            <span className="text-center">Suspicion Flags</span>
          </div>

          <ul className="divide-y divide-mist-blue/30 bg-paper-white">
            {sorted.map((student, idx) => {
              const risk = riskLevel(student.flags);
              const rowBg =
                risk === "danger"
                  ? "bg-pastel-pink/10 hover:bg-pastel-pink/20"
                  : risk === "warn"
                  ? "bg-pastel-yellow/10 hover:bg-pastel-yellow/20"
                  : "hover:bg-frost-surface/30";

              return (
                <motion.li
                  key={student.id}
                  layout
                  className={`grid grid-cols-[2rem_1fr_8rem_7rem_8rem_12rem] items-center gap-4 px-6 py-2.5 transition-colors ${rowBg}`}
                >
                  <span className="text-xs font-bold font-mono text-steel-blue-gray">
                    {idx + 1}
                  </span>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-frost-surface border border-mist-blue/30 text-midnight-navy font-bold text-[10px]">
                      {student.avatar}
                    </div>
                    <span className="truncate text-xs font-bold text-midnight-navy">
                      {student.name}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <div className="h-1.5 w-full rounded-pills bg-frost-surface border border-mist-blue/20 overflow-hidden">
                      <div
                        className="h-full bg-signal-green transition-all duration-500"
                        style={{ width: `${(student.answered / student.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-steel-blue-gray font-medium">
                      {student.answered}/{student.total} Q
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-pills px-2.5 py-0.5 text-xs font-bold min-w-[3rem] ${
                        student.score >= 80
                          ? "bg-pastel-mint text-pastel-mint-text"
                          : student.score >= 60
                          ? "bg-pastel-lavender text-pastel-lavender-text"
                          : student.score >= 40
                          ? "bg-pastel-yellow text-pastel-yellow-text"
                          : "bg-pastel-pink text-pastel-pink-text"
                      }`}
                    >
                      {student.score}%
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    {student.status === "active" && (
                      <span className="flex items-center gap-1 rounded-pills bg-pastel-mint px-2.5 py-0.5 text-[10px] font-bold text-pastel-mint-text">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pastel-mint-text" />
                        </span>
                        Active
                      </span>
                    )}
                    {student.status === "submitted" && (
                      <span className="flex items-center gap-1 rounded-pills bg-pastel-lavender px-2.5 py-0.5 text-[10px] font-bold text-pastel-lavender-text">
                        <ShieldCheck className="h-3 w-3 text-pastel-lavender-text" />
                        Submitted
                      </span>
                    )}
                    {student.status === "disconnected" && (
                      <span className="flex items-center gap-1 rounded-pills bg-pastel-pink px-2.5 py-0.5 text-[10px] font-bold text-pastel-pink-text">
                        <span className="h-1.5 w-1.5 rounded-full bg-pastel-pink-text" />
                        Offline
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 w-full">
                    {student.flags.length === 0 ? (
                      <span className="text-[10px] text-steel-blue-gray font-medium">—</span>
                    ) : (
                      <div className="flex flex-col gap-1 w-full text-left">
                        {student.flags.slice(-3).map((flag, fi) => (
                          <div
                            key={fi}
                            className={`flex items-center gap-1 rounded-pills px-2 py-0.5 text-[9px] font-bold ${
                              flag.type === "tab_switch" || flag.type === "fullscreen_exit"
                                ? "bg-pastel-pink text-pastel-pink-text"
                                : "bg-pastel-yellow text-pastel-yellow-text"
                            }`}
                          >
                            <FlagIcon type={flag.type} />
                            <span className="truncate">{flag.label}</span>
                            <span className="ml-auto shrink-0 font-mono text-[9px] opacity-70">{flag.at}</span>
                          </div>
                        ))}
                        {student.flags.length > 3 && (
                          <span className="text-[9px] text-steel-blue-gray text-center font-bold">
                            +{student.flags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        <p className="text-center text-[10px] text-steel-blue-gray font-medium">
          Flags are detected client-side by the{" "}
          <code className="font-mono bg-frost-surface text-signal-green px-1 py-0.5 rounded border border-mist-blue/30">
            useProctoring
          </code>{" "}
          hook and reported to the backend in real time · Live stream updates every 2s
        </p>
      </main>
    </div>
  );
}
