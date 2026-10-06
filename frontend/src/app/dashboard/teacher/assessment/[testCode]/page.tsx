"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CalendarDays,
  Clock,
  CheckCircle2,
  Trophy,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ENDPOINTS } from "@/lib/api/endpoints";

type SortKey = "rank" | "name" | "score" | "timeTaken";
type SortDir = "asc" | "desc";
type ResultVisibility = "NONE" | "LEADERBOARD" | "QUESTION_WISE" | "BOTH";

type AssessmentData = {
  quizId: number | string;
  quizCode: string;
  title: string;
  description?: string;
  subject?: string;
  subjectCode?: string;
  totalStudents: number;
  totalQuestions: number;
  totalMarks: number;
  overallTimerSeconds: number;
  startTime?: string | null;
  endTime?: string | null;
  resultVisibility?: ResultVisibility;
  resultsPublished: boolean;
  status: string;
  examState?: string;
};

type StudentRecord = {
  id: number | string;
  name: string;
  avatar: string;
  score: number;
  finalScore: number;
  totalMarks: number;
  percentage: number;
  timeTaken: string;
  timeTakenSeconds: number;
};

function numericValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPercentage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMarks(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m ${secs}s`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not configured";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function podiumRingColor(pos: number) {
  if (pos === 0) {
    return {
      bg: "bg-pastel-yellow/30",
      text: "text-pastel-yellow-text",
      icon: "🥇",
    };
  }

  if (pos === 1) {
    return {
      bg: "bg-frost-surface/30",
      text: "text-signal-green",
      icon: "🥈",
    };
  }

  return {
    bg: "bg-pastel-pink/20",
    text: "text-pastel-pink-text",
    icon: "🥉",
  };
}

function exportCSV(testCode: string, data: StudentRecord[], title: string) {
  const headers = [
    "Rank",
    "Candidate Name",
    "Score (Marks)",
    "Percentage (%)",
    "Time Taken",
  ];

  const rows = data.map((student, index) => [
    index + 1,
    student.name,
    `${student.finalScore} / ${student.totalMarks}`,
    student.percentage,
    student.timeTaken,
  ]);

  const escapeCSV = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csvContent = [
    `# Quizly Leaderboard Export — ${title} (${testCode})`,
    "",
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Quizly_${testCode}_Leaderboard.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SortIcon({
  col,
  active,
  dir,
}: {
  col: SortKey;
  active: SortKey;
  dir: SortDir;
}) {
  if (col !== active) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-steel-blue-gray" />;
  }

  return dir === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 text-signal-green" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 text-signal-green" />
  );
}

function Th({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray hover:text-midnight-navy transition-colors cursor-pointer bg-transparent border-0 ${className}`}
    >
      {label}
      <SortIcon col={col} active={sortKey} dir={sortDir} />
    </button>
  );
}

export default function TeacherAssessmentPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(
    null,
  );
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exported, setExported] = useState(false);

  const [resultVisibility, setResultVisibility] =
    useState<ResultVisibility>("BOTH");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  const [leaderboardUnavailable, setLeaderboardUnavailable] = useState(false);

  const getToken = () => {
    const token = localStorage.getItem("dynoquizz_token");
    if (!token) {
      throw new Error("Your teacher session has expired. Please log in again.");
    }
    return token;
  };

  const authHeaders = (token: string): Record<string, string> => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const resolveQuiz = async (value: string) => {
    const token = getToken();
    const headers = authHeaders(token);

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
          `Unable to load teacher assessments (${listRes.status}).`,
      );
    }

    const listPayload = await listRes.json();
    const list: any[] = Array.isArray(listPayload)
      ? listPayload
      : Array.isArray(listPayload?.content)
        ? listPayload.content
        : Array.isArray(listPayload?.data)
          ? listPayload.data
          : [];

    let matched = list.find(
      (quiz) =>
        String(quiz?.quizCode ?? "") === String(value) ||
        String(quiz?.quizId ?? quiz?.id ?? "") === String(value),
    );

    if (!matched && /^\d+$/.test(String(value))) {
      const detailRes = await fetch(ENDPOINTS.teacher.quizDetail(value), {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (detailRes.ok) {
        matched = await detailRes.json();
      }
    }

    if (!matched) {
      throw new Error(
        "Assessment not found. Check the assessment URL or return to the teacher dashboard.",
      );
    }

    const quizId = matched.quizId ?? matched.id;
    const quizCode = String(matched.quizCode ?? "").trim();

    if (quizId == null || !quizCode) {
      throw new Error("The backend returned an incomplete assessment record.");
    }

    return {
      token,
      quiz: {
        quizId,
        quizCode,
        title: matched.title ?? "Assessment Session",
        description: matched.description,
        subject: matched.subject,
        subjectCode: matched.subjectCode,
        totalStudents: numericValue(matched.totalStudents),
        totalQuestions: numericValue(matched.totalQuestions),
        totalMarks: numericValue(matched.totalMarks),
        overallTimerSeconds: numericValue(matched.overallTimerSeconds),
        startTime: matched.startTime ?? null,
        endTime: matched.endTime ?? null,
        resultVisibility: matched.resultVisibility as
          | ResultVisibility
          | undefined,
        resultsPublished: Boolean(matched.resultsPublished),
        status: String(matched.status ?? "DRAFT"),
        examState: matched.examState,
      } satisfies AssessmentData,
    };
  };

  const loadLeaderboard = async (
    quizId: number | string,
    totalMarks: number,
  ) => {
    const token = getToken();

    const res = await fetch(ENDPOINTS.teacher.leaderboard(quizId), {
      method: "GET",
      headers: authHeaders(token),
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

    const payload = await res.json();
    const entries: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.content)
        ? payload.content
        : [];

    const mapped: StudentRecord[] = entries.map((entry, index) => {
      const rawFinalScore = numericValue(entry.finalScore ?? entry.score, 0);

      const rawTotalMarks = numericValue(entry.totalMarks, totalMarks);

      const derivedPercentage =
        rawTotalMarks > 0 ? (rawFinalScore / rawTotalMarks) * 100 : 0;

      const percentage = numericValue(entry.percentage, derivedPercentage);

      const timeTakenSeconds = numericValue(entry.totalTimeTaken, 0);

      const name = String(entry.studentName ?? "").trim() || "Candidate";

      const avatar =
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "ST";

      return {
        id: entry.studentId ?? entry.rank ?? index + 1,
        name,
        avatar,
        score: percentage,
        finalScore: rawFinalScore,
        totalMarks: rawTotalMarks,
        percentage,
        timeTaken: formatTime(timeTakenSeconds),
        timeTakenSeconds,
      };
    });

    return mapped;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchAssessmentDetails = async () => {
      try {
        setLoading(true);
        setLifecycleError(null);
        setSettingsError(null);

        const { quiz } = await resolveQuiz(testCode);

        if (cancelled) return;

        setAssessmentData(quiz);
        setResultVisibility(quiz.resultVisibility ?? "BOTH");

        try {
          const leaderboard = await loadLeaderboard(
            quiz.quizId,
            quiz.totalMarks,
          );

          if (cancelled) return;

          setStudents(leaderboard);
          setLeaderboardUnavailable(false);
        } catch (leaderboardError) {
          console.warn("Teacher leaderboard unavailable:", leaderboardError);

          if (cancelled) return;

          setStudents([]);
          setLeaderboardUnavailable(true);
        }
      } catch (error: any) {
        if (cancelled) return;

        console.error("Backend assessment fetch error:", error);
        setAssessmentData(null);
        setStudents([]);
        setLeaderboardUnavailable(true);
        setLifecycleError(
          error?.message ||
            "We couldn't retrieve this assessment from the server.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAssessmentDetails();

    return () => {
      cancelled = true;
    };
  }, [testCode]);

  useEffect(() => {
    if (!assessmentData?.quizId) return;

    const interval = window.setInterval(async () => {
      try {
        const leaderboard = await loadLeaderboard(
          assessmentData.quizId,
          assessmentData.totalMarks,
        );

        setStudents(leaderboard);
        setLeaderboardUnavailable(false);
      } catch {
        // Keep the last successful leaderboard on transient refresh errors.
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [assessmentData?.quizId, assessmentData?.totalMarks]);

  const updateResultVisibility = async (nextVisibility: ResultVisibility) => {
    if (!assessmentData?.quizId) return;

    const previousVisibility = resultVisibility;

    setResultVisibility(nextVisibility);
    setSettingsSaving(true);
    setSettingsError(null);

    try {
      const token = getToken();

      const res = await fetch(
        ENDPOINTS.teacher.settings(assessmentData.quizId),
        {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({
            resultVisibility: nextVisibility,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            body?.error ||
            `Server rejected the settings update (${res.status}).`,
        );
      }

      const updated = await res.json();

      if (updated?.resultVisibility) {
        setResultVisibility(updated.resultVisibility as ResultVisibility);
        setAssessmentData((previous) =>
          previous
            ? {
                ...previous,
                resultVisibility: updated.resultVisibility,
              }
            : previous,
        );
      }
    } catch (error: any) {
      setResultVisibility(previousVisibility);
      setSettingsError(
        error?.message || "Failed to update assessment settings on the server.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleLeaderboardVisibility = () => {
    const leaderboard =
      resultVisibility === "LEADERBOARD" || resultVisibility === "BOTH";
    const questionWise =
      resultVisibility === "QUESTION_WISE" || resultVisibility === "BOTH";

    const nextLeaderboard = !leaderboard;

    const nextVisibility: ResultVisibility =
      nextLeaderboard && questionWise
        ? "BOTH"
        : nextLeaderboard
          ? "LEADERBOARD"
          : questionWise
            ? "QUESTION_WISE"
            : "NONE";

    void updateResultVisibility(nextVisibility);
  };

  const toggleQuestionWiseVisibility = () => {
    const leaderboard =
      resultVisibility === "LEADERBOARD" || resultVisibility === "BOTH";
    const questionWise =
      resultVisibility === "QUESTION_WISE" || resultVisibility === "BOTH";

    const nextQuestionWise = !questionWise;

    const nextVisibility: ResultVisibility =
      leaderboard && nextQuestionWise
        ? "BOTH"
        : leaderboard
          ? "LEADERBOARD"
          : nextQuestionWise
            ? "QUESTION_WISE"
            : "NONE";

    void updateResultVisibility(nextVisibility);
  };

  const handlePublishQuiz = async () => {
    if (!assessmentData?.quizId) return;

    setLifecycleLoading(true);
    setLifecycleError(null);

    try {
      const token = getToken();

      const res = await fetch(
        ENDPOINTS.teacher.publishQuiz(assessmentData.quizId),
        {
          method: "PUT",
          headers: authHeaders(token),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            body?.error ||
            `Failed to publish assessment (${res.status}).`,
        );
      }

      setAssessmentData((previous) =>
        previous
          ? {
              ...previous,
              status: "PUBLISHED",
              examState: "WAITING",
            }
          : previous,
      );
    } catch (error: any) {
      setLifecycleError(error?.message || "Failed to publish assessment.");
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleCompleteQuiz = async () => {
    if (!assessmentData?.quizId) return;

    setLifecycleLoading(true);
    setLifecycleError(null);

    try {
      const token = getToken();

      const res = await fetch(
        ENDPOINTS.teacher.completeQuiz(assessmentData.quizId),
        {
          method: "PUT",
          headers: authHeaders(token),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            body?.error ||
            `Failed to complete assessment (${res.status}).`,
        );
      }

      const updated = await res.json();

      setAssessmentData((previous) =>
        previous
          ? {
              ...previous,
              status: String(updated?.status ?? "COMPLETED"),
              examState: String(updated?.examState ?? "ENDED"),
            }
          : previous,
      );

      setConfirmCompleteOpen(false);
    } catch (error: any) {
      setLifecycleError(error?.message || "Failed to complete assessment.");
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleToggleResultsPublish = async () => {
    if (!assessmentData?.quizId) return;

    const currentlyPublished = assessmentData.resultsPublished;

    setLifecycleLoading(true);
    setLifecycleError(null);

    try {
      const token = getToken();

      const endpoint = currentlyPublished
        ? ENDPOINTS.teacher.unpublishResults(assessmentData.quizId)
        : ENDPOINTS.teacher.publishResults(assessmentData.quizId);

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: authHeaders(token),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message ||
            body?.error ||
            `Failed to update result publication (${res.status}).`,
        );
      }

      // Current backend returns 204 No Content for both result
      // publication endpoints, so there is intentionally no res.json().
      setAssessmentData((previous) =>
        previous
          ? {
              ...previous,
              resultsPublished: !currentlyPublished,
            }
          : previous,
      );
    } catch (error: any) {
      setLifecycleError(
        error?.message || "Failed to update result publication.",
      );
    } finally {
      setLifecycleLoading(false);
    }
  };

  const status = String(assessmentData?.status ?? "DRAFT").toUpperCase();

  const leaderboardVisible =
    resultVisibility === "LEADERBOARD" || resultVisibility === "BOTH";

  const questionWiseVisible =
    resultVisibility === "QUESTION_WISE" || resultVisibility === "BOTH";

  const settingsLocked = status !== "DRAFT";

  const submitted = students;

  const classAvg =
    submitted.length > 0
      ? submitted.reduce((sum, student) => sum + student.percentage, 0) /
        submitted.length
      : 0;

  const highScore = Math.max(
    ...(submitted.length > 0
      ? submitted.map((student) => student.percentage)
      : [0]),
  );

  const topThree = [...submitted]
    .sort(
      (a, b) =>
        b.percentage - a.percentage || a.timeTakenSeconds - b.timeTakenSeconds,
    )
    .slice(0, 3);

  const displayList = useMemo(() => {
    const ranked = [...submitted]
      .sort(
        (a, b) =>
          b.percentage - a.percentage ||
          a.timeTakenSeconds - b.timeTakenSeconds,
      )
      .map((student, index) => ({
        ...student,
        rank: index + 1,
      }));

    const filtered = ranked.filter((student) =>
      student.name.toLowerCase().includes(query.toLowerCase()),
    );

    return filtered.sort((a, b) => {
      let comparison = 0;

      if (sortKey === "rank") comparison = a.rank - b.rank;
      else if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "score") {
        comparison = a.percentage - b.percentage;
      } else if (sortKey === "timeTaken") {
        comparison = a.timeTakenSeconds - b.timeTakenSeconds;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [submitted, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExport = () => {
    if (!assessmentData) return;

    exportCSV(assessmentData.quizCode, displayList, assessmentData.title);

    setExported(true);
    window.setTimeout(() => setExported(false), 2500);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-frost-surface flex items-center justify-center text-xs text-steel-blue-gray">
        Loading assessment governance panel...
      </main>
    );
  }

  if (!assessmentData) {
    return (
      <main className="min-h-screen bg-frost-surface flex items-center justify-center p-4 font-sans text-midnight-navy">
        <div className="w-full max-w-md rounded-[14px] bg-paper-white border border-mist-blue/70 p-7 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-pastel-pink-text" />
          <h1 className="mt-4 text-lg font-bold">Unable to load assessment</h1>
          <p className="mt-2 text-xs leading-relaxed text-steel-blue-gray">
            {lifecycleError ||
              "The assessment could not be resolved from the teacher API."}
          </p>
          <Link
            href="/dashboard/teacher"
            className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-midnight-navy px-4 py-2.5 text-xs font-bold text-white transition-all hover:opacity-90"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-frost-surface text-midnight-navy p-4 md:p-6 lg:p-8 font-sans selection:bg-frost-surface selection:text-signal-green">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-cards bg-paper-white shadow-xl border border-mist-blue overflow-hidden text-left">
        <header className="flex w-full items-center justify-between border-b border-mist-blue/30 px-6 py-4 bg-paper-white">
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

          <button
            type="button"
            onClick={handleExport}
            disabled={displayList.length === 0}
            className={`flex items-center gap-2 rounded-[10px] px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-[0.98] border-0 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              exported
                ? "bg-pastel-mint text-pastel-mint-text"
                : "bg-signal-green text-white hover:bg-signal-green/90 shadow-sm"
            }`}
          >
            {exported ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text" />
                Exported
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-white" />
                Export to CSV
              </>
            )}
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 p-5 md:p-6 bg-paper-white">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-steel-blue-gray">
                Assessment Governance
              </p>

              <h1 className="text-xl font-bold text-midnight-navy mt-0.5">
                {assessmentData.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-steel-blue-gray font-medium">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-steel-blue-gray" />
                  {formatDateTime(assessmentData.startTime)}
                </span>

                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-steel-blue-gray" />
                  {Math.floor(assessmentData.overallTimerSeconds / 60)} min
                </span>

                <span className="rounded-full bg-frost-surface px-2.5 py-0.5 font-mono text-[9px] font-bold text-signal-green border border-mist-blue/30 shadow-xs">
                  {assessmentData.quizCode}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  status === "COMPLETED"
                    ? "bg-[#ece9f3] text-[#4c3d73]"
                    : status === "PUBLISHED"
                      ? "bg-[#e2ede8] text-[#1d5237]"
                      : "bg-[#f6efe1] text-[#73561a]"
                }`}
              >
                {status}
              </span>

              {status === "DRAFT" && (
                <button
                  type="button"
                  onClick={handlePublishQuiz}
                  disabled={lifecycleLoading}
                  className="rounded-[10px] bg-[#165dfb] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0f4fd8] active:scale-[0.98] transition-all cursor-pointer border-0 disabled:opacity-50 shadow-xs"
                >
                  {lifecycleLoading ? "Publishing..." : "Publish Quiz"}
                </button>
              )}

              {status === "PUBLISHED" && (
                <button
                  type="button"
                  onClick={() => setConfirmCompleteOpen(true)}
                  disabled={lifecycleLoading}
                  className="rounded-[10px] bg-[#8c381c] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#6e2b14] active:scale-[0.98] transition-all cursor-pointer border-0 disabled:opacity-50 shadow-xs"
                >
                  Complete Quiz
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleResultsPublish}
                disabled={lifecycleLoading || status !== "COMPLETED"}
                className={`rounded-[10px] px-3.5 py-1.5 text-xs font-bold transition-all border-0 shadow-xs active:scale-[0.98] ${
                  status !== "COMPLETED"
                    ? "bg-[#e6e3e2]/60 text-[#78716b] cursor-not-allowed"
                    : assessmentData.resultsPublished
                      ? "bg-[#8c381c] text-white hover:bg-[#6e2b14] cursor-pointer"
                      : "bg-[#1d5237] text-white hover:bg-[#153e2a] cursor-pointer"
                }`}
              >
                {assessmentData.resultsPublished
                  ? "Unpublish Results"
                  : "Publish Results"}
              </button>
            </div>
          </div>

          {lifecycleError && (
            <div className="flex items-center gap-2 rounded-[10px] bg-pastel-pink/30 border border-pastel-pink text-pastel-pink-text px-3.5 py-2 text-xs font-bold shadow-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{lifecycleError}</span>
            </div>
          )}

          {confirmCompleteOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm rounded-[14px] bg-white p-6 shadow-2xl border border-[#d1dee8]/80 space-y-4 text-left">
                <h3 className="text-sm font-black text-[#111111]">
                  Complete Assessment?
                </h3>

                <p className="text-xs text-[#78716b] leading-relaxed font-medium">
                  Completing this assessment changes its state to completed.
                  Results can then be published to students.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCompleteOpen(false)}
                    className="rounded-[10px] border border-[#d1dee8]/80 bg-white px-3.5 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#f5f5f4] hover:border-[#b9cbd9] shadow-xs cursor-pointer transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteQuiz}
                    disabled={lifecycleLoading}
                    className="rounded-[10px] bg-[#8c381c] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#6e2b14] active:scale-[0.98] shadow-xs cursor-pointer border-0 transition-all disabled:opacity-50"
                  >
                    {lifecycleLoading ? "Completing..." : "Confirm & Complete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <section className="rounded-[14px] border border-[#d1dee8]/70 bg-paper-white p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-midnight-navy flex items-center gap-1.5 border-b border-[#d1dee8]/40 pb-2">
              <Lock className="h-3.5 w-3.5 text-signal-green" />
              Student Result Visibility
            </h3>

            {settingsLocked && (
              <p className="text-[10px] font-medium text-steel-blue-gray">
                Result visibility can only be changed while the assessment is in
                DRAFT status.
              </p>
            )}

            {settingsError && (
              <div className="flex items-center gap-2 rounded-[10px] bg-pastel-pink/30 border border-pastel-pink text-pastel-pink-text px-3.5 py-2 text-xs font-bold shadow-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                {
                  label: "Show Leaderboard",
                  hint: "Allow students to see the quiz leaderboard after results are released.",
                  active: leaderboardVisible,
                  onClick: toggleLeaderboardVisibility,
                },
                {
                  label: "Show Question-wise Results",
                  hint: "Allow students to view question-level result details after results are released.",
                  active: questionWiseVisible,
                  onClick: toggleQuestionWiseVisibility,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  disabled={settingsLocked || settingsSaving}
                  className={`flex items-start justify-between gap-3 rounded-[10px] border p-3 text-left transition-all duration-150 ${
                    item.active
                      ? "border-signal-green bg-frost-surface text-midnight-navy ring-2 ring-signal-green/20"
                      : "border-[#d1dee8]/80 bg-paper-white text-steel-blue-gray hover:border-[#b9cbd9]"
                  } ${
                    settingsLocked || settingsSaving
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer active:scale-[0.98] shadow-xs"
                  }`}
                >
                  <div className="text-left">
                    <span className="block text-xs font-bold text-midnight-navy">
                      {item.label}
                    </span>
                    <span className="block text-[10px] text-steel-blue-gray mt-0.5 font-medium">
                      {item.hint}
                    </span>
                  </div>

                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 ${
                      item.active ? "bg-signal-green" : "bg-mist-blue"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                        item.active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                icon: <Users className="h-4 w-4 text-signal-green" />,
                label: "Target Students",
                value: assessmentData.totalStudents,
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-pastel-mint-text" />,
                label: "Submitted",
                value: submitted.length,
              },
              {
                icon: <Award className="h-4 w-4 text-signal-green" />,
                label: "High Score",
                value: `${formatPercentage(highScore)}%`,
              },
              {
                icon: <Clock className="h-4 w-4 text-signal-green" />,
                label: "Exam Duration",
                value: `${Math.floor(
                  assessmentData.overallTimerSeconds / 60,
                )}m`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-[14px] border border-[#d1dee8]/70 bg-paper-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-frost-surface text-signal-green border border-mist-blue/20 shadow-xs">
                  {stat.icon}
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-midnight-navy">
                    {stat.value}
                  </p>
                  <p className="text-[9px] text-steel-blue-gray font-bold uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <section className="text-left">
            <div className="mb-2.5 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-pastel-yellow-text" />
              <h2 className="text-xs font-bold text-midnight-navy uppercase tracking-wider">
                Top Performers
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {topThree.map((student, pos) => {
                const c = podiumRingColor(pos);

                return (
                  <div
                    key={student.id || pos}
                    className="relative overflow-hidden rounded-[14px] border border-[#d1dee8]/70 bg-paper-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <span className="absolute right-3.5 top-3.5 text-lg">
                      {c.icon}
                    </span>

                    <div
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full ${c.bg} ${c.text} text-[10px] font-bold shadow-xs`}
                    >
                      {student.avatar}
                    </div>

                    <p className="font-bold text-midnight-navy truncate pr-6 text-xs text-left">
                      {student.name}
                    </p>

                    <p className="text-[10px] text-steel-blue-gray font-medium text-left">
                      Rank #{pos + 1} · {student.timeTaken || "00:00"}
                    </p>

                    <div className="mt-3 text-left">
                      <p className="text-xl font-bold text-midnight-navy">
                        {formatMarks(student.finalScore)} /{" "}
                        {formatMarks(student.totalMarks)}
                      </p>

                      <p className="text-[10px] font-bold text-signal-green">
                        {formatPercentage(student.percentage)}%
                      </p>

                      <p className="text-[8px] text-steel-blue-gray font-bold uppercase">
                        Score
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-1 flex-col">
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xs font-bold text-midnight-navy uppercase tracking-wider text-left">
                Submitted Students ({displayList.length} of {submitted.length})
              </h2>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-blue-gray" />
                <input
                  type="text"
                  placeholder="Search by name…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-paper-white py-2 pl-9 pr-4 text-xs font-medium text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20 shadow-xs sm:w-64"
                />
              </div>
            </div>

            <div className="flex-1 rounded-[14px] border border-[#d1dee8]/70 overflow-hidden bg-paper-white shadow-sm text-left">
              <div className="grid grid-cols-[2.5rem_1fr_7rem_6rem] items-center gap-3 border-b border-[#d1dee8]/40 bg-paper-white px-5 py-2.5">
                <Th
                  label="#"
                  col="rank"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />

                <Th
                  label="Student"
                  col="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />

                <Th
                  label="Score / %"
                  col="score"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />

                <Th
                  label="Duration"
                  col="timeTaken"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />
              </div>

              {leaderboardUnavailable ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-steel-blue-gray">
                  <p className="text-xs font-medium text-steel-blue-gray">
                    Leaderboard isn&apos;t available yet.
                  </p>
                </div>
              ) : displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-steel-blue-gray">
                  <Search className="h-6 w-6 text-mist-blue" />
                  <p className="text-xs">
                    No submitted attempts match your query.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#d1dee8]/30 bg-paper-white">
                  {displayList.map((student) => (
                    <li
                      key={student.id}
                      className="grid grid-cols-[2.5rem_1fr_7rem_6rem] items-center gap-3 px-5 py-2.5 transition-colors hover:bg-frost-surface/40"
                    >
                      <span className="text-xs font-bold font-mono text-steel-blue-gray">
                        {student.rank}
                      </span>

                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-frost-surface border border-mist-blue/30 text-midnight-navy font-bold text-[10px] shadow-xs">
                          {student.avatar}
                        </div>

                        <p className="truncate text-xs font-bold text-midnight-navy">
                          {student.name}
                        </p>
                      </div>

                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span className="text-xs font-bold tabular-nums text-midnight-navy">
                          {formatMarks(student.finalScore)} /{" "}
                          {formatMarks(student.totalMarks)}
                        </span>

                        <span className="text-[9px] font-bold tabular-nums text-signal-green">
                          {formatPercentage(student.percentage)}%
                        </span>
                      </div>

                      <div className="flex justify-center">
                        <span className="font-mono text-[10px] font-semibold text-steel-blue-gray">
                          {student.timeTaken || "00:00"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
