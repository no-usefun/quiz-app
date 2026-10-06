"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Users,
  Copy,
  CheckCircle2,
  FileQuestion,
  BookOpen,
  Settings,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { computeQuizDisplayState, QuizDisplayState } from "@/lib/quizStatus";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { api } from "@/lib/api/client";
import { QuizResponse, TeacherQuizDetailResponse } from "@/lib/types";

type TeacherDashboardQuiz = QuizResponse & {
  displayState: QuizDisplayState;
};

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const [tests, setTests] = useState<TeacherDashboardQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [quizToEnd, setQuizToEnd] = useState<{
    quizId: number;
    quizCode: string;
    title: string;
  } | null>(null);

  const [actionLoadingQuizId, setActionLoadingQuizId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizeQuiz = (quiz: QuizResponse): TeacherDashboardQuiz => ({
    ...quiz,
    displayState: computeQuizDisplayState({
      status: quiz.status,
      examState: quiz.examState,
      startTime: quiz.startTime,
      endTime: quiz.endTime,
    }),
  });

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const data = await api.get<QuizResponse[]>(ENDPOINTS.teacher.quizzes);

      /*
       * Once an assessment's configured end time has passed, treat it the
       * same way as an instructor pressing "End Quiz". This moves the
       * backend lifecycle to COMPLETED automatically, so result publishing
       * does not depend on the teacher opening the leaderboard and manually
       * ending the assessment first.
       *
       * The backend remains authoritative: we only request completion for
       * quizzes that are still PUBLISHED and are already displayed as Ended.
       */
      const normalized = data.map(normalizeQuiz);

      const expiredPublishedQuizzes = normalized.filter(
        (quiz) =>
          quiz.displayState === "Ended" &&
          quiz.status === "PUBLISHED",
      );

      if (expiredPublishedQuizzes.length > 0) {
        const completionResults = await Promise.allSettled(
          expiredPublishedQuizzes.map((quiz) =>
            api.put<QuizResponse>(
              ENDPOINTS.teacher.completeQuiz(quiz.quizId),
            ),
          ),
        );

        const completedById = new Map<number, QuizResponse>();

        completionResults.forEach((result) => {
          if (result.status === "fulfilled") {
            completedById.set(result.value.quizId, result.value);
          } else {
            console.error(
              "Automatic quiz completion failed:",
              result.reason,
            );
          }
        });

        setTests(
          normalized.map((quiz) =>
            normalizeQuiz(completedById.get(quiz.quizId) ?? quiz),
          ),
        );
      } else {
        setTests(normalized);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);

      setFetchError(
        getErrorMessage(error, "Failed to load assessments from server."),
      );

      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    fetchQuizzes();
  }, [sessionLoading]);

  const replaceQuizInState = (updatedQuiz: QuizResponse) => {
    const normalized = normalizeQuiz(updatedQuiz);

    setTests((prev) =>
      prev.map((quiz) =>
        quiz.quizId === normalized.quizId ? normalized : quiz,
      ),
    );
  };

  const refreshQuiz = async (quizId: number) => {
    const detail = await api.get<TeacherQuizDetailResponse>(
      ENDPOINTS.teacher.quizDetail(quizId),
    );

    replaceQuizInState(detail);
    return detail;
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);

      setTimeout(() => {
        setCopiedCode(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy quiz code:", error);
    }
  };

  const handlePublishQuiz = async (quizId: number) => {
    setActionLoadingQuizId(quizId);
    setActionError(null);

    try {
      await api.put<void>(ENDPOINTS.teacher.publishQuiz(quizId));
      await refreshQuiz(quizId);
    } catch (error) {
      const message = getErrorMessage(error, "Publish failed.");

      setActionError(message);
      alert(`Could not publish quiz: ${message}`);
    } finally {
      setActionLoadingQuizId(null);
    }
  };

  const confirmEndQuiz = async () => {
    if (!quizToEnd) {
      return;
    }

    const quizId = quizToEnd.quizId;
    setActionLoadingQuizId(quizId);
    setActionError(null);

    try {
      const updatedQuiz = await api.put<QuizResponse>(
        ENDPOINTS.teacher.completeQuiz(quizId),
      );

      replaceQuizInState(updatedQuiz);
      setQuizToEnd(null);
    } catch (error) {
      const message = getErrorMessage(error, "Failed to complete assessment.");

      setActionError(message);
    } finally {
      setActionLoadingQuizId(null);
    }
  };

  const handlePublishResults = async (quizId: number) => {
    setActionLoadingQuizId(quizId);
    setActionError(null);

    try {
      await api.put<void>(ENDPOINTS.teacher.publishResults(quizId));
      await refreshQuiz(quizId);
    } catch (error) {
      const message = getErrorMessage(error, "Publish results failed.");

      setActionError(message);
      alert(`Could not publish results: ${message}`);
    } finally {
      setActionLoadingQuizId(null);
    }
  };

  const handleUnpublishResults = async (quizId: number) => {
    setActionLoadingQuizId(quizId);
    setActionError(null);

    try {
      await api.put<void>(ENDPOINTS.teacher.unpublishResults(quizId));
      await refreshQuiz(quizId);
    } catch (error) {
      const message = getErrorMessage(error, "Unpublish results failed.");

      setActionError(message);
      alert(`Could not unpublish results: ${message}`);
    } finally {
      setActionLoadingQuizId(null);
    }
  };

  const displayName =
    user?.firstName ||
    user?.name?.split(" ")[0] ||
    user?.fullName?.split(" ")[0] ||
    "Instructor";

  const liveCount = tests.filter((test) => test.displayState === "Live").length;

  const draftCount = tests.filter(
    (test) => test.displayState === "Draft",
  ).length;

  const completedCount = tests.filter(
    (test) => test.displayState === "Completed",
  ).length;

  const getBadgeStyle = (displayState: QuizDisplayState) => {
    switch (displayState) {
      case "Live":
        return "bg-[#e2ede8] text-[#1d5237] border border-[#1d5237]/25";

      case "Scheduled":
        return "bg-[#e0f2fe] text-[#0369a1] border border-[#0369a1]/25";

      case "Draft":
        return "bg-[#fef3c7] text-[#92400e] border border-[#92400e]/25";

      case "Ended":
        return "bg-[#f1f5f9] text-[#475569] border border-[#475569]/25";

      case "Completed":
        return "bg-[#f3e8ff] text-[#6b21a8] border border-[#6b21a8]/25";

      case "Cancelled":
        return "bg-[#ffe4e6] text-[#be123c] border border-[#be123c]/25";

      default:
        return "bg-[#f5f5f4] text-[#78716b] border border-[#d1dee8]";
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col text-left">
      <TopNav role="teacher" />

      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        <section className="border-b border-[#d1dee8]/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
              Educator Control Center
            </span>

            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mt-0.5">
              Welcome back, {displayName}
            </h1>

            <p className="text-xs text-[#78716b] font-medium mt-0.5">
              Manage your assessments, invite candidates, and review live results
              telemetry.
            </p>
          </div>

          <Link
            href="/dashboard/teacher/create"
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0f4fd8] shadow-sm shadow-[#165dfb]/20 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 text-white" />
            Create Assessment
          </Link>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Total Assessments
            </span>

            <p className="text-2xl font-black text-[#111111] mt-1">
              {loading ? "..." : tests.length}
            </p>
          </div>

          <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1d5237]">
              Live Sessions
            </span>

            <p className="text-2xl font-black text-[#1d5237] mt-1">
              {loading ? "..." : liveCount}
            </p>
          </div>

          <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#92400e]">
              Draft Assessments
            </span>

            <p className="text-2xl font-black text-[#92400e] mt-1">
              {loading ? "..." : draftCount}
            </p>
          </div>

          <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b21a8]">
              Completed
            </span>

            <p className="text-2xl font-black text-[#6b21a8] mt-1">
              {loading ? "..." : completedCount}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider">
              Assessments Roster ({tests.length})
            </h2>

            <span className="text-xs font-medium text-[#78716b]">
              Newest first
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {loading ? (
              <div className="rounded-[14px] bg-white border border-[#d1dee8]/70 p-10 text-center text-xs text-[#78716b] shadow-sm">
                Loading assessments roster...
              </div>
            ) : fetchError ? (
              <div className="rounded-[14px] bg-[#fbeee8] border border-[#8c381c]/30 p-8 text-center space-y-3 shadow-sm">
                <p className="font-bold text-[#8c381c] text-sm">{fetchError}</p>

                <button
                  type="button"
                  onClick={fetchQuizzes}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#8c381c] px-4 py-2 text-xs font-bold text-white hover:bg-[#8c381c]/90 shadow-xs active:scale-[0.98] transition-all cursor-pointer border-0"
                >
                  Retry Loading
                </button>
              </div>
            ) : tests.length === 0 ? (
              <div className="rounded-[14px] bg-white border border-[#d1dee8]/70 p-10 text-center space-y-3 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#78716b] border border-[#d1dee8]/70">
                  <FileQuestion className="h-6 w-6 text-[#78716b]" />
                </div>

                <div>
                  <p className="font-bold text-[#111111] text-sm">
                    No assessments created yet
                  </p>

                  <p className="text-xs text-[#78716b] mt-0.5 font-medium max-w-sm mx-auto">
                    Click &ldquo;Create Assessment&rdquo; to build your first
                    proctored test.
                  </p>
                </div>

                <Link
                  href="/dashboard/teacher/create"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#0f4fd8] shadow-sm shadow-[#165dfb]/20 active:scale-[0.98] transition-all"
                >
                  <Plus className="h-3.5 w-3.5 text-white" />
                  Create Assessment
                </Link>
              </div>
            ) : (
              tests.map((test, idx) => {
                const quizId = test.quizId;
                const code = test.quizCode;
                const name = test.title || "Assessment";
                const displayState: QuizDisplayState = test.displayState;

                const handleCardClick = () => {
                  switch (displayState) {
                    case "Draft":
                      break;

                    case "Scheduled":
                    case "Live":
                      if (code) {
                        router.push(`/dashboard/teacher/share/${code}`);
                      }
                      break;

                    case "Ended":
                    case "Completed":
                    case "Cancelled":
                      if (code) {
                        router.push(`/dashboard/teacher/assessment/${code}`);
                      }
                      break;
                  }
                };

                return (
                  <motion.div
                    key={`${quizId}-${idx}`}
                    role="link"
                    tabIndex={0}
                    onClick={handleCardClick}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleCardClick();
                      }
                    }}
                    initial={mounted ? { opacity: 0, y: 4 } : false}
                    animate={mounted ? { opacity: 1, y: 0 } : false}
                    transition={{
                      delay: idx * 0.03,
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    className="flex flex-col rounded-[14px] bg-white border border-[#d1dee8]/70 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm hover:border-[#165dfb]/40 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 cursor-pointer"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold ${getBadgeStyle(
                            displayState,
                          )}`}
                        >
                          {displayState === "Live" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1d5237] animate-pulse" />
                          )}

                          {displayState}
                        </span>

                        <h3 className="font-extrabold text-[#111111] text-sm truncate">
                          {name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#78716b] font-medium">
                        {test.subject && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3 text-[#78716b]/80" />
                            {test.subject}
                            {test.subjectCode ? ` (${test.subjectCode})` : ""}
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-[#78716b]/80" />
                          {test.totalStudents > 0
                            ? `${test.totalStudents} Students`
                            : "Open to all students"}
                        </span>

                        <span>{test.totalQuestions || 0} Questions</span>

                        <span>
                          {Math.floor((test.overallTimerSeconds || 3600) / 60)}{" "}
                          mins
                        </span>

                        {code && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyCode(code);
                            }}
                            className="flex items-center gap-1 font-mono text-[#165dfb] hover:underline font-bold cursor-pointer bg-transparent border-0"
                          >
                            {copiedCode === code ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-[#1d5237]" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-[#165dfb]" />
                                Code: {code}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2 shrink-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {displayState === "Draft" && (
                        <>
                          <Link
                            href={`/dashboard/teacher/create?draftId=${test.quizId}`}
                            className="flex items-center gap-1 rounded-[10px] border border-[#d1dee8]/80 bg-white px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Settings className="h-3 w-3 text-[#78716b]" />
                            Edit Draft
                          </Link>

                          <button
                            type="button"
                            onClick={() => handlePublishQuiz(quizId)}
                            disabled={actionLoadingQuizId === quizId}
                            className="flex items-center gap-1 rounded-[10px] bg-[#165dfb] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0f4fd8] shadow-xs active:scale-[0.98] transition-all border-0 cursor-pointer disabled:opacity-50"
                          >
                            Publish
                          </button>
                        </>
                      )}

                      {displayState === "Scheduled" && (
                        <Link
                          href={`/dashboard/teacher/share/${code}`}
                          className="flex items-center gap-1 rounded-[10px] border border-[#d1dee8]/80 bg-[#f5f5f4] px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Share
                        </Link>
                      )}

                      {displayState === "Live" && (
                        <>
                          <Link
                            href={`/dashboard/teacher/share/${code}`}
                            className="flex items-center gap-1 rounded-[10px] border border-[#d1dee8]/80 bg-[#f5f5f4] px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Share
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              setQuizToEnd({
                                quizId,
                                quizCode: code,
                                title: name,
                              })
                            }
                            disabled={actionLoadingQuizId === quizId}
                            className="flex items-center gap-1 rounded-[10px] border border-[#8c381c]/30 bg-[#fbeee8] px-3 py-1.5 text-xs font-bold text-[#8c381c] hover:bg-[#8c381c]/15 shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                          >
                            End Quiz
                          </button>
                        </>
                      )}

                      {(displayState === "Ended" ||
                        displayState === "Completed" ||
                        displayState === "Cancelled") && (
                        <>
                          <Link
                            href={`/dashboard/teacher/assessment/${code}`}
                            className="flex items-center gap-1 rounded-[10px] border border-[#d1dee8]/80 bg-white px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Results & Leaderboard
                          </Link>

                          {displayState !== "Cancelled" &&
                            (!test.resultsPublished ? (
                              <button
                                type="button"
                                disabled={
                                  test.status !== "COMPLETED" || actionLoadingQuizId === quizId
                                }
                                onClick={() => {
                                  if (test.status === "COMPLETED") {
                                    void handlePublishResults(quizId);
                                  }
                                }}
                                title={
                                  test.status !== "COMPLETED"
                                    ? "End quiz before publishing results"
                                    : "Publish Results"
                                }
                                className="flex items-center gap-1 rounded-[10px] bg-[#1d5237] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#153e2a] shadow-xs active:scale-[0.98] transition-all border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Publish Results
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={actionLoadingQuizId === quizId}
                                onClick={() =>
                                  void handleUnpublishResults(quizId)
                                }
                                className="flex items-center gap-1 rounded-[10px] border border-[#d1dee8]/80 bg-white px-3 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                              >
                                Unpublish Results
                              </button>
                            ))}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {quizToEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-sm rounded-[14px] border border-[#d1dee8]/80 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-extrabold text-[#111111]">
              End Assessment?
            </h3>

            <p className="text-xs text-[#78716b] leading-relaxed">
              Are you sure you want to end &ldquo;
              {quizToEnd.title}
              &rdquo;? Active student attempts will be concluded and the quiz
              will transition to COMPLETED.
            </p>

            {actionError && (
              <p className="text-xs font-semibold text-[#8c381c]">
                {actionError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setQuizToEnd(null);
                  setActionError(null);
                }}
                disabled={actionLoadingQuizId === quizToEnd.quizId}
                className="rounded-[10px] border border-[#d1dee8]/80 bg-white px-3.5 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmEndQuiz}
                disabled={actionLoadingQuizId === quizToEnd.quizId}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#8c381c] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#6e2b14] shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer border-0"
              >
                {actionLoadingQuizId === quizToEnd.quizId && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                End Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
