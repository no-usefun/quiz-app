"use client";

import { use, useState, useMemo } from "react";
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
} from "lucide-react";

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
  if (grade.startsWith("A")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (grade.startsWith("B")) return "bg-blue-100 text-blue-700 border-blue-200";
  if (grade.startsWith("C")) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function avatarStyle(grade: string, flagCount: number) {
  if (flagCount >= 4) return "bg-red-100 text-red-700";
  if (flagCount >= 2) return "bg-amber-100 text-amber-700";
  if (grade.startsWith("A")) return "bg-emerald-100 text-emerald-700";
  if (grade.startsWith("B")) return "bg-blue-100 text-blue-700";
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
    return "bg-red-50 text-red-600 border border-red-200";
  return "bg-amber-50 text-amber-600 border border-amber-200";
}

function totalFlags(s: StudentRecord) {
  return s.flags.reduce((sum, f) => sum + f.count, 0);
}

function podiumRingColor(pos: number) {
  if (pos === 0) return { ring: "#f59e0b", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "🥇" };
  if (pos === 1) return { ring: "#94a3b8", bg: "bg-slate-50",  border: "border-slate-200", text: "text-slate-600", icon: "🥈" };
  return            { ring: "#b45309", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: "🥉" };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(testCode: string, data: ReturnType<typeof ASSESSMENTS[string]["students"]["map"]> extends never ? never : StudentRecord[], title: string) {
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeacherAssessmentPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  // TODO: BACKEND INTEGRATION - Fetch assessment analytics and student performance table.
  // GET /api/assessments/{testCode}/summary with Authorization: Bearer {token}
  // Expected response: { title, date, duration, totalQuestions, students: Array<{ id, name, avatar, rawScore, adjustedScore, grade, timeTaken, submitted, flags: Array<{ type, label, count }> }> }
  // Optionally, GET /api/assessments/{testCode}/export-csv can directly stream the generated CSV file.
  const assessment  = ASSESSMENTS[testCode] ?? ASSESSMENTS[DEFAULT_CODE];
  const allStudents = assessment.students;

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState("");
  const [sortKey,   setSortKey]   = useState<SortKey>("rank");
  const [sortDir,   setSortDir]   = useState<SortDir>("asc");
  const [exported,  setExported]  = useState(false);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const submitted    = allStudents.filter((s) => s.submitted);
  const classAvg     = Math.round(submitted.reduce((a, s) => a + s.adjustedScore, 0) / submitted.length);
  const highScore    = Math.max(...submitted.map((s) => s.adjustedScore));
  const flaggedCount = allStudents.filter((s) => totalFlags(s) > 0).length;
  const topThree     = [...submitted].sort((a, b) => b.adjustedScore - a.adjustedScore).slice(0, 3);

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const displayList = useMemo(() => {
    // First add a stable rank based on adjustedScore desc
    const ranked = [...allStudents]
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // Filter
    const filtered = ranked.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.grade.toLowerCase().includes(query.toLowerCase())
    );

    // Sort
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

  // ── Column header helper ─────────────────────────────────────────────────────
  function Th({ label, col, className = "" }: { label: string; col: SortKey; className?: string }) {
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors ${className}`}
      >
        {label}
        <SortIcon col={col} active={sortKey} dir={sortDir} />
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3eefc] p-4 md:p-6 lg:p-8 font-sans">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-[2.5rem] bg-white shadow-2xl border border-white/50 overflow-hidden">

        {/* ── Header ── */}
        <header className="flex w-full items-center justify-between border-b border-slate-100 px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/teacher"
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="text-slate-200">|</span>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">DynoQuizz</span>
            </div>
          </div>

          {/* Export button — top-right, prominent */}
          <button
            onClick={handleExport}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
              exported
                ? "bg-emerald-600 text-white shadow-emerald-200"
                : "bg-black text-white shadow-black/10 hover:bg-slate-800"
            }`}
          >
            {exported ? (
              <><CheckCircle2 className="h-4 w-4" /> Exported!</>
            ) : (
              <><Download className="h-4 w-4" /> Export to CSV</>
            )}
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-8 p-8 lg:p-10">

          {/* ── Title ── */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                Past Assessment · Review
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {assessment.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> {assessment.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {assessment.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> {assessment.totalQuestions} questions
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-500">
                  {testCode}
                </span>
              </div>
            </div>
          </div>

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: <Users className="h-5 w-5 text-blue-600" />,        label: "Students Submitted", value: `${submitted.length}/${allStudents.length}`, bg: "bg-blue-50",    border: "border-blue-100"   },
              { icon: <TrendingUp className="h-5 w-5 text-emerald-600" />, label: "Class Average",      value: `${classAvg}%`,                              bg: "bg-emerald-50", border: "border-emerald-100" },
              { icon: <Award className="h-5 w-5 text-amber-500" />,        label: "High Score",         value: `${highScore}%`,                             bg: "bg-amber-50",   border: "border-amber-100"  },
              { icon: <AlertTriangle className="h-5 w-5 text-red-500" />,  label: "Flagged Students",   value: flaggedCount,                                bg: "bg-red-50",     border: "border-red-100"    },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`flex items-center gap-4 rounded-2xl border ${stat.border} ${stat.bg} p-5`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Podium: Top 3 Performers ── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Top Performers</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {topThree.map((s, pos) => {
                const c = podiumRingColor(pos);
                const flags = totalFlags(s);
                return (
                  <div
                    key={s.id}
                    className={`relative overflow-hidden rounded-3xl border ${c.border} ${c.bg} p-6`}
                  >
                    {/* Medal emoji */}
                    <span className="absolute right-4 top-4 text-2xl">{c.icon}</span>

                    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${avatarStyle(s.grade, flags)} text-sm font-bold`}>
                      {s.avatar}
                    </div>
                    <p className="font-bold text-slate-900 truncate pr-8">{s.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Rank #{pos + 1} · {s.timeTaken}
                    </p>

                    <div className="mt-4 flex items-end gap-3">
                      <div>
                        <p className={`text-3xl font-extrabold ${c.text}`}>{s.adjustedScore}%</p>
                        <p className="text-[11px] text-slate-400">Adjusted</p>
                      </div>
                      {s.rawScore !== s.adjustedScore && (
                        <p className="mb-1 text-sm text-slate-300 line-through">{s.rawScore}%</p>
                      )}
                      <span className={`ml-auto inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${gradeStyle(s.grade)}`}>
                        {s.grade}
                      </span>
                    </div>

                    {flags > 0 && (
                      <p className="mt-3 text-[11px] text-red-500 font-medium">
                        ⚠ {flags} proctoring flag{flags > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Full Results Table ── */}
          <section className="flex flex-1 flex-col">
            {/* Table toolbar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-bold text-slate-900">
                All Students
                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({displayList.length} of {allStudents.length})
                </span>
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or grade…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400 sm:w-64"
                />
              </div>
            </div>

            <div className="flex-1 rounded-[2rem] border border-slate-100 overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[2.5rem_1fr_8rem_9rem_6rem_7rem_5rem_14rem] items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3">
                <Th label="#"        col="rank"          />
                <Th label="Student"  col="name"          />
                <Th label="Raw"      col="rawScore"      className="justify-center" />
                <Th label="Adjusted" col="adjustedScore" className="justify-center" />
                <span className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">Grade</span>
                <Th label="Duration" col="timeTaken"     className="justify-center" />
                <Th label="Flags"    col="flagCount"     className="justify-center" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Suspicion Flags</span>
              </div>

              {displayList.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
                  <Search className="h-8 w-8" />
                  <p className="text-sm">No students match your search.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 bg-white">
                  {displayList.map((student) => {
                    const flags     = totalFlags(student);
                    const isHigh    = flags >= 4;
                    const isMed     = flags >= 2 && flags < 4;
                    const rowBg     = isHigh
                      ? "bg-red-50/50 hover:bg-red-50/80"
                      : isMed
                      ? "bg-amber-50/40 hover:bg-amber-50/70"
                      : "hover:bg-slate-50/70";

                    return (
                      <li
                        key={student.id}
                        className={`grid grid-cols-[2.5rem_1fr_8rem_9rem_6rem_7rem_5rem_14rem] items-center gap-3 px-6 py-3.5 transition-colors ${rowBg}`}
                      >
                        {/* Rank */}
                        <span className="text-sm font-bold tabular-nums text-slate-300">
                          {student.rank}
                        </span>

                        {/* Name + avatar */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarStyle(student.grade, flags)}`}>
                            {student.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{student.name}</p>
                            {!student.submitted && (
                              <span className="text-[10px] font-medium text-red-500">Did not submit</span>
                            )}
                          </div>
                        </div>

                        {/* Raw score */}
                        <div className="flex justify-center">
                          <span className={`tabular-nums text-sm font-semibold ${student.rawScore !== student.adjustedScore ? "text-slate-400 line-through" : "text-slate-700"}`}>
                            {student.rawScore}%
                          </span>
                        </div>

                        {/* Adjusted score */}
                        <div className="flex justify-center">
                          <span className={`inline-flex min-w-[3.5rem] items-center justify-center rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                            student.adjustedScore >= 80 ? "bg-emerald-100 text-emerald-700"
                            : student.adjustedScore >= 60 ? "bg-blue-100 text-blue-700"
                            : student.adjustedScore >= 40 ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-600"
                          }`}>
                            {student.adjustedScore}%
                          </span>
                        </div>

                        {/* Grade */}
                        <div className="flex justify-center">
                          <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-2.5 py-1 text-xs font-bold ${gradeStyle(student.grade)}`}>
                            {student.grade}
                          </span>
                        </div>

                        {/* Time taken */}
                        <div className="flex justify-center">
                          <span className="font-mono text-xs font-medium text-slate-500">{student.timeTaken}</span>
                        </div>

                        {/* Flag count badge */}
                        <div className="flex justify-center">
                          {flags === 0 ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                              isHigh ? "bg-red-100 text-red-700" : isMed ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              <AlertTriangle className="h-3 w-3" />
                              {flags}
                            </span>
                          )}
                        </div>

                        {/* Flag pills */}
                        <div className="flex flex-wrap gap-1">
                          {student.flags.length === 0 ? (
                            <span className="text-xs text-slate-300">Clean</span>
                          ) : (
                            student.flags.map((f, fi) => (
                              <span
                                key={fi}
                                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${flagChipStyle(f.type)}`}
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

          {/* ── Footer ── */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Proctoring flags are sourced from the{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-500">useProctoring</code>{" "}
              hook · Score adjustment applied by the grading engine
            </p>
            <button
              onClick={handleExport}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                exported
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Download className="h-4 w-4" />
              {exported ? "Exported!" : "Export to CSV"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
