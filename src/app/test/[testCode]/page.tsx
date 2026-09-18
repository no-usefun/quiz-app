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
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useProctoring } from "@/hooks/useProctoring";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function getClientAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("dynoquizz_token");
  if (!token) {
    const match = document.cookie.match(/(?:^|;\s*)dynoquizz_token=([^;]+)/);
    if (match) {
      token = match[1];
      try {
        localStorage.setItem("dynoquizz_token", token);
      } catch {
        // ignore
      }
    }
  }
  if (token) return token;
  if (localStorage.getItem("dynoquizz_user")) return "session_active";
  return null;
}

export default function TestArenaPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  // Test data and question indexing
  const [test, setTest] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Track answers as a map of questionId -> optionId
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeTakenPerQuestion, setTimeTakenPerQuestion] = useState<
    Record<number, number>
  >({});

  const [timeLeft, setTimeLeft] = useState(30);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const { flags } = useProctoring();

  useEffect(() => {
    setMounted(true);
    const cleanCode = testCode.toUpperCase();

    if (typeof window !== "undefined") {
      const token = getClientAuthToken();
      if (!token) {
        router.push(`/login?role=student&redirect=/test/${cleanCode}`);
        return;
      }

      const cached = localStorage.getItem(`dynoquizz_active_test_${cleanCode}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.answers) setAnswers(parsed.answers);
          if (parsed.timeTaken) setTimeTakenPerQuestion(parsed.timeTaken);
        } catch {
          // ignore
        }
      }
    }

    const loadTest = async () => {
      const cleanCode = testCode.toUpperCase();
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

          // Map to backend schema: use questionId and option array directly
          const normalizedQuestions = (data.questions || []).map(
            (q: any, qIdx: number) => ({
              id: q.questionId || qIdx + 1,
              text: q.questionText || `Question ${qIdx + 1}`,
              options: q.options || [], // Array of {optionId, optionText}
              marks: q.marks || 4,
              negativeMarks: q.negativeMarks || (data.negativeMarking ? 1 : 0),
              questionTimerSeconds: q.questionTimerSeconds || 30,
            }),
          );

          setTest({
            testCode: cleanCode,
            quizName: data.title || `Assessment ${cleanCode}`,
            totalTimeLimitMinutes: Math.floor(
              (data.overallTimerSeconds || 1800) / 60,
            ),
            settings: {
              allowResume: data.allowResume ?? true,
            },
            questions: normalizedQuestions,
          });
        }
      } catch (e) {
        console.warn("Backend quiz fetch error:", e);
      }
    };

    loadTest();

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
  const progressPercentage =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const handleSelectOption = (optionId: number) => {
    setSelectedOption(optionId);
    if (!currentQuestion) return;

    setSaveStatus("saving");
    const newAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(newAnswers);

    try {
      localStorage.setItem(
        `dynoquizz_active_test_${testCode.toUpperCase()}`,
        JSON.stringify({
          answers: newAnswers,
          timeTaken: timeTakenPerQuestion,
        }),
      );
    } catch {
      // ignore
    }

    setTimeout(() => {
      setSaveStatus("saved");
    }, 150);
  };

  const advanceOrSubmit = (latestAnswers: Record<number, number>) => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      const nextQ = questions[currentIndex + 1];
      setSelectedOption(latestAnswers[nextQ?.id] || null);
      setTimeLeft(nextQ?.questionTimerSeconds || 30);
      setSaveStatus("idle");
    } else {
      finishAssessment(latestAnswers);
    }
  };

  const handleNextQuestion = () => {
    if (!selectedOption && !answers[currentQuestion?.id]) return;

    const chosenOption = selectedOption || answers[currentQuestion.id];
    const newAnswers = { ...answers, [currentQuestion.id]: chosenOption };
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  const [sessionExpired, setSessionExpired] = useState(false);
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);

  useEffect(() => {
    const cleanCode = testCode.toUpperCase();
    const flushActiveState = () => {
      try {
        localStorage.setItem(
          `dynoquizz_active_test_${cleanCode}`,
          JSON.stringify({
            answers,
            timeTaken: timeTakenPerQuestion,
            lastUpdated: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushActiveState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushActiveState);
    window.addEventListener("beforeunload", flushActiveState);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushActiveState);
      window.removeEventListener("beforeunload", flushActiveState);
    };
  }, [answers, timeTakenPerQuestion, testCode]);

  const finishAssessment = async (latestAnswers: Record<number, number>) => {
    if (isSubmitted || !test) return;
    setIsSubmitted(true);

    try {
      localStorage.removeItem(
        `dynoquizz_active_test_${testCode.toUpperCase()}`,
      );
    } catch {
      // ignore
    }

    let totalTimeTaken = 0;
    Object.values(timeTakenPerQuestion).forEach((t) => (totalTimeTaken += t));

    const studentRoll =
      (typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_regNo") ||
          sessionStorage.getItem("dynoquizz_student_reg")
        : null) || "Student Candidate";

    try {
      const token = localStorage.getItem("dynoquizz_token");

      // Submit raw optionIds mapped to questionIds to the backend for secure grading
      const res = await fetch(
        `${API_BASE}/api/v1/student/quizzes/${testCode.toUpperCase()}/submit`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            testCode: testCode.toUpperCase(),
            registrationNo: studentRoll,
            timeTakenTotalSeconds: totalTimeTaken,
            answers: latestAnswers, // The backend will evaluate this map securely
            proctoringFlags: flags, // Pass any integrity flags caught by useProctoring
          }),
        },
      );

      if (res.status === 401) {
        localStorage.setItem(
          `dynoquizz_active_test_${testCode.toUpperCase()}`,
          JSON.stringify({
            answers: latestAnswers,
            timeTaken: timeTakenPerQuestion,
          }),
        );
        setIsSubmitted(false);
        setSessionExpired(true);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.deadlineExceeded || data.error === "EXAM_DEADLINE_EXCEEDED") {
          setDeadlineNotice(
            "Assessment deadline reached on the server. Responses collected up to the cutoff were saved.",
          );
        }
      }
    } catch (e) {
      console.error("Submission failed", e);
    }
  };

  const handleTimerExpired = () => {
    // If timer expires and no option is selected, we record -1 (skipped)
    const finalAns = selectedOption || answers[currentQuestion?.id] || -1;
    const newAnswers = { ...answers, [currentQuestion?.id]: finalAns };
    setAnswers(newAnswers);
    advanceOrSubmit(newAnswers);
  };

  useEffect(() => {
    if (isSubmitted || questions.length === 0 || !currentQuestion) return;

    const timer = setInterval(() => {
      setTimeTakenPerQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1,
      }));

      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimerExpired();
          return currentQuestion.questionTimerSeconds || 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isSubmitted, questions.length, currentQuestion]);

  if (sessionExpired) {
    const allowResume = test?.settings?.allowResume !== false;
    return (
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl space-y-4 text-left"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-inputs bg-[#fbeee8] border border-[#d1dee8] text-[#8c381c]">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray">
              Authentication Notice
            </span>
            <h1 className="text-lg font-bold text-midnight-navy">
              Session Expired Mid-Assessment
            </h1>
            <p className="text-xs text-steel-blue-gray leading-relaxed font-medium">
              {allowResume
                ? "Your authentication session has expired. Your answers have been preserved in local cache. Please log in again to resume your assessment."
                : "Your authentication session has expired. This assessment does not permit resumption."}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            {allowResume ? (
              <Link
                href={`/login?role=student&redirect=/test/${testCode.toUpperCase()}`}
                className="flex items-center justify-center gap-1.5 rounded-buttons bg-signal-green py-2.5 px-4 text-xs font-bold text-white hover:bg-signal-green/90 transition-all border-0 shadow-none"
              >
                Log In to Resume
              </Link>
            ) : (
              <Link
                href="/dashboard/student"
                className="flex items-center justify-center gap-1.5 rounded-buttons bg-signal-green py-2.5 px-4 text-xs font-bold text-white hover:bg-signal-green/90 transition-all border-0 shadow-none"
              >
                Return to Dashboard
              </Link>
            )}
          </div>
        </motion.div>
      </main>
    );
  }

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
              Your exam responses have been securely transmitted to the server
              for evaluation.
            </p>
          </div>

          {deadlineNotice && (
            <div className="rounded-inputs border border-pastel-yellow bg-pastel-yellow/20 p-3 text-xs text-pastel-yellow-text text-left font-medium">
              {deadlineNotice}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Link
              href={`/dashboard/student/result/${testCode.toUpperCase()}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-buttons bg-signal-green py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
            >
              View Scorecard <ChevronRight className="h-4 w-4 text-white" />
            </Link>
            <Link
              href="/dashboard/student"
              className="flex items-center justify-center gap-1.5 rounded-buttons border border-mist-blue bg-white py-2.5 px-4 text-xs font-bold text-midnight-navy hover:bg-frost-surface transition-all duration-200 shadow-none cursor-pointer"
            >
              Dashboard
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[8.8px] bg-white p-8 text-center border border-[#d1dee8] shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] border border-[#d1dee8] text-[#78716b]">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-[#111111]">
              Assessment Session Not Found
            </h1>
            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              No questions found for session code{" "}
              <strong>&ldquo;{testCode?.toUpperCase()}&rdquo;</strong>. Please
              check the code or contact your educator.
            </p>
          </div>
          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
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
        <header className="flex flex-wrap items-center justify-between bg-paper-white px-6 py-4 gap-3 border-b border-mist-blue/30">
          <div className="flex items-center gap-3.5">
            <span className="rounded-pills bg-frost-surface px-3 py-0.5 text-xs font-bold text-signal-green font-mono border border-mist-blue/30 shadow-none">
              {testCode.toUpperCase()}
            </span>
            <span className="text-xs font-bold text-steel-blue-gray">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {saveStatus === "saving" && (
              <span className="text-[11px] font-bold text-steel-blue-gray">
                Saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-[11px] font-bold text-pastel-mint-text">
                ✓ Saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5 font-sans">
            {isOnline ? (
              <span className="flex items-center gap-1.5 rounded-pills bg-pastel-mint text-pastel-mint-text px-2.5 py-0.5 text-xs font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-text opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pastel-mint-text" />
                </span>
                <Wifi className="h-3.5 w-3.5 text-pastel-mint-text" /> Sync
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-pills bg-pastel-yellow text-pastel-yellow-text px-2.5 py-0.5 text-xs font-bold">
                <WifiOff className="h-3.5 w-3.5 text-pastel-yellow-text" />{" "}
                Offline Mode
              </span>
            )}

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

        <div className="h-1.5 w-full bg-frost-surface border-b border-mist-blue/20">
          <div
            className="h-full bg-signal-green transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 bg-paper-white">
          <AnimatePresence mode="wait">
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
                {currentQuestion.options.map((option: any, idx: number) => {
                  const isSelected =
                    (selectedOption || answers[currentQuestion.id]) ===
                    option.optionId;
                  return (
                    <button
                      key={option.optionId || idx}
                      onClick={() => handleSelectOption(option.optionId)}
                      className={`w-full rounded-inputs border p-3.5 text-left text-xs font-bold transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? "border-signal-green bg-frost-surface text-midnight-navy ring-2 ring-signal-green/20"
                          : "border-mist-blue bg-paper-white text-steel-blue-gray hover:border-mist-blue/80 hover:text-midnight-navy"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-inputs text-xs font-bold border transition-colors ${
                            isSelected
                              ? "bg-signal-green border-signal-green text-white"
                              : "bg-paper-white text-steel-blue-gray border-mist-blue"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {option.optionText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="border-t border-mist-blue/30 bg-paper-white px-6 py-3 flex justify-between items-center">
          <span className="text-[10px] font-medium text-steel-blue-gray">
            Question {currentIndex + 1} of {questions.length}
          </span>

          <button
            onClick={handleNextQuestion}
            disabled={!selectedOption && !answers[currentQuestion?.id]}
            className="flex items-center gap-1 rounded-buttons bg-signal-green px-4 py-2 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none disabled:opacity-40 cursor-pointer border-0"
          >
            {currentIndex === questions.length - 1 ? (
              <>
                Submit Assessment{" "}
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </>
            ) : (
              <>
                Next Question{" "}
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </>
            )}
          </button>
        </footer>
      </motion.div>

      <aside className="hidden w-72 flex-col gap-4 pl-6 lg:flex text-left">
        <div className="overflow-hidden rounded-cards bg-paper-white border border-mist-blue shadow-xl">
          <div className="p-4 border-b border-mist-blue/30 bg-frost-surface">
            <span className="text-[10px] font-bold uppercase tracking-wider text-signal-green block mb-1">
              Active Candidate
            </span>
            <h3 className="font-extrabold text-midnight-navy text-sm truncate font-mono">
              {(typeof window !== "undefined"
                ? localStorage.getItem("dynoquizz_regNo") ||
                  sessionStorage.getItem("dynoquizz_student_reg")
                : null) || "Registered Student"}
            </h3>
            <p className="mt-0.5 text-[10px] text-steel-blue-gray font-medium">
              Session Code:{" "}
              <strong className="text-midnight-navy font-bold">
                {testCode.toUpperCase()}
              </strong>
            </p>
          </div>
          <div className="p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-steel-blue-gray">
              <span>Total Questions:</span>
              <span className="font-bold text-midnight-navy">
                {questions.length}
              </span>
            </div>
            <div className="flex justify-between items-center text-steel-blue-gray">
              <span>Current Progress:</span>
              <span className="font-bold text-signal-green">
                {currentIndex + 1} / {questions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-cards border border-mist-blue bg-paper-white p-4 shadow-xl space-y-2">
          <h3 className="flex items-center gap-1 font-bold text-midnight-navy text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-signal-green" /> Assessment
            Directives
          </h3>
          <ul className="space-y-1.5 text-[10px] font-medium text-steel-blue-gray">
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-signal-green shrink-0" />
              Select an option and click &ldquo;Next Question&rdquo; to proceed.
            </li>
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-signal-green shrink-0" />
              Questions advance automatically when the timer reaches zero.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
