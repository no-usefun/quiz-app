"use client";

import { use, useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
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
import { getTestByCode, updateTestSettings } from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlagType = "tab_switch" | "fullscreen_exit" | "right_click" | "copy_attempt";
type SortKey = "rank" | "name" | "rawScore" | "adjustedScore" | "timeTaken" | "flagCount";
type SortDir = "asc" | "desc";

interface StudentRecord {
  id: number;
  name: string;
  avatar: string;       // initials
  rawScore: number;     // 0-100
  adjustedScore: number;
  grade: string;
  timeTaken: string;    // "HH:MM:SS"
  submitted: boolean;
  flags: { type: FlagType; label: string; count: number }[];
}

// ─── Mock data keyed by testCode ──────────────────────────────────────────────

const ASSESSMENTS: Record<
  string,
  {
    title: string;
    date: string;
    duration: string;
    totalQuestions: number;
    students: StudentRecord[];
  }
> = {
  "CS-302": {
    title: "Database Management Systems",
    date: "Jul 22, 2026",
    duration: "70 min",
    totalQuestions: 20,
    students: [
      { id: 1,  name: "Divya Nair",          avatar: "DN", rawScore: 98, adjustedScore: 98, grade: "A+", timeTaken: "01:02:14", submitted: true,  flags: [] },
      { id: 2,  name: "Priya Mehta",         avatar: "PM", rawScore: 94, adjustedScore: 91, grade: "A+", timeTaken: "01:05:33", submitted: true,  flags: [{ type: "tab_switch",     label: "Tab switched",      count: 1 }, { type: "right_click", label: "Right-click", count: 2 }] },
      { id: 3,  name: "Aarav Sharma",        avatar: "AS", rawScore: 88, adjustedScore: 85, grade: "A",  timeTaken: "01:08:41", submitted: true,  flags: [{ type: "tab_switch",     label: "Tab switched",      count: 2 }] },
      { id: 4,  name: "Meera Krishnan",      avatar: "MK", rawScore: 82, adjustedScore: 82, grade: "A",  timeTaken: "00:58:10", submitted: true,  flags: [] },
      { id: 5,  name: "Karan Patel",         avatar: "KP", rawScore: 76, adjustedScore: 74, grade: "B+", timeTaken: "01:09:55", submitted: true,  flags: [{ type: "right_click",    label: "Right-click",       count: 1 }] },
      { id: 6,  name: "Sneha Iyer",          avatar: "SI", rawScore: 74, adjustedScore: 70, grade: "B",  timeTaken: "01:07:22", submitted: true,  flags: [{ type: "fullscreen_exit",label: "Fullscreen exit",   count: 1 }, { type: "tab_switch", label: "Tab switched", count: 1 }] },
      { id: 7,  name: "Rahul Joshi",         avatar: "RJ", rawScore: 68, adjustedScore: 63, grade: "B",  timeTaken: "01:10:00", submitted: true,  flags: [{ type: "copy_attempt",   label: "Copy attempt",      count: 2 }, { type: "tab_switch", label: "Tab switched", count: 1 }] },
      { id: 8,  name: "Ananya Reddy",        avatar: "AR", rawScore: 66, adjustedScore: 64, grade: "B-", timeTaken: "00:52:18", submitted: true,  flags: [{ type: "right_click",    label: "Right-click",       count: 3 }] },
      { id: 9,  name: "Vikram Nair",         avatar: "VN", rawScore: 60, adjustedScore: 58, grade: "C+", timeTaken: "01:04:09", submitted: true,  flags: [{ type: "tab_switch",     label: "Tab switched",      count: 1 }] },
      { id: 10, name: "Pooja Sharma",        avatar: "PS", rawScore: 54, adjustedScore: 50, grade: "C",  timeTaken: "01:09:47", submitted: true,  flags: [{ type: "fullscreen_exit",label: "Fullscreen exit",   count: 2 }, { type: "copy_attempt", label: "Copy attempt", count: 1 }] },
      { id: 11, name: "Deepak Menon",        avatar: "DM", rawScore: 48, adjustedScore: 44, grade: "C-", timeTaken: "00:48:33", submitted: true,  flags: [{ type: "tab_switch",     label: "Tab switched",      count: 3 }, { type: "fullscreen_exit", label: "Fullscreen exit", count: 1 }] },
      { id: 12, name: "Arjun Singh",         avatar: "AS", rawScore: 22, adjustedScore: 18, grade: "F",  timeTaken: "00:21:05", submitted: false, flags: [{ type: "tab_switch",     label: "Tab switched",      count: 4 }, { type: "fullscreen_exit", label: "Fullscreen exit", count: 3 }, { type: "copy_attempt", label: "Copy attempt", count: 2 }] },
    ],
  },
  "CS-401": {
    title: "Algorithms Mock Test",
    date: "Jul 15, 2026",
    duration: "60 min",
    totalQuestions: 15,
    students: [
      { id: 1, name: "Rohit Verma",    avatar: "RV", rawScore: 95, adjustedScore: 90, grade: "A+", timeTaken: "00:55:21", submitted: true,  flags: [{ type: "tab_switch", label: "Tab switched", count: 1 }] },
      { id: 2, name: "Neha Singh",     avatar: "NS", rawScore: 88, adjustedScore: 88, grade: "A",  timeTaken: "00:48:10", submitted: true,  flags: [] },
      { id: 3, name: "Aarav Sharma",   avatar: "AS", rawScore: 75, adjustedScore: 73, grade: "B+", timeTaken: "00:57:40", submitted: true,  flags: [{ type: "right_click", label: "Right-click", count: 1 }] },
    ],
  },
};

const DEFAULT_CODE = "CS-302";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeStyle(grade: string) {
  if (grade.startsWith("A")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (grade.startsWith("B")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (grade.startsWith("C")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

function avatarStyle(grade: string, flagCount: number) {
  if (flagCount >= 4) return "bg-rose-50 text-rose-705";
  if (flagCount >= 2) return "bg-amber-50 text-amber-705";
  if (grade.startsWith("A")) return "bg-emerald-50 text-emerald-705";
  if (grade.startsWith("B")) return "bg-blue-50 text-blue-705";
  return "bg-slate-100 text-slate-600";
}

function flagIcon(type: FlagType) {
  const cls = "h-3 w-3 shrink-0";
  if (type === "tab_switch")      return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt")    return <Copy className={cls} />;
  return <MousePointerClick className={cls} />;
}

function flagChipStyle(type: FlagType) {
  if (type === "tab_switch" || type === "fullscreen_exit")
    return "bg-rose-50 text-rose-700 border border-rose-200";
  return "bg-amber-50 text-amber-705 border border-amber-200";
}

function totalFlags(s: StudentRecord) {
  return s.flags.reduce((sum, f) => sum + f.count, 0);
}

function podiumRingColor(pos: number) {
  if (pos === 0) return { bg: "bg-amber-50/50", border: "border-amber-200", text: "text-amber-700", icon: "🥇" };
  if (pos === 1) return { bg: "bg-slate-50",  border: "border-slate-200", text: "text-slate-605", icon: "🥈" };
  return            { bg: "bg-orange-50/50", border: "border-orange-200", text: "text-orange-700", icon: "🥉" };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(testCode: string, data: StudentRecord[], title: string) {
  const headers = ["Rank", "Name", "Raw Score (%)", "Adjusted Score (%)", "Grade", "Time Taken", "Submitted", "Total Flags", "Flag Details"];
  const rows = data.map((s, idx) => [
    idx + 1,
    s.name,
    s.rawScore,
    s.adjustedScore,
    s.grade,
    s.timeTaken,
    s.submitted ? "Yes" : "No",
    totalFlags(s),
    s.flags.map((f) => `${f.label}×${f.count}`).join(" | ") || "None",
  ]);

  const csvContent = [
    `# DynoQuizz Export — ${title} (${testCode})`,
    "",
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `DynoQuizz_${testCode}_Results.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Sort chevron ─────────────────────────────────────────────────────────────

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  if (col !== active) return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />;
  return dir === "asc"
    ? <ChevronUp   className="h-3.5 w-3.5 text-blue-600" />
    : <ChevronDown className="h-3.5 w-3.5 text-blue-600" />;
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
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ${className}`}
    >
      {label}
      <SortIcon col={col} active={sortKey} dir={sortDir} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeacherAssessmentPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  // TODO: BACKEND INTEGRATION - Fetch assessment analytics and student performance table.
  const assessment  = ASSESSMENTS[testCode] ?? ASSESSMENTS[DEFAULT_CODE];
  const allStudents = assessment.students;

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState("");
  const [sortKey,   setSortKey]   = useState<SortKey>("rank");
  const [sortDir,   setSortDir]   = useState<SortDir>("asc");
  const [exported,  setExported]  = useState(false);

  // Test Settings from localStorage
  const [testSettings, setTestSettings] = useState({
    publishScoresImmediately: false,
    revealSolutions: false,
    showIntegrityFlagsToStudent: false,
  });

  useEffect(() => {
    const t = getTestByCode(testCode);
    if (t && t.settings) {
      setTimeout(() => {
        setTestSettings({
          publishScoresImmediately: !!t.settings.publishScoresImmediately,
          revealSolutions: !!t.settings.revealSolutions,
          showIntegrityFlagsToStudent: !!t.settings.showIntegrityFlagsToStudent,
        });
      }, 0);
    }
  }, [testCode]);

  const handleToggleSetting = (key: keyof typeof testSettings) => {
    const newVal = !testSettings[key];
    const updated = updateTestSettings(testCode, { [key]: newVal });
    if (updated && updated.settings) {
      setTestSettings({
        publishScoresImmediately: !!updated.settings.publishScoresImmediately,
        revealSolutions: !!updated.settings.revealSolutions,
        showIntegrityFlagsToStudent: !!updated.settings.showIntegrityFlagsToStudent,
      });
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const submitted    = allStudents.filter((s) => s.submitted);
  const classAvg     = Math.round(submitted.reduce((a, s) => a + s.adjustedScore, 0) / submitted.length);
  const highScore    = Math.max(...submitted.map((s) => s.adjustedScore));
  const flaggedCount = allStudents.filter((s) => totalFlags(s) > 0).length;
  const topThree     = [...submitted].sort((a, b) => b.adjustedScore - a.adjustedScore).slice(0, 3);

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const displayList = useMemo(() => {
    const ranked = [...allStudents]
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const filtered = ranked.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.grade.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "rank")          cmp = a.rank          - b.rank;
      else if (sortKey === "name")     cmp = a.name.localeCompare(b.name);
      else if (sortKey === "rawScore") cmp = a.rawScore       - b.rawScore;
      else if (sortKey === "adjustedScore") cmp = a.adjustedScore - b.adjustedScore;
      else if (sortKey === "timeTaken") cmp = a.timeTaken.localeCompare(b.timeTaken);
      else if (sortKey === "flagCount") cmp = totalFlags(a) - totalFlags(b);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allStudents, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function handleExport() {
    exportCSV(testCode, displayList, assessment.title);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  }



  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 lg:p-8 font-sans selection:bg-blue-105">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-2xl bg-white shadow-xs border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <header className="flex w-full items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-905 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span className="text-slate-200">|</span>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900">DynoQuizz</span>
            </div>
          </div>

          <button
            onClick={handleExport}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all active:scale-95 shadow-xs border ${
              exported
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {exported ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Exported</>
            ) : (
              <><Download className="h-3.5 w-3.5" /> Export to CSV</>
            )}
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 p-5 md:p-6">

          {/* Title Area */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Past Assessment · Review
              </p>
              <h1 className="text-xl font-bold text-slate-950 mt-0.5">
                {assessment.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {assessment.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> {assessment.duration}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /> {assessment.totalQuestions} questions
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-600 border border-slate-200">
                  {testCode}
                </span>
              </div>
            </div>
          </div>

          {/* Teacher Governance Control Panel */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-705 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-500" /> Teacher Control Panel (Dynamic Settings)
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
                const active = testSettings[item.key as keyof typeof testSettings];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleSetting(item.key as keyof typeof testSettings)}
                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all active:scale-[0.98] bg-white ${
                      active
                        ? "border-blue-600 ring-1 ring-blue-650"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">{item.hint}</span>
                    </div>
                    <div
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                        active ? "bg-blue-600" : "bg-slate-200"
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

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: <Users className="h-4 w-4 text-blue-600" />,        label: "Submitted", value: `${submitted.length}/${allStudents.length}`, bg: "bg-white" },
              { icon: <TrendingUp className="h-4 w-4 text-emerald-600" />, label: "Class Avg", value: `${classAvg}%`, bg: "bg-white" },
              { icon: <Award className="h-4 w-4 text-blue-600" />,        label: "High Score", value: `${highScore}%`, bg: "bg-white" },
              { icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,  label: "Flagged", value: flaggedCount, bg: "bg-rose-50/10" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`flex items-center gap-3 rounded-xl border border-slate-200 ${stat.bg} p-4 shadow-xs`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 shadow-xs">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Podium */}
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-900 font-bold uppercase">Top Performers</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {topThree.map((s, pos) => {
                const c = podiumRingColor(pos);
                const flags = totalFlags(s);
                return (
                  <div
                    key={s.id}
                    className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs`}
                  >
                    <span className="absolute right-3.5 top-3.5 text-lg">{c.icon}</span>

                    <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full ${avatarStyle(s.grade, flags)} text-[10px] font-bold`}>
                      {s.avatar}
                    </div>
                    <p className="font-bold text-slate-900 truncate pr-6 text-xs">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Rank #{pos + 1} · {s.timeTaken}
                    </p>

                    <div className="mt-3 flex items-end gap-2">
                      <div>
                        <p className="text-xl font-bold text-slate-900">{s.adjustedScore}%</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Adjusted</p>
                      </div>
                      {s.rawScore !== s.adjustedScore && (
                        <p className="mb-0.5 text-[10px] text-slate-300 line-through font-medium">{s.rawScore}%</p>
                      )}
                      <span className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${gradeStyle(s.grade)}`}>
                        {s.grade}
                      </span>
                    </div>

                    {flags > 0 && (
                      <p className="mt-1.5 text-[9px] text-rose-600 font-bold">
                        ⚠ {flags} proctoring flag{flags > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Full Results Table */}
          <section className="flex flex-1 flex-col">
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase">
                All Students
                <span className="ml-1 text-[10px] font-medium text-slate-405 lowercase">
                  ({displayList.length} of {allStudents.length})
                </span>
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or grade…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white sm:w-64"
                />
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              {/* Column headers */}
              <div className="grid grid-cols-[2.5rem_1fr_6rem_7rem_5rem_6rem_4rem_12rem] items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2">
                <Th label="#"        col="rank"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Student"  col="name"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Raw"      col="rawScore"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="justify-center" />
                <Th label="Adjusted" col="adjustedScore" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="justify-center" />
                <span className="text-center text-[9px] font-semibold uppercase tracking-wider text-slate-450">Grade</span>
                <Th label="Duration" col="timeTaken"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="justify-center" />
                <Th label="Flags"    col="flagCount"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="justify-center" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-450">Suspicion Flags</span>
              </div>

              {displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-10 text-slate-400">
                  <Search className="h-6 w-6" />
                  <p className="text-xs">No students match your search.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 bg-white">
                  {displayList.map((student) => {
                    const flags     = totalFlags(student);
                    const isHigh    = flags >= 4;
                    const isMed     = flags >= 2 && flags < 4;
                    const rowBg     = isHigh
                      ? "bg-rose-50/40 hover:bg-rose-50/60"
                      : isMed
                      ? "bg-amber-50/30 hover:bg-amber-50/50"
                      : "hover:bg-slate-50/30";

                    return (
                      <li
                        key={student.id}
                        className={`grid grid-cols-[2.5rem_1fr_6rem_7rem_5rem_6rem_4rem_12rem] items-center gap-3 px-5 py-2.5 transition-colors ${rowBg}`}
                      >
                        {/* Rank */}
                        <span className="text-xs font-bold font-mono text-slate-350">
                          {student.rank}
                        </span>

                        {/* Name + avatar */}
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarStyle(student.grade, flags)}`}>
                            {student.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900">{student.name}</p>
                            {!student.submitted && (
                              <span className="text-[9px] font-bold text-rose-600">No submission</span>
                            )}
                          </div>
                        </div>

                        {/* Raw score */}
                        <div className="flex justify-center text-xs font-medium">
                          <span className={`tabular-nums ${student.rawScore !== student.adjustedScore ? "text-slate-300 line-through" : "text-slate-700"}`}>
                            {student.rawScore}%
                          </span>
                        </div>

                        {/* Adjusted score */}
                        <div className="flex justify-center">
                          <span className={`inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                            student.adjustedScore >= 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : student.adjustedScore >= 60 ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : student.adjustedScore >= 40 ? "bg-amber-50 text-amber-705 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-100"
                          }`}>
                            {student.adjustedScore}%
                          </span>
                        </div>

                        {/* Grade */}
                        <div className="flex justify-center">
                          <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${gradeStyle(student.grade)}`}>
                            {student.grade}
                          </span>
                        </div>

                        {/* Time taken */}
                        <div className="flex justify-center">
                          <span className="font-mono text-[10px] font-semibold text-slate-500">{student.timeTaken}</span>
                        </div>

                        {/* Flag count badge */}
                        <div className="flex justify-center">
                          {flags === 0 ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              isHigh ? "bg-rose-50 text-rose-705 border border-rose-100" : isMed ? "bg-amber-50 text-amber-705 border border-amber-200" : "bg-slate-50 text-slate-600 border border-slate-200"
                            }`}>
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {flags}
                            </span>
                          )}
                        </div>

                        {/* Flag pills */}
                        <div className="flex flex-wrap gap-1">
                          {student.flags.length === 0 ? (
                            <span className="text-[10px] text-slate-350 font-medium">Clean</span>
                          ) : (
                            student.flags.map((f, fi) => (
                              <span
                                key={fi}
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${flagChipStyle(f.type)}`}
                              >
                                {flagIcon(f.type)}
                                {f.label}
                                <span className="ml-0.5 font-mono opacity-70">×{f.count}</span>
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

          {/* Footer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-center sm:text-left mt-2 border-t border-slate-100 pt-4">
            <p className="text-[10px] text-slate-400 font-medium">
              Proctoring flags are sourced from the{" "}
              <code className="rounded bg-slate-105 px-1 py-0.5 font-mono text-slate-500">useProctoring</code>{" "}
              hook · Score adjustment applied by the grading engine
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              DynoQuizz Assessment Governance System
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
