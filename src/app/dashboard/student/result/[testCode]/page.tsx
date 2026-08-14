"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
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
import { Logo } from "@/components/Logo";

function gradeColors(grade: string) {
  if (grade.startsWith("A")) return { text: "text-pastel-mint-text", bg: "bg-pastel-mint", border: "border-mist-blue/30", ring: "#006644" };
  if (grade.startsWith("B")) return { text: "text-pastel-lavender-text", bg: "bg-pastel-lavender", border: "border-mist-blue/30", ring: "#403294" };
  if (grade.startsWith("C")) return { text: "text-pastel-yellow-text", bg: "bg-pastel-yellow", border: "border-mist-blue/30", ring: "#825e00" };
  return { text: "text-pastel-pink-text", bg: "bg-pastel-pink", border: "border-mist-blue/30", ring: "#bf2600" };
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
      <circle cx="100" cy="100" r={r} fill="none" className="stroke-mist-blue/20" strokeWidth="12" />
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedResult = getResultByCode(testCode);
    const savedTest = getTestByCode(testCode);
    setResult(savedResult || SEED_RESULTS[0]);
    setQuizTest(savedTest || SEED_TESTS[0]);
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
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl space-y-4 text-left animate-none"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue text-signal-green shadow-none">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray">
              Under Instructor Review
            </span>
            <h1 className="mt-0.5 text-xl font-bold text-midnight-navy">
              Assessment Submitted
            </h1>
            <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
              Results are currently hidden pending instructor review. Please check back after your instructor releases the grades for <strong>&ldquo;{activeResult.quizName}&rdquo;</strong>.
            </p>
          </div>

          <div className="rounded-inputs border border-mist-blue bg-frost-surface p-3.5 text-xs font-semibold text-midnight-navy space-y-1.5 leading-relaxed">
            <p className="flex items-center gap-1.5 text-pastel-mint-text">
              <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
              Submission Logged ({activeResult.submittedAt})
            </p>
            <p className="flex items-center gap-1.5 text-pastel-yellow-text">
              <Lock className="h-3.5 w-3.5 text-pastel-yellow-text shrink-0" />
              Question Breakdown &amp; Grades Locked
            </p>
          </div>

          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-buttons bg-signal-green py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
          >
            Return to Student Dashboard <ChevronRight className="h-3.5 w-3.5 text-white" />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-frost-surface font-sans text-midnight-navy selection:bg-frost-surface selection:text-signal-green">
      {/* Top Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between bg-paper-white border-b border-mist-blue px-6 py-4 shadow-none">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <span className="text-mist-blue/40">|</span>
          <Logo />
        </div>
        <span className="rounded-pills bg-frost-surface border border-mist-blue px-3 py-1 font-mono text-xs font-bold text-signal-green shadow-none">
          {testCode.toUpperCase()}
        </span>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-left">
        {/* Page Title */}
        <section>
          <span className="text-xs font-bold uppercase tracking-widest text-steel-blue-gray">
            Assessment Performance
          </span>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-midnight-navy">
            {activeResult.quizName || "Midterm Assessment"}
          </h1>
          <p className="mt-0.5 text-xs text-steel-blue-gray font-medium flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-steel-blue-gray" /> Submitted: {activeResult.submittedAt} · Class: {activeResult.targetClass}
          </p>
        </section>

        {/* Hero Score Card */}
        <section className="rounded-cards bg-paper-white p-6 border border-mist-blue shadow-xl">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {/* Score Ring */}
            <div className="relative shrink-0">
              <ScoreRing score={activeResult.adjustedScore} color={gc.ring} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-2xl font-black tracking-tight tabular-nums ${gc.text}`}>
                  {activeResult.adjustedScore}%
                </span>
                <span className="text-[9px] font-bold text-steel-blue-gray uppercase tracking-wider mt-0.5">Grade</span>
              </div>
            </div>

            {/* Breakdown details */}
            <div className="flex-1 space-y-3.5 w-full">
              <div>
                <p className="text-xs text-midnight-navy font-medium">
                  You answered <strong className="text-midnight-navy font-bold">{activeResult.correctCount} / {activeResult.totalQuestions}</strong> questions correctly.
                </p>
                <p className="mt-0.5 text-xs text-steel-blue-gray font-medium">
                  Raw mark: <span className="font-bold text-midnight-navy">{activeResult.rawScore}%</span> &rarr; Final Score: <span className={`font-bold ${gc.text}`}>{activeResult.adjustedScore}%</span>.
                </p>
              </div>

              {/* Mini Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className={`rounded-inputs border border-mist-blue bg-paper-white p-3 text-center shadow-sm`}>
                  <div className={`mx-auto mb-1 inline-flex h-6.5 w-6.5 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue/30 ${gc.text}`}>
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <p className={`text-base font-black ${gc.text}`}>{activeResult.grade}</p>
                  <p className="text-[9px] text-steel-blue-gray font-bold uppercase tracking-wider">Final Grade</p>
                </div>

                <div className="rounded-inputs border border-mist-blue bg-paper-white p-3 text-center shadow-sm">
                  <div className="mx-auto mb-1 inline-flex h-6.5 w-6.5 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue/30 text-signal-green">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-base font-black text-midnight-navy">{formatTime(activeResult.timeTakenTotalSeconds || 120)}</p>
                  <p className="text-[9px] text-steel-blue-gray font-bold uppercase tracking-wider">Total Time</p>
                </div>

                {showFlags && (
                  <div className="rounded-inputs border border-pastel-pink-text/20 bg-pastel-pink p-3 text-center col-span-2 sm:col-span-1 shadow-sm">
                    <div className="mx-auto mb-1 inline-flex h-6.5 w-6.5 items-center justify-center rounded-inputs bg-white border border-pastel-pink-text/20 text-pastel-pink-text">
                      <TrendingDown className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-base font-black text-pastel-pink-text">-{totalPenalty}%</p>
                    <p className="text-[9px] text-pastel-pink-text font-bold uppercase tracking-wider">AI Deductions</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* AI Proctoring Summary */}
        {showFlags && activeResult.flags && activeResult.flags.length > 0 && (
          <section className="rounded-cards bg-paper-white border border-mist-blue overflow-hidden shadow-xl">
            <div className="p-4 border-b border-mist-blue/30 flex items-center justify-between bg-paper-white">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-pastel-pink-text" />
                <h2 className="text-xs font-bold text-midnight-navy">AI Proctoring Flags Summary</h2>
              </div>
              <span className="text-[10px] font-bold text-steel-blue-gray font-mono">
                {activeResult.flags.reduce((acc, f) => acc + f.count, 0)} events
              </span>
            </div>

            <ul className="divide-y divide-mist-blue/30 bg-paper-white">
              {activeResult.flags.map((flag, idx) => (
                <li key={idx} className="flex items-center justify-between p-4 text-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-inputs bg-frost-surface border border-mist-blue text-steel-blue-gray">
                      {flagIcon(flag.type)}
                    </div>
                    <div>
                      <p className="font-bold text-midnight-navy">{flag.label}</p>
                      <p className="text-steel-blue-gray font-medium text-[10px]">Occurred {flag.count} time(s)</p>
                    </div>
                  </div>
                  <span className="font-bold text-pastel-pink-text bg-pastel-pink px-2.5 py-0.5 rounded-pills text-[10px]">
                    -{flag.count * 5}% score penalty
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Question-by-Question Review */}
        {revealSolutions ? (
          <section className="space-y-2.5">
            <h2 className="text-xs font-bold text-midnight-navy uppercase tracking-wider">Question-by-Question Breakdown</h2>
            <div className="rounded-cards bg-paper-white border border-mist-blue overflow-hidden divide-y divide-mist-blue/30 shadow-xl">
              {questions.map((q) => {
                const studentAns = activeResult.answers.find((a) => a.questionId === q.id);
                const chosen = studentAns?.selectedOption || "No option selected";
                const isCorrect = chosen === q.correctOption;

                return (
                  <div key={q.id} className="p-4.5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-inputs bg-frost-surface border border-mist-blue text-[10px] font-bold text-signal-green">
                          {q.id}
                        </span>
                        <p className="font-bold text-midnight-navy text-xs leading-snug">{q.text}</p>
                      </div>
                      {isCorrect ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-pastel-mint-text bg-pastel-mint px-2.5 py-0.5 rounded-pills">
                          <CheckCircle2 className="h-3 w-3" /> Correct (+1)
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-pastel-pink-text bg-pastel-pink px-2.5 py-0.5 rounded-pills">
                          <XCircle className="h-3 w-3" /> Incorrect
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold pt-1 pl-7">
                      <div className={`p-2.5 rounded-inputs bg-paper-white border ${isCorrect ? "border-pastel-mint-text/25 text-pastel-mint-text bg-pastel-mint/10" : "border-pastel-pink-text/25 text-pastel-pink-text bg-pastel-pink/10"}`}>
                        <span className="block text-[9px] text-steel-blue-gray uppercase font-bold mb-0.5">Your Choice</span>
                        {chosen}
                      </div>

                      <div className="p-2.5 rounded-inputs border border-pastel-mint-text/25 text-pastel-mint-text bg-pastel-mint/10">
                        <span className="block text-[9px] text-steel-blue-gray uppercase font-bold mb-0.5">Correct Answer</span>
                        {q.correctOption}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-cards bg-paper-white border border-mist-blue p-4.5 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-inputs bg-frost-surface border border-mist-blue text-steel-blue-gray">
                <FileQuestion className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-midnight-navy">Question Solutions Locked</h3>
                <p className="text-[10px] text-steel-blue-gray font-medium">
                  Your instructor has disabled solution key visibility for this assessment.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-pills bg-pastel-lavender text-pastel-lavender-text">
              Solutions Hidden
            </span>
          </section>
        )}

        {/* Back CTA */}
        <section className="flex justify-end pt-1">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-1 rounded-buttons bg-signal-green px-5 py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
          >
            Return to Dashboard <ChevronRight className="h-4 w-4 text-white" />
          </Link>
        </section>
      </main>
    </div>
  );
}
