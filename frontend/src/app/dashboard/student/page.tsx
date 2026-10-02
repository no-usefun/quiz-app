"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  PlayCircle,
  CalendarDays,
  Clock,
  ChevronRight,
  Lock,
  CheckCircle2,
} from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { ApiClientError, api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { StudentSubmissionResponse } from "@/lib/types";

type Submission = StudentSubmissionResponse;

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatPercentage(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(Number(seconds))) {
    return "Time unavailable";
  }

  const safeSeconds = Math.max(0, Math.floor(Number(seconds)));

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

function normalizeSubmission(
  item: StudentSubmissionResponse,
): Submission | null {
  if (item?.attemptId == null || item?.quizId == null) {
    return null;
  }

  return {
    attemptId: Number(item.attemptId),
    quizId: Number(item.quizId),
    quizTitle: String(item.quizTitle || "Assessment Session"),
    status: item.status,
    finalScore: item.finalScore != null ? Number(item.finalScore) : null,
    totalMarks: item.totalMarks != null ? Number(item.totalMarks) : null,
    percentage: item.percentage != null ? Number(item.percentage) : null,
    totalTimeTaken:
      item.totalTimeTaken != null ? Number(item.totalTimeTaken) : null,
    startedAt: item.startedAt ?? null,
    submittedAt: item.submittedAt ?? null,
    resultsAvailable: item.resultsAvailable === true,
  };
}

export default function StudentDashboard() {
  const { user, loading: sessionLoading } = useSession();

  const [results, setResults] = useState<Submission[]>([]);

  const [loading, setLoading] = useState(true);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setLoading(true);
      setFetchError(null);

      try {
        const data = await api.get<StudentSubmissionResponse[]>(
          ENDPOINTS.student.submissions,
        );

        if (cancelled) {
          return;
        }

        const backendList = Array.isArray(data) ? data : [];

        const normalizedResults = backendList
          .map(normalizeSubmission)
          .filter((item): item is Submission => item !== null);

        setResults(normalizedResults);
        setFetchError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          setResults([]);
          setFetchError(
            "Your student session has expired. Please log in again.",
          );
          return;
        }

        setResults([]);
        setFetchError(
          error instanceof ApiClientError && error.status === 0
            ? "Quizly backend is unreachable. Start the Spring Boot server and verify NEXT_PUBLIC_API_URL."
            : error instanceof Error
              ? error.message
              : "A network error occurred while loading your submission history.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [sessionLoading]);

  const displayName =
    user?.fullName || user?.firstName || user?.name || "Student User";

  const releasedCount = results.filter(
    (result) => result.resultsAvailable,
  ).length;

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col">
      <TopNav role="student" />

      <main className="flex-1 p-4 md:p-8 space-y-6 text-left max-w-7xl mx-auto w-full">
        <section className="border-b border-[#d1dee8]/60 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716b]">
              Student Assessment Portal
            </span>

            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#111111] -tracking-wide">
              Welcome back, {displayName}
            </h1>

            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#78716b] font-medium">
              Join active exam sessions with your access credentials and view
              your submitted scorecards.
            </p>
          </div>

          <Link
            href="/join"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 transition-all hover:bg-[#0f4fd8] hover:shadow-md active:scale-[0.98] border-0"
          >
            <PlayCircle className="h-4 w-4 text-white" />
            Join Assessment
          </Link>
        </section>

        <section className="relative overflow-hidden rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 md:p-8 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 30%, rgba(22,93,251,0.06), transparent 65%)",
            }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#165dfb] shadow-xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#165dfb] opacity-60" />
                  <span className="relative inline-flex h-full w-full rounded-full bg-[#165dfb]" />
                </span>
                Active Exam Access
              </span>

              <h2 className="text-lg font-extrabold text-[#111111] -tracking-wide">
                Join a Proctored Assessment
              </h2>

              <p className="max-w-md text-xs text-[#78716b] leading-relaxed font-medium">
                Enter your Session Access Code along with your registered
                Student Roll / Registration Number to verify your environment
                and begin.
              </p>

              <Link
                href="/join"
                className="group mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 transition-all hover:bg-[#0f4fd8] hover:shadow-md active:scale-[0.98] border-0"
              >
                <PlayCircle className="h-4 w-4 text-white" />
                Join Assessment
                <ChevronRight className="h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#eef4ff] text-[#165dfb] ring-1 ring-[#165dfb]/10 shadow-xs">
              <ClipboardList className="h-6 w-6 text-[#165dfb]" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="group rounded-[14px] border border-[#d1dee8]/70 bg-white p-5 flex items-center gap-3.5 shadow-sm transition-all hover:border-[#b9cbd9] hover:shadow-md hover:-translate-y-[1px] duration-200">
            <div className="rounded-[10px] p-2.5 bg-[#eef4ff] text-[#165dfb] ring-1 ring-[#165dfb]/10 shadow-xs">
              <ClipboardList className="h-4 w-4 text-[#165dfb]" />
            </div>

            <div>
              <p className="text-2xl font-extrabold leading-none text-[#111111] tabular-nums">
                {loading ? (
                  <span className="inline-block h-6 w-10 animate-pulse rounded bg-[#e7e5e4] align-middle" />
                ) : (
                  results.length
                )}
              </p>

              <p className="mt-1.5 text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                Tests Submitted
              </p>
            </div>
          </div>

          <div className="group rounded-[14px] border border-[#d1dee8]/70 bg-white p-5 flex items-center gap-3.5 shadow-sm transition-all hover:border-[#b9cbd9] hover:shadow-md hover:-translate-y-[1px] duration-200">
            <div className="rounded-[10px] p-2.5 bg-[#e2ede8] text-[#1d5237] ring-1 ring-[#1d5237]/10 shadow-xs">
              <CheckCircle2 className="h-4 w-4 text-[#1d5237]" />
            </div>

            <div>
              <p className="text-2xl font-extrabold leading-none text-[#111111] tabular-nums">
                {loading ? (
                  <span className="inline-block h-6 w-10 animate-pulse rounded bg-[#e7e5e4] align-middle" />
                ) : (
                  releasedCount
                )}
              </p>

              <p className="mt-1.5 text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                Released Grades
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-bold text-[#111111] uppercase tracking-wider">
            <span className="h-3.5 w-1 rounded-full bg-[#165dfb]" />
            Recent Assessments
            <span className="rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-[10px] font-bold text-[#165dfb]">
              {results.length}
            </span>
          </h2>

          <div className="rounded-[14px] bg-white border border-[#d1dee8]/70 overflow-hidden shadow-sm">
            <ul className="divide-y divide-[#d1dee8]/50">
              {loading ? (
                <li className="flex items-center justify-center gap-2 p-8 text-center text-xs font-medium text-[#78716b]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#d1dee8] border-t-[#165dfb]" />
                  Loading submissions...
                </li>
              ) : fetchError ? (
                <li className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#a8a29d] ring-1 ring-[#d1dee8]/80 shadow-xs">
                    <ClipboardList className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#111111]">
                      Unable to load results history
                    </p>

                    <p className="mt-1 text-xs text-[#78716b] font-medium max-w-xs mx-auto leading-relaxed">
                      {fetchError}
                    </p>
                  </div>
                </li>
              ) : results.length === 0 ? (
                <li className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#a8a29d] ring-1 ring-[#d1dee8]/80 shadow-xs">
                    <ClipboardList className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#111111]">
                      No assessments taken yet
                    </p>

                    <p className="mt-1 text-xs text-[#78716b] font-medium max-w-xs mx-auto leading-relaxed">
                      Your recent submitted assessments will appear here. Join
                      your first assessment using the session code provided by
                      your instructor.
                    </p>
                  </div>

                  <Link
                    href="/join"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 transition-all hover:bg-[#0f4fd8] hover:shadow-md active:scale-[0.98] border-0"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-white" />
                    Join an Assessment
                  </Link>
                </li>
              ) : (
                results.map((result) => {
                  const score = formatPercentage(result.percentage);

                  const dateLabel = formatDate(result.submittedAt);

                  if (result.resultsAvailable) {
                    return (
                      <li key={result.attemptId}>
                        <Link
                          href={`/dashboard/student/result/${result.attemptId}`}
                          className="relative flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#f8fafc] group before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-r before:bg-[#165dfb] before:opacity-0 before:transition-opacity hover:before:opacity-100"
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate text-xs font-bold text-[#111111] group-hover:text-[#165dfb] transition-colors">
                              {result.quizTitle}
                            </span>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#78716b] font-medium">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3 text-[#a8a29d]" />
                                {dateLabel}
                              </span>

                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-[#a8a29d]" />
                                {formatDuration(result.totalTimeTaken)}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {score != null ? (
                              <span className="rounded-full bg-[#e2ede8] px-2.5 py-1 text-[10px] font-bold text-[#1d5237] tabular-nums shadow-xs">
                                {score}%
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#f6efe1] px-2.5 py-1 text-[10px] font-bold text-[#73561a] shadow-xs">
                                Result pending
                              </span>
                            )}

                            <ChevronRight className="h-3.5 w-3.5 text-[#c9c5c2] transition-all group-hover:translate-x-0.5 group-hover:text-[#165dfb]" />
                          </div>
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={result.attemptId}>
                      <div className="flex items-center justify-between gap-4 px-5 py-4 cursor-not-allowed bg-[#fbfbfa]">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-[#78716b]">
                              {result.quizTitle}
                            </span>

                            <span className="rounded-full bg-[#ece9f3] px-2 py-0.5 text-[9px] font-bold text-[#4c3d73] shadow-xs">
                              Locked
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#a8a29d] font-medium">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 text-[#c9c5c2]" />
                              {dateLabel}
                            </span>

                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-[#c9c5c2]" />
                              {formatDuration(result.totalTimeTaken)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f6efe1] px-2.5 py-1 text-[9px] font-bold text-[#73561a] shadow-xs">
                            <Lock className="h-3 w-3 text-[#73561a]" />
                            Pending Results
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
