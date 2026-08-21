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

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

type FlagType =
  | "tab_switch"
  | "fullscreen_exit"
  | "right_click"
  | "copy_attempt";
type SortKey =
  | "rank"
  | "name"
  | "rawScore"
  | "adjustedScore"
  | "timeTaken"
  | "flagCount";
type SortDir = "asc" | "desc";

interface StudentRecord {
  id: number;
  name: string;
  avatar: string;
  rawScore: number;
  adjustedScore: number;
  accuracyPercentage?: number;
  speedBonus?: number;
  grade: string;
  timeTaken: string;
  timeTakenSeconds?: number;
  submitted: boolean;
  flags: { type: FlagType; label: string; count: number }[];
}

function gradeStyle(grade: string) {
  if (!grade) return "bg-pastel-mint text-pastel-mint-text";
  const upper = grade.toUpperCase();
  if (upper.startsWith("A")) return "bg-pastel-mint text-pastel-mint-text";
  if (upper.startsWith("B"))
    return "bg-pastel-lavender text-pastel-lavender-text";
  if (upper.startsWith("C")) return "bg-pastel-yellow text-pastel-yellow-text";
  return "bg-pastel-pink text-pastel-pink-text";
}

function avatarStyle(grade: string, flagCount: number) {
  if (flagCount >= 4) return "bg-pastel-pink text-pastel-pink-text";
  if (flagCount >= 2) return "bg-pastel-yellow text-pastel-yellow-text";
  if (grade?.startsWith("A")) return "bg-pastel-mint text-pastel-mint-text";
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
    "Accuracy (%)",
    "Final Score (Speed-Weighted)",
    "Base Score",
    "Speed Bonus",
    "Grade",
    "Time Taken",
    "Submitted",
    "Total Flags",
    "Flag Details",
  ];
  const rows = data.map((s, idx) => [
    idx + 1,
    s.name,
    s.accuracyPercentage ?? `${s.rawScore}%`,
    s.adjustedScore,
    s.rawScore,
    s.speedBonus ?? 0,
    s.grade,
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

  useEffect(() => {
    const fetchAssessmentDetails = async () => {
      const cleanCode = (testCode || "").toUpperCase();

      // Check stored test details
      const localTest = getStoredTests().find((t) => t.testCode.toUpperCase() === cleanCode);

      // Check local actual submissions
      const localStudents: StudentRecord[] = getStoredResults()
        .filter((r) => r.testCode.toUpperCase() === cleanCode)
        .map((r, idx) => ({
          id: idx + 1,
          name: r.studentName || "Candidate",
          avatar: (r.studentName || "C").slice(0, 2).toUpperCase(),
          rawScore: r.rawScore || 0,
          adjustedScore: r.adjustedScore || r.rawScore || 0,
          accuracyPercentage: r.accuracyPercentage ?? (r.totalQuestions > 0 ? Math.round((r.correctCount / r.totalQuestions) * 100) : 0),
          speedBonus: r.speedBonusTotal ?? 0,
          grade: r.grade || "A",
          timeTaken: `${Math.floor((r.timeTakenTotalSeconds || 0) / 60)}m ${(r.timeTakenTotalSeconds || 0) % 60}s`,
          timeTakenSeconds: r.timeTakenTotalSeconds || 0,
          submitted: true,
          flags: [],
        }));

      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(
          `${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          const backendStudents: StudentRecord[] = Array.isArray(data.students) ? data.students : [];
          const seen = new Set(backendStudents.map((s) => s.name.toUpperCase()));
          const mergedStudents = [
            ...backendStudents,
            ...localStudents.filter((l) => !seen.has(l.name.toUpperCase())),
          ];

          setAssessmentData({
            ...data,
            title: data.title || localTest?.quizName || `Assessment ${cleanCode}`,
            students: mergedStudents.length > 0 ? mergedStudents : localStudents,
          });

          if (data.settings) {
            setTestSettings({
              publishScoresImmediately: !!data.settings.publishScoresImmediately,
              revealSolutions: !!data.settings.revealSolutions,
              showIntegrityFlagsToStudent: !!data.settings.showIntegrityFlagsToStudent,
            });
          }
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn("Backend assessment fetch fallback to local session:", e);
      }

      setAssessmentData({
        title: localTest?.quizName || `Assessment Session (${cleanCode})`,
        quizCode: cleanCode,
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

  const handleToggleSetting = async (key: keyof typeof testSettings) => {
    const newVal = !testSettings[key];
    setTestSettings((prev) => ({ ...prev, [key]: newVal }));
    try {
      const token = localStorage.getItem("dynoquizz_token");
      await fetch(`${API_BASE}/api/v1/teacher/quizzes/${testCode}/settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: newVal }),
      });
    } catch (e) {
      console.error("Failed to sync setting to backend:", e);
    }
  };

  const allStudents: StudentRecord[] = assessmentData?.students || [];
  const submitted = allStudents.filter((s) => s.submitted);
  const classAvg = Math.round(
    submitted.reduce((a, s) => a + (s.adjustedScore || 0), 0) /
      Math.max(1, submitted.length),
  );
  const highScore = Math.max(
    ...(submitted.map((s) => s.adjustedScore).length > 0
      ? submitted.map((s) => s.adjustedScore)
      : [0]),
  );
  const flaggedCount = allStudents.filter((s) => totalFlags(s) > 0).length;
  const topThree = [...submitted]
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .slice(0, 3);

  const displayList = useMemo(() => {
    const ranked = [...allStudents]
      .sort((a, b) => (b.adjustedScore || 0) - (a.adjustedScore || 0))
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const filtered = ranked.filter(
      (s) =>
        s.name?.toLowerCase().includes(query.toLowerCase()) ||
        s.grade?.toLowerCase().includes(query.toLowerCase()),
    );

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "rank") cmp = a.rank - b.rank;
      else if (sortKey === "name")
        cmp = (a.name || "").localeCompare(b.name || "");
      else if (sortKey === "rawScore")
        cmp = (a.rawScore || 0) - (b.rawScore || 0);
      else if (sortKey === "adjustedScore")
        cmp = (a.adjustedScore || 0) - (b.adjustedScore || 0);
      else if (sortKey === "timeTaken")
        cmp = (a.timeTaken || "").localeCompare(b.timeTaken || "");
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
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full ${avatarStyle(s.grade, flags)} text-[10px] font-bold`}
                    >
                      {s.avatar || "ST"}
                    </div>
                    <p className="font-bold text-midnight-navy truncate pr-6 text-xs text-left">
                      {s.name}
                    </p>
                    <p className="text-[10px] text-steel-blue-gray font-medium text-left">
                      Rank #{pos + 1} · {s.timeTaken || "00:00"}
                    </p>
                    <div className="mt-3 flex items-end gap-2 text-left">
                      <div>
                        <p className="text-xl font-bold text-midnight-navy">
                          {s.adjustedScore}%
                        </p>
                        <p className="text-[8px] text-steel-blue-gray font-bold uppercase">
                          Adjusted
                        </p>
                      </div>
                      <span
                        className={`ml-auto inline-flex items-center rounded-pills px-2.5 py-0.5 text-[9px] font-bold ${gradeStyle(s.grade)}`}
                      >
                        {s.grade || "A"}
                      </span>
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
                  placeholder="Search by name or grade…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-pills border border-mist-blue bg-paper-white py-2 pl-9 pr-4 text-xs text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20 sm:w-64"
                />
              </div>
            </div>

            <div className="flex-1 rounded-cards border border-mist-blue overflow-hidden bg-paper-white shadow-xl text-left">
              <div className="grid grid-cols-[2.5rem_1fr_6rem_7rem_5rem_6rem_4rem_12rem] items-center gap-3 border-b border-mist-blue/30 bg-paper-white px-5 py-2">
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
                  label="Raw"
                  col="rawScore"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />
                <Th
                  label="Adjusted"
                  col="adjustedScore"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  className="justify-center"
                />
                <span className="text-center text-[9px] font-bold uppercase tracking-wider text-steel-blue-gray">
                  Grade
                </span>
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
                        className="grid grid-cols-[2.5rem_1fr_6rem_7rem_5rem_6rem_4rem_12rem] items-center gap-3 px-5 py-2.5 transition-colors hover:bg-frost-surface/30"
                      >
                        <span className="text-xs font-bold font-mono text-steel-blue-gray">
                          {student.rank}
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarStyle(student.grade, flags)}`}
                          >
                            {student.avatar || "ST"}
                          </div>
                          <p className="truncate text-xs font-bold text-midnight-navy">
                            {student.name}
                          </p>
                        </div>
                        <div className="flex justify-center text-xs font-medium text-midnight-navy">
                          {student.rawScore}%
                        </div>
                        <div className="flex justify-center">
                          <span className="inline-flex min-w-[3rem] items-center justify-center rounded-pills px-2.5 py-0.5 text-xs font-bold tabular-nums bg-pastel-mint text-pastel-mint-text">
                            {student.adjustedScore}%
                          </span>
                        </div>
                        <div className="flex justify-center">
                          <span
                            className={`inline-flex min-w-[2rem] items-center justify-center rounded-pills px-2.5 py-0.5 text-[9px] font-bold ${gradeStyle(student.grade)}`}
                          >
                            {student.grade || "A"}
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
