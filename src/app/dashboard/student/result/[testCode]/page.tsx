"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  CalendarDays,
  ChevronRight,
  Lock,
  FileQuestion,
} from "lucide-react";
import { StudentTestResult, QuizTest } from "@/lib/types";
import { getResultByCode, getTestByCode, SEED_RESULTS, SEED_TESTS } from "@/lib/storage";

function gradeColors(grade: string) {
  if (grade.startsWith("A")) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", ring: "#10b981" };
  if (grade.startsWith("B")) return { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100", ring: "#2563eb" };
  if (grade.startsWith("C")) return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", ring: "#f59e0b" };
  return { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", ring: "#f43f5e" };
}

function formatTime(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function flagIcon(type: string) {
  const cls = "h-4 w-4";
  if (type === "tab_switch") return <Monitor className={cls} />;
  if (type === "fullscreen_exit") return <Eye className={cls} />;
  if (type === "copy_attempt") return <Copy className={cls} />;
  return <MousePointerClick className={cls} />;
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
      <circle cx="100" cy="100" r={r} fill="none" className="stroke-slate-100" strokeWidth="12" />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

export default function StudentResultPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const [result, setResult] = useState<StudentTestResult | null>(null);
  const [quizTest, setQuizTest] = useState<QuizTest | null>(null);

  useEffect(() => {
    const savedResult = getResultByCode(testCode);
    const savedTest = getTestByCode(testCode);
    setTimeout(() => {
      setResult(savedResult || SEED_RESULTS[0]);
      setQuizTest(savedTest || SEED_TESTS[0]);
    }, 0);
  }, [testCode]);

  const activeResult = result || SEED_RESULTS[0];
  const activeTest = quizTest || SEED_TESTS[0];

  const publishScores = activeTest.settings?.publishScoresImmediately ?? false;
  const revealSolutions = activeTest.settings?.revealSolutions ?? false;
  const showFlags = activeTest.settings?.showIntegrityFlagsToStudent ?? false;

  const gc = gradeColors(activeResult.grade || "A");
  const totalPenalty = Math.max(0, activeResult.rawScore - activeResult.adjustedScore);
  const questions = activeTest.questions || [];

  // STRICT FAILSAFE: If results are not published by teacher, return isolated Pending Review card
  if (!publishScores) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-850 p-4 font-sans selection:bg-blue-105 selection:text-blue-900">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 text-center border border-slate-205 shadow-xs space-y-4"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 shadow-xs">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Under Instructor Review
            </span>
            <h1 className="mt-0.5 text-xl font-bold text-slate-905">
              Assessment Submitted
            </h1>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed font-medium">
              Results are currently hidden pending instructor review. Please check back after your instructor releases the grades for <strong>&ldquo;{activeResult.quizName}&rdquo;</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-semibold text-slate-700 text-left space-y-1.5">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Submission Logged ({activeResult.submittedAt})
            </p>
            <p className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              Question Breakdown &amp; Grades Locked
            </p>
          </div>

          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-750 active:scale-95 transition-all shadow-xs"
          >
            Return to Student Dashboard <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-850 selection:bg-blue-105 selection:text-blue-900">
      {/* Top Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">DynoQuizz</span>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 font-mono text-xs font-bold text-slate-655">
          {testCode.toUpperCase()}
        </span>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {/* Page Title */}
        <section>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Assessment Performance
          </span>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">
            {activeResult.quizName || "Midterm Assessment"}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 font-medium flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> Submitted: {activeResult.submittedAt} · Target Class: {activeResult.targetClass}
          </p>
        </section>

        {/* Hero Score Card */}
        <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {/* Score Ring */}
            <div className="relative shrink-0">
              <ScoreRing score={activeResult.adjustedScore} color={gc.ring} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-2xl font-black tracking-tight tabular-nums ${gc.text}`}>
                  {activeResult.adjustedScore}%
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Released Grade</span>
              </div>
            </div>

            {/* Breakdown details */}
            <div className="flex-1 space-y-3.5">
              <div>
                <p className="text-xs text-slate-700 font-medium">
                  You answered <strong className="text-slate-950 font-bold">{activeResult.correctCount} / {activeResult.totalQuestions}</strong> questions correctly.
                </p>
                <p className="mt-0.5 text-xs text-slate-550 font-medium">
                  Raw mark: <span className="font-bold text-slate-700">{activeResult.rawScore}%</span> → Final Released Score: <span className={`font-bold ${gc.text}`}>{activeResult.adjustedScore}%</span>.
                </p>
              </div>

              {/* Mini Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className={`rounded-xl border ${gc.border} ${gc.bg} p-3 text-center`}>
                  <div className={`mx-auto mb-1 inline-flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-white border ${gc.border} ${gc.text}`}>
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <p className={`text-base font-black ${gc.text}`}>{activeResult.grade}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Final Grade</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <div className="mx-auto mb-1 inline-flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-white border border-slate-205 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-base font-black text-slate-900">{formatTime(activeResult.timeTakenTotalSeconds || 120)}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Time</p>
                </div>

                {showFlags && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center col-span-2 sm:col-span-1">
                    <div className="mx-auto mb-1 inline-flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-white border border-rose-200 text-rose-700">
                      <TrendingDown className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-base font-black text-rose-750">-{totalPenalty}%</p>
                    <p className="text-[9px] text-rose-600 font-bold uppercase tracking-wider">AI Deductions</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* AI Proctoring Summary (Only if showFlags is true) */}
        {showFlags && activeResult.flags && activeResult.flags.length > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <h2 className="text-xs font-bold text-slate-900">AI Proctoring Flags Summary</h2>
              </div>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {activeResult.flags.reduce((acc, f) => acc + f.count, 0)} events
              </span>
            </div>

            <ul className="divide-y divide-slate-100 bg-white">
              {activeResult.flags.map((flag, idx) => (
                <li key={idx} className="flex items-center justify-between p-4 text-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                      {flagIcon(flag.type)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{flag.label}</p>
                      <p className="text-slate-400 font-medium text-[10px]">Occurred {flag.count} time(s)</p>
                    </div>
                  </div>
                  <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px]">
                    -{flag.count * 5}% score penalty
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Question-by-Question Review (Only if revealSolutions is true) */}
        {revealSolutions ? (
          <section className="space-y-2.5">
            <h2 className="text-xs font-bold text-slate-905">Question-by-Question Breakdown</h2>
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-xs">
              {questions.map((q) => {
                const studentAns = activeResult.answers.find((a) => a.questionId === q.id);
                const chosen = studentAns?.selectedOption || "No option selected";
                const isCorrect = chosen === q.correctOption;

                return (
                  <div key={q.id} className="p-4.5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700">
                          {q.id}
                        </span>
                        <p className="font-bold text-slate-900 text-xs leading-snug">{q.text}</p>
                      </div>
                      {isCorrect ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Correct (+1)
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                          <XCircle className="h-3 w-3" /> Incorrect
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold pt-1 pl-7">
                      <div className={`p-2.5 rounded-lg border ${isCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"}`}>
                        <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Your Choice</span>
                        {chosen}
                      </div>

                      <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800">
                        <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Correct Answer</span>
                        {q.correctOption}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white border border-slate-200 p-4.5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
                <FileQuestion className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-905">Question Solutions Locked</h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Your instructor has disabled solution key visibility for this assessment.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
              Solutions Hidden
            </span>
          </section>
        )}

        {/* Back CTA */}
        <section className="flex justify-end pt-1">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
          >
            Return to Student Dashboard <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
