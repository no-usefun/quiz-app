"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  Lock,
  Trophy,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Award,
} from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { ApiClientError, api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { LeaderboardEntryResponse } from "@/lib/types";

function formatTime(seconds: number | null | undefined): string {
  const safe = Math.max(0, Math.floor(Number(seconds ?? 0)));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function formatScore(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function StudentLeaderboardPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = use(params);
  const [entries, setEntries] = useState<LeaderboardEntryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboardLocked, setLeaderboardLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const numericQuizId = Number(quizId);
  const { user } = useSession();
  const currentStudentId = Number(user?.id ?? user?.userId);

  const load = useCallback(async (background = false) => {
    if (!Number.isInteger(numericQuizId) || numericQuizId <= 0) {
      setLeaderboardLocked(false);
      setError("The leaderboard URL contains an invalid quiz ID.");
      setLoading(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setLeaderboardLocked(false);
      const data = await api.get<LeaderboardEntryResponse[]>(
        ENDPOINTS.student.leaderboard(numericQuizId),
      );

      const list = Array.isArray(data) ? data : [];
      setEntries(
        [...list].sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank;
          if (b.percentage !== a.percentage) return b.percentage - a.percentage;
          return a.totalTimeTaken - b.totalTimeTaken;
        }),
      );
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError("Your student session has expired. Please log in again.");
      } else if (
        err instanceof ApiClientError &&
        err.status === 400 &&
        ["LEADERBOARD_NOT_AVAILABLE", "RESULTS_NOT_PUBLISHED"].includes(
          String(err.errorCode || "").toUpperCase(),
        )
      ) {
        setEntries([]);
        setLeaderboardLocked(true);
        setError(
          String(err.errorCode || "").toUpperCase() === "RESULTS_NOT_PUBLISHED"
            ? "The instructor has not published the leaderboard yet."
            : "The instructor has not enabled the leaderboard for this assessment yet.",
        );
      } else if (err instanceof ApiClientError && err.status === 0) {
        setError(
          "Quizly backend is unreachable. Start the Spring Boot server and verify NEXT_PUBLIC_API_URL.",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to load the leaderboard.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [numericQuizId]);

  useEffect(() => {
    // This starts an asynchronous API request; its state updates occur as the
    // request resolves, rather than synchronously deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const podium = useMemo(() => entries.slice(0, 3), [entries]);

  const scoreStats = useMemo(() => {
    if (entries.length === 0) {
      return { average: 0, highest: 0, median: 0, completed: 0, distribution: [] as { label: string; min: number; max: number; count: number; color: string }[] };
    }

    const percentages = entries.map((entry) => Math.min(100, Math.max(0, Number(entry.percentage) || 0)));
    const average = percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
    const distribution = [
      { label: "0–20%", min: 0, max: 20, color: "bg-[#fca5a5]" },
      { label: "21–40%", min: 20, max: 40, color: "bg-[#fdba74]" },
      { label: "41–60%", min: 40, max: 60, color: "bg-[#fcd34d]" },
      { label: "61–80%", min: 60, max: 80, color: "bg-[#86b7ff]" },
      { label: "81–100%", min: 80, max: 100, color: "bg-[#6ee7b7]" },
    ].map((band, index) => ({
      label: band.label,
      min: band.min,
      max: band.max,
      color: band.color,
      count: percentages.filter((value) =>
        index === 0
          ? value >= band.min && value <= band.max
          : value > band.min && value <= band.max,
      ).length,
    }));

    const sortedPercentages = [...percentages].sort((a, b) => a - b);
    const middle = Math.floor(sortedPercentages.length / 2);
    const median = sortedPercentages.length % 2 === 0
      ? (sortedPercentages[middle - 1] + sortedPercentages[middle]) / 2
      : sortedPercentages[middle];

    return {
      average,
      highest: Math.max(...percentages),
      median,
      completed: entries.length,
      distribution,
    };
  }, [entries]);

  const currentEntry = useMemo(() => {
    if (!Number.isFinite(currentStudentId)) return undefined;
    return entries.find((entry) => Number(entry.studentId) === currentStudentId);
  }, [entries, currentStudentId]);

  const comparison = useMemo(() => {
    if (!currentEntry || entries.length === 0) return null;
    const difference = Number(currentEntry.percentage ?? 0) - scoreStats.average;
    const status = Math.abs(difference) <= 3
      ? "Around the cohort average"
      : difference > 0
        ? "Above the cohort average"
        : "Below the cohort average";
    const message = Math.abs(difference) <= 3
      ? "Your score is close to the cohort average."
      : `${Math.abs(difference).toFixed(1)} percentage points ${difference > 0 ? "above" : "below"} the cohort average.`;
    return { difference, status, message };
  }, [currentEntry, entries.length, scoreStats.average]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      (entry.studentName || "Student").toLowerCase().includes(query) ||
      String(entry.rank).includes(query) ||
      String(entry.percentage).includes(query),
    );
  }, [entries, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNav role="student" />
        <main className="flex min-h-[70vh] items-center justify-center p-6 text-sm font-medium text-slate-500">
          Loading leaderboard...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <TopNav role="student" />

      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <Link
              href="/dashboard/student"
              className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#165dfb]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Student Dashboard
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Assessment Leaderboard
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Rankings published by the instructor for quiz #{quizId}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-xs transition-all hover:border-[#165dfb] hover:text-[#165dfb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>

        {error && leaderboardLocked ? (
          <div className="flex items-start gap-3 rounded-[12px] border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500 shadow-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-500">
              <Lock className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-900">Leaderboard Locked</p>
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-[#8c381c]/25 bg-[#fbeee8] p-4 text-xs font-semibold text-[#8c381c]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {currentEntry && comparison && (
          <section className="rounded-[14px] border border-[#165dfb]/25 bg-[#eef4ff] p-5 shadow-sm dark:border-blue-400/40 dark:bg-blue-950/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#165dfb] dark:text-blue-300">Your performance</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {comparison.status}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Ranked #{currentEntry.rank} of {entries.length} students. {comparison.message}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:min-w-56">
                <div className="rounded-[10px] border border-blue-200/70 bg-white/80 p-3 dark:border-blue-900 dark:bg-slate-900/80">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Your score</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{formatScore(currentEntry.percentage)}%</p>
                </div>
                <div className="rounded-[10px] border border-blue-200/70 bg-white/80 p-3 dark:border-blue-900 dark:bg-slate-900/80">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Cohort average</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{scoreStats.average.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {entries.length > 0 && (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Participants", value: scoreStats.completed.toLocaleString(), hint: "Ranked students", icon: Users, tone: "text-[#165dfb]", surface: "bg-[#e8f0ff]" },
                { label: "Average score", value: `${scoreStats.average.toFixed(1)}%`, hint: "Across participants", icon: TrendingUp, tone: "text-[#1d5237]", surface: "bg-[#e2ede8]" },
                { label: "Highest score", value: `${scoreStats.highest.toFixed(1)}%`, hint: "Top performance", icon: Award, tone: "text-[#92400e]", surface: "bg-[#fff0d8]" },
                { label: "Median score", value: `${scoreStats.median.toFixed(1)}%`, hint: "Middle participant score", icon: Trophy, tone: "text-[#6b21a8]", surface: "bg-[#f3e8ff]" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${stat.surface} ${stat.tone}`}>
                      <stat.icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">{stat.hint}</p>
                </div>
              ))}
            </section>

            <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Score distribution</h2>
                  <p className="mt-1 text-xs text-slate-500">How published participant scores are spread across percentage bands.</p>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Based on {scoreStats.completed} ranked students</span>
              </div>
              <div className="grid grid-cols-5 items-end gap-2 sm:gap-4">
                {scoreStats.distribution.map((band, bandIndex) => {
                  const studentScore = Number(currentEntry?.percentage);
                  const isStudentBand = Boolean(currentEntry) && (bandIndex === 0
                    ? studentScore >= band.min && studentScore <= band.max
                    : studentScore > band.min && studentScore <= band.max);
                  const maxCount = Math.max(1, ...scoreStats.distribution.map((item) => item.count));
                  const height = band.count === 0 ? 4 : Math.max(12, (band.count / maxCount) * 112);
                  return (
                    <div key={band.label} className="flex min-w-0 flex-col items-center gap-2">
                      <span className={`text-xs font-bold tabular-nums ${isStudentBand ? "text-[#165dfb] dark:text-blue-300" : "text-[#44403c] dark:text-slate-200"}`}>{band.count}{isStudentBand ? " · You" : ""}</span>
                      <div className="flex h-28 w-full items-end justify-center rounded-t-[8px] bg-slate-50">
                        <div className={`w-full max-w-16 rounded-t-[7px] ${isStudentBand ? "bg-[#165dfb] dark:bg-blue-400" : `${band.color} dark:bg-slate-600`} transition-[height] duration-500 ease-out`} style={{ height: `${height}px` }} />
                      </div>
                      <span className={`text-center text-[9px] font-bold sm:text-[10px] ${isStudentBand ? "text-[#165dfb] dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`}>{band.label}{isStudentBand ? " · You" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {entries.length === 0 ? (
          <div className="rounded-[14px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            {leaderboardLocked ? (
              <>
                <Lock className="mx-auto h-9 w-9 text-[#a8a29d]" />
                <h2 className="mt-3 text-sm font-bold">Rankings Not Released</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Your instructor has not released the leaderboard for this assessment yet.
                </p>
              </>
            ) : (
              <>
                <Trophy className="mx-auto h-9 w-9 text-[#a8a29d]" />
                <h2 className="mt-3 text-sm font-bold">No rankings yet</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  The leaderboard is published, but there are no rankings to display yet.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              {podium.map((entry) => (
                <div
                  key={entry.studentId}
                  className={`rounded-[14px] border p-5 shadow-sm ${Number(entry.studentId) === currentStudentId ? "border-[#165dfb] bg-[#eef4ff]/80 ring-1 ring-[#165dfb]/30 dark:border-blue-400 dark:bg-blue-950/40" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff] text-xs font-extrabold text-[#165dfb]">
                      #{entry.rank}
                    </span>
                    {Number(entry.studentId) === currentStudentId && <span className="rounded-full bg-[#165dfb] px-2 py-1 text-[9px] font-extrabold tracking-wide text-white">YOU</span>}
                    <Trophy className="h-4 w-4 text-[#73561a] dark:text-amber-300" />
                  </div>
                  <p className="mt-4 truncate text-sm font-extrabold">
                    {entry.studentName || "Student"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {formatScore(entry.score)} / {formatScore(entry.totalMarks)}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-[#e2ede8] px-2.5 py-1 text-[10px] font-bold text-[#1d5237]">
                      {formatScore(entry.percentage)}%
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.totalTimeTaken)}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#d1dee8]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Full rankings</h2>
                  <p className="mt-1 text-[10px] text-slate-500">{filteredEntries.length} of {entries.length} students</p>
                </div>
                <label className="relative block w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8a29e]" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search student or rank..." aria-label="Search leaderboard" className="h-10 w-full rounded-[10px] border border-[#d1dee8] bg-[#fbfbfa] pl-9 pr-3 text-xs outline-none transition focus:border-[#165dfb] focus:ring-2 focus:ring-[#165dfb]/10" />
                </label>
              </div>
              <div className="overflow-x-auto">
              <div className="min-w-[620px]">
              <div className="grid grid-cols-[4rem_1fr_8rem_8rem] gap-3 border-b border-[#d1dee8]/40 bg-[#fbfbfa] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span>Rank</span>
                <span>Student</span>
                <span className="text-center">Score</span>
                <span className="text-center">Time</span>
              </div>

              <ul className="divide-y divide-[#d1dee8]/40">
                {filteredEntries.map((entry) => (
                  <li
                    key={entry.studentId}
                    className={`grid grid-cols-[4rem_1fr_8rem_8rem] items-center gap-3 px-5 py-3.5 transition-colors ${Number(entry.studentId) === currentStudentId ? "bg-[#eef4ff] ring-1 ring-inset ring-[#165dfb]/50 dark:bg-blue-950/50 dark:ring-blue-400/50" : "hover:bg-[#f8fafc] dark:hover:bg-slate-800"}`}
                  >
                    <span className="font-mono text-xs font-bold text-slate-500">
                      #{entry.rank}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{entry.studentName}{Number(entry.studentId) === currentStudentId && <span className="ml-2 inline-flex rounded-full bg-[#165dfb] px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-white">YOU</span>}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-[#a8a29d]">
                        {formatScore(entry.percentage)}%
                      </p>
                    </div>
                    <span className="text-center text-xs font-bold">
                      {formatScore(entry.score)} / {formatScore(entry.totalMarks)}
                    </span>
                    <span className="flex items-center justify-center gap-1 text-[10px] font-mono font-semibold text-slate-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.totalTimeTaken)}
                    </span>
                  </li>
                ))}
              </ul>
              {filteredEntries.length === 0 && (
                <p className="px-5 py-10 text-center text-xs font-medium text-slate-500">No students match “{searchQuery}”.</p>
              )}
              </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
