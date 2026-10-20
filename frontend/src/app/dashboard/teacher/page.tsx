"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Users,
  Copy,
  CheckCircle2,
  FileQuestion,
  BookOpen,
  Settings,
  Search,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { computeQuizDisplayState, QuizDisplayState } from "@/lib/quizStatus";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { api } from "@/lib/api/client";
import { QuizResponse, TeacherQuizDetailResponse } from "@/lib/types";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type TeacherDashboardQuiz = QuizResponse & {
  displayState: QuizDisplayState;
};

type TeacherDashboardStatusFilter =
  | "ALL"
  | "DRAFT"
  | "UPCOMING"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED";

type TeacherDashboardSortField =
  | "CREATED"
  | "TITLE"
  | "SUBJECT"
  | "CODE"
  | "START"
  | "QUESTIONS"
  | "DURATION"
  | "STUDENTS";

type TeacherDashboardSortDirection = "ASC" | "DESC";

export default function TeacherDashboard() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const reduceMotion = useReducedMotion();

  const [tests, setTests] = useState<TeacherDashboardQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [hasLoadedQuizData, setHasLoadedQuizData] = useState(false);
  const [cacheOwnerKey, setCacheOwnerKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [statusFilter, setStatusFilter] =
    useState<TeacherDashboardStatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] =
    useState<TeacherDashboardSortField>("CREATED");
  const [sortDirection, setSortDirection] =
    useState<TeacherDashboardSortDirection>("DESC");
  const [visibleCount, setVisibleCount] = useState(5);

  const [quizToEnd, setQuizToEnd] = useState<{
    quizId: number;
    quizCode: string;
    title: string;
  } | null>(null);

  const [actionLoadingQuizId, setActionLoadingQuizId] = useState<number | null>(
    null,
  );
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

  const getQuizCacheKey = () => {
    if (typeof window === "undefined") {
      return null;
    }

    const userKey = user?.id ?? user?.userId ?? user?.email;
    return userKey != null
      ? `dynoquizz_teacher_quizzes_${String(userKey).toLowerCase()}`
      : null;
  };

  const fetchQuizzes = async () => {
    const cacheKey = getQuizCacheKey();
    let hasUsableCache = false;

    if (cacheKey) {
      try {
        const rawCache = localStorage.getItem(cacheKey);
        if (rawCache) {
          const parsed = JSON.parse(rawCache) as {
            quizzes?: QuizResponse[];
            savedAt?: number;
          };

          if (Array.isArray(parsed.quizzes)) {
            setTests(parsed.quizzes.map(normalizeQuiz));
            setHasCachedData(true);
            setHasLoadedQuizData(true);
            setCacheOwnerKey(cacheKey);
            hasUsableCache = true;
          }
        }
      } catch (cacheError) {
        console.warn("Could not read cached teacher quizzes:", cacheError);
      }
    }

    setCacheReady(true);
    setLoading(!hasUsableCache);
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
        (quiz) => quiz.displayState === "Ended" && quiz.status === "PUBLISHED",
      );

      // Render the fetched quiz list immediately. Expired quiz completion
      // is a follow-up operation and must not block the dashboard's loading
      // state while the backend processes those updates.
      setTests(normalized);
      setHasCachedData(false);
      setHasLoadedQuizData(true);
      setCacheOwnerKey(cacheKey);

      if (cacheKey) {
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ quizzes: normalized, savedAt: Date.now() }),
          );
        } catch (cacheError) {
          console.warn("Could not cache teacher quizzes:", cacheError);
        }
      }

      if (expiredPublishedQuizzes.length > 0) {
        void Promise.allSettled(
          expiredPublishedQuizzes.map((quiz) =>
            api.put<QuizResponse>(ENDPOINTS.teacher.completeQuiz(quiz.quizId)),
          ),
        ).then((completionResults) => {
          const completedById = new Map<number, QuizResponse>();

          completionResults.forEach((result) => {
            if (result.status === "fulfilled") {
              completedById.set(result.value.quizId, result.value);
            } else {
              console.error("Automatic quiz completion failed:", result.reason);
            }
          });

          if (completedById.size > 0) {
            setTests((current) =>
              current.map((quiz) => {
                const completed = completedById.get(quiz.quizId);
                return completed ? normalizeQuiz(completed) : quiz;
              }),
            );
          }
        });
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);

      const message = getErrorMessage(
        error,
        "Failed to load assessments from server.",
      );

      if (hasUsableCache) {
        // Keep the last successful list visible without exposing cache details
        // or a background-refresh error in the teacher-facing dashboard.
        setHasCachedData(true);
      } else {
        setFetchError(message);
        setTests([]);
      }
    } finally {
      setLoading(false);
    }
  };

  

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    // This effect starts the async API/cache synchronization for the active teacher session.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch updates dashboard state
    fetchQuizzes();
  }, [sessionLoading, user?.id, user?.userId, user?.email]);

  useEffect(() => {
    const cacheKey = getQuizCacheKey();
    if (!cacheReady || !hasLoadedQuizData || !cacheKey || cacheOwnerKey !== cacheKey) {
      return;
    }

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ quizzes: tests, savedAt: Date.now() }),
      );
    } catch (cacheError) {
      console.warn("Could not persist teacher quiz cache:", cacheError);
    }
  }, [tests, cacheReady, hasLoadedQuizData, cacheOwnerKey, user?.id, user?.userId, user?.email]);

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

  const liveCount = useMemo(
    () => tests.filter((test) => test.displayState === "Live").length,
    [tests],
  );

  const draftCount = useMemo(
    () => tests.filter((test) => test.displayState === "Draft").length,
    [tests],
  );

  const completedCount = useMemo(
    () => tests.filter((test) => test.displayState === "Completed").length,
    [tests],
  );

  const statusCounts = useMemo(
    () => ({
      ALL: tests.length,
      DRAFT: tests.filter((test) => test.displayState === "Draft").length,
      UPCOMING: tests.filter((test) => test.displayState === "Scheduled").length,
      LIVE: tests.filter((test) => test.displayState === "Live").length,
      COMPLETED: tests.filter(
        (test) =>
          test.displayState === "Completed" || test.displayState === "Ended",
      ).length,
      CANCELLED: tests.filter((test) => test.displayState === "Cancelled").length,
    }),
    [tests],
  );

  const sortedTests = useMemo(() => {
    const queryTerms = searchQuery
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const dateSearchText = (value?: string | null) => {
      if (!value) return "";
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? value
        : `${value} ${parsed.toLocaleDateString()} ${parsed.toLocaleString()}`;
    };

    const filtered = tests.filter((test) => {
      let matchesStatus: boolean;

      switch (statusFilter) {
        case "DRAFT":
          matchesStatus = test.displayState === "Draft";
          break;
        case "UPCOMING":
          matchesStatus = test.displayState === "Scheduled";
          break;
        case "LIVE":
          matchesStatus = test.displayState === "Live";
          break;
        case "COMPLETED":
          matchesStatus =
            test.displayState === "Completed" || test.displayState === "Ended";
          break;
        case "CANCELLED":
          matchesStatus = test.displayState === "Cancelled";
          break;
        case "ALL":
        default:
          matchesStatus = true;
          break;
      }

      if (!matchesStatus) return false;
      if (queryTerms.length === 0) return true;

      const durationSeconds = Number(test.overallTimerSeconds || 0);
      const durationMinutes = Math.ceil(durationSeconds / 60);
      const searchableText = [
        test.title,
        test.description,
        test.instructions,
        test.subject,
        test.subjectCode,
        test.quizCode,
        test.quizId,
        test.teacherId,
        test.status,
        test.examState,
        test.displayState,
        test.totalQuestions,
        test.totalMarks,
        test.totalStudents,
        test.overallTimerSeconds,
        `${durationMinutes} min`,
        `${durationMinutes} mins`,
        `${durationMinutes} minutes`,
        dateSearchText(test.startTime),
        dateSearchText(test.endTime),
      ]
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLocaleLowerCase();

      // Every term must match somewhere across an assessment's searchable fields.
      return queryTerms.every((term) => searchableText.includes(term));
    });

    const sorted = [...filtered];
    const compareText = (
      left: unknown,
      right: unknown,
      direction: 1 | -1 = 1,
    ) =>
      direction *
      String(left ?? "").localeCompare(String(right ?? ""), undefined, {
        sensitivity: "base",
        numeric: true,
      });

    const compareNumber = (
      left: unknown,
      right: unknown,
      direction: 1 | -1 = 1,
    ) =>
      direction * (Number(left || 0) - Number(right || 0));

    const compareStartTime = (
      left?: string | null,
      right?: string | null,
      direction: 1 | -1 = 1,
    ) => {
      const leftTime = left ? Date.parse(left) : Number.NaN;
      const rightTime = right ? Date.parse(right) : Number.NaN;
      const leftValid = Number.isFinite(leftTime);
      const rightValid = Number.isFinite(rightTime);

      // Assessments without a valid start time stay at the bottom in either order.
      if (!leftValid && !rightValid) return 0;
      if (!leftValid) return 1;
      if (!rightValid) return -1;
      return direction * (leftTime - rightTime);
    };

    const direction = sortDirection === "ASC" ? 1 : -1;

    switch (sortField) {
      case "TITLE":
        sorted.sort((a, b) => compareText(a.title, b.title, direction));
        break;
      case "SUBJECT":
        sorted.sort((a, b) =>
          compareText(a.subject || a.subjectCode, b.subject || b.subjectCode, direction),
        );
        break;
      case "CODE":
        sorted.sort((a, b) => compareText(a.quizCode, b.quizCode, direction));
        break;
      case "START":
        sorted.sort((a, b) =>
          compareStartTime(a.startTime, b.startTime, direction),
        );
        break;
      case "QUESTIONS":
        sorted.sort((a, b) =>
          compareNumber(a.totalQuestions, b.totalQuestions, direction),
        );
        break;
      case "DURATION":
        sorted.sort((a, b) =>
          compareNumber(a.overallTimerSeconds, b.overallTimerSeconds, direction),
        );
        break;
      case "STUDENTS":
        sorted.sort((a, b) =>
          compareNumber(a.totalStudents, b.totalStudents, direction),
        );
        break;
      case "CREATED":
      default:
        // API order is newest-first, so reverse only for ascending/oldest-first.
        if (sortDirection === "ASC") sorted.reverse();
        break;
    }

    return sorted;
  }, [tests, statusFilter, searchQuery, sortField, sortDirection]);

  const visibleTests = sortedTests.slice(0, visibleCount);
  const hasMoreTests = visibleCount < sortedTests.length;
  const handleLoadMore = () => {
    setVisibleCount((current) => Math.min(current + 5, sortedTests.length));
  };

  const handleFilterChange = (
    nextFilter:
      | "ALL"
      | "DRAFT"
      | "UPCOMING"
      | "LIVE"
      | "COMPLETED"
      | "CANCELLED",
  ) => {
    setStatusFilter(nextFilter);
    setVisibleCount(5);
  };

  const handleSearchChange = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    setVisibleCount(5);
  };

  const handleSortChange = (nextField: TeacherDashboardSortField) => {
    setSortField(nextField);

    // Start each field in the direction people usually expect for that data.
    setSortDirection(
      nextField === "CREATED" ||
        nextField === "QUESTIONS" ||
        nextField === "DURATION" ||
        nextField === "STUDENTS"
        ? "DESC"
        : "ASC",
    );
    setVisibleCount(5);
  };

  const handleSortDirectionToggle = () => {
    setSortDirection((current) => (current === "ASC" ? "DESC" : "ASC"));
    setVisibleCount(5);
  };

  const handleClearRosterFilters = () => {
    setStatusFilter("ALL");
    setSearchQuery("");
    setSortField("CREATED");
    setSortDirection("DESC");
    setVisibleCount(5);
  };

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
    <div className="teacher-dashboard min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col text-left">
      <TopNav role="teacher" />

      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        <motion.section initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: "easeOut" }} className="teacher-dashboard-hero relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:px-7 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
              Educator Control Center
            </span>

            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mt-0.5">
              Welcome back, {displayName}
            </h1>

            <p className="text-xs text-[#78716b] font-medium mt-0.5">
              Manage your assessments, invite candidates, and review live
              results telemetry.
            </p>
          </div>

          <Link
            href="/dashboard/teacher/create"
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0f4fd8] shadow-sm shadow-[#165dfb]/20 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4 text-white" />
            Create Assessment
          </Link>
        </motion.section>

        <motion.section initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.07, ease: "easeOut" }} className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[
            { label: "Total Assessments", value: loading ? "..." : tests.length },
            { label: "Live Sessions", value: loading ? "..." : liveCount },
            { label: "Draft Assessments", value: loading ? "..." : draftCount },
            { label: "Completed", value: loading ? "..." : completedCount },
          ].map((stat) => (
            <div key={stat.label} className="teacher-stat rounded-xl border border-slate-200 bg-white p-4 sm:p-5 transition-colors duration-150 hover:border-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{stat.value}</p>
            </div>
          ))}
        </motion.section>

        <motion.section initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.14, ease: "easeOut" }} className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider">
                Assessments Roster (
                {statusFilter === "ALL" && !searchQuery.trim()
                  ? tests.length
                  : `${sortedTests.length} of ${tests.length}`}
                )
              </h2>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { value: "ALL", label: "All", count: statusCounts.ALL },
                    { value: "DRAFT", label: "Draft", count: statusCounts.DRAFT },
                    { value: "UPCOMING", label: "Upcoming", count: statusCounts.UPCOMING },
                    { value: "LIVE", label: "Live", count: statusCounts.LIVE },
                    { value: "COMPLETED", label: "Completed", count: statusCounts.COMPLETED },
                    { value: "CANCELLED", label: "Cancelled", count: statusCounts.CANCELLED },
                  ] as const
                ).map(({ value, label, count }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleFilterChange(value)}
                    aria-pressed={statusFilter === value}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all " +
                      (statusFilter === value
                        ? "border-[#165dfb] bg-[#165dfb] text-white shadow-xs"
                        : "border-[#d1dee8]/80 bg-white text-[#78716b] hover:border-[#165dfb]/40 hover:text-[#111111]")
                    }
                  >
                    <span>{label}</span>
                    <span
                      className={
                        "tabular-nums " +
                        (statusFilter === value ? "text-white/80" : "text-[#a8a29e]")
                      }
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex h-8 w-full items-center justify-between gap-1 rounded-[10px] border border-[#d1dee8]/80 bg-white px-2 text-[10px] font-bold text-[#78716b] shadow-xs sm:w-auto sm:justify-start">
                <label htmlFor="assessment-sort-field" className="pl-1 whitespace-nowrap">
                  Sort
                </label>
                <select
                  id="assessment-sort-field"
                  value={sortField}
                  onChange={(event) =>
                    handleSortChange(event.target.value as TeacherDashboardSortField)
                  }
                  aria-label="Sort assessments by"
                  className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent px-1 py-0 text-[10px] font-bold text-[#111111] outline-none sm:min-w-[122px] sm:flex-none"
                >
                  <option value="CREATED">Created date</option>
                  <option value="TITLE">Assessment title</option>
                  <option value="SUBJECT">Subject</option>
                  <option value="CODE">Test code</option>
                  <option value="START">Start date</option>
                  <option value="QUESTIONS">Questions</option>
                  <option value="DURATION">Duration</option>
                  <option value="STUDENTS">Students</option>
                </select>
                <button
                  type="button"
                  onClick={handleSortDirectionToggle}
                  aria-label={
                    sortDirection === "ASC"
                      ? "Currently ascending. Switch to descending order"
                      : "Currently descending. Switch to ascending order"
                  }
                  title={
                    sortDirection === "ASC"
                      ? "Ascending — click for descending"
                      : "Descending — click for ascending"
                  }
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[#165dfb] transition-colors hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb]"
                >
                  {sortDirection === "ASC" ? (
                    <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Search assessments</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716b]"
              />
              <input
                type="text"
                id="assessment-search"
                role="searchbox"
                autoComplete="off"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search title, subject, test code, ID..."
                aria-label="Search assessments by title, subject, code, or ID"
                className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-white py-2.5 pl-9 pr-10 text-xs font-medium text-[#111111] shadow-xs outline-none transition focus:border-[#165dfb]/60 focus:ring-2 focus:ring-[#165dfb]/10 placeholder:text-[#a8a29e]"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear assessment search"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#78716b] transition hover:bg-[#f5f5f4] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb]"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <p className="text-[10px] font-medium text-[#78716b]" aria-live="polite">
              {searchQuery.trim()
                ? `Found ${sortedTests.length} matching assessment${sortedTests.length === 1 ? "" : "s"}`
                : `Showing ${Math.min(visibleCount, sortedTests.length)} of ${sortedTests.length} assessments`}
            </p>
          </div>

          <div className="grid gap-3.5">
            {loading ? (
              <div className="rounded-[14px] bg-white border border-[#d1dee8]/70 p-10 text-center text-xs text-[#78716b] shadow-sm">
                Loading assessments roster...
              </div>
            ) : fetchError && tests.length === 0 ? (
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
            ) : visibleTests.length === 0 ? (
              <div className="rounded-[14px] bg-white border border-[#d1dee8]/70 p-10 text-center space-y-3 shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#78716b] border border-[#d1dee8]/70">
                  <FileQuestion className="h-6 w-6 text-[#78716b]" />
                </div>

                <div>
                  <p className="font-bold text-[#111111] text-sm">
                    No matching assessments
                  </p>

                  <p className="text-xs text-[#78716b] mt-0.5 font-medium max-w-sm mx-auto">
                    Try a different search, status filter, or sort option.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearRosterFilters}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8]/80 bg-white px-4 py-2 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  Clear Search & Filters
                </button>
              </div>
            ) : (
              visibleTests.map((test, idx) => {
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
                    initial={
                      reduceMotion || !mounted
                        ? false
                        : { opacity: 0, y: 12, scale: 0.99 }
                    }
                    animate={
                      reduceMotion || !mounted
                        ? false
                        : { opacity: 1, y: 0, scale: 1 }
                    }
                    transition={{
                      delay: reduceMotion ? 0 : idx * 0.075,
                      duration: reduceMotion ? 0 : 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="teacher-assessment-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50/40 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
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

                        <h3 className="min-w-0 flex-1 font-extrabold text-[#111111] text-sm leading-5 break-words">
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
                      className="flex w-full lg:w-auto lg:max-w-[48%] flex-wrap items-center gap-2 shrink-0"
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
                                  test.status !== "COMPLETED" ||
                                  actionLoadingQuizId === quizId
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

          {!loading && !fetchError && hasMoreTests && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center justify-center rounded-[10px] border border-[#d1dee8]/80 bg-white px-5 py-2 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                Show More Assessments
              </button>
            </div>
          )}
        </motion.section>
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
