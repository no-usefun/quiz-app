"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  CalendarDays,
  ChevronRight,
  Lock,
  FileQuestion,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { getResultByCode, getTestByCode } from "@/lib/storage";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function gradeColors(grade: string) {
  if (!grade)
    return {
      text: "text-[#1d5237]",
      bg: "bg-[#e2ede8]",
      border: "border-[#d1dee8]/30",
      ring: "#1d5237",
    };
  const upper = grade.toUpperCase();
  if (upper.startsWith("A"))
    return {
      text: "text-[#1d5237]",
      bg: "bg-[#e2ede8]",
      border: "border-[#d1dee8]/30",
      ring: "#1d5237",
    };
  if (upper.startsWith("B"))
    return {
      text: "text-[#4c3d73]",
      bg: "bg-[#ece9f3]",
      border: "border-[#d1dee8]/30",
      ring: "#4c3d73",
    };
  if (upper.startsWith("C"))
    return {
      text: "text-[#73561a]",
      bg: "bg-[#f6efe1]",
      border: "border-[#d1dee8]/30",
      ring: "#73561a",
    };
  return {
    text: "text-[#8c381c]",
    bg: "bg-[#fbeee8]",
    border: "border-[#d1dee8]/30",
    ring: "#8c381c",
  };
}

function formatTime(s: number) {
  if (!s || s < 60) return `${s || 0}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = ((score || 0) / 100) * circ;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="12"
      />
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
  const [result, setResult] = useState<any | null>(null);
  const [testMeta, setTestMeta] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchResult = async () => {
      const codeUpper = (testCode || "").toUpperCase();
      const localTest = getTestByCode(codeUpper);
      setTestMeta(localTest);

      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(
          `${API_BASE}/api/v1/student/results/${codeUpper}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          if (data) {
            setResult(data);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Backend student result lookup error:", e);
      }

      // Check local storage for actual student submission
      const localResult = getResultByCode(codeUpper);
      if (localResult) {
        setResult({
          ...localResult,
          score: localResult.rawScore,
          questions: localTest?.questions || [],
          published: localTest?.settings?.publishScoresImmediately ?? true,
          revealSolutions: localTest?.settings?.revealSolutions ?? true,
        });
      } else {
        setResult(null);
      }
      setLoading(false);
    };

    fetchResult();
  }, [testCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] flex items-center justify-center text-xs font-semibold text-[#78716b]">
        Loading assessment results...
      </div>
    );
  }

  // No result submitted
  if (!result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md rounded-[8.8px] bg-white p-8 text-center border border-[#d1dee8] shadow-sm space-y-4 text-left"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] border border-[#d1dee8] text-[#78716b]">
            <FileQuestion className="h-6 w-6" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              No Record Found
            </span>
            <h1 className="text-xl font-black text-[#111111]">
              Submission Not Found
            </h1>
            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              No recorded assessment submission found for session code{" "}
              <strong>&ldquo;{testCode?.toUpperCase()}&rdquo;</strong>.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/join"
              className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0"
            >
              Take Assessment <ChevronRight className="h-3.5 w-3.5 text-white" />
            </Link>
            <Link
              href="/dashboard/student"
              className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] bg-[#f5f5f4] py-2.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] transition-all border border-[#d1dee8]"
            >
              Return to Dashboard
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  // Determine if scores are published by instructor
  const isPublished =
    testMeta?.settings?.publishScoresImmediately !== undefined
      ? testMeta.settings.publishScoresImmediately
      : (result.published ?? result.isPublished ?? true);

  const canRevealSolutions =
    testMeta?.settings?.revealSolutions !== undefined
      ? testMeta.settings.revealSolutions
      : (result.revealSolutions ?? true);

  // If scores are not released yet
  if (!isPublished) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-md rounded-[12px] bg-white p-8 text-center border border-[#d1dee8] shadow-sm space-y-5 text-left"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] border border-[#8c381c]/30 text-[#8c381c]">
            <Lock className="h-6 w-6" />
          </div>
          <div className="text-center space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f4] border border-[#d1dee8] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Pending Instructor Release
            </span>
            <h1 className="text-xl font-black text-[#111111]">
              Assessment Submitted Successfully
            </h1>
            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              Your responses for{" "}
              <strong>&ldquo;{result.quizName || testCode}&rdquo;</strong> have
              been permanently recorded. Detailed scorecards, accuracy grades, and
              solutions will be displayed once published by your instructor.
            </p>
          </div>

          <div className="rounded-[8.8px] bg-[#f5f5f4] border border-[#d1dee8] p-3 text-xs space-y-1.5 font-medium text-[#78716b]">
            <div className="flex justify-between">
              <span>Session Code:</span>
              <strong className="font-mono text-[#111111]">{testCode?.toUpperCase()}</strong>
            </div>
            <div className="flex justify-between">
              <span>Candidate:</span>
              <strong className="text-[#111111]">{result.studentName || "Registered Student"}</strong>
            </div>
            <div className="flex justify-between">
              <span>Submitted At:</span>
              <strong className="text-[#111111]">{result.submittedAt || "Recently"}</strong>
            </div>
          </div>

          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] bg-[#111111] py-2.5 text-xs font-bold text-white hover:bg-[#111111]/90 active:scale-[0.98] transition-all border-0"
          >
            Return to Student Dashboard{" "}
            <ChevronRight className="h-3.5 w-3.5 text-white" />
          </Link>
        </motion.div>
      </main>
    );
  }

  const gc = gradeColors(result.grade || "A");
  const questions = result.questions || testMeta?.questions || [];

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] selection:bg-[#e6e3e2] selection:text-[#165dfb]">
      <nav className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-[#d1dee8] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2 text-xs font-bold text-[#78716b] hover:text-[#111111] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <span className="text-[#d1dee8]">|</span>
          <Logo />
        </div>
        <span className="rounded-full bg-[#f5f5f4] border border-[#d1dee8] px-3 py-1 font-mono text-xs font-bold text-[#111111]">
          {testCode.toUpperCase()}
        </span>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-left">
        <section>
          <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
            Verified Assessment Performance
          </span>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#111111]">
            {result.quizName || "Assessment Results"}
          </h1>
          <p className="mt-0.5 text-xs text-[#78716b] font-medium flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-[#78716b]" />{" "}
            Submitted: {result.submittedAt || "Recently"}
          </p>
        </section>

        <section className="rounded-[8.8px] bg-white p-6 border border-[#d1dee8] shadow-sm">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <ScoreRing
                score={result.adjustedScore || result.rawScore || 0}
                color={gc.ring}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className={`text-2xl font-black tracking-tight tabular-nums ${gc.text}`}
                >
                  {result.adjustedScore || result.rawScore || 0}%
                </span>
                <span className="text-[9px] font-bold text-[#78716b] uppercase tracking-wider mt-0.5">
                  Grade
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-3.5 w-full">
              <div>
                <p className="text-xs text-[#111111] font-medium">
                  You scored{" "}
                  <strong className="text-[#111111] font-bold">
                    {result.correctCount ?? 0} /{" "}
                    {result.totalQuestions || questions.length || 0}
                  </strong>{" "}
                  questions correctly.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-3 text-center shadow-sm">
                  <div
                    className={`mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#f5f5f4] border border-[#d1dee8] ${gc.text}`}
                  >
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <p className={`text-base font-black ${gc.text}`}>
                    {result.grade || "A"}
                  </p>
                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Grade
                  </p>
                </div>

                <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-3 text-center shadow-sm">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#f5f5f4] border border-[#d1dee8] text-[#165dfb]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-base font-black text-[#111111]">
                    {result.accuracyPercentage ?? (result.totalQuestions > 0 ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0)}%
                  </p>
                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Accuracy
                  </p>
                </div>

                <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-3 text-center shadow-sm">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#f5f5f4] border border-[#d1dee8] text-[#73561a]">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-base font-black text-[#111111]">
                    +{result.speedBonusTotal ?? 0}
                  </p>
                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Speed Bonus
                  </p>
                </div>

                <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-3 text-center shadow-sm">
                  <div className="mx-auto mb-1 inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#f5f5f4] border border-[#d1dee8] text-[#111111]">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-base font-black text-[#111111]">
                    {formatTime(result.timeTakenTotalSeconds || 120)}
                  </p>
                  <p className="text-[9px] text-[#78716b] font-bold uppercase tracking-wider">
                    Total Time
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {canRevealSolutions && questions.length > 0 ? (
          <section className="space-y-2.5">
            <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Question Breakdown &amp; Solutions
            </h2>
            <div className="rounded-[8.8px] bg-white border border-[#d1dee8] overflow-hidden divide-y divide-[#d1dee8] shadow-sm">
              {questions.map((q: any, idx: number) => {
                const studentAns = result.answers?.find(
                  (a: any) =>
                    a.questionId === (q.id || idx + 1) || a.questionText === q.text,
                );
                const isCorrect =
                  studentAns?.selectedOption === q.correctOption;

                return (
                  <div key={idx} className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-[#111111] leading-snug">
                        {idx + 1}. {q.text || q.questionText}
                      </p>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e2ede8] text-[#1d5237] px-2 py-0.5 text-[10px] font-bold shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fbeee8] text-[#8c381c] px-2 py-0.5 text-[10px] font-bold shrink-0">
                          <XCircle className="h-3 w-3" /> Incorrect
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-[6px] bg-[#f5f5f4] p-2 border border-[#d1dee8]">
                        <span className="text-[#78716b] block text-[9px] uppercase font-bold">
                          Your Answer:
                        </span>
                        <span className="font-semibold text-[#111111]">
                          {studentAns?.selectedOption || "Not answered"}
                        </span>
                      </div>
                      <div className="rounded-[6px] bg-[#e2ede8]/60 p-2 border border-[#1d5237]/20">
                        <span className="text-[#1d5237] block text-[9px] uppercase font-bold">
                          Correct Answer:
                        </span>
                        <span className="font-bold text-[#1d5237]">
                          {q.correctOption || "Option A"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-[8.8px] bg-white border border-[#d1dee8] p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] border border-[#d1dee8] text-[#78716b]">
                <FileQuestion className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#111111]">
                  Question Solutions Locked
                </h3>
                <p className="text-[10px] text-[#78716b] font-medium">
                  Detailed answer keys and explanations have been disabled by the instructor.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="flex justify-end pt-2">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-sm"
          >
            Return to Dashboard <ChevronRight className="h-4 w-4 text-white" />
          </Link>
        </section>
      </main>
    </div>
  );
}
