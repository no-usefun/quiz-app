"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  Trophy,
  RefreshCw,
} from "lucide-react";

import { TopNav } from "@/components/TopNav";
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

  const numericQuizId = Number(quizId);

  const load = async (background = false) => {
    if (!Number.isInteger(numericQuizId) || numericQuizId <= 0) {
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
  };

  useEffect(() => {
    void load();
  }, [quizId]);

  const podium = useMemo(() => entries.slice(0, 3), [entries]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f4]">
        <TopNav role="student" />
        <main className="flex min-h-[70vh] items-center justify-center p-6 text-sm font-medium text-[#78716b]">
          Loading leaderboard...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111]">
      <TopNav role="student" />

      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
        <div className="flex items-center justify-between gap-3 border-b border-[#d1dee8]/60 pb-4">
          <div>
            <Link
              href="/dashboard/student"
              className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] hover:text-[#165dfb]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Student Dashboard
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Assessment Leaderboard
            </h1>
            <p className="mt-1 text-xs font-medium text-[#78716b]">
              Rankings published by the instructor for quiz #{quizId}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8]/80 bg-white px-3.5 py-2 text-xs font-bold text-[#111111] shadow-xs transition-all hover:border-[#165dfb] hover:text-[#165dfb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-[12px] border border-[#8c381c]/25 bg-[#fbeee8] p-4 text-xs font-semibold text-[#8c381c]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-10 text-center shadow-sm">
            <Trophy className="mx-auto h-9 w-9 text-[#a8a29d]" />
            <h2 className="mt-3 text-sm font-bold">No published rankings</h2>
            <p className="mt-1 text-xs font-medium text-[#78716b]">
              The leaderboard may be empty or has not been released yet.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              {podium.map((entry) => (
                <div
                  key={entry.studentId}
                  className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff] text-xs font-extrabold text-[#165dfb]">
                      #{entry.rank}
                    </span>
                    <Trophy className="h-4 w-4 text-[#73561a]" />
                  </div>
                  <p className="mt-4 truncate text-sm font-extrabold">
                    {entry.studentName || "Student"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#78716b]">
                    {formatScore(entry.score)} / {formatScore(entry.totalMarks)}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-[#e2ede8] px-2.5 py-1 text-[10px] font-bold text-[#1d5237]">
                      {formatScore(entry.percentage)}%
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#78716b]">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.totalTimeTaken)}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-[14px] border border-[#d1dee8]/70 bg-white shadow-sm">
              <div className="grid grid-cols-[4rem_1fr_8rem_8rem] gap-3 border-b border-[#d1dee8]/40 bg-[#fbfbfa] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                <span>Rank</span>
                <span>Student</span>
                <span className="text-center">Score</span>
                <span className="text-center">Time</span>
              </div>

              <ul className="divide-y divide-[#d1dee8]/40">
                {entries.map((entry) => (
                  <li
                    key={entry.studentId}
                    className="grid grid-cols-[4rem_1fr_8rem_8rem] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#f8fafc]"
                  >
                    <span className="font-mono text-xs font-bold text-[#78716b]">
                      #{entry.rank}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{entry.studentName}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-[#a8a29d]">
                        {formatScore(entry.percentage)}%
                      </p>
                    </div>
                    <span className="text-center text-xs font-bold">
                      {formatScore(entry.score)} / {formatScore(entry.totalMarks)}
                    </span>
                    <span className="flex items-center justify-center gap-1 text-[10px] font-mono font-semibold text-[#78716b]">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.totalTimeTaken)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
