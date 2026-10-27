"use client";

import { use, useEffect, useState, useSyncExternalStore } from "react";

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
  Trophy,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

import { ApiClientError, api } from "@/lib/api/client";

import { ENDPOINTS } from "@/lib/api/endpoints";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

import type {
  AttemptResultResponse,
  AttemptResultDetailResponse,
} from "@/lib/types";

type AttemptResult = AttemptResultResponse;
type ResultDetail = AttemptResultDetailResponse;

type LocalScoringSnapshot = {
  negativeMarking: boolean;
  questions: Record<number, { marks: number; negativeMarks: number | null }>;
};

type PendingSubmitRecovery = {
  answers: Record<number, number[]>;
  scoring?: LocalScoringSnapshot;
};

function readPendingSubmitRecovery(attemptId: string): PendingSubmitRecovery | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(`dynoquizz_pending_submit_${attemptId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.answers || typeof parsed.answers !== "object") return null;

    const answers = Object.entries(
      parsed.answers as Record<string, unknown>,
    ).reduce<Record<number, number[]>>((result, [rawQuestionId, rawOptionIds]) => {
      const questionId = Number(rawQuestionId);
      if (!Number.isFinite(questionId) || questionId <= 0 || !Array.isArray(rawOptionIds)) {
        return result;
      }

      result[questionId] = rawOptionIds
        .map(Number)
        .filter((optionId) => Number.isFinite(optionId) && optionId > 0);
      return result;
    }, {});

    let scoring: LocalScoringSnapshot | undefined;
    const candidate = parsed.scoring;
    if (
      candidate &&
      typeof candidate.negativeMarking === "boolean" &&
      candidate.questions &&
      typeof candidate.questions === "object"
    ) {
      scoring = candidate as LocalScoringSnapshot;
    }

    return { answers, scoring };
  } catch {
    return null;
  }
}

function sameOptionSet(selectedIds: number[], correctIds: number[]): boolean {
  if (selectedIds.length === 0 || selectedIds.length !== correctIds.length) return false;
  const selected = new Set(selectedIds);
  return selected.size === correctIds.length && correctIds.every((id) => selected.has(id));
}

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

function formatOptionTexts(
  texts: string[] | undefined,
  questionId: number,
  ids: Array<number | string> | undefined,
  optionTextByQuestion: Record<number, Record<number, string>>,
) {
  /*
   * Backend-provided option text is authoritative for historical results.
   * The local snapshot is used only as a compatibility fallback when an older
   * response does not contain the new text arrays.
   */
  if (Array.isArray(texts)) {
    return texts
      .map((text) => String(text ?? "").trim())
      .filter(Boolean);
  }

  if (!ids || ids.length === 0) {
    return [];
  }

  return ids.map((rawId) => {
    const optionId = Number(rawId);
    return (
      optionTextByQuestion[questionId]?.[optionId] ||
      `Option ${optionId}`
    );
  });
}

function readOptionTextSnapshot(
  attemptId: string,
  quizId: number,
): Record<number, Record<number, string>> {
  if (typeof window === "undefined") {
    return {};
  }

  const keys = [
    `dynoquizz_option_texts_attempt_${attemptId}`,
    `dynoquizz_option_texts_quiz_${quizId}`,
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      // The parsed snapshot is now in memory. Drop the attempt-scoped copy;
      // the quiz-scoped compatibility snapshot remains available if needed.
      if (key.startsWith("dynoquizz_option_texts_attempt_")) {
        localStorage.removeItem(key);
      }

      return Object.entries(parsed as Record<string, unknown>).reduce<
        Record<number, Record<number, string>>
      >((questionMap, [questionId, options]) => {
        const numericQuestionId = Number(questionId);

        if (
          !Number.isFinite(numericQuestionId) ||
          !options ||
          typeof options !== "object"
        ) {
          return questionMap;
        }

        questionMap[numericQuestionId] = Object.entries(
          options as Record<string, unknown>,
        ).reduce<Record<number, string>>(
          (optionMap, [optionId, text]) => {
            const numericOptionId = Number(optionId);

            if (Number.isFinite(numericOptionId)) {
              optionMap[numericOptionId] = String(text ?? "");
            }

            return optionMap;
          },
          {},
        );

        return questionMap;
      }, {});
    } catch {
      // Ignore invalid historical snapshots and try the next key.
    }
  }

  return {};
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
        stroke="var(--color-ice-line)"
        strokeWidth="12"
      />

      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="var(--pastel-mint-text)"
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
  const [questionFilter, setQuestionFilter] = useState<"all" | "correct" | "incorrect" | "unanswered">("all");

  const [optionTextByQuestion, setOptionTextByQuestion] = useState<
    Record<number, Record<number, string>>
  >({});

  const [detailsAvailable, setDetailsAvailable] = useState(false);
  const [recoveredFromLocalDraft, setRecoveredFromLocalDraft] = useState(false);
  const [recoveredScoreAvailable, setRecoveredScoreAvailable] = useState(false);

  const [loading, setLoading] = useState(true);

  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const [pendingRelease, setPendingRelease] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchResult = async () => {
      setRecoveredFromLocalDraft(false);
      setRecoveredScoreAvailable(false);
      const attemptId = String(testCode || "").trim();

      if (!/^\d+$/.test(attemptId)) {
        setResult(null);
        setDetails([]);
        setOptionTextByQuestion({});
        setDetailsAvailable(false);
        setPendingRelease(false);
        setError("The result URL must contain a valid attempt ID.");
        setLoading(false);
        return;
      }

      // This marker only bridges submission to the results route; no code
      // reads it after navigation, so clear it even while results are locked.
      localStorage.removeItem(`dynoquizz_submittedAttemptId_${attemptId}`);
      if (localStorage.getItem("dynoquizz_submittedAttemptId") === attemptId) {
        localStorage.removeItem("dynoquizz_submittedAttemptId");
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
              selectedOptionTexts: Array.isArray(item.selectedOptionTexts)
                ? item.selectedOptionTexts
                    .map((text) => String(text ?? "").trim())
                    .filter(Boolean)
                : undefined,
              correctOptionTexts: Array.isArray(item.correctOptionTexts)
                ? item.correctOptionTexts
                    .map((text) => String(text ?? "").trim())
                    .filter(Boolean)
                : undefined,
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

          const detailsUnavailable =
            detailsError instanceof ApiClientError &&
            detailsError.status === 400 &&
            (
              String(detailsError.errorCode || "").toUpperCase() ===
                "RESULT_DETAILS_NOT_AVAILABLE" ||
              String(detailsError.errorCode || "").toUpperCase() ===
                "RESULTS_NOT_PUBLISHED"
            );

          if (!detailsUnavailable) {
            console.info(
              "[Student Result] Question-wise details unavailable:",
              detailsError,
            );
          }
        }

        // Results are historical data. Do not request the active student
        // quiz package here: once a quiz ends, that endpoint is intentionally
        // unavailable and would turn a valid result page into a 400.
        const pendingDraft =
          normalized.status === "AUTO_SUBMITTED"
            ? readPendingSubmitRecovery(attemptId)
            : null;
        const hasLocalSelections = Boolean(
          pendingDraft &&
            Object.values(pendingDraft.answers).some((optionIds) => optionIds.length > 0),
        );
        const needsLegacyOptionSnapshot = detailList.some(
          (detail) =>
            !Array.isArray(detail.selectedOptionTexts) ||
            !Array.isArray(detail.correctOptionTexts),
        );
        const shouldRecoverAnswers =
          normalized.status === "AUTO_SUBMITTED" &&
          hasLocalSelections &&
          detailList.length > 0;

        const nextOptionTextByQuestion =
          detailList.length > 0 && (needsLegacyOptionSnapshot || shouldRecoverAnswers)
            ? readOptionTextSnapshot(attemptId, normalized.quizId)
            : {};

        let displayResult = normalized;
        let displayDetails = detailList;
        let didRecoverAnswers = false;
        let didRecoverScore = false;

        if (shouldRecoverAnswers && pendingDraft) {
          let scoringCanBeReconstructed = Boolean(
            pendingDraft.scoring &&
              detailList.length > 0 &&
              detailList.every((detail) => (detail.correctOptionIds ?? []).length > 0),
          );
          let recoveredScore = 0;

          displayDetails = detailList.map((detail) => {
            const questionId = Number(detail.questionId);
            const hasLocalAnswer = Object.prototype.hasOwnProperty.call(
              pendingDraft.answers,
              questionId,
            );
            const selectedOptionIds = hasLocalAnswer
              ? pendingDraft.answers[questionId]
              : (detail.selectedOptionIds ?? []).map(Number);
            const correctOptionIds = (detail.correctOptionIds ?? []).map(Number);
            const correct = sameOptionSet(selectedOptionIds, correctOptionIds);
            const scoringQuestion = pendingDraft.scoring?.questions?.[questionId];

            let marksAwarded = formatNumber(detail.marksAwarded);
            if (pendingDraft.scoring && scoringQuestion) {
              if (correct) {
                marksAwarded = formatNumber(detail.questionMarks, scoringQuestion.marks);
              } else if (
                selectedOptionIds.length > 0 &&
                pendingDraft.scoring.negativeMarking &&
                Number(scoringQuestion.negativeMarks ?? 0) > 0
              ) {
                marksAwarded = -Number(scoringQuestion.negativeMarks);
              } else {
                marksAwarded = 0;
              }
              recoveredScore += marksAwarded;
            } else {
              scoringCanBeReconstructed = false;
            }

            const recoveredTexts = selectedOptionIds
              .map((optionId) => nextOptionTextByQuestion[questionId]?.[optionId])
              .filter((text): text is string => Boolean(text));

            return {
              ...detail,
              selectedOptionIds,
              selectedOptionTexts:
                selectedOptionIds.length > 0 && recoveredTexts.length === selectedOptionIds.length
                  ? recoveredTexts
                  : selectedOptionIds.length === 0
                    ? []
                    : undefined,
              answerStatus: (selectedOptionIds.length > 0 ? "ANSWERED" : "UNANSWERED") as ResultDetail["answerStatus"],
              correct,
              marksAwarded,
            };
          });

          didRecoverAnswers = displayDetails.some((detail) => detail.selectedOptionIds.length > 0);

          if (
            didRecoverAnswers &&
            scoringCanBeReconstructed &&
            displayDetails.length > 0 &&
            displayDetails.every((detail) =>
              Boolean(pendingDraft.scoring?.questions?.[Number(detail.questionId)]),
            )
          ) {
            const totalMarks = formatNumber(normalized.totalMarks);
            displayResult = {
              ...normalized,
              finalScore: recoveredScore,
              percentage: totalMarks > 0 ? (recoveredScore / totalMarks) * 100 : 0,
            };
            didRecoverScore = true;
          }
        }

        if (!cancelled) {
          setResult(displayResult);
          setDetails(displayDetails);
          setOptionTextByQuestion(nextOptionTextByQuestion);
          setDetailsAvailable(displayDetails.length > 0);
          setRecoveredFromLocalDraft(didRecoverAnswers);
          setRecoveredScoreAvailable(didRecoverScore);
          setPendingRelease(false);
          setError(null);

          if (detailList.length > 0) {
            localStorage.removeItem(`dynoquizz_option_texts_attempt_${attemptId}`);
          }
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

  const isUnanswered = (detail: ResultDetail) => {
    const status = String(detail.answerStatus ?? "").trim().toUpperCase();
    const selectedIds = detail.selectedOptionIds;
    const selectedTexts = detail.selectedOptionTexts;
    const hasIds = Array.isArray(selectedIds);
    const hasTexts = Array.isArray(selectedTexts);
    const hasAnySelection =
      (hasIds && selectedIds.some((id) => id != null && String(id).trim() !== "")) ||
      (hasTexts && selectedTexts.some((text) => {
        const value = String(text ?? "").trim().toLowerCase();
        return value.length > 0 && value !== "not answered" && value !== "unanswered" && value !== "—";
      }));

    // A real selection is authoritative. If there is none, explicit empty
    // selection arrays beat stale correctness/status fields (some older API
    // responses mark blank answers INCORRECT even while reporting UNANSWERED).
    if (hasAnySelection) return false;
    if (hasIds || hasTexts) return true;
    if (["UNANSWERED", "NOT_ANSWERED", "SKIPPED", "BLANK", "NO_ANSWER"].includes(status)) return true;
    if (["ANSWERED", "CORRECT", "INCORRECT", "PARTIALLY_CORRECT"].includes(status)) return false;
    return true;
  };
  const isCorrect = (detail: ResultDetail) =>
    Boolean(detail.correct) && !isUnanswered(detail);

  const correctCount = details.filter(isCorrect).length;
  const totalQuestions = details.length;
  const accuracy =
    totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100)
      : null;
  const incorrectCount = details.filter(
    (detail) => !isCorrect(detail) && !isUnanswered(detail),
  ).length;
  const unansweredCount = details.filter(isUnanswered).length;
  const indexedDetails = [...details]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((detail, index) => ({ detail, questionNumber: index + 1 }));
  const visibleDetails = indexedDetails.filter(({ detail }) => {
    if (questionFilter === "all") return true;
    if (questionFilter === "correct") return isCorrect(detail);
    if (questionFilter === "unanswered") return isUnanswered(detail);
    return !isCorrect(detail) && !isUnanswered(detail);
  });

  if (loading) {
    return (
      <main className="student-result-page min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6" aria-busy="true" aria-label="Loading assessment results">
        <div className="mx-auto max-w-4xl animate-pulse space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-8 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="h-36 w-36 shrink-0 rounded-full border-[12px] border-slate-200 dark:border-slate-700" />
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                {["accuracy", "score", "time"].map((item) => (
                  <div key={item} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mx-auto h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mx-auto h-6 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mx-auto h-2 w-14 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-5 w-56 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-8 w-64 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          {[1, 2, 3].map((question) => (
            <section key={question} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-3/5 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800" />
            </section>
          ))}
          <p className="sr-only">Loading assessment results…</p>
        </div>
      </main>
    );
  }

  if (error && !result && !pendingRelease) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 p-4 font-sans">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-slate-200 shadow-sm space-y-4"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-slate-50 border border-slate-200 text-slate-500 shadow-xs">
            <FileQuestion className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Result unavailable
            </span>

            <h1 className="text-xl font-black text-slate-900">
              Unable to Load Result
            </h1>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 p-4 font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{
            duration: 0.25,
            ease: "easeOut",
          }}
          className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-slate-200 shadow-sm space-y-5"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] border border-[#8c381c]/30 text-[#8c381c] shadow-xs">
            <Lock className="h-6 w-6" />
          </div>

          <div className="text-center space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-xs">
              Pending Instructor Release
            </span>

            <h1 className="text-xl font-black text-slate-900">
              Assessment Submitted Successfully
            </h1>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Your result is recorded, but the instructor has not published the
              results yet.
            </p>
          </div>

          <div className="rounded-[10px] bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5 font-medium text-slate-500 shadow-xs">
            <div className="flex justify-between gap-3">
              <span>Attempt ID:</span>

              <strong className="font-mono text-slate-900">{testCode}</strong>
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
    <div className="student-result-page min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-[#e6e3e2] selection:text-[#165dfb] dark:bg-slate-950 dark:text-slate-100">
      <nav className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-white border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:bg-slate-950 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <span className="text-[#d1dee8]">|</span>

          <Logo />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="rounded-full bg-slate-50 border border-slate-200 px-3 py-1 font-mono text-xs font-bold text-slate-900 shadow-xs">
            Attempt #{result.attemptId}
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-left">
        <section>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Verified Assessment Performance
          </span>

          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
            {result.quizTitle}
          </h1>

          <p className="mt-0.5 text-xs text-slate-500 font-medium flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
            Submitted: {formatDateTime(result.submittedAt)}
          </p>

          {recoveredFromLocalDraft && (
            <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              The saved answer sheet was recovered from this device after automatic submission.
              {recoveredScoreAvailable
                ? " The displayed score is reconstructed from the recovered selections, published answer key, and saved scoring rules. The server-side leaderboard may still show the score it originally stored."
                : " The answer selections are restored, but this page could not safely reconstruct the score from the available scoring data; the displayed score remains the server-reported score."}
            </p>
          )}

          <Link
            href={"/dashboard/student/leaderboard/" + result.quizId}
            className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-xs transition-all hover:border-[#165dfb] hover:text-[#165dfb]"
          >
            <Trophy className="h-3.5 w-3.5" />
            View Leaderboard
          </Link>
        </section>

        <section className="rounded-[14px] bg-white p-6 border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <ScoreRing score={percentage} />

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className={`text-2xl font-black tracking-tight tabular-nums ${gc.text}`}
                >
                  {formatDisplayNumber(percentage)}%
                </span>

                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  Percentage
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3.5 w-full">
              <div>
                <p className="text-xs text-slate-900 font-medium">
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
                <div className="rounded-[12px] border border-slate-200 bg-white p-3 text-center shadow-xs">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-slate-50 border border-slate-200 text-[#165dfb] shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-base font-black text-slate-900">
                    {accuracy != null ? `${accuracy}%` : "—"}
                  </p>

                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    Accuracy
                  </p>
                </div>

                <div className="rounded-[12px] border border-slate-200 bg-white p-3 text-center shadow-xs">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-slate-50 border border-slate-200 text-[#1d5237] shadow-xs">
                    <Award className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-base font-black text-slate-900">
                    {formatDisplayNumber(result.finalScore)} /{" "}
                    {formatDisplayNumber(result.totalMarks)}
                  </p>

                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    Score
                  </p>
                </div>

                <div className="rounded-[12px] border border-slate-200 bg-white p-3 text-center shadow-xs">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-slate-50 border border-slate-200 text-slate-900 shadow-xs">
                    <Clock className="h-3.5 w-3.5" />
                  </div>

                  <p className="text-base font-black text-slate-900">
                    {formatTime(result.totalTimeTaken)}
                  </p>

                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    Total Time
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>

        {canRevealSolutions && details.length > 0 ? (
          <section className="space-y-2.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Question Breakdown &amp; Solutions
                </h2>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Showing {visibleDetails.length} of {totalQuestions} questions
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter questions by result">
                {([
                  { value: "all", label: "All", count: totalQuestions },
                  { value: "correct", label: "Correct", count: correctCount },
                  { value: "incorrect", label: "Incorrect", count: incorrectCount },
                  { value: "unanswered", label: "Unanswered", count: unansweredCount },
                ] as const).map((option) => {
                  const active = questionFilter === option.value;
                  const tone = option.value === "correct"
                    ? { active: "border-emerald-600 bg-emerald-600 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950" }
                    : option.value === "incorrect"
                      ? { active: "border-rose-600 bg-rose-600 text-white", idle: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950" }
                      : option.value === "unanswered"
                        ? { active: "border-slate-500 bg-slate-600 text-white", idle: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" }
                        : { active: "border-[#165dfb] bg-[#165dfb] text-white", idle: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" };
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setQuestionFilter(option.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] ${active ? tone.active : tone.idle}`}
                    >
                      {option.value === "correct" ? <CheckCircle2 className="h-3.5 w-3.5" /> : option.value === "incorrect" ? <XCircle className="h-3.5 w-3.5" /> : option.value === "unanswered" ? <FileQuestion className="h-3.5 w-3.5" /> : null}
                      {option.label}
                      <span className={active ? "text-white/80" : option.value === "correct" ? "text-emerald-700 dark:text-emerald-300" : option.value === "incorrect" ? "text-rose-700 dark:text-rose-300" : option.value === "unanswered" ? "text-slate-500 dark:text-slate-400" : "text-slate-400"}>{option.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[14px] bg-white border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:divide-slate-800">
              {visibleDetails.map(({ detail, questionNumber }) => {
                const idx = questionNumber - 1;
                const questionUnanswered = isUnanswered(detail);
                const questionCorrect = isCorrect(detail);
                const selectedOptionTexts = formatOptionTexts(
                  detail.selectedOptionTexts,
                  detail.questionId,
                  detail.selectedOptionIds,
                  optionTextByQuestion,
                );
                const correctOptionTexts = formatOptionTexts(
                  detail.correctOptionTexts,
                  detail.questionId,
                  detail.correctOptionIds,
                  optionTextByQuestion,
                );

                return (
                  <div
                    key={`${detail.questionId}-${idx}`}
                    className={`space-y-3 border-l-4 p-4 text-xs transition-colors sm:p-5 ${questionCorrect ? "border-l-emerald-500" : questionUnanswered ? "border-l-slate-300 dark:border-l-slate-600" : "border-l-rose-500"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold leading-snug text-slate-900 dark:text-slate-100">
                        {idx + 1}. {detail.questionText || "Question"}
                      </p>

                      {questionCorrect ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-700/15 bg-[#e2ede8] px-2.5 py-1 text-[10px] font-bold text-[#1d5237] shadow-xs dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Correct
                        </span>
                      ) : questionUnanswered ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <FileQuestion className="h-3 w-3" />
                          Unanswered
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-700/15 bg-[#fbeee8] px-2.5 py-1 text-[10px] font-bold text-[#8c381c] shadow-xs dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-300">
                          <XCircle className="h-3 w-3" />
                          Incorrect
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-2.5 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                        <span className="block text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
                          Your Answer:
                        </span>

                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {selectedOptionTexts.length > 0 ? (
                            selectedOptionTexts.map((optionText, optionIndex) => (
                              <span
                                key={`selected-${detail.questionId}-${optionIndex}`}
                                className="rounded-[8px] border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              >
                                {optionText}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 font-medium">
                              Not answered
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`rounded-[10px] border p-2.5 shadow-xs ${questionUnanswered ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" : "border-[#1d5237]/20 bg-[#e2ede8]/60 dark:border-emerald-900 dark:bg-emerald-950/40"}`}>
                        <span className={`block text-[9px] font-bold uppercase ${questionUnanswered ? "text-slate-500 dark:text-slate-400" : "text-[#1d5237] dark:text-emerald-300"}`}>
                          Correct Answer:
                        </span>

                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {correctOptionTexts.length > 0 ? (
                            correctOptionTexts.map((optionText, optionIndex) => (
                              <span
                                key={`correct-${detail.questionId}-${optionIndex}`}
                                className={`rounded-[8px] border bg-white px-2.5 py-1.5 font-bold dark:bg-slate-900 ${questionUnanswered ? "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300" : "border-[#1d5237]/20 text-[#1d5237] dark:border-emerald-900 dark:text-emerald-300"}`}
                              >
                                {optionText}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 font-medium">
                              No correct option returned.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 font-medium">
                      <span>
                        Marks:{" "}
                        <strong className="text-slate-900">
                          {formatDisplayNumber(detail.marksAwarded)} /{" "}
                          {formatDisplayNumber(detail.questionMarks)}
                        </strong>
                      </span>

                      {detail.responseTimeSeconds != null && (
                        <span>
                          Response time:{" "}
                          <strong className="text-slate-900">
                            {formatTime(detail.responseTimeSeconds)}
                          </strong>
                        </span>
                      )}

                      <span>
                        Status:{" "}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {questionUnanswered ? "UNANSWERED" : questionCorrect ? "CORRECT" : "INCORRECT"}
                        </strong>
                      </span>
                    </div>


                  </div>
                );
                })}
              {visibleDetails.length === 0 && (
                <div className="px-5 py-10 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  No questions match this filter.
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-[14px] bg-white border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-slate-50 border border-slate-200 text-slate-500 shadow-xs">
                <FileQuestion className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-900">
                  Question Solutions Locked
                </h3>

                <p className="text-[10px] text-slate-500 font-medium">
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