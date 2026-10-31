"use client";

import LoadingIndicator from "@/components/LoadingIndicator";
import SkeletonBlock from "@/components/SkeletonBlock";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
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
  ClipboardList,
  Eye,
  BarChart3,
  Star,
  FileText,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ENDPOINTS } from "@/lib/api/endpoints";
import LanExamPreflight from "@/components/LanExamPreflight";
import { isLanExamMode } from "@/lib/examMode";
import type {
  ProctoringEventDetailResponse,
  TeacherProctoringReportResponse,
  TeacherQuizProctoringOverviewResponse,
} from "@/lib/types";

type ApiRecord = Record<string, unknown>;

function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getApiRecords(value: unknown): ApiRecord[] {
  if (Array.isArray(value)) return value.filter(isApiRecord);
  if (!isApiRecord(value)) return [];
  if (Array.isArray(value.content)) return value.content.filter(isApiRecord);
  if (Array.isArray(value.data)) return value.data.filter(isApiRecord);
  return [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

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
  allowedRegistrationNumbers?: string[] | null;
  overallTimerSeconds: number;
  negativeMarking: boolean;
  negativeMarks: number;
  timeBonusEnabled: boolean;
  allowReview: boolean;
  allowResume: boolean;
  startTime?: string | null;
  endTime?: string | null;
  resultVisibility?: ResultVisibility;
  resultsPublished: boolean;
  status: string;
  examState?: string;
};

type StudentRecord = {
  id: number | string;
  attemptId?: number;
  name: string;
  registrationNumber: string;
  avatar: string;
  score: number;
  finalScore: number;
  totalMarks: number;
  percentage: number;
  timeTaken: string;
  timeTakenSeconds: number;
  status?: string | null;
  terminationReason?: string | null;
};

type ProctoringEvent = ProctoringEventDetailResponse;
type ProctoringStudentReport = TeacherProctoringReportResponse;
type ProctoringOverview = TeacherQuizProctoringOverviewResponse;

function toProctoringOverview(payload: unknown): ProctoringOverview {
  const root = isApiRecord(payload) ? payload : {};
  const nested = isApiRecord(root.data) ? root.data : root;
  if (
    typeof nested.quizCode !== "string" ||
    typeof nested.quizTitle !== "string" ||
    !Array.isArray(nested.studentReports)
  ) {
    throw new Error("The backend returned an invalid teacher proctoring overview.");
  }

  // These objects have been fetched from the endpoint whose response is
  // TeacherQuizProctoringOverviewResponse. Keep the runtime envelope check
  // while using the shared DTO type for the known report shape.
  const studentReports = nested.studentReports
    .filter(isApiRecord) as unknown as ProctoringStudentReport[];

  // The backend aggregate currently counts only selected risk-scored events.
  // Count any recorded student event too, so browser audit evidence (copy/paste,
  // focus loss, restricted shortcuts) is not hidden by a zero risk aggregate.
  const flaggedFromEvents = studentReports.filter((report) =>
    numericValue(report.warningCount) > 0 ||
    numericValue(report.riskScore) >= 30 ||
    (Array.isArray(report.events) && report.events.length > 0)
  ).length;

  return {
    quizCode: nested.quizCode,
    quizTitle: nested.quizTitle,
    totalAttempts: numericValue(nested.totalAttempts),
    flaggedAttempts: Math.max(numericValue(nested.flaggedAttempts), flaggedFromEvents),
    autoSubmittedAttempts: numericValue(nested.autoSubmittedAttempts),
    averageRiskScore: numericValue(nested.averageRiskScore),
    studentReports,
  };
}

function displayMetric(value: unknown): string {
  return value == null || value === "" ? "—" : String(value);
}

function humanizeEvent(value?: string | null): string {
  return String(value || "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

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
    "Registration Number",
    "Candidate Name",
    "Score (Marks)",
    "Total Marks",
    "Percentage (%)",
    "Time Taken",
    "Attempt Status",
  ];

  const rows = data.map((student, index) => [
    index + 1,
    student.registrationNumber,
    student.name,
    student.finalScore,
    student.totalMarks,
    student.percentage,
    student.timeTaken,
    student.status ?? "",
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
    return <ChevronsUpDown className="h-3.5 w-3.5 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400" />;
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
      className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 hover:text-midnight-navy dark:text-slate-100 transition-colors cursor-pointer bg-transparent border-0 ${className}`}
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
  const [proctoringOverview, setProctoringOverview] = useState<ProctoringOverview | null>(null);
  const [proctoringLoading, setProctoringLoading] = useState(false);
  const [proctoringError, setProctoringError] = useState<string | null>(null);
  const [selectedProctoringStudent, setSelectedProctoringStudent] = useState<StudentRecord | null>(null);

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

    // Assessment routes are commonly opened with a numeric quiz ID. Fetch the
    // detail endpoint first so publishing/results does not depend on the
    // teacher's entire quiz-list endpoint being available.
    let matched: ApiRecord | undefined;

    if (/^\d+$/.test(String(value))) {
      try {
        const detailRes = await fetch(ENDPOINTS.teacher.quizDetail(value), {
          method: "GET",
          headers,
          cache: "no-store",
        });

        if (detailRes.ok) {
          const detailPayload: unknown = await detailRes.json();
          if (isApiRecord(detailPayload)) matched = detailPayload;
        }
      } catch {
        // Fall back to the list endpoint below; preserve the most useful
        // error if both requests fail.
      }
    }

    if (!matched) {
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

      const listPayload: unknown = await listRes.json();
      const list = getApiRecords(listPayload);

      matched = list.find(
        (quiz) =>
          String(quiz?.quizCode ?? "") === String(value) ||
          String(quiz?.quizId ?? quiz?.id ?? "") === String(value),
      );
    }

    if (!matched) {
      throw new Error(
        "Assessment not found. Check the assessment URL or return to the teacher dashboard.",
      );
    }

    const rawQuizId = matched.quizId ?? matched.id;
    const quizId =
      typeof rawQuizId === "string" || typeof rawQuizId === "number"
        ? rawQuizId
        : null;
    const quizCode = String(matched.quizCode ?? "").trim();
    const title =
      typeof matched.title === "string" && matched.title.trim()
        ? matched.title
        : "Assessment Session";
    const description =
      typeof matched.description === "string" ? matched.description : undefined;
    const subject =
      typeof matched.subject === "string" ? matched.subject : undefined;
    const subjectCode =
      typeof matched.subjectCode === "string" ? matched.subjectCode : undefined;
    const startTime =
      typeof matched.startTime === "string" ? matched.startTime : null;
    const endTime =
      typeof matched.endTime === "string" ? matched.endTime : null;
    const examState =
      typeof matched.examState === "string" ? matched.examState : undefined;
    const settings = isApiRecord(matched.settings) ? matched.settings : {};

    if (quizId == null || !quizCode) {
      throw new Error("The backend returned an incomplete assessment record.");
    }

    return {
      token,
      quiz: {
        quizId,
        quizCode,
        title,
        description,
        subject,
        subjectCode,
        totalStudents: numericValue(matched.totalStudents),
        totalQuestions: numericValue(matched.totalQuestions),
        totalMarks: numericValue(matched.totalMarks),
        allowedRegistrationNumbers: Array.isArray(
          matched.allowedRegistrationNumbers,
        )
          ? matched.allowedRegistrationNumbers.map((value: unknown) =>
              String(value).trim().toUpperCase(),
            )
          : undefined,
        overallTimerSeconds: numericValue(matched.overallTimerSeconds),
        negativeMarking: Boolean(matched.negativeMarking ?? settings.negativeMarking),
        negativeMarks: numericValue(matched.negativeMarks ?? settings.negativeMarks),
        timeBonusEnabled: Boolean(matched.timeBonusEnabled ?? settings.timeBonusEnabled),
        allowReview: Boolean(matched.allowReview ?? settings.allowReview),
        allowResume: Boolean(matched.allowResume ?? settings.allowResume),
        startTime,
        endTime,
        resultVisibility: matched.resultVisibility as
          | ResultVisibility
          | undefined,
        resultsPublished: Boolean(matched.resultsPublished),
        status: String(matched.status ?? "DRAFT"),
        examState,
      } satisfies AssessmentData,
    };
  };

  const loadProctoringOverview = async (quizCode: string) => {
    const token = getToken();
    const response = await fetch(
      ENDPOINTS.proctoring.teacherQuizReport(quizCode),
      {
        method: "GET",
        headers: authHeaders(token),
        cache: "no-store",
      },
    );

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const body = isApiRecord(payload) ? payload : {};
      throw new Error(
        String(body.message || body.error || `Unable to load proctoring report (${response.status}).`),
      );
    }

    return toProctoringOverview(payload);
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

    const payload: unknown = await res.json();
    const entries = getApiRecords(payload);

    const mapped: StudentRecord[] = entries.map((entry, index) => {
      const rawFinalScore = numericValue(entry.finalScore ?? entry.score, 0);

      const rawTotalMarks = numericValue(entry.totalMarks, totalMarks);

      const derivedPercentage =
        rawTotalMarks > 0 ? (rawFinalScore / rawTotalMarks) * 100 : 0;

      const percentage = numericValue(entry.percentage, derivedPercentage);

      const timeTakenSeconds = numericValue(entry.totalTimeTaken, 0);

      const name = String(entry.studentName ?? "").trim() || "Candidate";
      const registrationNumber = String(
        entry.registrationNumber ??
        entry.registrationNo ??
        entry.regNo ??
        entry.regNumber ??
        entry.studentRegistrationNumber ??
        ""
      ).trim();
      const status = typeof entry.status === "string" ? entry.status : null;
      const rawTerminationReason =
        entry.terminationReason ?? entry.finalizationReason ?? entry.submissionReason;
      const terminationReason =
        typeof rawTerminationReason === "string" && rawTerminationReason.trim()
          ? rawTerminationReason.trim()
          : null;
      const rawAttemptId = Number(entry.attemptId);
      const attemptId =
        Number.isSafeInteger(rawAttemptId) && rawAttemptId > 0
          ? rawAttemptId
          : undefined;
      const avatar =
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "ST";

      const rawStudentId = entry.studentId ?? entry.rank;
      const id =
        typeof rawStudentId === "string" || typeof rawStudentId === "number"
          ? rawStudentId
          : index + 1;

      return {
        id,
        attemptId,
        name,
        registrationNumber,
        avatar,
        status,
        terminationReason,
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

        setProctoringLoading(true);
        setProctoringError(null);
        try {
          const report = await loadProctoringOverview(quiz.quizCode);
          if (cancelled) return;
          setProctoringOverview(report);
        } catch (reportError) {
          if (cancelled) return;
          setProctoringOverview(null);
          setProctoringError(
            getErrorMessage(
              reportError,
              "The backend proctoring report could not be loaded.",
            ),
          );
        } finally {
          if (!cancelled) setProctoringLoading(false);
        }

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
      } catch (error: unknown) {
        if (cancelled) return;

        console.error("Backend assessment fetch error:", error);
        setAssessmentData(null);
        setStudents([]);
        setLeaderboardUnavailable(true);
        setLifecycleError(
          getErrorMessage(
            error,
            "We couldn't retrieve this assessment from the server.",
          ),
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

      const updated = res.status === 204
        ? null
        : await res.json().catch(() => null);

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
    } catch (error: unknown) {
      setResultVisibility(previousVisibility);
      setSettingsError(
        getErrorMessage(error, "Failed to update assessment settings on the server."),
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
    } catch (error: unknown) {
      setLifecycleError(getErrorMessage(error, "Failed to publish assessment."));
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
    } catch (error: unknown) {
      setLifecycleError(getErrorMessage(error, "Failed to complete assessment."));
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
    } catch (error: unknown) {
      setLifecycleError(
        getErrorMessage(error, "Failed to update result publication."),
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

  // Do not restrict result-visibility controls by assessment status in the frontend.
  // The backend remains authoritative and may still reject an update.

  const submitted = students;

  const highScoreMarks = Math.max(
    ...(submitted.length > 0
      ? submitted.map((student) => Number(student.finalScore) || 0)
      : [0]),
  );

  const topThree = [...submitted]
    .sort(
      (a, b) =>
        b.percentage - a.percentage || a.timeTakenSeconds - b.timeTakenSeconds,
    )
    .slice(0, 3);

  const scoreDistribution = useMemo(() => {
    const bands = [
      { min: 0, max: 20, label: "0–20%", color: "bg-gradient-to-r from-rose-400 via-rose-400 to-rose-500" },
      { min: 20, max: 40, label: "20–40%", color: "bg-gradient-to-r from-orange-300 via-amber-300 to-amber-400" },
      { min: 40, max: 60, label: "40–60%", color: "bg-gradient-to-r from-amber-300 via-yellow-300 to-lime-300" },
      { min: 60, max: 80, label: "60–80%", color: "bg-gradient-to-r from-sky-300 via-blue-300 to-blue-400" },
      { min: 80, max: 100, label: "80–100%", color: "bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400" },
    ];

    return bands.map((band, index) => ({
      ...band,
      count: submitted.filter((student) => {
        const percentage = Math.min(100, Math.max(0, Number(student.percentage) || 0));
        return index === 0
          ? percentage >= band.min && percentage <= band.max
          : percentage > band.min && percentage <= band.max;
      }).length,
    }));
  }, [submitted]);

  const averageMarks = submitted.length
    ? submitted.reduce((total, student) => total + (Number(student.finalScore) || 0), 0) / submitted.length
    : 0;

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

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = ranked.filter((student) =>
      student.name.toLowerCase().includes(normalizedQuery) ||
      student.registrationNumber.toLowerCase().includes(normalizedQuery),
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
      <main
        className="assessment-governance min-h-screen bg-frost-surface p-4 font-sans md:p-6 lg:p-8"
        aria-busy="true"
      >
        <span role="status" className="sr-only">
          Loading assessment details
        </span>
        <div
          aria-hidden="true"
          className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col overflow-hidden rounded-cards border border-mist-blue bg-paper-white shadow-xl"
        >
          {/* Header skeleton */}
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-mist-blue/40 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="assessment-skeleton h-4 w-20" />
              <div className="h-5 w-px bg-mist-blue/50" />
              <div className="assessment-skeleton h-7 w-24 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <div className="assessment-skeleton h-10 w-10 rounded-full" />
              <div className="assessment-skeleton h-10 w-32 rounded-xl" />
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5 md:p-6">
            {/* Assessment title and state */}
            <section className="assessment-skeleton-panel relative overflow-hidden rounded-[24px] border p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="assessment-skeleton h-3 w-36" />
                  <div className="assessment-skeleton h-7 w-2/3 max-w-sm" />
                  <div className="flex flex-wrap gap-3 pt-1">
                    <div className="assessment-skeleton h-3 w-32" />
                    <div className="assessment-skeleton h-3 w-20" />
                    <div className="assessment-skeleton h-3 w-16" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="assessment-skeleton h-7 w-24 rounded-full" />
                  <div className="assessment-skeleton h-9 w-32 rounded-xl" />
                </div>
              </div>
              <Trophy className="assessment-skeleton-ghost-icon absolute -bottom-2 right-7 h-24 w-24" />
            </section>

            {/* Student result visibility */}
            <section className="assessment-skeleton-panel rounded-[20px] border p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-mist-blue/40 pb-3">
                <Eye className="assessment-skeleton-icon h-4 w-4" />
                <div className="assessment-skeleton h-3 w-48" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[0, 1].map((item) => (
                  <div key={item} className="assessment-skeleton-option flex min-w-0 items-center justify-between gap-3 rounded-[15px] border p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="assessment-skeleton-icon-wrap flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                        {item === 0 ? (
                          <Trophy className="assessment-skeleton-icon h-5 w-5" />
                        ) : (
                          <BarChart3 className="assessment-skeleton-icon h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="assessment-skeleton h-3 w-32 max-w-full" />
                        <div className="assessment-skeleton h-2.5 w-52 max-w-full" />
                      </div>
                    </div>
                    <div className="assessment-skeleton h-5 w-9 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            </section>

            {/* Scoring and review settings */}
            <section className="assessment-skeleton-panel rounded-[14px] border p-4">
              <div className="mb-3 space-y-2 border-b border-mist-blue/40 pb-3">
                <div className="assessment-skeleton h-3 w-44" />
                <div className="assessment-skeleton h-2.5 w-3/4 max-w-2xl" />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="assessment-skeleton-option rounded-xl border p-3.5">
                    <div className="assessment-skeleton mb-2 h-2.5 w-24" />
                    <div className="assessment-skeleton h-3.5 w-32 max-w-full" />
                  </div>
                ))}
              </div>
            </section>

            {/* Summary statistics */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[Users, TrendingUp, Award, ClipboardList, Clock].map((Icon, item) => (
                <div key={item} className="assessment-skeleton-stat flex min-w-0 items-center gap-3 rounded-2xl border p-4">
                  <div className="assessment-skeleton-icon-wrap flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                    <Icon className="assessment-skeleton-icon h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="assessment-skeleton h-5 w-12" />
                    <div className="assessment-skeleton h-2.5 w-20 max-w-full" />
                  </div>
                </div>
              ))}
            </section>

            {/* Top performers */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="assessment-skeleton-icon-wrap flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Trophy className="assessment-skeleton-icon h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <div className="assessment-skeleton h-3.5 w-32" />
                  <div className="assessment-skeleton h-2.5 w-48" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="assessment-skeleton-performer rounded-[18px] border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="assessment-skeleton h-9 w-9 rounded-full" />
                      <Award className="assessment-skeleton-ghost-icon h-5 w-5" />
                    </div>
                    <div className="assessment-skeleton mb-2 h-3.5 w-36 max-w-full" />
                    <div className="assessment-skeleton mb-5 h-2.5 w-24" />
                    <div className="assessment-skeleton mb-2 h-6 w-20" />
                    <div className="assessment-skeleton h-2.5 w-12" />
                  </div>
                ))}
              </div>
            </section>

            {/* Leaderboard toolbar */}
            <section className="assessment-skeleton-panel flex flex-col justify-between gap-4 rounded-[20px] border p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="assessment-skeleton-icon-wrap flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                  <Trophy className="assessment-skeleton-icon h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <div className="assessment-skeleton h-4 w-36" />
                  <div className="assessment-skeleton h-2.5 w-56 max-w-full" />
                  <div className="assessment-skeleton h-2 w-40" />
                </div>
              </div>
              <div className="assessment-skeleton h-10 w-full rounded-xl sm:max-w-xs" />
            </section>

            {/* Leaderboard table: same eight-column proportions as the real table */}
            <section className="assessment-skeleton-panel overflow-hidden rounded-[18px] border">
              <div className="overflow-x-auto">
                <div className="assessment-skeleton-table-head grid min-w-[1040px] grid-cols-[32px_minmax(140px,1.2fr)_minmax(120px,1fr)_80px_90px_80px_110px_100px] items-center gap-3 border-b px-4 py-4">
                {[12, 44, 68, 35, 45, 40, 42, 52].map((width, item) => (
                  <div key={item} className="assessment-skeleton h-2.5" style={{ width: `${width}px` }} />
                ))}
                </div>
                <div className="min-w-[1040px] divide-y divide-mist-blue/30">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="assessment-skeleton-table-row grid grid-cols-[32px_minmax(140px,1.2fr)_minmax(120px,1fr)_80px_90px_80px_110px_100px] items-center gap-3 px-4 py-4">
                      <div className="assessment-skeleton h-8 w-8 rounded-full" />
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="assessment-skeleton h-8 w-8 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="assessment-skeleton h-3 w-28 max-w-full" />
                          <div className="assessment-skeleton h-2 w-20" />
                        </div>
                      </div>
                      <div className="assessment-skeleton h-3 w-24 max-w-full" />
                      <div className="assessment-skeleton mx-auto h-3 w-12" />
                      <div className="space-y-2">
                        <div className="assessment-skeleton mx-auto h-3 w-10" />
                        <div className="assessment-skeleton mx-auto h-1.5 w-16 rounded-full" />
                      </div>
                      <div className="assessment-skeleton mx-auto h-3 w-10" />
                      <div className="assessment-skeleton h-7 w-full rounded-full" />
                      <div className="assessment-skeleton h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (!assessmentData) {
    return (
      <main className="min-h-screen bg-frost-surface flex items-center justify-center p-4 font-sans text-midnight-navy dark:text-slate-100">
        <div className="w-full max-w-md rounded-[14px] bg-paper-white dark:bg-white dark:bg-slate-900 border border-mist-blue/70 p-7 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-pastel-pink-text" />
          <h1 className="mt-4 text-lg font-bold">Unable to load assessment</h1>
          <p className="mt-2 text-xs leading-relaxed text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
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
    <main className="assessment-governance min-h-screen bg-frost-surface text-midnight-navy dark:text-slate-100 p-4 md:p-6 lg:p-8 font-sans selection:bg-frost-surface selection:text-signal-green">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-cards bg-paper-white dark:bg-white dark:bg-slate-900 shadow-xl border border-mist-blue overflow-hidden text-left">
        <header className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-mist-blue/30 px-4 py-4 bg-paper-white dark:bg-white dark:bg-slate-900 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="flex items-center gap-2 text-xs font-bold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 hover:text-midnight-navy dark:text-slate-100 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-mist-blue/30">|</span>
            <Logo />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <ThemeToggle />
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
          </div>
        </header>

        {isLanExamMode() && assessmentData && (
          <LanExamPreflight
            quiz={{
              quizCode: assessmentData.quizCode,
              status,
              totalStudents: assessmentData.totalStudents,
              totalQuestions: assessmentData.totalQuestions,
              allowedRegistrationNumbers:
                assessmentData.allowedRegistrationNumbers,
            }}
          />
        )}

        <div className="flex flex-1 flex-col gap-5 p-5 md:p-6 bg-paper-white dark:bg-white dark:bg-slate-900">
          <div className="assessment-hero relative isolate overflow-hidden rounded-[24px] border border-[#dce7ff] dark:border-slate-700 bg-gradient-to-br from-[#f8f6ff] via-white dark:via-slate-900 to-[#eaf5ff] px-5 py-5 sm:px-7 sm:py-6 shadow-[0_8px_30px_rgba(71,100,180,0.08)]">
            <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-12 h-48 w-48 rounded-full bg-[#dceaff]/60 blur-2xl" />
            <div aria-hidden="true" className="pointer-events-none absolute right-24 top-10 h-28 w-28 rounded-full bg-[#fce7f3]/60 blur-2xl" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:pr-44">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                Assessment Governance
              </p>

              <h1 className="text-xl font-bold text-midnight-navy dark:text-slate-100 mt-0.5">
                {assessmentData.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400" />
                  {formatDateTime(assessmentData.startTime)}
                </span>

                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400" />
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
                    ? "bg-[#ece9f3] text-[#4c3d73] dark:text-violet-200"
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
                  {lifecycleLoading ? <LoadingIndicator label="Publishing quiz" size="sm" /> : "Publish Quiz"}
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
                    ? "bg-[#e6e3e2]/60 text-[#78716b] dark:text-slate-400 cursor-not-allowed"
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
            <div aria-hidden="true" className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 sm:block">
              <div className="relative flex h-36 w-44 items-center justify-center">
                <div className="absolute bottom-2 h-12 w-40 rounded-full bg-[#dbeafe]/70 blur-md" />
                <div className="absolute bottom-3 left-5 h-14 w-14 rotate-[-12deg] rounded-[12px] bg-gradient-to-br from-[#c4b5fd] to-[#818cf8] opacity-80 shadow-sm" />
                <div className="absolute bottom-3 right-4 h-16 w-14 rotate-[10deg] rounded-[12px] bg-gradient-to-br from-[#bfdbfe] to-[#60a5fa] opacity-80 shadow-sm" />
                <div className="absolute bottom-3 h-20 w-20 rounded-[22px] bg-gradient-to-br from-[#fff1bf] to-[#fbbf24] shadow-[0_10px_24px_rgba(245,158,11,0.22)]" />
                <div className="relative z-10 flex h-20 w-20 items-center justify-center text-[#b45309]">
                  <Trophy className="h-12 w-12 drop-shadow-sm" strokeWidth={1.7} />
                </div>
                <Sparkles className="absolute right-1 top-4 h-5 w-5 text-[#fb923c]" />
                <Star className="absolute left-2 top-7 h-4 w-4 fill-[#fbbf24] text-[#fbbf24]" />
                <span className="absolute right-7 top-0 text-sm text-[#f472b6]">✦</span>
                <span className="absolute bottom-0 left-2 text-lg text-[#60a5fa]">✦</span>
              </div>
            </div>
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
              <div className="w-full max-w-sm rounded-[14px] bg-white dark:bg-slate-900 p-6 shadow-2xl border border-[#d1dee8]/80 dark:border-slate-700 space-y-4 text-left">
                <h3 className="text-sm font-black text-[#111111] dark:text-slate-100">
                  Complete Assessment?
                </h3>

                <p className="text-xs text-[#78716b] dark:text-slate-400 leading-relaxed font-medium">
                  Completing this assessment changes its state to completed.
                  Results can then be published to students.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCompleteOpen(false)}
                    className="rounded-[10px] border border-[#d1dee8]/80 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-[#78716b] dark:text-slate-400 hover:bg-[#f5f5f4] dark:bg-slate-950 hover:border-[#b9cbd9] shadow-xs cursor-pointer transition-all"
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

          <section className="assessment-result-visibility rounded-[20px] border border-[#dce7ff] dark:border-slate-700 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-3 shadow-[0_5px_20px_rgba(71,100,180,0.06)]">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-midnight-navy dark:text-slate-100 flex items-center gap-2 border-b border-[#e6edfb] dark:border-slate-700 pb-3">
              <Eye className="h-4 w-4 text-[#3984ff]" />
              Student Result Visibility
            </h3>

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
                  disabled={settingsSaving}
                  className={`assessment-result-visibility-option flex items-center justify-between gap-3 rounded-[15px] border p-3.5 text-left transition-all duration-200 ${
                    item.active
                      ? "is-active border-[#b8ccf5] bg-[#f8fbff] text-midnight-navy dark:text-slate-100 ring-1 ring-[#dce8ff]"
                      : "is-inactive border-[#e2e8f0] bg-white dark:bg-slate-900 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 hover:border-[#cbd5e1] hover:bg-slate-50"
                  } ${
                    settingsSaving
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer active:scale-[0.98] shadow-xs"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`assessment-result-visibility-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${"bg-[#eef4ff] dark:bg-blue-950/50 text-[#315fba]"}`}>
                      {item.label === "Show Leaderboard" ? <Trophy className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0 text-left">
                    <span className="assessment-result-visibility-label block text-xs font-bold text-midnight-navy dark:text-slate-100">
                      {item.label}
                    </span>
                    <span className="assessment-result-visibility-hint block text-[10px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      {item.hint}
                    </span>
                    </span>
                  </div>

                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 ${
                      item.active ? "bg-[#2563eb]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`assessment-result-switch-knob inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 shadow-xs transition-transform duration-150 ${
                        item.active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[14px] border border-slate-200 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
            <div className="border-b border-[#d1dee8]/40 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-midnight-navy dark:text-slate-100">Student Result Details</h3>
              <p className="mt-1 text-[10px] font-medium text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Relevant scoring and review rules from the assessment settings. These are displayed for clarity; changing them here does not alter the completed attempt scores.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  label: "Scoring method",
                  value: assessmentData.negativeMarking
                    ? `Negative marking (${formatMarks(assessmentData.negativeMarks)} marks deducted per incorrect answer)`
                    : "No negative marking",
                },
                {
                  label: "Time bonus",
                  value: assessmentData.timeBonusEnabled ? "Enabled" : "Not enabled",
                },
                {
                  label: "Question review",
                  value: assessmentData.allowReview ? "Allowed by assessment settings" : "Not allowed by assessment settings",
                },
                {
                  label: "Resume attempt",
                  value: assessmentData.allowResume ? "Allowed by assessment settings" : "Not allowed by assessment settings",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-[10px] border border-slate-200 bg-white dark:bg-slate-900 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-midnight-navy dark:text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
                value: String(formatMarks(highScoreMarks)),
              },
              {
                icon: <ClipboardList className="h-4 w-4 text-signal-green" />,
                label: "Total Marks",
                value: formatMarks(assessmentData.totalMarks),
              },
              {
                icon: <Clock className="h-4 w-4 text-signal-green" />,
                label: "Exam Duration",
                value: `${Math.floor(
                  assessmentData.overallTimerSeconds / 60,
                )}m`,
              },
            ].map((stat, index) => {
              const palette = [
                { card: "border-slate-200 bg-white dark:bg-slate-900", icon: "bg-slate-100 text-slate-600", decor: "text-slate-200" },
                { card: "border-slate-200 bg-white dark:bg-slate-900", icon: "bg-slate-100 text-slate-600", decor: "text-slate-200" },
                { card: "border-slate-200 bg-white dark:bg-slate-900", icon: "bg-slate-100 text-slate-600", decor: "text-slate-200" },
                { card: "border-slate-200 bg-white dark:bg-slate-900", icon: "bg-slate-100 text-slate-600", decor: "text-slate-200" },
                { card: "border-slate-200 bg-white dark:bg-slate-900", icon: "bg-slate-100 text-slate-600", decor: "text-slate-200" },
              ][index];
              const decorativeIcon = [
                <Users key="users" className="h-11 w-11" />,
                <CheckCircle2 key="check" className="h-11 w-11" />,
                <TrendingUp key="trend" className="h-11 w-11" />,
                <FileText key="file" className="h-11 w-11" />,
                <Clock key="clock" className="h-11 w-11" />,
              ][index];
              return (
              <div
                key={stat.label}
                className={`assessment-stat group relative isolate overflow-hidden flex items-center gap-3 rounded-[14px] border p-4 shadow-sm transition-colors duration-200 hover:border-slate-300 hover:shadow-md ${palette.card}`}
              >
                <div aria-hidden="true" className={`pointer-events-none absolute bottom-2 right-2 z-0 opacity-10 ${palette.decor}`}>{decorativeIcon}</div>
                <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${palette.icon}`}>
                  {stat.icon}
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-midnight-navy dark:text-slate-100">
                    {stat.value}
                  </p>
                  <p className="text-[9px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              </div>
              );
            })}
          </div>

          {submitted.length > 0 && (
            <section className="rounded-[16px] border border-slate-200 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm text-left">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-midnight-navy dark:text-slate-100"><BarChart3 className="h-4 w-4 text-[#8b5cf6]" />Class Performance</h2>
                  <p className="mt-1 text-xs text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">A percentage-based view of submitted attempts.</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="min-w-[112px] rounded-[12px] border border-slate-200 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-sm dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#2563eb] dark:text-blue-300" />
                      <p className="text-lg font-extrabold tabular-nums text-[#155eef] dark:text-blue-200">{formatMarks(averageMarks)}</p>
                    </div>
                    <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#3265b8] dark:text-blue-300">Average marks</p>
                  </div>
                  <div className="min-w-[100px] rounded-[12px] border border-slate-200 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-sm dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#059669] dark:text-emerald-300" />
                      <p className="text-lg font-extrabold tabular-nums text-[#047857] dark:text-emerald-200">{submitted.length}</p>
                    </div>
                    <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#087f5b] dark:text-emerald-300">Submitted</p>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between border-b border-[#d1dee8]/50 dark:border-slate-700 pb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Percentage range</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Students</p>
              </div>

              <div className="space-y-4">
                {scoreDistribution.map((band) => {
                  const maximumCount = Math.max(1, ...scoreDistribution.map((item) => item.count));
                  const barWidth = (band.count / maximumCount) * 100;
                  return (
                    <div key={band.label} title={`${band.label}: ${band.count} students`} className="group grid grid-cols-[84px_minmax(0,1fr)_44px] items-center gap-3 sm:grid-cols-[104px_minmax(0,1fr)_48px]">
                      <span className="inline-flex w-fit min-w-[76px] justify-center rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:text-xs">{band.label}</span>
                      <div
                        className="relative h-4 overflow-hidden rounded-full border border-slate-200/60 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
                        role="progressbar"
                        aria-label={`Students scoring ${band.label}`}
                        aria-valuemin={0}
                        aria-valuemax={maximumCount}
                        aria-valuenow={band.count}
                      >
                        <div
                          className={`h-full rounded-full ${band.color} shadow-sm transition-[width] duration-700 ease-out group-hover:brightness-105`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="inline-flex min-w-9 justify-center rounded-full bg-slate-100 px-2 py-1 text-right text-xs font-extrabold tabular-nums text-midnight-navy dark:bg-slate-800 dark:text-slate-100">{band.count}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[10px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Bars compare student counts across percentage ranges. Empty ranges remain visible.</p>
            </section>
          )}

          <section className="text-left">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fff0b8] to-[#ffd45f] text-[#b45309] shadow-sm">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-midnight-navy dark:text-slate-100 uppercase tracking-wider">Top Performers</h2>
                <p className="mt-0.5 text-[11px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Celebrating the highest-scoring submissions.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {topThree.map((student, pos) => {
                const c = podiumRingColor(pos);

                return (
                  <div
                    key={student.id || pos}
                    className={`assessment-top-performer-card relative isolate overflow-hidden rounded-[18px] border p-4 shadow-[0_5px_18px_rgba(71,100,180,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(71,100,180,0.11)] ${pos === 0 ? "is-gold border-[#f8df98] bg-gradient-to-br from-[#fffaf0] via-white dark:via-slate-900 to-[#fff1c9] dark:to-amber-950/30" : pos === 1 ? "is-silver border-[#dce4f0] dark:border-slate-700 bg-gradient-to-br from-[#f7faff] dark:from-slate-900 to-[#edf2f9] dark:to-slate-800" : "is-bronze border-[#f6d8c8] bg-gradient-to-br from-[#fff8f3] dark:from-slate-900 to-[#ffeadf] dark:to-slate-800"}`}
                  >
                    <span className="absolute right-3.5 top-3.5 text-lg">
                      {c.icon}
                    </span>

                    <div
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full ${c.bg} ${c.text} text-[10px] font-bold shadow-xs`}
                    >
                      {student.avatar}
                    </div>

                    <p className="font-bold text-midnight-navy dark:text-slate-100 truncate pr-6 text-xs text-left">
                      {student.name}
                    </p>

                    <p className="text-[10px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 font-medium text-left">
                      Rank #{pos + 1} · {student.timeTaken || "00:00"}
                    </p>

                    <div className="mt-3 text-left">
                      <p className="text-xl font-bold text-midnight-navy dark:text-slate-100">
                        {formatMarks(student.finalScore)} /{" "}
                        {formatMarks(student.totalMarks)}
                      </p>

                      <p className="text-[10px] font-bold text-signal-green">
                        {formatPercentage(student.percentage)}%
                      </p>

                      <p className="text-[8px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400 font-bold uppercase">
                        Score
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-1 flex-col">
            <div className="assessment-leaderboard-toolbar mb-4 flex flex-col gap-3 rounded-[20px] border border-[#dce7ff] dark:border-slate-700 bg-gradient-to-r from-[#f7faff] dark:from-slate-900 via-white dark:via-slate-900 to-[#f8f5ff] dark:to-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between shadow-[0_4px_16px_rgba(71,100,180,0.05)]">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#dceaff] to-[#c7d2fe] text-[#315ce8] shadow-sm">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold tracking-tight text-midnight-navy dark:text-slate-100">Student Leaderboard</h2>
                    <p className="mt-0.5 text-[11px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                      Ranked by score, with completion time as the tie-breaker.
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                  Showing {displayList.length} of {submitted.length} submissions
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or registration no."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-[10px] border border-[#d1dee8]/80 dark:border-slate-700 bg-paper-white dark:bg-white dark:bg-slate-900 py-2.5 pl-9 pr-4 text-xs font-medium text-midnight-navy dark:text-slate-100 outline-none transition-all placeholder:text-steel-blue-gray/70 focus:border-[#165dfb] focus:ring-2 focus:ring-[#165dfb]/15"
                />
              </div>
            </div>

            <div className="assessment-leaderboard-table flex-1 overflow-x-auto rounded-[18px] border border-[#dce7ff] dark:border-slate-700 bg-white dark:bg-slate-900 text-left shadow-[0_6px_22px_rgba(71,100,180,0.06)]">
              <div className="min-w-[1040px]">
              <div className="assessment-leaderboard-table-header grid min-w-[1040px] grid-cols-[32px_minmax(140px,1.2fr)_minmax(120px,1fr)_80px_90px_80px_110px_100px] items-center gap-3 border-b border-[#dce7ff] dark:border-slate-700 bg-gradient-to-r from-[#f4f8ff] dark:from-slate-800 to-[#faf7ff] dark:to-slate-800 px-4 py-3">
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
                  label="Registration No."
                  col="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />

                <Th
                  label="Score"
                  col="score"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />

                <Th
                  label="Percentage"
                  col="score"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />

                <Th
                  label="Time Taken"
                  col="timeTaken"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />

                <span className="w-full whitespace-nowrap text-center text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Status</span>
                <span className="w-full whitespace-nowrap text-center text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Proctoring</span>
              </div>

              {leaderboardUnavailable ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                  <p className="text-xs font-medium text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                    Leaderboard isn&apos;t available yet.
                  </p>
                </div>
              ) : displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                  <Search className="h-6 w-6 text-mist-blue" />
                  <p className="text-xs">
                    No submitted attempts match your query.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#d1dee8]/50 bg-paper-white dark:bg-white dark:bg-slate-900">
                  {displayList.map((student) => (
                    <li
                      key={student.id}
                      className="assessment-leaderboard-row grid min-w-[1040px] grid-cols-[32px_minmax(140px,1.2fr)_minmax(120px,1fr)_80px_90px_80px_110px_100px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f6f9ff] dark:hover:bg-slate-800/70 dark:bg-slate-800/70"
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${student.rank === 1 ? "bg-amber-100 text-amber-800" : student.rank === 2 ? "bg-slate-100 text-slate-700" : student.rank === 3 ? "bg-orange-100 text-orange-800" : "bg-frost-surface text-steel-blue-gray dark:text-slate-500 dark:text-slate-400"}`}>
                        {student.rank}
                      </span>

                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-frost-surface border border-mist-blue/30 text-midnight-navy dark:text-slate-100 font-bold text-[10px] shadow-xs">
                          {student.avatar}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-midnight-navy dark:text-slate-100">
                            {student.name}
                          </p>
                          {student.status && (
                            <p className="mt-1 text-[9px] font-medium text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                              {student.status.replaceAll("_", " ")}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="truncate font-mono text-[11px] font-medium text-steel-blue-gray dark:text-slate-500 dark:text-slate-400" title={student.registrationNumber || "Registration number unavailable"}>
                        {student.registrationNumber || "—"}
                      </span>

                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span className="text-xs font-bold tabular-nums text-midnight-navy dark:text-slate-100">
                          {formatMarks(student.finalScore)} / {formatMarks(student.totalMarks)}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold tabular-nums text-midnight-navy dark:text-slate-100">{formatPercentage(student.percentage)}%</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e3ebfb]">
                          <span className="block h-full rounded-full bg-gradient-to-r from-[#3984ff] to-[#7c5cff]" style={{ width: `${Math.max(0, Math.min(100, student.percentage))}%` }} />
                        </span>
                      </div>

                      <div className="flex justify-center">
                        <span className="font-mono text-[10px] font-semibold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">
                          {student.timeTaken || "00:00"}
                        </span>
                      </div>

                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${student.status === "SUBMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${student.status === "SUBMITTED" ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {(() => {
                            const status = String(student.status || "UNKNOWN").toUpperCase();
                            const reason = String(student.terminationReason || "").toUpperCase();
                            if (status === "SUBMITTED") return "Submitted";
                            if (status === "AUTO_SUBMITTED") {
                              if (/DEADLINE|TIME_LIMIT|TIMEOUT|EXPIRED/.test(reason)) {
                                return "Auto-submitted · Deadline";
                              }
                              if (/PROCTOR|MALPRACTICE|VIOLATION|WARNING_LIMIT/.test(reason)) {
                                return "Auto-submitted · Proctoring limit";
                              }
                              return "Auto-submitted";
                            }
                            return status.replaceAll("_", " ");
                          })()}
                        </span>
                      </div>

                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setSelectedProctoringStudent(student)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          aria-label={`View proctoring issues for ${student.name}`}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          View issues
                        </button>
                      </div>

                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>
          </section>
        </div>
      {selectedProctoringStudent && (() => {
        const student = selectedProctoringStudent;
        const report = proctoringOverview?.studentReports.find((item) =>
          (student.attemptId != null && item.attemptId != null &&
            String(item.attemptId) === String(student.attemptId)) ||
          (item.studentId != null && String(item.studentId) === String(student.id)) ||
          (item.studentName != null &&
            item.studentName.trim().toLowerCase() === student.name.trim().toLowerCase())
        );
        const events = Array.isArray(report?.events) ? report.events : [];
        const countEvent = (type: string) => events.filter((event) =>
          String(event.eventType || "").toUpperCase() === type
        ).length;
        const browserMetrics: Array<[string, number]> = [
          ["Tab switches", countEvent("TAB_SWITCH")],
          ["Fullscreen exits", countEvent("FULLSCREEN_EXIT")],
          ["Copy attempts", countEvent("COPY_ATTEMPT")],
          ["Cut attempts", countEvent("CUT_ATTEMPT")],
          ["Paste attempts", countEvent("PASTE_ATTEMPT")],
          ["Right-clicks", countEvent("RIGHT_CLICK")],
          ["Focus losses", countEvent("FOCUS_LOSS")],
          ["Restricted shortcuts", events.filter((event) => String(event.eventType || "").toUpperCase() === "KEYBOARD_ATTEMPT" && !/screenshot/i.test(String(event.details || ""))).length],
          ["Screenshot attempts", events.filter((event) =>
            String(event.eventType || "").toUpperCase() === "SCREENSHOT_ATTEMPT" ||
            String(event.details || "").toLowerCase().includes("screenshot")
          ).length],
          ["Refreshes", countEvent("REFRESH_COUNT")],
          ["Reconnections", countEvent("RECONNECT_COUNT")],
        ];
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProctoringStudent(null);
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="student-proctoring-title" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-200 bg-white dark:bg-slate-900 p-4 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 id="student-proctoring-title" className="flex items-center gap-2 text-base font-extrabold text-midnight-navy dark:text-slate-100">
                    <ShieldAlert className="h-5 w-5 text-amber-700" />
                    Proctoring issues
                  </h2>
                  <p className="mt-1 text-xs text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">{student.name} · Registration {student.registrationNumber || "unavailable"}</p>
                </div>
                <button type="button" onClick={() => setSelectedProctoringStudent(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Close</button>
              </div>
              {proctoringLoading && !proctoringOverview ? (
                <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading proctoring report">
                  <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" /><SkeletonBlock className="h-4 w-36 rounded" /></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[{ icon: ShieldCheck }, { icon: Users }, { icon: Clock }].map(({ icon: ReportIcon }, index) => <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center gap-2"><ReportIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" /><SkeletonBlock className="h-3 w-24 rounded" /></div><SkeletonBlock className="h-6 w-16 rounded" /><SkeletonBlock className="h-3 w-full rounded" /></div>)}
                  </div>
                  {[1, 2, 3].map((row) => <div key={row} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"><Clock className="h-4 w-4 shrink-0 text-slate-400" /><div className="flex-1 space-y-2"><SkeletonBlock className="h-3 w-3/4 rounded" /><SkeletonBlock className="h-2.5 w-1/2 rounded" /></div><SkeletonBlock className="h-6 w-16 rounded-full" /></div>)}
                  <p className="sr-only" role="status">Loading proctoring report</p>
                </div>
              ) : proctoringError ? (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{proctoringError}</p>
              ) : !report ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No per-student proctoring report was returned for this submission. Refresh the report and check that the backend includes this student’s attempt events.

                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Attempt status", humanizeEvent(report.status || student.status || "UNKNOWN")],
                      ["AI warnings", report.warningCount ?? 0],
                      ["Risk score", report.riskScore ?? 0],
                      ["Risk level", humanizeEvent(report.riskLevel || "UNKNOWN")],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">{label}</p>
                        <p className="mt-1 text-sm font-extrabold text-midnight-navy dark:text-slate-100">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-midnight-navy dark:text-slate-100">Browser activity</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {browserMetrics.map(([label, count]) => (
                        <div key={label} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-[10px] font-semibold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">{label}</p>
                          <p className={`mt-1 text-lg font-extrabold ${count > 0 ? "text-rose-700" : "text-midnight-navy dark:text-slate-100"}`}>{count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Termination reason</p>
                      <p className="mt-1 text-xs font-semibold text-midnight-navy dark:text-slate-100">{report.terminationReason ? humanizeEvent(report.terminationReason) : "None reported"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Recorded events</p>
                      <p className="mt-1 text-xs font-semibold text-midnight-navy dark:text-slate-100">{Math.max(numericValue(report.totalViolationsCount), events.length)}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-midnight-navy dark:text-slate-100">Recorded event timeline ({events.length})</h3>
                    {events.length === 0 ? (
                      <p className="rounded-lg bg-slate-50 p-3 text-xs text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">No event timeline was included in the report. Zero counters cannot confirm that no browser activity occurred.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[600px] text-left">
                          <thead className="bg-slate-50"><tr>
                            <th className="px-3 py-2 text-[10px] font-bold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Time</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Event</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Severity</th>
                            <th className="px-3 py-2 text-[10px] font-bold text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">Details</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {events.map((event, index) => (
                              <tr key={String(event.id ?? index)}>
                                <td className="whitespace-nowrap px-3 py-2 text-[10px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">{formatDateTime(event.timestamp)}</td>
                                <td className="px-3 py-2 text-[10px] font-bold text-midnight-navy dark:text-slate-100">{humanizeEvent(event.eventType)}</td>
                                <td className="px-3 py-2 text-[10px] text-midnight-navy dark:text-slate-100">{event.severity || "—"}</td>
                                <td className="px-3 py-2 text-[10px] text-steel-blue-gray dark:text-slate-500 dark:text-slate-400">{event.details || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        );
      })()}
      </div>
    </main>
  );
}
