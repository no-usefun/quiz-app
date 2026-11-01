"use client";

import SkeletonBlock from "@/components/SkeletonBlock";
import { use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowLeft,
  Users,
  Clock,
  Activity,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ENDPOINTS } from "@/lib/api/endpoints";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type QuizSummary = {
  quizId: number | string;
  quizCode: string;
  title: string;
  totalStudents: number;
  totalQuestions: number;
  totalMarks: number;
  overallTimerSeconds: number;
  status?: string;
  examState?: string;
  resultsPublished?: boolean;
};

type LeaderboardEntry = {
  rank?: number;
  studentId?: number | string;
  studentName?: string;
  score?: number | string;
  totalMarks?: number | string;
  percentage?: number | string;
  totalTimeTaken?: number | null;
};

type StudentRow = {
  id: number | string;
  name: string;
  avatar: string;
  answered: number | null;
  total: number;
  score: number;
  timeTaken: string;
};

function nowTime(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatTimeTaken(seconds: number | null | undefined): string {
  const safeSeconds = Math.max(0, Number(seconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeQuiz(raw: unknown): QuizSummary | null {
  if (!isRecord(raw)) return null;

  const quizId = raw.quizId ?? raw.id;
  const quizCode = String(raw.quizCode ?? raw.testCode ?? "").trim();

  if (
    (typeof quizId !== "string" && typeof quizId !== "number") ||
    !quizCode
  ) return null;

  return {
    quizId,
    quizCode,
    title: String(raw.title ?? "Assessment Session"),
    totalStudents: Number(raw.totalStudents ?? 0),
    totalQuestions: Number(raw.totalQuestions ?? 0),
    totalMarks: Number(raw.totalMarks ?? 0),
    overallTimerSeconds: Number(raw.overallTimerSeconds ?? 0),
    status: typeof raw.status === "string" ? raw.status : undefined,
    examState: typeof raw.examState === "string" ? raw.examState : undefined,
    resultsPublished: Boolean(raw.resultsPublished),
  };
}

function mapLeaderboardEntry(
  entry: LeaderboardEntry,
  fallbackTotalQuestions: number,
  index: number,
): StudentRow {
  const name = entry.studentName?.trim() || "Candidate";
  const total = Math.max(0, fallbackTotalQuestions);
  const percentage = Math.round(Number(entry.percentage ?? 0));

  return {
    id: entry.studentId ?? entry.rank ?? index + 1,
    name,
    avatar:
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "ST",
    // The leaderboard API only returns submitted-result data, not per-question progress.
    answered: null,
    total,
    score: percentage,
    timeTaken: formatTimeTaken(entry.totalTimeTaken),
  };
}

export default function LiveLeaderboard({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  const [quiz, setQuiz] = useState<QuizSummary | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [lastSync, setLastSync] = useState("--:--:--");
  const [refreshKey, setRefreshKey] = useState(0);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayCode = quiz?.quizCode || testCode;

  

  useEffect(() => {
    let cancelled = false;

    const fetchQuiz = async () => {
      const token = localStorage.getItem("dynoquizz_token");

      if (!token) {
        throw new Error(
          "Your teacher session has expired. Please log in again.",
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const listRes = await fetch(ENDPOINTS.teacher.quizzes, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            body?.error ||
            `Unable to load your assessments (${listRes.status}).`,
        );
      }

      const payload = await listRes.json();

      const rawList: unknown[] = Array.isArray(payload)
        ? payload
        : isRecord(payload) && Array.isArray(payload.content)
          ? payload.content
          : isRecord(payload) && Array.isArray(payload.data)
            ? payload.data
            : [];
      const list = rawList.filter(isRecord);

      let matched = list.find(
        (item) =>
          String(item?.quizCode ?? "") === String(testCode) ||
          String(item?.quizId ?? item?.id ?? "") === String(testCode),
      );

      if (!matched && /^\d+$/.test(String(testCode))) {
        const detailRes = await fetch(ENDPOINTS.teacher.quizDetail(testCode), {
          method: "GET",
          headers,
          cache: "no-store",
        });

        if (detailRes.ok) {
          matched = await detailRes.json();
        }
      }

      const normalized = normalizeQuiz(matched);

      if (!normalized) {
        throw new Error(
          "Assessment not found. Check the assessment URL or return to the teacher dashboard.",
        );
      }

      if (!cancelled) {
        setQuiz(normalized);
      }

      return normalized;
    };

    const fetchLeaderboard = async (
      quizId: number | string,
      totalQuestions: number,
    ) => {
      const token = localStorage.getItem("dynoquizz_token");

      if (!token) {
        throw new Error(
          "Your teacher session has expired. Please log in again.",
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const res = await fetch(ENDPOINTS.teacher.leaderboard(quizId), {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            body?.error ||
            `Unable to load the leaderboard (${res.status}).`,
        );
      }

      const data = await res.json();
      const entries: LeaderboardEntry[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
          ? data.content
          : [];

      if (cancelled) return;

      setStudents(
        entries.map((entry, index) =>
          mapLeaderboardEntry(entry, totalQuestions, index),
        ),
      );
      setLastSync(nowTime());
      setError(null);
    };

    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);

        const resolvedQuiz = await fetchQuiz();
        await fetchLeaderboard(resolvedQuiz.quizId, resolvedQuiz.totalQuestions);
      } catch (err: unknown) {
        if (cancelled) return;

        console.error("Failed to load teacher live leaderboard:", err);
        setStudents([]);
        setError(
          (err instanceof Error ? err.message : null) ||
            "We couldn't retrieve the assessment leaderboard from the server.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [testCode, refreshKey]);

  // Live-attempt telemetry is deferred by the backend contract.
  // This route shows the latest persisted leaderboard snapshot only.

  const sorted = useMemo(
    () =>
      [...students].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken.localeCompare(b.timeTaken);
      }),
    [students],
  );

  const submittedCount = students.length;
  const avgScore =
    students.length > 0
      ? Math.round(
          students.reduce((acc, student) => acc + student.score, 0) /
            students.length,
        )
      : 0;

  const examDurationMins = Math.floor((quiz?.overallTimerSeconds ?? 0) / 60);

  if (loading) {
    return (
      <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy dark:bg-slate-950 dark:text-slate-100" aria-busy="true" aria-label="Loading teacher leaderboard">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-mist-blue/60 bg-paper-white px-3 py-3.5 sm:px-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3"><Link href="/dashboard/teacher" className="flex items-center gap-2 text-xs font-bold text-steel-blue-gray"><ArrowLeft className="h-3.5 w-3.5" />Dashboard</Link><span className="text-mist-blue/30">|</span><Logo /></div>
          <div className="flex items-center gap-2"><ThemeToggle /><SkeletonBlock className="hidden h-7 w-32 rounded-full sm:block" /><span className="flex items-center gap-2 rounded-[10px] border border-mist-blue/70 bg-white px-3.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"><RefreshCw className="h-3.5 w-3.5 text-slate-400" /><SkeletonBlock className="h-3 w-20 rounded" /></span></div>
        </header>
        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-signal-green">Leaderboard</span><h1 className="text-2xl font-bold tracking-tight text-midnight-navy dark:text-slate-100">{displayCode}</h1><SkeletonBlock className="h-3 w-44 rounded" /></div>
            <div className="flex flex-wrap items-center gap-3.5 rounded-full border border-mist-blue/80 bg-paper-white px-3.5 py-2 dark:border-slate-700 dark:bg-slate-900"><span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-signal-green" /><SkeletonBlock className="h-3 w-24 rounded" /></span><span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-signal-green" /><SkeletonBlock className="h-3 w-28 rounded" /></span></div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[
              { icon: <Users className="h-4 w-4 text-signal-green" />, label: "Target Students" },
              { icon: <ShieldCheck className="h-4 w-4 text-pastel-mint-text" />, label: "Submitted" },
              { icon: <Clock className="h-4 w-4 text-signal-green" />, label: "Exam Duration" },
              { icon: <TrendingUp className="h-4 w-4 text-signal-green" />, label: "Class Avg Score" },
            ].map((stat) => <section key={stat.label} className="flex items-center gap-3 rounded-[14px] border border-mist-blue/70 bg-paper-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-mist-blue/20 bg-frost-surface dark:bg-slate-800">{stat.icon}</span><div className="space-y-2"><SkeletonBlock className="h-5 w-12 rounded" /><p className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-400">{stat.label}</p></div></section>)}
          </div>
          <section className="overflow-hidden rounded-[14px] border border-mist-blue/70 bg-paper-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-mist-blue/60 p-4 dark:border-slate-700"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-signal-green" /><SkeletonBlock className="h-4 w-32 rounded" /></div><SkeletonBlock className="h-8 w-28 rounded-[10px]" /></div>
            {[1,2,3,4,5].map((row) => <div key={row} className="grid grid-cols-[36px_minmax(0,1fr)_72px_60px] items-center gap-3 border-b border-mist-blue/40 px-4 py-4 last:border-0 dark:border-slate-800"><SkeletonBlock className="h-4 w-6 rounded" /><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-frost-surface text-steel-blue-gray dark:bg-slate-800 dark:text-slate-300"><Users className="h-4 w-4" /></span><div className="min-w-0 flex-1 space-y-2"><SkeletonBlock className="h-3 w-3/4 rounded" /><SkeletonBlock className="h-2.5 w-1/2 rounded" /></div></div><SkeletonBlock className="h-4 w-12 rounded" /><SkeletonBlock className="h-4 w-10 rounded" /></div>)}
          </section>
          <p className="sr-only" role="status">Loading leaderboard data</p>
        </main>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-[14px] bg-paper-white border border-mist-blue/70 p-7 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-pastel-pink-text" />
          <h1 className="mt-4 text-lg font-bold">Unable to load assessment</h1>
          <p className="mt-2 text-xs leading-relaxed text-steel-blue-gray">
            {error}
          </p>
          <Link
            href="/dashboard/teacher"
            className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-midnight-navy px-4 py-2.5 text-xs font-bold text-white transition-all hover:opacity-90"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy selection:bg-frost-surface selection:text-signal-green">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-paper-white border-b border-mist-blue/60 px-3 py-3.5 shadow-none sm:px-6 dark:border-slate-700">
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-pastel-yellow px-3 py-1 text-xs font-bold text-pastel-yellow-text shadow-xs">
            PERSISTED SNAPSHOT
          </span>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="flex items-center gap-2 rounded-[10px] bg-pastel-mint px-3.5 py-1.5 text-xs font-bold text-pastel-mint-text transition-all duration-200 border border-transparent cursor-pointer shadow-xs active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh Snapshot</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 text-left">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-signal-green">
              Leaderboard
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-midnight-navy">
              {displayCode}
            </h1>
            <p className="mt-0.5 text-xs text-steel-blue-gray font-medium">
              {quiz?.title || "Assessment Session"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-xs text-steel-blue-gray font-medium bg-paper-white border border-mist-blue/80 px-3.5 py-1.5 rounded-full shadow-xs mt-2 sm:mt-0">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-signal-green" />
              Last sync:
              <strong className="text-midnight-navy font-bold">
                {lastSync}
              </strong>
            </span>
            <span className="text-mist-blue/30">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-signal-green" />
              Mode:
              <strong className="text-midnight-navy font-bold">
                Persisted results
              </strong>
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-[12px] border border-pastel-pink/40 bg-pastel-pink/10 px-4 py-3 text-xs font-medium text-pastel-pink-text">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {[
            {
              icon: <Users className="h-4 w-4 text-signal-green" />,
              label: "Target Students",
              value: quiz?.totalStudents ?? 0,
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-pastel-mint-text" />,
              label: "Submitted",
              value: submittedCount,
            },
            {
              icon: <Clock className="h-4 w-4 text-signal-green" />,
              label: "Exam Duration",
              value: examDurationMins + "m",
            },
            {
              icon: <TrendingUp className="h-4 w-4 text-signal-green" />,
              label: "Class Avg Score",
              value: avgScore + "%",
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={mounted ? { opacity: 0, y: 8 } : false}
              animate={mounted ? { opacity: 1, y: 0 } : false}
              className="rounded-[14px] bg-paper-white p-4 sm:p-5 flex items-center gap-3 border border-[#d1dee8]/70 shadow-sm hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-frost-surface text-signal-green border border-mist-blue/20 shadow-xs">
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

        <div className="rounded-[14px] bg-paper-white border border-[#d1dee8]/70 overflow-hidden shadow-sm text-left">
          <div className="grid grid-cols-[2rem_1fr_8rem_7rem_8rem] items-center gap-4 bg-paper-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-steel-blue-gray border-b border-[#d1dee8]/40">
            <span>#</span>
            <span>Student</span>
            <span className="text-center">Progress</span>
            <span className="text-center">Score</span>
            <span className="text-center">Time Taken</span>
          </div>

          <ul className="divide-y divide-[#d1dee8]/30 bg-paper-white">
            {sorted.length === 0 ? (
              <li className="p-8 text-center text-xs text-steel-blue-gray">
                No submitted attempts are available yet.
              </li>
            ) : (
              sorted.map((student, idx) => (
                <motion.li
                  key={student.id || idx}
                  layout
                  className="grid grid-cols-[2rem_1fr_8rem_7rem_8rem] items-center gap-4 px-6 py-2.5 transition-colors hover:bg-frost-surface/30"
                >
                  <span className="text-xs font-bold font-mono text-steel-blue-gray">
                    {idx + 1}
                  </span>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-frost-surface border border-mist-blue/30 text-midnight-navy font-bold text-[10px] shadow-xs">
                      {student.avatar}
                    </div>
                    <span className="truncate text-xs font-bold text-midnight-navy">
                      {student.name}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    {student.answered == null ? (
                      <span
                        className="text-[10px] text-steel-blue-gray font-medium"
                        title="Per-question progress is not returned by the leaderboard endpoint."
                      >
                        Unavailable
                      </span>
                    ) : (
                      <>
                        <div className="h-1.5 w-full rounded-full bg-frost-surface border border-mist-blue/20 overflow-hidden">
                          <div
                            className="h-full bg-signal-green transition-all duration-500"
                            style={{
                              width: `${student.total > 0 ? Math.min(100, Math.round((student.answered / student.total) * 100)) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-steel-blue-gray font-medium">
                          {student.answered}/{student.total || 0} Q
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold min-w-[3rem] bg-pastel-mint text-pastel-mint-text shadow-xs">
                      {student.score}%
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <span className="flex items-center gap-1 rounded-full bg-pastel-lavender px-2.5 py-0.5 text-[10px] font-bold text-pastel-lavender-text shadow-xs">
                      <Clock className="h-3 w-3 text-pastel-lavender-text" />
                      {student.timeTaken}
                    </span>
                  </div>
                </motion.li>
              ))
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
