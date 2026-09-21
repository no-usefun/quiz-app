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
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== "undefined") {
      const cleanCode = testCode.toUpperCase();
      const savedIndex = localStorage.getItem(`exam_index_${cleanCode}`);
      return savedIndex ? parseInt(savedIndex, 10) : 0;
    }
    return 0;
  });
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Track answers as questionId -> optionId
  const [answers, setAnswers] = useState<Record<number, number | null>>({});

  const [timeTakenPerQuestion, setTimeTakenPerQuestion] = useState<
    Record<number, number>
  >({});

  const [timeLeft, setTimeLeft] = useState(30);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const { flags } = useProctoring();

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  /*
   * Load test and restore locally cached answers
   */
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

      // Answers are restored only from the local assessment state above.
      // The current backend does not expose an incremental answer-save endpoint.
    }

    const loadTest = async () => {
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
          const normalizedQuestions = (data.questions || []).map(
            (q: any, qIdx: number) => ({
              id: Number(q.questionId ?? q.id),
              text: q.questionText || `Question ${qIdx + 1}`,
              options: (q.options || []).map((opt: any) => ({
                ...opt,
                optionId: Number(opt.optionId ?? opt.id),
                optionText: opt.optionText ?? opt.text ?? "",
              })),
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

  useEffect(() => {
    if (currentQuestion) {
      setSelectedOption(answers[currentQuestion.id] ?? null);
    }
  }, [currentIndex, currentQuestion?.id, answers]);

  useEffect(() => {
    if (currentQuestion) {
      setTimeLeft(currentQuestion.questionTimerSeconds || 30);
    }
  }, [currentIndex, currentQuestion?.id]);

  const persistLocalAnswerState = (
    nextAnswers: Record<number, number | null>,
    nextTimeTaken: Record<number, number>,
  ) => {
    const cleanCode = testCode.toUpperCase();

    try {
      localStorage.setItem(
        `dynoquizz_active_test_${cleanCode}`,
        JSON.stringify({
          answers: nextAnswers,
          timeTaken: nextTimeTaken,
          lastUpdated: Date.now(),
        }),
      );
    } catch {
      // ignore localStorage failures
    }
  };

  /*
   * Select an answer.
   *
   * Answers are kept locally during the assessment. The current backend
   * accepts the complete answer sheet only when the attempt is submitted.
   */
  const handleSelectOption = (optionId: number | string) => {
    if (!currentQuestion) return;

    const safeQuestionId = Number(currentQuestion.id);
    const safeOptionId = Number(optionId);

    if (
      !Number.isFinite(safeQuestionId) ||
      safeQuestionId <= 0 ||
      !Number.isFinite(safeOptionId) ||
      safeOptionId <= 0
    ) {
      console.warn("[Assessment] Ignoring invalid question/option ID:", {
        questionId: currentQuestion.id,
        optionId,
      });
      return;
    }

    const nextAnswers: Record<number, number | null> = {
      ...answers,
      [safeQuestionId]: safeOptionId,
    };

    setSelectedOption(safeOptionId);
    setAnswers(nextAnswers);
    setSaveStatus("saved");
    persistLocalAnswerState(nextAnswers, timeTakenPerQuestion);
  };

  /*
   * Move to next question or submit
   */
  const advanceOrSubmit = (latestAnswers: Record<number, number | null>) => {
    const cleanCode = testCode.toUpperCase();

    persistLocalAnswerState(latestAnswers, timeTakenPerQuestion);

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;

      setCurrentIndex(nextIndex);

      if (typeof window !== "undefined") {
        localStorage.setItem(`exam_index_${cleanCode}`, nextIndex.toString());
      }

      const nextQuestion = questions[nextIndex];

      setSelectedOption(
        nextQuestion ? (latestAnswers[Number(nextQuestion.id)] ?? null) : null,
      );

      setTimeLeft(nextQuestion?.questionTimerSeconds || 30);
      setSaveStatus("idle");
    } else {
      finishAssessment(latestAnswers);
    }
  };

  /*
   * Handle Next Question.
   *
   * Unanswered questions can be skipped. They are submitted as
   * selectedOptionIds: [].
   */
  const handleNextQuestion = () => {
    if (!currentQuestion) return;

    const questionId = Number(currentQuestion.id);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      console.warn(
        "[Assessment] Invalid current question ID:",
        currentQuestion,
      );
      return;
    }

    const latestAnswers: Record<number, number | null> = {
      ...answers,
      [questionId]:
        selectedOption !== null && selectedOption !== undefined
          ? Number(selectedOption)
          : (answers[questionId] ?? null),
    };

    setAnswers(latestAnswers);
    advanceOrSubmit(latestAnswers);
  };

  /*
   * Save active assessment state when leaving tab/page
   */
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

  /*
   * Submit assessment
   */
  const finishAssessment = async (
    latestAnswers: Record<number, number | null>,
  ) => {
    if (isSubmitted || !test) return;

    setIsSubmitted(true);

    const cleanCode = testCode.toUpperCase();

    // Keep local answers until the backend confirms the final submission.
    persistLocalAnswerState(latestAnswers, timeTakenPerQuestion);

    try {
      const token = getClientAuthToken();
      const attemptId =
        localStorage.getItem("dynoquizz_attemptId") ||
        localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`);

      if (!attemptId) {
        console.warn("No attemptId found. Cannot submit attempt.");
        setIsSubmitted(false);
        setSubmissionNotice(
          "Your attempt session is missing. Your answers remain stored locally.",
        );
        return;
      }

      // Build the payload from the authoritative backend quiz package.
      // Never create questionId/optionId values such as 0.
      const completeAnswers: Array<{
        questionId: number;
        selectedOptionIds: number[];
        responseTimeSeconds: number;
      }> = [];

      for (const question of questions) {
        const questionId = Number(question.id);

        if (!Number.isFinite(questionId) || questionId <= 0) {
          console.error(
            "[Assessment Submission] Invalid backend question ID:",
            question,
          );
          continue;
        }

        const selectedOptionId = latestAnswers[questionId];

        const selectedOptionIds =
          selectedOptionId !== null &&
          selectedOptionId !== undefined &&
          Number.isFinite(Number(selectedOptionId)) &&
          Number(selectedOptionId) > 0
            ? [Number(selectedOptionId)]
            : [];

        completeAnswers.push({
          questionId,
          selectedOptionIds,
          responseTimeSeconds: Number(timeTakenPerQuestion[questionId] || 0),
        });
      }

      const payload = {
        answers: completeAnswers,
      };

      console.log("[Assessment Submission] Attempt ID:", attemptId);
      console.log("[Assessment Submission] Payload:", payload);

      const res = await fetch(
        `${API_BASE}/api/v1/student/attempts/${attemptId}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      console.log("[Assessment Submission] HTTP status:", res.status);

      const rawText = await res.text();

      console.log("[Assessment Submission] Raw response text:", rawText);

      let data: any = {};

      try {
        data = JSON.parse(rawText);
      } catch (err) {
        console.warn(
          "[Assessment Submission] Could not parse JSON response:",
          err,
        );
      }

      if (res.status === 401) {
        persistLocalAnswerState(latestAnswers, timeTakenPerQuestion);
        setIsSubmitted(false);
        setSessionExpired(true);
        return;
      }

      if (res.ok) {
        localStorage.removeItem(`dynoquizz_active_test_${cleanCode}`);
        localStorage.removeItem(`exam_index_${cleanCode}`);
        localStorage.removeItem("dynoquizz_attemptId");
        localStorage.removeItem(`dynoquizz_attemptId_${cleanCode}`);

        if (data.deadlineExceeded || data.error === "EXAM_DEADLINE_EXCEEDED") {
          setDeadlineNotice(
            "Assessment deadline reached on the server. Responses collected up to the cutoff were saved.",
          );
        }

        if (data.finalScore == null || data.published === false) {
          setSubmissionNotice(
            "Submitted successfully. Results will be available once published.",
          );
        }
      } else {
        setIsSubmitted(false);
        setSubmissionNotice(
          data?.message ||
            "Submission failed. Your answers remain stored locally. Please try again.",
        );
      }
    } catch (e) {
      console.error("[Assessment Submission] Submission failed:", e);
      setIsSubmitted(false);
      setSubmissionNotice(
        "Submission failed because the server could not be reached. Your answers remain stored locally. Please try again.",
      );
    }
  };

  /*
   * Handle timer expiration
   */
  const handleTimerExpired = () => {
    if (!currentQuestion) return;

    const questionId = Number(currentQuestion.id);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      console.warn(
        "[Assessment] Invalid question ID during timer expiry:",
        currentQuestion,
      );
      return;
    }

    const currentAnswer =
      selectedOption !== null && selectedOption !== undefined
        ? Number(selectedOption)
        : (answers[questionId] ?? null);

    const latestAnswers: Record<number, number | null> = {
      ...answers,
      [questionId]:
        currentAnswer !== null &&
        Number.isFinite(Number(currentAnswer)) &&
        Number(currentAnswer) > 0
          ? Number(currentAnswer)
          : null,
    };

    setAnswers(latestAnswers);
    advanceOrSubmit(latestAnswers);
  };

  /*
   * Question timer
   */
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

  /*
   * Session expired screen
   */
  if (sessionExpired) {
    const allowResume = test?.settings?.allowResume !== false;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans selection:bg-[#f5f5f4] selection:text-[#165dfb]">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md rounded-[14px] bg-white p-6 md:p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4 text-left"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#fbeee8] border border-[#d1dee8]/70 text-[#8c381c] shadow-xs">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Authentication Notice
            </span>
            <h1 className="text-lg font-bold text-[#111111]">
              Session Expired Mid-Assessment
            </h1>
            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              {allowResume
                ? "Your authentication session has expired. Your answers have been preserved in local cache. Please log in again to resume your assessment."
                : "Your authentication session has expired. This assessment does not permit resumption."}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            {allowResume ? (
              <Link
                href={`/login?role=student&redirect=/test/${testCode.toUpperCase()}`}
                className="flex items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-xs"
              >
                Log In to Resume
              </Link>
            ) : (
              <Link
                href="/dashboard/student"
                className="flex items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-xs"
              >
                Return to Dashboard
              </Link>
            )}
          </div>
        </motion.div>
      </main>
    );
  }

  /*
   * Submitted screen
   */
  if (isSubmitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans selection:bg-[#f5f5f4] selection:text-[#165dfb]">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-md rounded-[14px] bg-white p-6 md:p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#e2ede8] border border-[#d1dee8]/70 text-[#1d5237] shadow-xs">
            <CheckCircle2 className="h-6 w-6 text-[#1d5237]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Response Recorded
            </span>
            <h1 className="mt-0.5 text-xl font-bold text-[#111111]">
              Assessment Submitted
            </h1>
            <p className="mt-1 text-xs text-[#78716b] leading-relaxed font-medium">
              Your exam responses have been securely transmitted to the server
              for evaluation.
            </p>
          </div>
          {deadlineNotice && (
            <div className="rounded-[10px] border border-[#73561a]/20 bg-[#f6efe1] p-3 text-xs text-[#73561a] text-left font-medium shadow-xs">
              {deadlineNotice}
            </div>
          )}
          {submissionNotice && (
            <div className="rounded-[10px] border border-[#d1dee8]/70 bg-[#f5f5f4] p-3 text-xs text-[#111111] text-left font-medium shadow-xs">
              {submissionNotice}
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Link
              href={`/dashboard/student/result/${testCode.toUpperCase()}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all duration-200 shadow-xs cursor-pointer border-0"
            >
              View Scorecard <ChevronRight className="h-4 w-4 text-white" />
            </Link>
            <Link
              href="/dashboard/student"
              className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[#d1dee8]/70 bg-white py-2.5 px-4 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all duration-200 shadow-xs cursor-pointer"
            >
              Dashboard
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  /*
   * Test not found/loading
   */
  if (!test || questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#fbeee8] border border-[#d1dee8]/70 text-[#8c381c] shadow-xs">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#111111]">
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
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-xs"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  /*
   * Main assessment UI
   */
  return (
    <div className="flex min-h-screen bg-[#f5f5f4] text-[#111111] p-4 md:p-6 font-sans selection:bg-[#f5f5f4] selection:text-[#165dfb]">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-1 flex-col rounded-[14px] bg-white overflow-hidden border border-[#d1dee8]/70 shadow-sm text-left"
      >
        <header className="flex flex-wrap items-center justify-between bg-white px-6 py-4 gap-3 border-b border-[#d1dee8]/50">
          <div className="flex items-center gap-3.5">
            <span className="rounded-full bg-[#f5f5f4] px-3 py-1 text-xs font-bold text-[#165dfb] font-mono border border-[#d1dee8]/70 shadow-xs">
              {testCode.toUpperCase()}
            </span>
            <span className="text-xs font-bold text-[#78716b]">
              Question {currentIndex + 1} of {questions.length}
            </span>
            {saveStatus === "saved" && (
              <span className="text-[11px] font-bold text-[#1d5237]">
                ✓ Stored locally
              </span>
            )}
          </div>
          <div className="flex items-center gap-3.5 font-sans">
            {isOnline ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#e2ede8] text-[#1d5237] border border-[#1d5237]/20 px-2.5 py-0.5 text-xs font-bold shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1d5237] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1d5237]" />
                </span>
                <Wifi className="h-3.5 w-3.5 text-[#1d5237]" /> Local Save
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#f6efe1] text-[#73561a] border border-[#73561a]/20 px-2.5 py-0.5 text-xs font-bold shadow-xs">
                <WifiOff className="h-3.5 w-3.5 text-[#73561a]" /> Offline Mode
              </span>
            )}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs transition-colors border shadow-xs ${
                timeLeft <= 10
                  ? "bg-[#fbeee8] text-[#8c381c] border-[#8c381c]/30 animate-pulse"
                  : "bg-[#f5f5f4] text-[#78716b] border-[#d1dee8]/70"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              00:{timeLeft.toString().padStart(2, "0")}
            </div>
          </div>
        </header>

        <div className="h-1.5 w-full bg-[#e6e3e2]/40 border-b border-[#d1dee8]/30">
          <div
            className="h-full bg-[#165dfb] transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${currentIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <h2 className="mb-5 text-lg font-bold leading-snug text-[#111111] md:text-xl tracking-tight">
                {currentQuestion.text}
              </h2>
              <div className="space-y-2.5">
                {currentQuestion.options.map((option: any, idx: number) => {
                  const optId = Number(option.optionId ?? option.id);
                  const isSelected =
                    Number(selectedOption ?? answers[currentQuestion.id]) ===
                    optId;
                  return (
                    <button
                      key={optId || idx}
                      onClick={() => handleSelectOption(optId)}
                      className={`w-full rounded-[10px] border p-3.5 text-left text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs ${
                        isSelected
                          ? "border-[#165dfb] bg-[#165dfb]/5 text-[#111111] ring-2 ring-[#165dfb]/20"
                          : "border-[#d1dee8]/70 bg-white text-[#78716b] hover:border-[#165dfb]/40 hover:text-[#111111] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-[8px] text-xs font-bold border transition-colors shadow-xs ${
                            isSelected
                              ? "bg-[#165dfb] border-[#165dfb] text-white"
                              : "bg-[#f5f5f4] text-[#78716b] border-[#d1dee8]/70"
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

        <footer className="border-t border-[#d1dee8]/50 bg-white px-6 py-3.5 flex justify-between items-center">
          <span className="text-[10px] font-medium text-[#78716b]">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <button
            onClick={handleNextQuestion}
            disabled={false}
            className="flex items-center gap-1 rounded-[10px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all duration-200 shadow-xs disabled:opacity-40 cursor-pointer border-0"
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
        <div className="overflow-hidden rounded-[14px] bg-white border border-[#d1dee8]/70 shadow-sm">
          <div className="p-4 border-b border-[#d1dee8]/50 bg-[#f5f5f4]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#165dfb] block mb-1">
              Active Candidate
            </span>
            <h3 className="font-bold text-[#111111] text-sm truncate font-mono">
              {(typeof window !== "undefined"
                ? localStorage.getItem("dynoquizz_regNo") ||
                  sessionStorage.getItem("dynoquizz_student_reg")
                : null) || "Registered Student"}
            </h3>
            <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">
              Session Code:{" "}
              <strong className="text-[#111111] font-bold">
                {testCode.toUpperCase()}
              </strong>
            </p>
          </div>
          <div className="p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-[#78716b]">
              <span>Total Questions:</span>
              <span className="font-bold text-[#111111]">
                {questions.length}
              </span>
            </div>
            <div className="flex justify-between items-center text-[#78716b]">
              <span>Current Progress:</span>
              <span className="font-bold text-[#165dfb]">
                {currentIndex + 1} / {questions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 shadow-sm space-y-2">
          <h3 className="flex items-center gap-1.5 font-bold text-[#111111] text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#165dfb]" /> Assessment
            Directives
          </h3>
          <ul className="space-y-1.5 text-[10px] font-medium text-[#78716b]">
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-[#165dfb] shrink-0" />
              Select an option if you want to answer it. Unanswered questions
              can be skipped.
            </li>
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-[#165dfb] shrink-0" />
              Questions advance automatically when the timer reaches zero.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
