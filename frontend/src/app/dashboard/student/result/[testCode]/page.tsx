"use client";

import { use, useEffect, useState } from "react";

import Link from "next/link";

import { motion } from "framer-motion";

import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  CalendarDays,
  ChevronRight,
  Lock,
  FileQuestion,
} from "lucide-react";

import { Logo } from "@/components/Logo";

import { ApiClientError, api } from "@/lib/api/client";

import { ENDPOINTS } from "@/lib/api/endpoints";

import type {
  AttemptResultResponse,
  AttemptResultDetailResponse,
} from "@/lib/types";

type AttemptResult = AttemptResultResponse;
type ResultDetail = AttemptResultDetailResponse;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${minutes}m ${secs}s`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatNumber(value: unknown, fallback = 0): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function formatDisplayNumber(value: unknown): string {
  const n = formatNumber(value);

  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatOptionIds(ids: Array<number | string> | undefined) {
  if (!ids || ids.length === 0) {
    return "Not answered";
  }

  return ids.join(", ");
}

function ScoreRing({ score }: { score: number }) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const safeScore = Math.max(0, Math.min(100, score || 0));
  const dash = (safeScore / 100) * circ;

  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      className="-rotate-90"
      aria-label={`Score ${safeScore}%`}
    >
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="12"
      />

      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="#1d5237"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{
          transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </svg>
  );
}

export default function StudentResultPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  const [result, setResult] = useState<AttemptResult | null>(null);

  const [details, setDetails] = useState<ResultDetail[]>([]);

  const [detailsAvailable, setDetailsAvailable] = useState(false);

  const [loading, setLoading] = useState(true);

  const [mounted, setMounted] = useState(false);

  const [pendingRelease, setPendingRelease] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    let cancelled = false;

    const fetchResult = async () => {
      const attemptId = String(testCode || "").trim();

      if (!/^\d+$/.test(attemptId)) {
        setResult(null);
        setDetails([]);
        setDetailsAvailable(false);
        setPendingRelease(false);
        setError("The result URL must contain a valid attempt ID.");
        setLoading(false);
        return;
      }

      try {
        const resultData = await api.get<AttemptResultResponse>(
          ENDPOINTS.student.attemptResult(attemptId),
        );

        if (!resultData) {
          throw new Error("The server returned an invalid result response.");
        }

        const normalized: AttemptResult = {
          ...resultData,
          attemptId: Number(resultData.attemptId),
          quizId: Number(resultData.quizId),
          quizTitle: String(resultData.quizTitle ?? "Assessment Results"),
          status: String(
            resultData.status ?? "SUBMITTED",
          ).toUpperCase() as AttemptResult["status"],
          finalScore: formatNumber(resultData.finalScore),
          totalMarks: formatNumber(resultData.totalMarks),
          percentage: formatNumber(
            resultData.percentage,
            formatNumber(resultData.totalMarks) > 0
              ? (formatNumber(resultData.finalScore) /
                  formatNumber(resultData.totalMarks)) *
                  100
              : 0,
          ),
          totalTimeTaken: formatNumber(resultData.totalTimeTaken),
          startedAt: resultData.startedAt,
          submittedAt: resultData.submittedAt,
        };

        let detailList: ResultDetail[] = [];

        try {
          const detailData = await api.get<AttemptResultDetailResponse[]>(
            ENDPOINTS.student.attemptResultDetails(attemptId),
          );

          if (Array.isArray(detailData)) {
            detailList = detailData.map((item) => ({
              ...item,
              questionId: Number(item.questionId),
              questionText: String(item.questionText ?? ""),
              displayOrder: Number(item.displayOrder ?? 0),
              selectedOptionIds: Array.isArray(item.selectedOptionIds)
                ? item.selectedOptionIds.map(Number)
                : [],
              correctOptionIds: Array.isArray(item.correctOptionIds)
                ? item.correctOptionIds.map(Number)
                : [],
              marksAwarded: formatNumber(item.marksAwarded),
              questionMarks: formatNumber(item.questionMarks),
              responseTimeSeconds:
                item.responseTimeSeconds != null
                  ? Number(item.responseTimeSeconds)
                  : null,
            }));
          }
        } catch (detailsError) {
          if (
            detailsError instanceof ApiClientError &&
            detailsError.status === 401
          ) {
            throw detailsError;
          }

          console.info(
            "[Student Result] Question-wise details unavailable:",
            detailsError,
          );
        }

        if (!cancelled) {
          setResult(normalized);
          setDetails(detailList);
          setDetailsAvailable(detailList.length > 0);
          setPendingRelease(false);
          setError(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("[Student Result] Result lookup error:", error);

        if (error instanceof ApiClientError && error.status === 401) {
          setResult(null);
          setDetails([]);
          setDetailsAvailable(false);
          setPendingRelease(false);
          setError("Your student session has expired. Please log in again.");
          setLoading(false);
          return;
        }

        if (
          error instanceof ApiClientError &&
          error.status === 400 &&
          String(error.errorCode || "").toUpperCase() ===
            "RESULTS_NOT_PUBLISHED"
        ) {
          setResult(null);
          setDetails([]);
          setDetailsAvailable(false);
          setPendingRelease(true);
          setError(null);
          setLoading(false);
          return;
        }

        setResult(null);
        setDetails([]);
        setDetailsAvailable(false);
        setPendingRelease(false);
        setError(
          getErrorMessage(
            error,
            "We couldn't retrieve this assessment result from the server.",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchResult();

    return () => {
      cancelled = true;
    };
  }, [testCode]);

  const correctCount = details.filter((detail) => detail.correct).length;

  const totalQuestions = details.length;

  const accuracy =
    totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100)
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] flex items-center justify-center text-xs font-semibold text-[#78716b]">
        Loading assessment results...
      </div>
    );
  }

  if (error && !result && !pendingRelease) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-sm space-y-4"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] border border-[#d1dee8]/80 text-[#78716b] shadow-xs">
            <FileQuestion className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Result unavailable
            </span>

            <h1 className="text-xl font-black text-[#111111]">
              Unable to Load Result
            </h1>

            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              {error}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/dashboard/student"
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#0f4fd8] active:scale-[0.98] shadow-sm shadow-[#165dfb]/20 transition-all border-0"
            >
              Return to Dashboard
              <ChevronRight className="h-3.5 w-3.5 text-white" />
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  if (pendingRelease) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{
            duration: 0.25,
            ease: "easeOut",
          }}
          className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-sm space-y-5"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] border border-[#8c381c]/30 text-[#8c381c] shadow-xs">
            <Lock className="h-6 w-6" />
          </div>

          <div className="text-center space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f4] border border-[#d1dee8]/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] shadow-xs">
              Pending Instructor Release
            </span>

            <h1 className="text-xl font-black text-[#111111]">
              Assessment Submitted Successfully
            </h1>

            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              Your result is recorded, but the instructor has not published the
              results yet.
            </p>
          </div>

          <div className="rounded-[10px] bg-[#f5f5f4] border border-[#d1dee8]/80 p-3.5 text-xs space-y-1.5 font-medium text-[#78716b] shadow-xs">
            <div className="flex justify-between gap-3">
              <span>Attempt ID:</span>

              <strong className="font-mono text-[#111111]">{testCode}</strong>
            </div>
          </div>

          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#111111] py-2.5 text-xs font-bold text-white hover:bg-[#222222] active:scale-[0.98] shadow-sm transition-all border-0"
          >
            Return to Student Dashboard
            <ChevronRight className="h-3.5 w-3.5 text-white" />
          </Link>
        </motion.div>
      </main>
    );
  }

  if (!result) {
    return null;
  }

  const percentage = result.percentage;
  const canRevealSolutions = detailsAvailable;

  const gc = {
    text: "text-[#1d5237]",
    bg: "bg-[#e2ede8]",
    ring: "#1d5237",
  };

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] selection:bg-[#e6e3e2] selection:text-[#165dfb]">
      <nav className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-[#d1dee8]/70 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 text-xs font-bold text-[#78716b] hover:text-[#111111] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <span className="text-[#d1dee8]">|</span>

          <Logo />
        </div>

        <span className="rounded-full bg-[#f5f5f4] border border-[#d1dee8]/80 px-3 py-1 font-mono text-xs font-bold text-[#111111] shadow-xs">
          Attempt #{result.attemptId}
        </span>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-left">
        <section>
          <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
            Verified Assessment Performance
          </span>

          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#111111]">
            {result.quizTitle}
          </h1>

          <p className="mt-0.5 text-xs text-[#78716b] font-medium flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-[#78716b]" />
            Submitted: {formatDateTime(result.submittedAt)}
          </p>
        </section>

        <section className="rounded-[14px] bg-white p-6 border border-[#d1dee8]/70 shadow-sm">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <ScoreRing score={percentage} />

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className={`text-2xl font-black tracking-tight tabular-nums ${gc.text}`}
                >
                  {formatDisplayNumber(percentage)}%
                </span>

                <span className="text-[9px] font-bold text-[#78716b] uppercase tracking-wider mt-0.5">
                  Percentage
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3.5 w-full">
              <div>
                <p className="text-xs text-[#111111] font-medium">
                  {totalQuestions > 0 ? (
                    <>
                      You answered{" "}
                      <strong className="font-bold">
                        {correctCount} / {totalQuestions}
                      </strong>{" "}
                      questions correctly.
                    </>
                  ) : (
                    <>
                      Your final score is{" "}
                      <strong className="font-bold">
                        {formatDisplayNumber(result.finalScore)} /{" "}
                        {formatDisplayNumber(result.totalMarks)}
                      </strong>
                      .
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="rounded-[12px] border border-[#d1dee8]/70 bg-white p-3 text-center shadow-xs">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#165dfb] shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-base font-black text-[#111111]">
                    {accuracy != null ? `${accuracy}%` : "—"}
                  </p>

                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Accuracy
                  </p>
                </div>

                <div className="rounded-[12px] border border-[#d1dee8]/70 bg-white p-3 text-center shadow-xs">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#1d5237] shadow-xs">
                    <Award className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-base font-black text-[#111111]">
                    {formatDisplayNumber(result.finalScore)} /{" "}
                    {formatDisplayNumber(result.totalMarks)}
                  </p>

                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Score
                  </p>
                </div>

                <div className="rounded-[12px] border border-[#d1dee8]/70 bg-white p-3 text-center shadow-xs">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#111111] shadow-xs">
                    <Clock className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-base font-black text-[#111111]">
                    {formatTime(result.totalTimeTaken)}
                  </p>

                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Total Time
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {canRevealSolutions && details.length > 0 ? (
          <section className="space-y-2.5">
            <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Question Breakdown &amp; Solutions
            </h2>

            <div className="rounded-[14px] bg-white border border-[#d1dee8]/70 overflow-hidden divide-y divide-[#d1dee8]/40 shadow-sm">
              {[...details]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((detail, idx) => (
                  <div
                    key={`${detail.questionId}-${idx}`}
                    className="p-4 sm:p-5 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-[#111111] leading-snug">
                        {idx + 1}. {detail.questionText || "Question"}
                      </p>

                      {detail.correct ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e2ede8] text-[#1d5237] px-2.5 py-0.5 text-[10px] font-bold shrink-0 shadow-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeee8] text-[#8c381c] px-2.5 py-0.5 text-[10px] font-bold shrink-0 shadow-xs">
                          <XCircle className="h-3 w-3" />
                          Incorrect
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-[10px] bg-[#f5f5f4] p-2.5 border border-[#d1dee8]/80 shadow-xs">
                        <span className="text-[#78716b] block text-[9px] uppercase font-bold">
                          Your Selected Option IDs:
                        </span>

                        <span className="font-semibold text-[#111111]">
                          {formatOptionIds(detail.selectedOptionIds)}
                        </span>
                      </div>

                      <div className="rounded-[10px] bg-[#e2ede8]/60 p-2.5 border border-[#1d5237]/20 shadow-xs">
                        <span className="text-[#1d5237] block text-[9px] uppercase font-bold">
                          Correct Option IDs:
                        </span>

                        <span className="font-bold text-[#1d5237]">
                          {formatOptionIds(detail.correctOptionIds)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-[10px] text-[#78716b] font-medium">
                      <span>
                        Marks:{" "}
                        <strong className="text-[#111111]">
                          {formatDisplayNumber(detail.marksAwarded)} /{" "}
                          {formatDisplayNumber(detail.questionMarks)}
                        </strong>
                      </span>

                      {detail.responseTimeSeconds != null && (
                        <span>
                          Response time:{" "}
                          <strong className="text-[#111111]">
                            {formatTime(detail.responseTimeSeconds)}
                          </strong>
                        </span>
                      )}

                      {detail.answerStatus && (
                        <span>
                          Status:{" "}
                          <strong className="text-[#111111]">
                            {detail.answerStatus}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : (
          <section className="rounded-[14px] bg-white border border-[#d1dee8]/70 p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#78716b] shadow-xs">
                <FileQuestion className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-[#111111]">
                  Question Solutions Locked
                </h3>

                <p className="text-[10px] text-[#78716b] font-medium">
                  Detailed question-wise results have not been released for this
                  assessment.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="flex justify-end pt-2">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0f4fd8] active:scale-[0.98] transition-all border-0 shadow-sm shadow-[#165dfb]/20"
          >
            Return to Dashboard
            <ChevronRight className="h-4 w-4 text-white" />
          </Link>
        </section>
      </main>
    </div>
  );
}
