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
  Camera,
  Volume2,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

interface SuspicionFlag {
  type: string;
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
  status: "active" | "submitted" | "auto_submitted" | "disconnected";
  tabSwitches: number;
  faceWarnings: number;
  voiceWarnings: number;
  fullscreenExits: number;
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

function riskLevel(student: StudentRow): "clean" | "warn" | "danger" {
  const totalWarnings = student.tabSwitches + student.faceWarnings + student.fullscreenExits;
  if (totalWarnings === 0) return "clean";
  if (totalWarnings <= 2) return "warn";
  return "danger";
}

function FlagBadge({ type, label }: { type: string; label: string }) {
  const isFace = type.includes("FACE");
  const isVoice = type.includes("VOICE");
  const isTab = type.includes("TAB") || type.includes("WINDOW");

  return (
    <span className="flex items-center gap-1 rounded-pills px-2 py-0.5 text-[9px] font-bold bg-pastel-pink text-pastel-pink-text">
      {isFace ? (
        <Camera className="h-3 w-3" />
      ) : isVoice ? (
        <Volume2 className="h-3 w-3" />
      ) : isTab ? (
        <Monitor className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

export default function LiveLeaderboard({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const [testTitle, setTestTitle] = useState("Live Assessment Session");
  const [quizId, setQuizId] = useState<number | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [lastSync, setLastSync] = useState(nowTime());
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncTelemetry = async () => {
    const cleanCode = (testCode || "").toUpperCase();

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("dynoquizz_token") : null;

      // 1. Fetch Quiz Package
      let currentQuizId = quizId;
      if (!currentQuizId) {
        const pkgRes = await fetch(`${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        });

        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          setTestTitle(pkgData.title || `Assessment ${cleanCode}`);
          currentQuizId = pkgData.id;
          setQuizId(pkgData.id);
        }
      }

      // 2. Fetch Live Proctoring Overview
      if (currentQuizId) {
        const procRes = await fetch(`${API_BASE}/api/v1/teacher/quizzes/${currentQuizId}/proctoring-overview`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        });

        if (procRes.ok) {
          const procData = await procRes.json();
          const rows: StudentRow[] = (procData.candidates || []).map((c: any) => {
            const flags: SuspicionFlag[] = (c.recentViolations || []).map((v: any) => ({
              type: v.activityType,
              label: v.activityType.replace(/_/g, " "),
              at: v.activityTime,
            }));

            const statusMap: Record<string, "active" | "submitted" | "auto_submitted"> = {
              IN_PROGRESS: "active",
              SUBMITTED: "submitted",
              AUTO_SUBMITTED: "auto_submitted",
            };

            return {
              id: c.attemptId,
              name: c.studentName || "Candidate",
              avatar: (c.studentName || "C").slice(0, 2).toUpperCase(),
              answered: 0,
              total: 20,
              score: 0,
              status: statusMap[c.status] || "active",
              tabSwitches: c.tabSwitches || 0,
              faceWarnings: c.faceWarnings || 0,
              voiceWarnings: c.voiceWarnings || 0,
              fullscreenExits: c.fullscreenExits || 0,
              flags,
            };
          });

          setStudents(rows);
        }
      }
    } catch (e) {
      console.warn("Live telemetry fetch error:", e);
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
  }, [isLive, testCode, quizId]);

  const activeCount = students.filter((s) => s.status === "active").length;
  const submittedCount = students.filter((s) => s.status === "submitted" || s.status === "auto_submitted").length;
  const flaggedCount = students.filter((s) => riskLevel(s) !== "clean").length;

  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-frost-surface flex items-center justify-center text-xs text-steel-blue-gray">
        Connecting to live proctoring stream...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-paper-white border-b border-mist-blue px-6 py-3.5">
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
              AI PROCTOR LIVE
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
                <RefreshCw className="h-3.5 w-3.5" /> Resume Stream
              </>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-left">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-signal-green">
              Real-time AI Proctoring Stream
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-midnight-navy">
              {testCode.toUpperCase()}
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

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            {
              icon: <Users className="h-4 w-4 text-signal-green" />,
              label: "Live Candidates",
              value: activeCount,
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-pastel-mint-text" />,
              label: "Submitted",
              value: submittedCount,
            },
            {
              icon: <AlertTriangle className="h-4 w-4 text-pastel-pink-text" />,
              label: "Flagged Sessions",
              value: flaggedCount,
            },
            {
              icon: <Camera className="h-4 w-4 text-signal-green" />,
              label: "Vision Proctor",
              value: "Active",
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

        {/* Candidate Table */}
        <div className="rounded-cards bg-paper-white border border-mist-blue overflow-hidden shadow-xl text-left">
          <div className="grid grid-cols-[2rem_1fr_8rem_7rem_8rem_14rem] items-center gap-4 bg-paper-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-steel-blue-gray border-b border-mist-blue/30">
            <span>#</span>
            <span>Student Candidate</span>
            <span className="text-center">Tab Switches</span>
            <span className="text-center">Vision Flags</span>
            <span className="text-center">Status</span>
            <span className="text-center">Telemetry Logs</span>
          </div>

          <ul className="divide-y divide-mist-blue/30 bg-paper-white">
            {students.length === 0 ? (
              <li className="p-8 text-center text-xs text-steel-blue-gray">
                No candidate telemetry streaming yet. Waiting for students to join.
              </li>
            ) : (
              students.map((student, idx) => {
                const risk = riskLevel(student);
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
                    className={`grid grid-cols-[2rem_1fr_8rem_7rem_8rem_14rem] items-center gap-4 px-6 py-2.5 transition-colors ${rowBg}`}
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

                    <div className="flex items-center justify-center">
                      <span
                        className={`rounded-pills px-2.5 py-0.5 text-xs font-bold ${
                          student.tabSwitches > 0
                            ? "bg-pastel-pink text-pastel-pink-text"
                            : "bg-frost-surface text-steel-blue-gray"
                        }`}
                      >
                        {student.tabSwitches} switches
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span
                        className={`rounded-pills px-2.5 py-0.5 text-xs font-bold ${
                          student.faceWarnings > 0
                            ? "bg-pastel-pink text-pastel-pink-text"
                            : "bg-pastel-mint text-pastel-mint-text"
                        }`}
                      >
                        {student.faceWarnings > 0 ? `${student.faceWarnings} alerts` : "Clean"}
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
                      {student.status === "auto_submitted" && (
                        <span className="flex items-center gap-1 rounded-pills bg-pastel-pink px-2.5 py-0.5 text-[10px] font-bold text-pastel-pink-text">
                          <AlertTriangle className="h-3 w-3 text-pastel-pink-text" />
                          Auto-Submitted
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-1 w-full">
                      {student.flags.length === 0 ? (
                        <span className="text-[10px] text-pastel-mint-text font-bold">
                          ✓ No Violations
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1 w-full text-left">
                          {student.flags.slice(-2).map((flag, fi) => (
                            <FlagBadge key={fi} type={flag.type} label={flag.label} />
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
