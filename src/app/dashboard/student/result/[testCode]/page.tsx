"use client";

import { use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Monitor,
  Eye,
  Copy,
  MousePointerClick,
  TrendingDown,
  Award,
  BarChart3,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionResult {
  id: number;
  text: string;
  yourAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  timeTaken: number; // seconds
  timeLimit: number; // seconds
}

interface ProctoringFlag {
  type: "tab_switch" | "fullscreen_exit" | "right_click" | "copy_attempt";
  label: string;
  count: number;
  penaltyPerEvent: number; // marks deducted per occurrence
  icon: React.ReactNode;
  severity: "high" | "medium";
}

// ─── Mock result data (keyed by testCode) ─────────────────────────────────────

const RESULT_DATA: Record<
  string,
  {
    subject: string;
    date: string;
    totalQuestions: number;
    rawScore: number;
    adjustedScore: number;
    grade: string;
    classAvg: number;
    classRank: number;
    classSize: number;
    questions: QuestionResult[];
    flags: Omit<ProctoringFlag, "icon">[];
  }
> = {
  "CS-201": {
    subject: "Data Structures & Algorithms",
    date: "Jul 28, 2026 · 10:30 AM",
    totalQuestions: 10,
    rawScore: 88,
    adjustedScore: 83,
    grade: "A",
    classAvg: 71,
    classRank: 4,
    classSize: 42,
    questions: [
      { id: 1, text: "Which data structure uses LIFO ordering?",                                        yourAnswer: "Stack",         correctAnswer: "Stack",         isCorrect: true,  timeTaken: 18, timeLimit: 30 },
      { id: 2, text: "Time complexity of BST search (balanced)?",                                       yourAnswer: "O(log n)",      correctAnswer: "O(log n)",      isCorrect: true,  timeTaken: 22, timeLimit: 45 },
      { id: 3, text: "Which sorting algorithm has worst-case O(n²)?",                                   yourAnswer: "Merge Sort",    correctAnswer: "Bubble Sort",   isCorrect: false, timeTaken: 41, timeLimit: 45 },
      { id: 4, text: "What is the height of a complete binary tree with n nodes?",                      yourAnswer: "O(log n)",      correctAnswer: "O(log n)",      isCorrect: true,  timeTaken: 29, timeLimit: 40 },
      { id: 5, text: "Which data structure is used in BFS?",                                            yourAnswer: "Queue",         correctAnswer: "Queue",         isCorrect: true,  timeTaken: 12, timeLimit: 30 },
      { id: 6, text: "What does amortized O(1) mean for a dynamic array?",                              yourAnswer: null,            correctAnswer: "Average over a sequence of operations", isCorrect: false, timeTaken: 30, timeLimit: 30 },
      { id: 7, text: "Which traversal visits left subtree, root, then right?",                          yourAnswer: "Inorder",       correctAnswer: "Inorder",       isCorrect: true,  timeTaken: 9,  timeLimit: 30 },
      { id: 8, text: "What is a hash collision?",                                                       yourAnswer: "Two keys map to same bucket", correctAnswer: "Two keys map to same bucket", isCorrect: true,  timeTaken: 25, timeLimit: 40 },
      { id: 9, text: "Dijkstra's algorithm finds the shortest path in a graph with?",                   yourAnswer: "Non-negative weights", correctAnswer: "Non-negative weights", isCorrect: true, timeTaken: 33, timeLimit: 45 },
      { id: 10, text: "What is the space complexity of merge sort?",                                    yourAnswer: "O(n)",          correctAnswer: "O(n)",          isCorrect: true,  timeTaken: 20, timeLimit: 35 },
    ],
    flags: [
      { type: "tab_switch",     label: "Tab switched / window minimized", count: 2, penaltyPerEvent: 2, severity: "high" },
      { type: "fullscreen_exit",label: "Exited fullscreen mode",          count: 1, penaltyPerEvent: 1, severity: "high" },
      { type: "right_click",    label: "Right-click attempted",           count: 3, penaltyPerEvent: 0, severity: "medium" },
      { type: "copy_attempt",   label: "Copy attempt blocked",            count: 1, penaltyPerEvent: 2, severity: "high" },
    ],
  },
};

// Default result for any unknown testCode
const DEFAULT_RESULT = RESULT_DATA["CS-201"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColors(grade: string) {
  if (grade.startsWith("A")) return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", ring: "#10b981" };
  if (grade.startsWith("B")) return { text: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",    ring: "#3b82f6" };
  if (grade.startsWith("C")) return { text: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   ring: "#f59e0b" };
  return                             { text: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     ring: "#ef4444" };
}

function formatTime(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function flagIcon(type: ProctoringFlag["type"]) {
  const cls = "h-4 w-4";
  if (type === "tab_switch")      return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt")    return <Copy className={cls} />;
  return <MousePointerClick className={cls} />;
}

// ─── Animated SVG score ring ──────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 88;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
      {/* Track */}
      <circle cx="110" cy="110" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {/* Progress */}
      <circle
        cx="110"
        cy="110"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentResultPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  // TODO: BACKEND INTEGRATION - Fetch detailed test result for student.
  // GET /api/students/me/results/{testCode} with Authorization: Bearer {token}
  // Expected response: { subject, date, totalQuestions, rawScore, adjustedScore, grade, classAvg, classRank, classSize, questions: Array<{ id, text, yourAnswer, correctAnswer, isCorrect, timeTaken, timeLimit }>, flags: Array<{ type, label, count, penaltyPerEvent, severity }> }
  const result = RESULT_DATA[testCode] ?? DEFAULT_RESULT;

  const gc = gradeColors(result.grade);
  const avgTimeSecs = Math.round(
    result.questions.reduce((a, q) => a + q.timeTaken, 0) / result.questions.length
  );
  const totalPenalty = result.rawScore - result.adjustedScore;
  const correctCount = result.questions.filter((q) => q.isCorrect).length;
  const flaggedPenalty = result.flags.reduce(
    (sum, f) => sum + f.count * f.penaltyPerEvent,
    0
  );

  return (
    <div className="min-h-screen bg-[#f3eefc] font-sans">
      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-purple-100/60 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">DynoQuizz</span>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-500">
          {testCode}
        </span>
      </nav>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">

        {/* ── Page title ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Assessment Results
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            {result.subject}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {result.date}
            </span>
            <span className="text-slate-200">·</span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Class rank: <strong className="text-slate-700">#{result.classRank}</strong> of {result.classSize}
            </span>
          </div>
        </section>

        {/* ── Hero score card ── */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-white/50 p-8">
          {/* Subtle grid texture */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

          <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            {/* Ring */}
            <div className="relative shrink-0">
              <ScoreRing score={result.adjustedScore} color={gc.ring} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-5xl font-extrabold tabular-nums ${gc.text}`}>
                  {result.adjustedScore}
                </span>
                <span className="text-xs font-semibold text-slate-400 mt-1">Adjusted Score</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="flex-1 space-y-5">
              <div>
                <p className="text-sm text-slate-500">
                  You scored <strong className="text-slate-900">{correctCount} / {result.totalQuestions}</strong> questions correctly.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Your raw mark of{" "}
                  <span className="font-semibold text-slate-700 line-through decoration-red-300">
                    {result.rawScore}%
                  </span>{" "}
                  was adjusted to{" "}
                  <span className={`font-bold ${gc.text}`}>{result.adjustedScore}%</span>{" "}
                  after AI proctoring deductions.
                </p>
              </div>

              {/* Three mini stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: <Award className="h-5 w-5" />,
                    label: "Grade",
                    value: result.grade,
                    color: gc,
                  },
                  {
                    icon: <Clock className="h-5 w-5 text-purple-600" />,
                    label: "Avg / Question",
                    value: formatTime(avgTimeSecs),
                    color: { text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-100" },
                  },
                  {
                    icon: <TrendingDown className="h-5 w-5 text-red-500" />,
                    label: "Penalty Applied",
                    value: `-${totalPenalty}%`,
                    color: { text: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl border ${stat.color.border} ${stat.color.bg} p-4 text-center`}
                  >
                    <div className={`mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ${stat.color.text}`}>
                      {stat.icon}
                    </div>
                    <p className={`text-xl font-extrabold ${stat.color.text}`}>{stat.value}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Class comparison bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                  <span>Your adjusted score</span>
                  <span>Class average ({result.classAvg}%)</span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${result.adjustedScore >= result.classAvg ? "bg-emerald-400" : "bg-amber-400"}`}
                    style={{ width: `${result.adjustedScore}%` }}
                  />
                  {/* Class avg marker */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-slate-400"
                    style={{ left: `${result.classAvg}%` }}
                  />
                </div>
                <p className={`mt-1.5 text-xs font-medium ${result.adjustedScore >= result.classAvg ? "text-emerald-600" : "text-amber-600"}`}>
                  {result.adjustedScore >= result.classAvg
                    ? `You scored ${result.adjustedScore - result.classAvg}% above the class average 🎉`
                    : `You scored ${result.classAvg - result.adjustedScore}% below the class average`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Proctoring Summary ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">AI Proctoring Summary</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              The following violations were recorded by the AI proctor during your session.
              High-severity events contribute to your score penalty.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-2xl overflow-hidden">
            {/* Summary header strip */}
            <div className={`flex items-center justify-between px-6 py-4 ${flaggedPenalty > 0 ? "bg-red-50 border-b border-red-100" : "bg-emerald-50 border-b border-emerald-100"}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${flaggedPenalty > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${flaggedPenalty > 0 ? "text-red-800" : "text-emerald-800"}`}>
                    {flaggedPenalty > 0
                      ? `${flaggedPenalty} mark${flaggedPenalty > 1 ? "s" : ""} deducted for integrity violations`
                      : "No score-impacting violations detected"}
                  </p>
                  <p className={`text-xs ${flaggedPenalty > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {result.flags.reduce((s, f) => s + f.count, 0)} total events recorded
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${flaggedPenalty > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                {flaggedPenalty > 0 ? `-${flaggedPenalty}%` : "Clean"}
              </span>
            </div>

            {/* Per-flag rows */}
            <ul className="divide-y divide-slate-100">
              {result.flags.map((flag) => {
                const penalty = flag.count * flag.penaltyPerEvent;
                const isHigh = flag.severity === "high";
                return (
                  <li key={flag.type} className="flex items-center gap-4 px-6 py-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isHigh ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"}`}>
                      {flagIcon(flag.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{flag.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Detected <strong className="text-slate-600">{flag.count}×</strong>
                        {flag.penaltyPerEvent > 0
                          ? ` · ${flag.penaltyPerEvent} mark${flag.penaltyPerEvent > 1 ? "s" : ""} deducted per occurrence`
                          : " · Logged only, no mark deduction"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {penalty > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          −{penalty}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
                          No penalty
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Per-question breakdown ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Question-by-Question Review</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Review your answers and time spent on each question.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-2xl overflow-hidden">
            {/* Column header */}
            <div className="grid grid-cols-[2rem_1fr_7rem_7rem_6rem] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>#</span>
              <span>Question</span>
              <span className="text-center">Your Answer</span>
              <span className="text-center">Time Taken</span>
              <span className="text-center">Result</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {result.questions.map((q) => {
                const timeRatio = q.timeTaken / q.timeLimit;
                const timeColor =
                  timeRatio < 0.5
                    ? "bg-emerald-400"
                    : timeRatio < 0.85
                    ? "bg-blue-400"
                    : "bg-amber-400";

                return (
                  <li
                    key={q.id}
                    className={`grid grid-cols-[2rem_1fr_7rem_7rem_6rem] items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70 ${!q.isCorrect ? "bg-red-50/30" : ""}`}
                  >
                    {/* # */}
                    <span className="text-sm font-bold text-slate-300">{q.id}</span>

                    {/* Question text */}
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                        {q.text}
                      </p>
                      {!q.isCorrect && (
                        <p className="mt-1 text-xs text-slate-400">
                          Correct: <span className="font-semibold text-emerald-600">{q.correctAnswer}</span>
                        </p>
                      )}
                    </div>

                    {/* Answer */}
                    <div className="flex items-center justify-center">
                      <span className={`max-w-full truncate rounded-lg px-2.5 py-1 text-xs font-semibold text-center ${
                        q.yourAnswer === null
                          ? "bg-slate-100 text-slate-400"
                          : q.isCorrect
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {q.yourAnswer ?? "Skipped"}
                      </span>
                    </div>

                    {/* Time taken */}
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-600">{formatTime(q.timeTaken)}</span>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${timeColor} transition-all`}
                          style={{ width: `${Math.min(100, timeRatio * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-300">of {formatTime(q.timeLimit)}</span>
                    </div>

                    {/* Result */}
                    <div className="flex items-center justify-center">
                      {q.isCorrect ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600">
                          <XCircle className="h-3.5 w-3.5" /> Wrong
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="flex flex-col items-center gap-4 pb-4 sm:flex-row sm:justify-between">
          <p className="text-center text-sm text-slate-400 sm:text-left">
            Results are final. Contact your instructor if you believe there is an error.
          </p>
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Back to Dashboard <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
