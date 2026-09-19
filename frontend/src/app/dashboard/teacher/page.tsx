"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Users,
  BarChart3,
  Copy,
  CheckCircle2,
  FileQuestion,
  BookOpen,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { computeQuizDisplayState, QuizDisplayState } from "@/lib/quizStatus";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Modal and action states
  const [quizToEnd, setQuizToEnd] = useState<{
    quizId: number;
    quizCode: string;
    title: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    setLoading(true);
    setFetchError(null);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_token")
        : null;

    if (!token) {
      setTests([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/teacher/quizzes`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
            ? data.content
            : Array.isArray(data?.data)
              ? data.data
              : [];

        const normalizedBackend = list.map((q: any) => {
          const rawQuizId = q.quizId ?? q.id;
          const quizCode =
            q.quizCode ?? q.testCode ?? String(rawQuizId ?? "");
          const status = (q.status ?? "DRAFT").toUpperCase();
          const examState = (q.examState ?? "WAITING").toUpperCase();
          const startTime = q.startTime ?? null;
          const endTime = q.endTime ?? null;

          const displayState = computeQuizDisplayState({
            status,
            examState,
            startTime,
            endTime,
          });

          return {
            quizId: rawQuizId,
            quizCode,
            teacherId: q.teacherId ?? 0,
            title: q.title ?? q.quizName ?? "Assessment",
            description: q.description ?? "",
            instructions: q.instructions ?? "",
            subject: q.subject ?? "",
            subjectCode: q.subjectCode ?? "",
            totalStudents: q.totalStudents ?? 0,
            totalQuestions:
              q.totalQuestions ??
              (Array.isArray(q.questions) ? q.questions.length : 0),
            totalMarks: q.totalMarks ?? 0,
            overallTimerSeconds: q.overallTimerSeconds ?? 3600,
            status,
            examState,
            startTime,
            endTime,
            displayState,
            resultVisibility: q.resultVisibility ?? "NONE",
            resultsPublished: Boolean(q.resultsPublished),
          };
        });

        setTests(normalizedBackend);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message || errData.error || `Server returned ${res.status}`,
        );
      }
    } catch (e: any) {
      console.error("Dashboard fetch error:", e);
      setFetchError(e.message || "Failed to load assessments from server.");
      setTests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);

    if (sessionLoading) return;

    fetchQuizzes();
  }, [sessionLoading]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePublishQuiz = async (quizId: number) => {
    setActionLoading(true);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_token")
        : null;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/teacher/quizzes/${quizId}/publish`,
        {
          method: "PUT",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || err.error || `Publish failed (${res.status})`,
        );
      }
      await fetchQuizzes();
    } catch (err: any) {
      alert(`Could not publish quiz: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmEndQuiz = async () => {
    if (!quizToEnd) return;
    setActionLoading(true);
    setActionError(null);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_token")
        : null;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/teacher/quizzes/${quizToEnd.quizId}/complete`,
        {
          method: "PUT",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || err.error || `Complete failed (${res.status})`,
        );
      }
      setQuizToEnd(null);
      await fetchQuizzes();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishResults = async (quizId: number) => {
    setActionLoading(true);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_token")
        : null;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/teacher/quizzes/${quizId}/results/publish`,
        {
          method: "PUT",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || err.error || `Publish results failed (${res.status})`,
        );
      }
      await fetchQuizzes();
    } catch (err: any) {
      alert(`Could not publish results: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpublishResults = async (quizId: number) => {
    setActionLoading(true);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_token")
        : null;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/teacher/quizzes/${quizId}/results/unpublish`,
        {
          method: "PUT",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message ||
            err.error ||
            `Unpublish results failed (${res.status})`,
        );
      }
      await fetchQuizzes();
    } catch (err: any) {
      alert(`Could not unpublish results: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const displayName =
    user?.firstName ||
    user?.name?.split(" ")[0] ||
    user?.fullName?.split(" ")[0] ||
    "Instructor";

  const liveCount = tests.filter((t) => t.displayState === "Live").length;
  const draftCount = tests.filter((t) => t.displayState === "Draft").length;
  const completedCount = tests.filter(
    (t) => t.displayState === "Completed",
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
              Manage your assessments, invite candidates, and monitor live exam
              telemetry.
            </p>
          </div>

          <Link
            href="/dashboard/teacher/create"
            className="inline-flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-none"
          >
            <Plus className="h-4 w-4 text-white" />
            Create Assessment
          </Link>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Total Assessments
            </span>
            <p className="text-2xl font-black text-[#111111] mt-1">
              {loading ? "..." : tests.length}
            </p>
          </div>
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1d5237]">
              Live Sessions
            </span>
            <p className="text-2xl font-black text-[#1d5237] mt-1">
              {loading ? "..." : liveCount}
            </p>
          </div>
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#92400e]">
              Draft Assessments
            </span>
            <p className="text-2xl font-black text-[#92400e] mt-1">
              {loading ? "..." : draftCount}
            </p>
          </div>
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
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

          <div className="grid gap-3.5">
            {loading ? (
              <div className="rounded-[8.8px] bg-white border border-[#d1dee8] p-10 text-center text-xs text-[#78716b]">
                Loading assessments roster...
              </div>
            ) : fetchError ? (
              <div className="rounded-[8.8px] bg-[#fbeee8] border border-[#8c381c]/30 p-8 text-center space-y-3">
                <p className="font-bold text-[#8c381c] text-sm">{fetchError}</p>
                <button
                  type="button"
                  onClick={fetchQuizzes}
                  className="inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#8c381c] px-4 py-2 text-xs font-bold text-white hover:bg-[#8c381c]/90 transition-all cursor-pointer border-0"
                >
                  Retry Loading
                </button>
              </div>
            ) : tests.length === 0 ? (
              <div className="rounded-[8.8px] bg-white border border-[#d1dee8] p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] text-[#78716b] border border-[#d1dee8]">
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
                  className="inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0"
                >
                  <Plus className="h-3.5 w-3.5 text-white" /> Create Assessment
                </Link>
              </div>
            ) : (
              tests.map((test, idx) => {
                const quizId = test.quizId;
                const code = test.quizCode || String(quizId);
                const name = test.title || "Assessment";
                const displayState: QuizDisplayState = test.displayState;

                // The whole card is clickable and goes to the state's primary page
                const handleCardClick = () => {
                  switch (displayState) {
                    case "Draft":
                      handlePublishQuiz(quizId);
                      break;
                    case "Scheduled":
                      router.push(`/dashboard/teacher/share/${code}`);
                      break;
                    case "Live":
                      router.push(`/dashboard/teacher/live/${code}`);
                      break;
                    case "Ended":
                    case "Completed":
                    case "Cancelled":
                      router.push(`/dashboard/teacher/assessment/${code}`);
                      break;
                  }
                };

                return (
                  <motion.div
                    key={`${quizId}-${idx}`}
                    role="link"
                    tabIndex={0}
                    onClick={handleCardClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCardClick();
                    }}
                    initial={mounted ? { opacity: 0, y: 4 } : false}
                    animate={mounted ? { opacity: 1, y: 0 } : false}
                    transition={{
                      delay: idx * 0.03,
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    className="flex flex-col rounded-[8.8px] bg-white border border-[#d1dee8] p-4 sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-[#165dfb]/40 transition-all duration-200 cursor-pointer"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center gap-1.5 rounded-[8.8px] px-2.5 py-0.5 text-[9px] font-bold ${getBadgeStyle(
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
                            <BookOpen className="h-3 w-3 text-[#78716b]/80" />{" "}
                            {test.subject}
                            {test.subjectCode ? ` (${test.subjectCode})` : ""}
                          </span>
                        )}
                        {/* TODO(backend): Ask backend to add submittedCount/attemptedCount to QuizResponse for GET /teacher/quizzes so the dashboard can show live attempt counts without N+1 leaderboard calls. */}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-[#78716b]/80" />{" "}
                          {test.totalStudents > 0
                            ? `${test.totalStudents} Students`
                            : "Open to all students"}
                        </span>
                        <span>{test.totalQuestions || 0} Questions</span>
                        <span>
                          {Math.floor((test.overallTimerSeconds || 3600) / 60)}{" "}
                          mins
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCode(String(code));
                          }}
                          className="flex items-center gap-1 font-mono text-[#165dfb] hover:underline font-bold cursor-pointer bg-transparent border-0"
                        >
                          {copiedCode === String(code) ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-[#1d5237]" />{" "}
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-[#165dfb]" />{" "}
                              Code: {code}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {displayState === "Draft" && (
                        <button
                          type="button"
                          onClick={() => handlePublishQuiz(quizId)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded-[8.8px] bg-[#165dfb] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 cursor-pointer disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}

                      {displayState === "Scheduled" && (
                        <Link
                          href={`/dashboard/teacher/share/${code}`}
                          className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Share
                        </Link>
                      )}

                      {displayState === "Live" && (
                        <>
                          <Link
                            href={`/dashboard/teacher/live/${code}`}
                            className="flex items-center gap-1 rounded-[8.8px] bg-[#165dfb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 cursor-pointer"
                          >
                            <BarChart3 className="h-3 w-3 text-white" /> Live Monitor
                          </Link>
                          <Link
                            href={`/dashboard/teacher/share/${code}`}
                            className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Share
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setQuizToEnd({
                                quizId,
                                quizCode: String(code),
                                title: name,
                              })
                            }
                            disabled={actionLoading}
                            className="flex items-center gap-1 rounded-[8.8px] border border-[#8c381c]/30 bg-[#fbeee8] px-3 py-1.5 text-xs font-bold text-[#8c381c] hover:bg-[#8c381c]/10 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
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
                            className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-white px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Results & Leaderboard
                          </Link>

                          {displayState === "Ended" && test.status !== "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() =>
                                setQuizToEnd({
                                  quizId,
                                  quizCode: String(code),
                                  title: name,
                                })
                              }
                              disabled={actionLoading}
                              className="flex items-center gap-1 rounded-[8.8px] border border-[#8c381c]/30 bg-[#fbeee8] px-3 py-1.5 text-xs font-bold text-[#8c381c] hover:bg-[#8c381c]/10 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                            >
                              End Quiz
                            </button>
                          )}

                          {displayState !== "Cancelled" && (
                            !test.resultsPublished ? (
                              <button
                                type="button"
                                disabled={
                                  test.status !== "COMPLETED" || actionLoading
                                }
                                onClick={() =>
                                  test.status === "COMPLETED" &&
                                  handlePublishResults(quizId)
                                }
                                title={
                                  test.status !== "COMPLETED"
                                    ? "End quiz before publishing results"
                                    : "Publish Results"
                                }
                                className="flex items-center gap-1 rounded-[8.8px] bg-[#1d5237] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1d5237]/90 active:scale-[0.98] transition-all border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Publish Results
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleUnpublishResults(quizId)}
                                className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-white px-3 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                              >
                                Unpublish Results
                              </button>
                            )
                          )}
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

      {/* Confirmation modal for End Assessment */}
      {quizToEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-navy/40 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-sm rounded-[14px] border border-[#d1dee8] bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-[#111111]">
              End Assessment?
            </h3>
            <p className="text-xs text-[#78716b] leading-relaxed">
              Are you sure you want to end &ldquo;{quizToEnd.title}&rdquo;? Active
              student attempts will be concluded and the quiz will transition
              to COMPLETED.
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
                disabled={actionLoading}
                className="rounded-[8.8px] border border-[#d1dee8] px-3.5 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#f5f5f4] transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEndQuiz}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#8c381c] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#6e2b14] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer border-0"
              >
                {actionLoading && (
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
