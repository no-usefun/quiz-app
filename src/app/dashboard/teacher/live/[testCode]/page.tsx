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
import { Logo } from "@/components/Logo";
import { getStoredResults, getStoredTests } from "@/lib/storage";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

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

function FlagIcon({ type }: { type: SuspicionFlag["type"] }) {
  const cls = "h-3 w-3";
  if (type === "tab_switch") return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt") return <Copy className={cls} />;
  return <AlertTriangle className={cls} />;
}

export default function LiveLeaderboard({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const [testTitle, setTestTitle] = useState("Assessment Session");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [lastSync, setLastSync] = useState(nowTime());
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncTelemetry = async () => {
    const cleanCode = (testCode || "").toUpperCase();

    // Check stored test details
    const localTest = getStoredTests().find((t) => t.testCode.toUpperCase() === cleanCode);
    if (localTest) {
      setTestTitle(localTest.quizName);
    }

    // Check local actual submissions
    const localSubmissions = getStoredResults()
      .filter((r) => r.testCode.toUpperCase() === cleanCode)
      .map((r, idx) => ({
        id: idx + 100,
        name: r.studentName || "Candidate",
        avatar: (r.studentName || "C").slice(0, 2).toUpperCase(),
        answered: r.totalQuestions,
        total: r.totalQuestions,
        score: r.adjustedScore || r.rawScore || 0,
        timeLeft: "00:00",
        status: "submitted" as const,
        flags: [],
      }));

    try {
      const token = localStorage.getItem("dynoquizz_token");
      const res = await fetch(
        `${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        },
      );

      if (res.ok) {
        const data = await res.json();
        setTestTitle(data.title || data.quizName || testTitle);
        const backendStudents: StudentRow[] = Array.isArray(data.students)
          ? data.students
          : [];
        
        // Merge backend and local submissions
        const seenNames = new Set(backendStudents.map((s) => s.name.toUpperCase()));
        const combined = [
          ...backendStudents,
          ...localSubmissions.filter((l) => !seenNames.has(l.name.toUpperCase())),
        ];

        setStudents(combined.length > 0 ? combined : localSubmissions);
      } else {
        setStudents(localSubmissions);
      }
    } catch (e) {
      setStudents(localSubmissions);
    } finally {
      setLoading(false);
      setLastSync(nowTime());
    }
  };

  useEffect(() => {
    setMounted(true);
    syncTelemetry();
  }, [testCode]);

  useEffect(() => {
    if (!isLive) return;

    const ticker = setInterval(() => {
      setElapsed((s) => s + 3);
      syncTelemetry();
    }, 3000);

    return () => clearInterval(ticker);
  }, [isLive, testCode]);

  const sorted = [...students].sort((a, b) => {
    if (a.status === "submitted" && b.status !== "submitted") return 1;
    if (b.status === "submitted" && a.status !== "submitted") return -1;
    return (b.score || 0) - (a.score || 0);
  });

  const activeCount = students.filter((s) => s.status === "active").length;
  const submittedCount = students.filter(
    (s) => s.status === "submitted",
  ).length;
  const flaggedCount = students.filter(
    (s) => (s.flags || []).length > 0,
  ).length;
  const avgScore =
    students.length > 0
      ? Math.round(
          students.reduce((acc, s) => acc + (s.score || 0), 0) /
            students.length,
        )
      : 0;

  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-frost-surface flex items-center justify-center text-xs text-steel-blue-gray">
        Loading live monitoring stream...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy selection:bg-frost-surface selection:text-signal-green">
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
              <>
                <StopCircle className="h-3.5 w-3.5" /> Pause Stream
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Resume Stream
              </>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-left">
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
              Last sync:{" "}
              <strong className="text-midnight-navy font-bold">
                {lastSync}
              </strong>
            </span>
            <span className="text-mist-blue/30">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-signal-green" />
              Duration:{" "}
              <strong className="text-midnight-navy font-bold">
                {elapsedLabel}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            {
              icon: <Users className="h-4 w-4 text-signal-green" />,
              label: "Active Candidates",
              value: activeCount,
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-pastel-mint-text" />,
              label: "Submitted",
              value: submittedCount,
            },
            {
              icon: <AlertTriangle className="h-4 w-4 text-pastel-pink-text" />,
              label: "Flagged Students",
              value: flaggedCount,
            },
            {
              icon: <TrendingUp className="h-4 w-4 text-signal-green" />,
              label: "Class Avg Score",
              value: `${avgScore}%`,
            },
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
                <p className="text-lg font-bold text-midnight-navy">
                  {stat.value}
                </p>
                <p className="text-[10px] text-steel-blue-gray font-bold uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

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
            {sorted.length === 0 ? (
              <li className="p-8 text-center text-xs text-steel-blue-gray">
                No candidates currently streaming.
              </li>
            ) : (
              sorted.map((student, idx) => {
                const flags = student.flags || [];
                const risk = riskLevel(flags);
                const rowBg =
                  risk === "danger"
                    ? "bg-pastel-pink/10 hover:bg-pastel-pink/20"
                    : risk === "warn"
                      ? "bg-pastel-yellow/10 hover:bg-pastel-yellow/20"
                      : "hover:bg-frost-surface/30";

                return (
                  <motion.li
                    key={student.id || idx}
                    layout
                    className={`grid grid-cols-[2rem_1fr_8rem_7rem_8rem_12rem] items-center gap-4 px-6 py-2.5 transition-colors ${rowBg}`}
                  >
                    <span className="text-xs font-bold font-mono text-steel-blue-gray">
                      {idx + 1}
                    </span>

                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-frost-surface border border-mist-blue/30 text-midnight-navy font-bold text-[10px]">
                        {student.avatar || "ST"}
                      </div>
                      <span className="truncate text-xs font-bold text-midnight-navy">
                        {student.name}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-1.5 w-full rounded-pills bg-frost-surface border border-mist-blue/20 overflow-hidden">
                        <div
                          className="h-full bg-signal-green transition-all duration-500"
                          style={{
                            width: `${((student.answered || 0) / Math.max(1, student.total || 20)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-steel-blue-gray font-medium">
                        {student.answered || 0}/{student.total || 20} Q
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="inline-flex items-center justify-center rounded-pills px-2.5 py-0.5 text-xs font-bold min-w-[3rem] bg-pastel-mint text-pastel-mint-text">
                        {student.score || 0}%
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
                      {flags.length === 0 ? (
                        <span className="text-[10px] text-steel-blue-gray font-medium">
                          —
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1 w-full text-left">
                          {flags.slice(-3).map((flag, fi) => (
                            <div
                              key={fi}
                              className="flex items-center gap-1 rounded-pills px-2 py-0.5 text-[9px] font-bold bg-pastel-pink text-pastel-pink-text"
                            >
                              <FlagIcon type={flag.type} />
                              <span className="truncate">{flag.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
