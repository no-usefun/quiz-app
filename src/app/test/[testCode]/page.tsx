"use client";

import { useProctoring } from "@/hooks/useProctoring";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  Video,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Wifi,
  WifiOff,
  Hourglass,
} from "lucide-react";
import { QuizTest, StudentAnswer, StudentTestResult } from "@/lib/types";
import { getTestByCode, saveResult } from "@/lib/storage";

const DEFAULT_FALLBACK_TEST: QuizTest = {
  testCode: "DEMO-101",
  quizName: "Data Structures & Algorithms Midterm",
  targetClass: "CS-201",
  totalTimeLimitMinutes: 30,
  settings: {
    negativeMarking: true,
    automatedAiPenalty: true,
    publishScoresImmediately: false,
    revealSolutions: false,
    showIntegrityFlagsToStudent: false,
  },
  createdAt: "Aug 14, 2026",
  status: "LIVE",
  questions: [
    {
      id: 1,
      text: "Which data structure operates on a Last In, First Out (LIFO) principle?",
      options: ["Queue", "Stack", "Linked List", "Binary Tree"],
      correctOption: "Stack",
    },
    {
      id: 2,
      text: "What is the worst-case time complexity of searching in a balanced Binary Search Tree?",
      options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
      correctOption: "O(log n)",
    },
    {
      id: 3,
      text: "Which property in SQL guarantees that a database transaction is completely committed or aborted?",
      options: ["Atomicity", "Consistency", "Isolation", "Durability"],
      correctOption: "Atomicity",
    },
  ],
};

function calculateGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "F";
}

export default function TestArenaPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const { violationCount, flags } = useProctoring();
  const router = useRouter();

  // Test state loaded from localStorage
  const [activeTest, setActiveTest] = useState<QuizTest>(DEFAULT_FALLBACK_TEST);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState(30); // fixed 30s per question
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Async update to avoid cascading synchronous render in effect
      setTimeout(() => setIsOnline(navigator.onLine), 0);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    const loaded = getTestByCode(testCode);
    if (loaded && loaded.questions.length > 0) {
      // Async update to avoid cascading synchronous render in effect
      setTimeout(() => setActiveTest(loaded), 0);
    }
  }, [testCode]);

  const questions = activeTest.questions;
  const currentQuestion = questions[currentIndex] || questions[0];
  const progressPercentage = ((currentIndex + 1) / questions.length) * 100;

  const handleLockAnswer = () => {
    if (!selectedOption || isAnswerLocked) return;

    const currentAnswer: StudentAnswer = {
      questionId: currentQuestion.id,
      selectedOption: selectedOption,
      timeTakenSeconds: 30 - timeLeft,
    };

    setStudentAnswers((prev) => [...prev, currentAnswer]);
    setIsAnswerLocked(true);
  };

  const finishAssessment = (finalAnswers: StudentAnswer[]) => {
    let correctCount = 0;
    let incorrectCount = 0;
    finalAnswers.forEach((ans) => {
      const q = questions.find((item) => item.id === ans.questionId);
      if (q) {
        if (q.correctOption === ans.selectedOption) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    });

    let rawScorePoints = correctCount;
    if (activeTest.settings?.negativeMarking) {
      rawScorePoints -= incorrectCount * 0.5;
    }
    const rawPercentage = Math.max(0, Math.round((rawScorePoints / questions.length) * 100));
    const penaltyDeduction = Math.min(violationCount * 5, 25);
    const adjustedPercentage = Math.max(0, rawPercentage - penaltyDeduction);
    const grade = calculateGrade(adjustedPercentage);

    const finalResult: StudentTestResult = {
      testCode: testCode.toUpperCase(),
      quizName: activeTest.quizName,
      targetClass: activeTest.targetClass,
      studentName: "Suryanshu Saini",
      submittedAt: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
      rawScore: rawPercentage,
      adjustedScore: adjustedPercentage,
      totalQuestions: questions.length,
      correctCount: correctCount,
      grade: grade,
      timeTakenTotalSeconds: finalAnswers.reduce((acc, a) => acc + a.timeTakenSeconds, 0),
      answers: finalAnswers,
      flags: [
        { type: "tab_switch" as const, label: "Tab switched", count: flags.tab_switch },
        { type: "fullscreen_exit" as const, label: "Fullscreen exited", count: flags.fullscreen_exit },
        { type: "right_click" as const, label: "Right-click attempted", count: flags.right_click },
        { type: "copy_attempt" as const, label: "Copy/Paste attempted", count: flags.copy_attempt },
      ].filter((f) => f.count > 0),
    };

    saveResult(finalResult);

    if (activeTest.settings?.publishScoresImmediately) {
      router.push(`/dashboard/student/result/${testCode}`);
    } else {
      setIsSubmitted(true);
    }
  };

  const handleTimerExpired = () => {
    let latestAnswers = [...studentAnswers];
    const hasCurrent = latestAnswers.some((a) => a.questionId === currentQuestion.id);

    if (!hasCurrent) {
      const autoAnswer: StudentAnswer = {
        questionId: currentQuestion.id,
        selectedOption: selectedOption,
        timeTakenSeconds: 30,
      };
      latestAnswers = [...latestAnswers, autoAnswer];
      setStudentAnswers(latestAnswers);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerLocked(false);
      setTimeLeft(30);
    } else {
      finishAssessment(latestAnswers);
    }
  };

  // Countdown timer for current question
  useEffect(() => {
    if (isSubmitted || questions.length === 0) return;

    const timer = setTimeout(() => {
      if (timeLeft <= 1) {
        handleTimerExpired();
      } else {
        setTimeLeft((prev) => prev - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isSubmitted, questions.length]);

  if (isSubmitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-850 p-4 font-sans selection:bg-blue-105 selection:text-blue-900">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 text-center border border-slate-205 shadow-xs space-y-4"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 shadow-xs">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Response Recorded
            </span>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">
              Assessment Submitted
            </h1>
            <p className="mt-1 text-xs text-slate-505 leading-relaxed font-medium">
              Your exam payload and telemetry log have been securely saved. Results will be available once evaluated and published by your instructor.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-semibold text-slate-705 text-left space-y-1.5">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Answers Submitted &amp; Encrypted
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              Proctoring Telemetry Logged
            </p>
            <p className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-550 shrink-0" />
              Results Pending Instructor Release
            </p>
          </div>
          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-650 hover:bg-blue-700 py-2.5 text-xs font-bold text-white active:scale-95 transition-all shadow-xs"
          >
            Return to Dashboard <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-850 p-4 md:p-6 font-sans selection:bg-blue-105 selection:text-blue-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex flex-1 flex-col rounded-2xl bg-white overflow-hidden border border-slate-200 shadow-xs"
      >
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between bg-slate-50 px-6 py-4 gap-3 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            <span className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-bold text-white font-mono shadow-xs border border-blue-700">
              {testCode.toUpperCase()}
            </span>
            <span className="text-xs font-bold text-slate-500">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {/* Extension Locked Security Badge */}
            <span className="hidden md:flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Extension Locked: Secure Mode Active
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Dynamic Network Status Indicator */}
            {isOnline ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250/60 px-2.5 py-0.5 text-xs font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <Wifi className="h-3.5 w-3.5" /> Connected &amp; Syncing
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-250/60 px-2.5 py-0.5 text-xs font-bold">
                <WifiOff className="h-3.5 w-3.5" /> Offline - Saving Locally
              </span>
            )}

            {/* Per-Question Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs transition-colors border ${
                timeLeft <= 10
                  ? "bg-rose-50 text-rose-700 border-rose-250/60"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              00:{timeLeft.toString().padStart(2, "0")}
            </div>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 border-b border-slate-200/50">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 bg-white">
          <AnimatePresence mode="wait">
            {!isAnswerLocked ? (
              <motion.div
                key={`q-${currentIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h2 className="mb-5 text-lg font-bold leading-snug text-slate-900 md:text-xl">
                  {currentQuestion.text}
                </h2>

                <div className="space-y-2.5">
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(option)}
                      className={`w-full rounded-xl border p-3.5 text-left text-xs font-bold transition-all ${
                        selectedOption === option
                          ? "border-blue-650 bg-blue-50/70 text-blue-900 ring-1 ring-blue-600"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold border ${
                            selectedOption === option
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white text-slate-500 border-slate-205"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {option}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* Synchronized Locked Waiting View */
              <motion.div
                key="waiting-lock"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center text-center py-8 space-y-3.5 max-w-md mx-auto"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-650 text-white shadow-xs border border-blue-700">
                  <Lock className="h-5 w-5" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Synchronized Pacing Active
                  </span>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-905">
                    Answer Locked &amp; Saved
                  </h2>
                  <p className="mt-1 text-xs text-slate-505 leading-relaxed font-medium">
                    Your choice for Question {currentIndex + 1} has been recorded locally. Waiting for the synchronized timer to expire before unlocking Question {currentIndex + 2}...
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 w-full text-center space-y-1">
                  <p className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1">
                    <Hourglass className="h-3.5 w-3.5 text-slate-800 animate-spin" />
                    Next question unlocks in 00:{timeLeft.toString().padStart(2, "0")}s
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Selected Choice: <strong className="font-bold text-slate-900">{selectedOption}</strong>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-between items-center">
          <span className="text-[10px] font-medium text-slate-400">
            Synchronized Question Flow · Back &amp; Skip Disabled
          </span>

          <button
            onClick={handleLockAnswer}
            disabled={!selectedOption || isAnswerLocked}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs disabled:opacity-40"
          >
            {isAnswerLocked ? (
              <><Lock className="h-3.5 w-3.5" /> Answer Locked</>
            ) : currentIndex === questions.length - 1 ? (
              <><Lock className="h-3.5 w-3.5" /> Lock &amp; Submit</>
            ) : (
              <><Lock className="h-3.5 w-3.5" /> Lock Answer</>
            )}
          </button>
        </footer>
      </motion.div>

      {/* RIGHT COLUMN: AI Proctoring Sidebar */}
      <aside className="hidden w-72 flex-col gap-4 pl-6 lg:flex">
        {/* Webcam Container */}
        <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="aspect-video w-full bg-slate-900 border-b border-slate-200 flex items-center justify-center relative">
            <Video className="h-6 w-6 text-slate-405" />
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </div>
          </div>
          <div className="p-3.5">
            <h3 className="flex items-center gap-1 font-bold text-slate-900 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-slate-550" /> Edge-AI Proctor Active
            </h3>
            <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
              Webcam feed, tab switches, and clipboard events are monitored.
            </p>
          </div>
        </div>

        {/* System Warnings Panel */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <h3 className="flex items-center gap-1 font-bold text-amber-900 mb-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Proctoring Rules
          </h3>
          <ul className="space-y-1 text-[10px] font-medium text-amber-800">
            <li className="flex items-start gap-1">
              <div className="mt-1 h-1 w-1 rounded-full bg-amber-600 shrink-0" />
              Do not switch tabs or minimize the window.
            </li>
            <li className="flex items-start gap-1">
              <div className="mt-1 h-1 w-1 rounded-full bg-amber-600 shrink-0" />
              Questions advance automatically when timer hits zero.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
