"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  ShieldCheck,
  Hourglass,
  Video,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { QuizTest, StudentTestResult } from "@/lib/types";
import { getTestByCode, saveResult } from "@/lib/storage";
import { useProctoring } from "@/hooks/useProctoring";

export default function TestArenaPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  // Test data and question indexing
  const [test, setTest] = useState<QuizTest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30s per question
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Active Internet Connection Status
  const [isOnline, setIsOnline] = useState(true);

  // Load proctoring hook hooks
  const { flags, requestFullscreen } = useProctoring();

  useEffect(() => {
    setMounted(true);
    const loadedTest = getTestByCode(testCode);
    if (loadedTest) {
      setTest(loadedTest);
    } else {
      router.push("/join");
    }

    // Bind connection monitors
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [testCode, router]);

  const questions = test?.questions || [];
  const currentQuestion = questions[currentIndex];

  const progressPercentage = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleLockAnswer = () => {
    if (!selectedOption) return;
    setIsAnswerLocked(true);
    
    // Save current answer
    const newAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    setAnswers(newAnswers);
    
    // Auto-advance after 1.5s or submit
    setTimeout(() => {
      advanceOrSubmit(newAnswers);
    }, 1500);
  };

  const advanceOrSubmit = (latestAnswers: Record<number, string>) => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerLocked(false);
      setTimeLeft(30);
    } else {
      finishAssessment(latestAnswers);
    }
  };

  const finishAssessment = (latestAnswers: Record<number, string>) => {
    if (isSubmitted || !test) return;
    setIsSubmitted(true);

    // Calculate score
    let correctCount = 0;
    test.questions.forEach((q) => {
      if (latestAnswers[q.id] === q.correctOption) {
        correctCount++;
      }
    });

    const totalQuestions = test.questions.length;
    const rawScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    
    const proctorFlags = [
      { type: "tab_switch" as const, label: "Tab switched / window minimized", count: flags.tab_switch },
      { type: "fullscreen_exit" as const, label: "Exited fullscreen mode", count: flags.fullscreen_exit },
      { type: "right_click" as const, label: "Right-click attempted", count: flags.right_click },
      { type: "copy_attempt" as const, label: "Copy attempt blocked", count: flags.copy_attempt },
    ].filter((f) => f.count > 0);

    // Score deduction penalty: -5% per tab switch/fullscreen exit
    const flagsCount = proctorFlags.reduce((a, b) => a + b.count, 0);
    const penalty = test.settings.automatedAiPenalty ? flagsCount * 5 : 0;
    const adjustedScore = Math.max(0, rawScore - penalty);

    // Calculate grade
    let grade = "F";
    if (adjustedScore >= 90) grade = "A+";
    else if (adjustedScore >= 80) grade = "A";
    else if (adjustedScore >= 70) grade = "B+";
    else if (adjustedScore >= 60) grade = "B";
    else if (adjustedScore >= 50) grade = "C";
    else if (adjustedScore >= 40) grade = "D";

    const submission: StudentTestResult = {
      testCode: testCode.toUpperCase(),
      quizName: test.quizName,
      targetClass: test.targetClass,
      studentName: "Student User",
      submittedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      rawScore,
      adjustedScore,
      totalQuestions,
      correctCount,
      grade,
      timeTakenTotalSeconds: 320, // Mock time
      answers: Object.entries(latestAnswers).map(([qid, ans]) => ({
        questionId: Number(qid),
        selectedOption: ans,
        timeTakenSeconds: 15, // Mock time taken per question
      })),
      flags: proctorFlags,
    };

    saveResult(submission);
  };

  const handleTimerExpired = () => {
    // Lock answer with current selection or empty if none selected
    const finalAns = selectedOption || "Skipped (Timer Expired)";
    const newAnswers = { ...answers, [currentQuestion?.id]: finalAns };
    setAnswers(newAnswers);
    setIsAnswerLocked(true);
    
    setTimeout(() => {
      advanceOrSubmit(newAnswers);
    }, 1000);
  };

  // Countdown timer
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
  }, [timeLeft, isSubmitted, questions.length]);

  if (isSubmitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl space-y-4"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue text-signal-green shadow-none">
            <CheckCircle2 className="h-6 w-6 text-pastel-mint-text" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray">
              Response Recorded
            </span>
            <h1 className="mt-0.5 text-xl font-bold text-midnight-navy">
              Assessment Submitted
            </h1>
            <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
              Your exam payload and telemetry log have been securely saved. Results will be available once evaluated and published by your instructor.
            </p>
          </div>
          <div className="rounded-inputs border border-mist-blue bg-frost-surface p-3.5 text-xs font-semibold text-midnight-navy text-left space-y-1.5 leading-relaxed">
            <p className="flex items-center gap-1.5 text-pastel-mint-text">
              <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
              Answers Submitted &amp; Encrypted
            </p>
            <p className="flex items-center gap-1.5 text-pastel-mint-text">
              <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text shrink-0" />
              Proctoring Telemetry Logged
            </p>
            <p className="flex items-center gap-1.5 text-pastel-yellow-text">
              <Lock className="h-3.5 w-3.5 text-pastel-yellow-text shrink-0" />
              Results Pending Instructor Release
            </p>
          </div>
          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-buttons bg-signal-green py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
          >
            Return to Dashboard <ChevronRight className="h-4 w-4 text-white" />
          </Link>
        </motion.div>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy">
        <p className="text-xs font-bold text-steel-blue-gray animate-pulse">Initializing Test Environment...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-frost-surface text-midnight-navy p-4 md:p-6 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-1 flex-col rounded-cards bg-paper-white overflow-hidden border border-mist-blue shadow-xl text-left"
      >
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between bg-paper-white px-6 py-4 gap-3 border-b border-mist-blue/30">
          <div className="flex items-center gap-3.5">
            <span className="rounded-pills bg-frost-surface px-3 py-0.5 text-xs font-bold text-signal-green font-mono border border-mist-blue/30 shadow-none">
              {testCode.toUpperCase()}
            </span>
            <span className="text-xs font-bold text-steel-blue-gray">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {/* Security Mode Badge */}
            <span className="hidden md:flex items-center gap-1.5 rounded-pills bg-paper-white border border-mist-blue px-2.5 py-0.5 text-xs font-bold text-steel-blue-gray">
              <ShieldCheck className="h-3.5 w-3.5 text-signal-green" /> Environment Locked
            </span>
          </div>

          <div className="flex items-center gap-3.5 font-sans">
            {/* Network Sync */}
            {isOnline ? (
              <span className="flex items-center gap-1.5 rounded-pills bg-pastel-mint text-pastel-mint-text px-2.5 py-0.5 text-xs font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pastel-mint-text" />
                </span>
                <Wifi className="h-3.5 w-3.5 text-pastel-mint-text" /> Sync Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-pills bg-pastel-yellow text-pastel-yellow-text px-2.5 py-0.5 text-xs font-bold">
                <WifiOff className="h-3.5 w-3.5 text-pastel-yellow-text" /> Offline Mode
              </span>
            )}

            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-pills px-3 py-1 font-bold text-xs transition-colors border ${
                timeLeft <= 10
                  ? "bg-pastel-pink text-pastel-pink-text border-transparent animate-pulse"
                  : "bg-paper-white text-steel-blue-gray border-mist-blue"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              00:{timeLeft.toString().padStart(2, "0")}
            </div>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-frost-surface border-b border-mist-blue/20">
          <div
            className="h-full bg-signal-green transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 bg-paper-white">
          <AnimatePresence mode="wait">
            {!isAnswerLocked ? (
              <motion.div
                key={`q-${currentIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <h2 className="mb-5 text-lg font-bold leading-snug text-midnight-navy md:text-xl tracking-tight">
                  {currentQuestion.text}
                </h2>

                <div className="space-y-2.5">
                  {currentQuestion.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(option)}
                      className={`w-full rounded-inputs border p-3.5 text-left text-xs font-bold transition-all duration-150 cursor-pointer ${
                        selectedOption === option
                          ? "border-signal-green bg-frost-surface text-midnight-navy ring-2 ring-signal-green/20"
                          : "border-mist-blue bg-paper-white text-steel-blue-gray hover:border-mist-blue/80 hover:text-midnight-navy"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-inputs text-xs font-bold border transition-colors ${
                            selectedOption === option
                              ? "bg-signal-green border-signal-green text-white"
                              : "bg-paper-white text-steel-blue-gray border-mist-blue"
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
              /* Waiting Lock */
              <motion.div
                key="waiting-lock"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center text-center py-8 space-y-3.5 max-w-md mx-auto"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-inputs bg-frost-surface text-signal-green border border-mist-blue/30 animate-pulse">
                  <Lock className="h-5 w-5 text-signal-green" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-steel-blue-gray">
                    Synchronized Pacing Active
                  </span>
                  <h2 className="mt-0.5 text-lg font-bold text-midnight-navy">
                    Answer Locked &amp; Saved
                  </h2>
                  <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
                    Your choice for Question {currentIndex + 1} has been recorded locally. Waiting for the synchronized timer to expire...
                  </p>
                </div>

                <div className="rounded-inputs border border-mist-blue bg-frost-surface p-3.5 w-full text-center space-y-1">
                  <p className="text-xs font-bold text-midnight-navy flex items-center justify-center gap-1">
                    <Hourglass className="h-3.5 w-3.5 text-signal-green animate-spin" />
                    Next question unlocks in 00:{timeLeft.toString().padStart(2, "0")}s
                  </p>
                  <p className="text-[10px] text-steel-blue-gray font-medium">
                    Selected Choice: <strong className="font-bold text-midnight-navy">{selectedOption}</strong>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="border-t border-mist-blue/30 bg-paper-white px-6 py-3 flex justify-between items-center">
          <span className="text-[10px] font-medium text-steel-blue-gray">
            Paced Exam Flow · Back &amp; Skip Disabled
          </span>

          <button
            onClick={handleLockAnswer}
            disabled={!selectedOption || isAnswerLocked}
            className="flex items-center gap-1 rounded-buttons bg-signal-green px-4 py-2 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none disabled:opacity-40 cursor-pointer border-0"
          >
            {isAnswerLocked ? (
              <><Lock className="h-3.5 w-3.5 text-white" /> Locked</>
            ) : currentIndex === questions.length - 1 ? (
              <><Lock className="h-3.5 w-3.5 text-white" /> Lock &amp; Submit</>
            ) : (
              <><Lock className="h-3.5 w-3.5 text-white" /> Lock Answer</>
            )}
          </button>
        </footer>
      </motion.div>

      {/* Proctoring Sidebar */}
      <aside className="hidden w-72 flex-col gap-4 pl-6 lg:flex text-left">
        {/* Webcam Container */}
        <div className="overflow-hidden rounded-cards bg-paper-white border border-mist-blue shadow-xl">
          <div className="aspect-video w-full bg-frost-surface border-b border-mist-blue/30 flex items-center justify-center relative">
            <Video className="h-6 w-6 text-steel-blue-gray" />
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-pills bg-pastel-mint px-2 py-0.5 text-[9px] font-bold text-pastel-mint-text">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pastel-mint-text" />
              </span>
              LIVE
            </div>
          </div>
          <div className="p-3.5">
            <h3 className="flex items-center gap-1 font-bold text-midnight-navy text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-signal-green" /> Edge-AI Proctor Active
            </h3>
            <p className="mt-0.5 text-[10px] text-steel-blue-gray font-medium">
              Webcam feed, tab switches, and clipboard events are monitored.
            </p>
          </div>
        </div>

        {/* System Warnings Panel */}
        <div className="rounded-cards border border-pastel-yellow-text/20 bg-pastel-yellow p-4 shadow-xl">
          <h3 className="flex items-center gap-1 font-bold text-pastel-yellow-text mb-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-pastel-yellow-text" /> Proctoring Rules
          </h3>
          <ul className="space-y-1 text-[10px] font-medium text-pastel-yellow-text/90">
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-pastel-yellow-text shrink-0" />
              Do not switch tabs or minimize the window.
            </li>
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-pastel-yellow-text shrink-0" />
              Questions advance automatically when timer hits zero.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
