"use client";

import { use, useState, useMemo, useEffect } from "react";
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
  Monitor,
  Eye,
  Copy,
  MousePointerClick,
  CalendarDays,
  Clock,
  CheckCircle2,
  Trophy,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { getStoredResults, getStoredTests } from "@/lib/storage";
import { resolveQuizIdentifiers } from "@/lib/quizCache";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

type FlagType =
  | "tab_switch"
  | "fullscreen_exit"
  | "right_click"
  | "copy_attempt";
type SortKey = "rank" | "name" | "score" | "timeTaken" | "flagCount";
type SortDir = "asc" | "desc";

interface StudentRecord {
  id: number;
  name: string;
  avatar: string;
  score: number;
  accuracyPercentage?: number;
  timeTaken: string;
  timeTakenSeconds?: number;
  submitted: boolean;
  flags: { type: FlagType; label: string; count: number }[];
}

function avatarStyle(flagCount: number) {
  if (flagCount >= 4) return "bg-pastel-pink text-pastel-pink-text";
  if (flagCount >= 2) return "bg-pastel-yellow text-pastel-yellow-text";
  return "bg-frost-surface text-midnight-navy";
}

function flagIcon(type: FlagType) {
  const cls = "h-3 w-3 shrink-0";
  if (type === "tab_switch") return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt") return <Copy className={cls} />;
  return <MousePointerClick className={cls} />;
}

function flagChipStyle(type: FlagType) {
  if (type === "tab_switch" || type === "fullscreen_exit")
    return "bg-pastel-pink text-pastel-pink-text";
  return "bg-pastel-yellow text-pastel-yellow-text";
}

function totalFlags(s: StudentRecord) {
  return (s.flags || []).reduce((sum, f) => sum + f.count, 0);
}

function podiumRingColor(pos: number) {
  if (pos === 0)
    return {
      bg: "bg-pastel-yellow/30",
      border: "border-mist-blue/20",
      text: "text-pastel-yellow-text",
      icon: "🥇",
    };
  if (pos === 1)
    return {
      bg: "bg-frost-surface/30",
      border: "border-mist-blue/20",
      text: "text-signal-green",
      icon: "🥈",
    };
  return {
    bg: "bg-pastel-pink/20",
    border: "border-mist-blue/20",
    text: "text-pastel-pink-text",
    icon: "🥉",
  };
}

function exportCSV(testCode: string, data: StudentRecord[], title: string) {
  const headers = [
    "Rank",
    "Candidate Name",
    "Score (%)",
    "Accuracy (%)",
    "Time Taken",
    "Submitted",
    "Total Flags",
    "Flag Details",
  ];
  const rows = data.map((s, idx) => [
    idx + 1,
    s.name,
    s.score,
    s.accuracyPercentage ?? s.score,
    s.timeTaken,
    s.submitted ? "Yes" : "No",
    totalFlags(s),
    (s.flags || []).map((f) => `${f.label}×${f.count}`).join(" | ") || "None",
  ]);

  const csvContent = [
    `# Quizly Leaderboard Export — ${title} (${testCode})`,
    "",
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Quizly_${testCode}_Leaderboard.csv`;
  link.click();
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
  if (col !== active)
    return <ChevronsUpDown className="h-3.5 w-3.5 text-steel-blue-gray" />;
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
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exported, setExported] = useState(false);

  const [testSettings, setTestSettings] = useState({
    publishScoresImmediately: true,
    revealSolutions: true,
    showIntegrityFlagsToStudent: false,
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssessmentDetails = async () => {
      // The URL param may be a numeric quizId (e.g. "42") or an access code.
      // Resolve both identifiers from the local cache up front.
      const { quizId: resolvedId, quizCode } = resolveQuizIdentifiers(testCode);

      // Match stored tests by access code OR numeric quizId
      const localTest = getStoredTests().find(
        (t) =>
          t.testCode.toUpperCase() === quizCode.toUpperCase() ||
          (resolvedId &&
            String((t as any).quizId ?? (t as any).id) === resolvedId),
      );

      // Match stored submissions by the resolved access code or quizId
      const localStudents: StudentRecord[] = getStoredResults()
        .filter(
          (r) =>
            r.testCode.toUpperCase() === quizCode.toUpperCase() ||
            (resolvedId && String((r as any).quizId) === resolvedId),
        )
        .map((r, idx) => ({
          id: idx + 1,
          name: r.studentName || "Candidate",
          avatar: (r.studentName || "C").slice(0, 2).toUpperCase(),
          score: r.score || 0,
          accuracyPercentage:
            r.accuracyPercentage ??
            (r.totalQuestions > 0
              ? Math.round((r.correctCount / r.totalQuestions) * 100)
              : 0),
          timeTaken: `${Math.floor((r.timeTakenTotalSeconds || 0) / 60)}m ${(r.timeTakenTotalSeconds || 0) % 60}s`,
          timeTakenSeconds: r.timeTakenTotalSeconds || 0,
          submitted: true,
          flags: [],
        }));

      try {
        const token = localStorage.getItem("dynoquizz_token");
        const headers = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        };

        // Use quizCode for /code/{code}/… endpoints
        // Use resolvedId (numeric quizId) for the leaderboard if available
        const leaderboardUrl = resolvedId
          ? `${API_BASE}/api/v1/quizzes/${resolvedId}/leaderboard`
          : `${API_BASE}/api/v1/quizzes/${quizCode}/leaderboard`;

        // Fetch Quiz details and Leaderboard simultaneously
        const [pkgRes, lbRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/quizzes/code/${quizCode}/package`, {
            headers,
          }).catch(() => null),
          fetch(leaderboardUrl, { headers }).catch(() => null),
        ]);

        let pkgData: any = {};
        if (pkgRes && pkgRes.ok) {
          pkgData = await pkgRes.json();
        } else {
          // Fallback to teacher quiz endpoint by ID if /package by code was 404
          const altRes = await fetch(
            `${API_BASE}/api/v1/teacher/quizzes/${testCode}`,
            { headers },
          ).catch(() => null);
          if (altRes && altRes.ok) {
            pkgData = await altRes.json();
          }
        }

        let backendStudents: StudentRecord[] = [];
        let activeLbRes = lbRes;
        if ((!activeLbRes || !activeLbRes.ok) && resolvedId && quizCode !== resolvedId) {
          activeLbRes = await fetch(
            `${API_BASE}/api/v1/quizzes/${quizCode}/leaderboard`,
            { headers },
          ).catch(() => null);
        }

        if (activeLbRes && activeLbRes.ok) {
          const lbData = await activeLbRes.json();
          // Extract array whether it's wrapped in a response object or root level array
          const rawList = Array.isArray(lbData)
            ? lbData
            : lbData.content || lbData.leaderboard || lbData.students || [];

          backendStudents = rawList.map((entry: any, idx: number) => {
            const timeSecs = Number(
              entry.timeTakenSeconds || entry.timeTakenTotalSeconds || 0,
            );
            return {
              id: entry.attemptId || entry.id || idx + 1,
              name:
                entry.studentName ||
                entry.registrationNo ||
                entry.username ||
                "Candidate",
              avatar: String(
                entry.studentName ||
                  entry.registrationNo ||
                  entry.username ||
                  "C",
              )
                .slice(0, 2)
                .toUpperCase(),
              score: Number(entry.score || entry.percentage || 0),
              accuracyPercentage: Number(
                entry.accuracy || entry.score || entry.percentage || 0,
              ),
              timeTaken: `${Math.floor(timeSecs / 60)}m ${timeSecs % 60}s`,
              timeTakenSeconds: timeSecs,
              submitted: true, // If they are on the leaderboard, they submitted
              flags: Array.isArray(entry.proctoringFlags)
                ? entry.proctoringFlags
                : [],
            };
          });
        }

        if (pkgData.title || backendStudents.length > 0) {
          const seen = new Set(
            backendStudents.map((s) => s.name.toUpperCase()),
          );
          const mergedStudents = [
            ...backendStudents,
            ...localStudents.filter((l) => !seen.has(l.name.toUpperCase())),
          ];

          setAssessmentData({
            ...pkgData,
            title:
              pkgData.title || localTest?.quizName || `Assessment ${quizCode}`,
            students:
              mergedStudents.length > 0 ? mergedStudents : localStudents,
          });

          if (pkgData.resultVisibility) {
            const rv = pkgData.resultVisibility;
            setTestSettings({
              publishScoresImmediately: rv === "BOTH" || rv === "LEADERBOARD",
              revealSolutions: rv === "BOTH" || rv === "QUESTION_WISE",
              showIntegrityFlagsToStudent:
                !!pkgData.showIntegrityFlagsToStudent,
            });
          } else if (pkgData.settings) {
            setTestSettings({
              publishScoresImmediately:
                !!pkgData.settings.publishScoresImmediately,
              revealSolutions: !!pkgData.settings.revealSolutions,
              showIntegrityFlagsToStudent:
                !!pkgData.settings.showIntegrityFlagsToStudent,
            });
          }
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Backend assessment fetch fallback to local session:", e);
      }

      setAssessmentData({
        title: localTest?.quizName || `Assessment Session (${quizCode})`,
        quizCode,
        targetClass: localTest?.targetClass || "CS302 - 2026 Batch",
        totalStudents: 50,
        overallTimerSeconds: (localTest?.totalTimeLimitMinutes || 30) * 60,
        students: localStudents,
        settings: {
          publishScoresImmediately: true,
          revealSolutions: true,
          showIntegrityFlagsToStudent: false,
        },
      });
      setLoading(false);
    };

    fetchAssessmentDetails();
  }, [testCode]);

  // Update settings on backend, synchronizing resultVisibility and toggles
  const handleToggleSetting = async (key: keyof typeof testSettings) => {
    const prevSettings = { ...testSettings };
    const newVal = !testSettings[key];
    const nextSettings = { ...testSettings, [key]: newVal };

    const nextPub = nextSettings.publishScoresImmediately;
    const nextRev = nextSettings.revealSolutions;
    const resultVisibility =
      nextPub && nextRev
        ? "BOTH"
        : nextPub
          ? "LEADERBOARD"
          : nextRev
            ? "QUESTION_WISE"
            : "NONE";

    // Optimistically update UI
    setTestSettings(nextSettings);
    setSettingsError(null);

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("dynoquizz_token")
          : null;
      if (!token) {
        throw new Error("Authentication token not found. Please log in.");
      }

      const { quizId: resolvedId, quizCode } = resolveQuizIdentifiers(testCode);
      const settingsId = resolvedId ?? testCode;

      const payload = {
        [key]: newVal,
        resultVisibility,
        publishScoresImmediately: nextPub,
        revealSolutions: nextRev,
        showIntegrityFlagsToStudent: nextSettings.showIntegrityFlagsToStudent,
      };

      let res = await fetch(
        `${API_BASE}/api/v1/teacher/quizzes/${settingsId}/settings`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      // If PUT returned 404 or 405, try PATCH
      if (!res.ok && res.status !== 401 && res.status !== 403) {
        const patchRes = await fetch(
          `${API_BASE}/api/v1/teacher/quizzes/${settingsId}/settings`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (patchRes.ok) res = patchRes;
      }

      // If still not ok and quizCode is available and different, try with quizCode
      if (
        !res.ok &&
        quizCode &&
        quizCode !== settingsId &&
        res.status !== 401 &&
        res.status !== 403
      ) {
        const codeRes = await fetch(
          `${API_BASE}/api/v1/teacher/quizzes/${quizCode}/settings`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (codeRes.ok) res = codeRes;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message ||
            errData.error ||
            `Server rejected settings update with status ${res.status}`,
        );
      }

      const updated = await res.json().catch(() => null);
      if (updated?.resultVisibility) {
        const rv = updated.resultVisibility;
        setTestSettings({
          publishScoresImmediately: rv === "BOTH" || rv === "LEADERBOARD",
          revealSolutions: rv === "BOTH" || rv === "QUESTION_WISE",
          showIntegrityFlagsToStudent:
            updated.showIntegrityFlagsToStudent ??
            nextSettings.showIntegrityFlagsToStudent,
        });
      }
    } catch (e: any) {
      console.error("Failed to sync setting to backend:", e);
      // Visually revert setting on failure
      setTestSettings(prevSettings);
      setSettingsError(
        e.message || "Failed to update assessment settings on the server.",
      );
      setTimeout(() => setSettingsError(null), 4000);
    }
  };

  const allStudents: StudentRecord[] = assessmentData?.students || [];
  const submitted = allStudents.filter((s) => s.submitted);
  const classAvg = Math.round(
    submitted.reduce((a, s) => a + (s.score || 0), 0) /
      Math.max(1, submitted.length),
  );
  const highScore = Math.max(
    ...(submitted.map((s) => s.score).length > 0
      ? submitted.map((s) => s.score)
      : [0]),
  );
  const flaggedCount = allStudents.filter((s) => totalFlags(s) > 0).length;
  const topThree = [...submitted].sort((a, b) => b.score - a.score).slice(0, 3);

  const displayList = useMemo(() => {
    const ranked = [...allStudents]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const filtered = ranked.filter((s) =>
      s.name?.toLowerCase().includes(query.toLowerCase()),
    );

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "rank") cmp = a.rank - b.rank;
      else if (sortKey === "name")
        cmp = (a.name || "").localeCompare(b.name || "");
      else if (sortKey === "score") cmp = (a.score || 0) - (b.score || 0);
      else if (sortKey === "timeTaken")
        cmp = (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
      else if (sortKey === "flagCount") cmp = totalFlags(a) - totalFlags(b);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allStudents, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleExport() {
    exportCSV(testCode, displayList, assessmentData?.title || "Assessment");
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-frost-surface flex items-center justify-center text-xs text-steel-blue-gray">
        Loading assessment governance panel...
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
            onClick={handleExport}
            className={`flex items-center gap-2 rounded-buttons px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-[0.98] border-0 shadow-sm cursor-pointer ${
              exported
                ? "bg-pastel-mint text-pastel-mint-text"
                : "bg-signal-green text-white hover:bg-signal-green/90"
            }`}
          >
            {exported ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text" />{" "}
                Exported
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-white" /> Export to CSV
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
                {assessmentData?.title || "Assessment Session"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-steel-blue-gray font-medium">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-steel-blue-gray" />{" "}
                  {assessmentData?.date || "Active Session"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-steel-blue-gray" />{" "}
                  {Math.floor(
                    (assessmentData?.overallTimerSeconds || 3600) / 60,
                  )}{" "}
                  min
                </span>
                <span className="rounded-pills bg-frost-surface px-2.5 py-0.5 font-mono text-[9px] font-bold text-signal-green border border-mist-blue/30">
                  {testCode}
                </span>
              </div>
            </div>
          </div>

          <section className="rounded-cards border border-mist-blue bg-paper-white p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-midnight-navy flex items-center gap-1.5 border-b border-mist-blue/30 pb-2">
              <Lock className="h-3.5 w-3.5 text-signal-green" /> Teacher Control
              Panel (Dynamic Settings)
            </h3>

            {settingsError && (
              <div className="flex items-center gap-2 rounded-inputs bg-pastel-pink/30 border border-pastel-pink text-pastel-pink-text px-3 py-2 text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {[
                {
                  label: "Release Grades to Students",
                  hint: "Publish score percentage & passing status",
                  key: "publishScoresImmediately",
                },
                {
                  label: "Allow Solution Key View",
                  hint: "Let students view choice vs correction breakdown",
                  key: "revealSolutions",
                },
                {
                  label: "Expose Integrity Logs",
                  hint: "Reveal tab switches & copy detections",
                  key: "showIntegrityFlagsToStudent",
                },
              ].map((item) => {
                const active =
                  testSettings[item.key as keyof typeof testSettings];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      handleToggleSetting(item.key as keyof typeof testSettings)
                    }
                    className={`flex items-start justify-between gap-3 rounded-inputs border p-3 text-left transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                      active
                        ? "border-signal-green bg-frost-surface text-midnight-navy ring-2 ring-signal-green/20"
                        : "border-mist-blue bg-paper-white text-steel-blue-gray hover:border-mist-blue/80"
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
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                        active ? "bg-signal-green" : "bg-mist-blue"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${
                          active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                icon: <Users className="h-4 w-4 text-signal-green" />,
                label: "Submitted",
                value: `${submitted.length}/${allStudents.length}`,
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-pastel-mint-text" />,
                label: "Class Avg",
                value: `${classAvg}%`,
              },
              {
                icon: <Award className="h-4 w-4 text-signal-green" />,
                label: "High Score",
                value: `${highScore}%`,
              },
              {
                icon: (
                  <AlertTriangle className="h-4 w-4 text-pastel-pink-text" />
                ),
                label: "Flagged",
                value: flaggedCount,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-cards border border-mist-blue bg-paper-white p-4 shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-inputs bg-frost-surface text-signal-green border border-mist-blue/20">
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
              {topThree.map((s, pos) => {
                const c = podiumRingColor(pos);
                const flags = totalFlags(s);
                return (
                  <div
                    key={s.id || pos}
                    className="relative overflow-hidden rounded-cards border border-mist-blue bg-paper-white p-4 shadow-sm"
                  >
                    <span className="absolute right-3.5 top-3.5 text-lg">
                      {c.icon}
                    </span>
                    <div
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full ${avatarStyle(flags)} text-[10px] font-bold`}
                    >
                      {s.avatar || "ST"}
                    </div>
                    <p className="font-bold text-midnight-navy truncate pr-6 text-xs text-left">
                      {s.name}
                    </p>
                    <p className="text-[10px] text-steel-blue-gray font-medium text-left">
                      Rank #{pos + 1} · {s.timeTaken || "00:00"}
                    </p>
                    <div className="mt-3 text-left">
                      <p className="text-xl font-bold text-midnight-navy">
                        {s.score}%
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
                All Students ({displayList.length} of {allStudents.length})
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-blue-gray" />
                <input
                  type="text"
                  placeholder="Search by name…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-pills border border-mist-blue bg-paper-white py-2 pl-9 pr-4 text-xs text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20 sm:w-64"
                />
              </div>
            </div>

            <div className="flex-1 rounded-cards border border-mist-blue overflow-hidden bg-paper-white shadow-xl text-left">
              <div className="grid grid-cols-[2.5rem_1fr_7rem_6rem_4rem_12rem] items-center gap-3 border-b border-mist-blue/30 bg-paper-white px-5 py-2">
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
                  label="Score"
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
                <Th
                  label="Flags"
                  col="flagCount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />
                <span className="text-left text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray">
                  Suspicion Flags
                </span>
              </div>

              {displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-steel-blue-gray">
                  <Search className="h-6 w-6 text-mist-blue" />
                  <p className="text-xs">
                    No student submissions match your query.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-mist-blue/30 bg-paper-white">
                  {displayList.map((student) => {
                    const flags = totalFlags(student);
                    return (
                      <li
                        key={student.id}
                        className="grid grid-cols-[2.5rem_1fr_7rem_6rem_4rem_12rem] items-center gap-3 px-5 py-2.5 transition-colors hover:bg-frost-surface/30"
                      >
                        <span className="text-xs font-bold font-mono text-steel-blue-gray">
                          {student.rank}
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarStyle(flags)}`}
                          >
                            {student.avatar || "ST"}
                          </div>
                          <p className="truncate text-xs font-bold text-midnight-navy">
                            {student.name}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <span className="inline-flex min-w-[3rem] items-center justify-center rounded-pills px-2.5 py-0.5 text-xs font-bold tabular-nums bg-pastel-mint text-pastel-mint-text">
                            {student.score}%
                          </span>
                        </div>
                        <div className="flex justify-center">
                          <span className="font-mono text-[10px] font-semibold text-steel-blue-gray">
                            {student.timeTaken || "00:00"}
                          </span>
                        </div>
                        <div className="flex justify-center">
                          {flags === 0 ? (
                            <span className="text-xs text-steel-blue-gray">
                              —
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-pastel-pink-text">
                              {flags}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 text-left">
                          {(student.flags || []).length === 0 ? (
                            <span className="text-[10px] text-steel-blue-gray font-medium">
                              Clean
                            </span>
                          ) : (
                            student.flags.map((f, fi) => (
                              <span
                                key={fi}
                                className={`flex items-center gap-1 rounded-pills px-2 py-0.5 text-[9px] font-bold ${flagChipStyle(f.type)}`}
                              >
                                {flagIcon(f.type)} {f.label} ×{f.count}
                              </span>
                            ))
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
