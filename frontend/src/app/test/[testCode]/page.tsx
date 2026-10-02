"use client";
// frontend/src/app/test/[testCode]/page.tsx
import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  AlertTriangle,
  Eye,
  Volume2,
  ShieldAlert,
  Maximize2,
  RefreshCw,
  Download,
  Activity,
  User,
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
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [testLoadError, setTestLoadError] = useState<string | null>(null);

  /*
   * Active attempt is the storage boundary for this assessment.
   */
  const [activeAttemptId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    const cleanCode = testCode.toUpperCase();

    return (
      localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`) ||
      localStorage.getItem("dynoquizz_attemptId")
    );
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Track answers as questionId -> optionId
  const [answers, setAnswers] = useState<Record<number, number | null>>({});

  const [timeTakenPerQuestion, setTimeTakenPerQuestion] = useState<
    Record<number, number>
  >({});

  // Backend-authoritative absolute attempt deadline.
  const [effectiveDeadline, setEffectiveDeadline] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;

      const cleanCode = testCode.toUpperCase();
      const attemptId =
        localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`) ||
        localStorage.getItem("dynoquizz_attemptId");

      if (!attemptId) return null;

      try {
        const raw = localStorage.getItem(
          `dynoquizz_attemptTiming_${attemptId}`,
        );
        if (!raw) return null;

        const timing = JSON.parse(raw);
        return typeof timing?.effectiveDeadline === "string"
          ? timing.effectiveDeadline
          : null;
      } catch {
        return null;
      }
    },
  );

  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const expiryHandledRef = useRef(false);
  const questionElapsedRef = useRef(0);

  const [submittedAttemptId, setSubmittedAttemptId] = useState<string | null>(
    null,
  );

  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const {
    videoRef,
    warningsCount,
    maxWarnings,
    proctorStatus,
    statusMessage,
    currentWarningMessage,
    dismissWarning,
    faceStatus,
    isFullscreen,
    isExtensionInstalled,
    displayCount,
    requestFullscreen,
  } = useProctoring({
    attemptId: activeAttemptId,
    testCode: testCode.toUpperCase(),
    studentReg:
      (typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_regNo") ||
          sessionStorage.getItem("dynoquizz_student_reg")
        : "") || "Student",
    maxWarnings: 3,
    onAutoSubmit: () => {
      if (!isSubmitted) {
        finishAssessment(answers);
      }
    },
    enabled: !isSubmitted,
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  /*
   * Load the authoritative quiz package.
   */
  useEffect(() => {
    setMounted(true);
    const cleanCode = testCode.toUpperCase();

    let cancelled = false;

    const normalizePackage = (data: any) => {
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

      return {
        testCode: cleanCode,
        quizName: data.title || `Assessment ${cleanCode}`,
        totalTimeLimitMinutes: Math.floor(
          (data.overallTimerSeconds || 1800) / 60,
        ),
        settings: {
          allowResume: data.allowResume ?? true,
        },
        questions: normalizedQuestions,
      };
    };

    if (typeof window !== "undefined") {
      const token = getClientAuthToken();

      if (!token) {
        router.push(`/login?role=student&redirect=/test/${cleanCode}`);
        return;
      }

      if (activeAttemptId) {
        try {
          const rawTiming = localStorage.getItem(
            `dynoquizz_attemptTiming_${activeAttemptId}`,
          );
          const timing = rawTiming ? JSON.parse(rawTiming) : null;

          if (typeof timing?.effectiveDeadline !== "string") {
            throw new Error(
              "The server did not return the authoritative attempt timing information.",
            );
          }

          setEffectiveDeadline(timing.effectiveDeadline);
        } catch (timingError: any) {
          console.error(
            "[Assessment Timing] Invalid attempt timing:",
            timingError,
          );
          setTestLoadError(
            timingError?.message ||
              "The server did not return the authoritative attempt timing information.",
          );
        }
      } else {
        setTestLoadError(
          "No active server attempt was found. Please return to the lobby and start the assessment again.",
        );
      }

      if (activeAttemptId) {
        const attemptStateKey = `dynoquizz_active_test_${activeAttemptId}`;
        const attemptIndexKey = `exam_index_${activeAttemptId}`;

        const cached = localStorage.getItem(attemptStateKey);

        if (cached) {
          try {
            const parsed = JSON.parse(cached);

            if (parsed.answers) {
              setAnswers(parsed.answers);
            }

            if (parsed.timeTaken) {
              setTimeTakenPerQuestion(parsed.timeTaken);
            }
          } catch {
            localStorage.removeItem(attemptStateKey);
          }
        }

        const savedIndex = localStorage.getItem(attemptIndexKey);
        if (savedIndex) {
          const parsedIndex = Number.parseInt(savedIndex, 10);

          if (Number.isInteger(parsedIndex) && parsedIndex >= 0) {
            setCurrentIndex(parsedIndex);
          }
        }
      }
    }

    const loadTest = async () => {
      setIsLoadingTest(true);
      setTestLoadError(null);

      try {
        let packageData: any = null;

        if (typeof window !== "undefined") {
          const cachedPackage = sessionStorage.getItem(
            `dynoquizz_pkg_${cleanCode}`,
          );

          if (cachedPackage) {
            try {
              const parsed = JSON.parse(cachedPackage);

              if (
                parsed &&
                Array.isArray(parsed.questions) &&
                parsed.questions.length > 0
              ) {
                packageData = parsed;
              }
            } catch {
              sessionStorage.removeItem(`dynoquizz_pkg_${cleanCode}`);
            }
          }
        }

        if (!packageData) {
          const token = getClientAuthToken();

          if (!token) {
            throw new Error(
              "Your login session has expired. Please log in again.",
            );
          }

          const res = await fetch(
            `${API_BASE}/api/v1/student/quizzes/code/${cleanCode}/package`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              cache: "no-store",
            },
          );

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            throw new Error(
              data.message ||
                data.error ||
                "Unable to load the assessment package.",
            );
          }

          packageData = data;

          if (
            typeof window !== "undefined" &&
            packageData &&
            Array.isArray(packageData.questions) &&
            packageData.questions.length > 0
          ) {
            sessionStorage.setItem(
              `dynoquizz_pkg_${cleanCode}`,
              JSON.stringify(packageData),
            );
          }
        }

        if (
          !packageData ||
          !Array.isArray(packageData.questions) ||
          packageData.questions.length === 0
        ) {
          throw new Error("The assessment package is empty or invalid.");
        }

        const normalizedTest = normalizePackage(packageData);

        const hasInvalidQuestion = normalizedTest.questions.some(
          (question: any) =>
            !Number.isFinite(Number(question.id)) ||
            Number(question.id) <= 0 ||
            !Array.isArray(question.options),
        );

        if (hasInvalidQuestion) {
          throw new Error(
            "The assessment package contains invalid question data.",
          );
        }

        if (!cancelled) {
          setTest(normalizedTest);
          setTestLoadError(null);
        }
      } catch (error: any) {
        console.error("Assessment package load error:", error);

        if (!cancelled) {
          setTest(null);
          setTestLoadError(
            error?.message ||
              "Unable to load the assessment package. Please return to the lobby and try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTest(false);
        }
      }
    };

    loadTest();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;

      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [testCode, router, activeAttemptId]);

  const questions = test?.questions || [];
  const currentQuestion = questions[currentIndex];

  const progressPercentage =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  useEffect(() => {
    if (!currentQuestion) return;

    setSelectedOption(answers[currentQuestion.id] ?? null);
  }, [currentIndex, currentQuestion?.id, answers]);

  useEffect(() => {
    questionElapsedRef.current = 0;
  }, [currentIndex, currentQuestion?.id]);

  useEffect(() => {
    if (isSubmitted || !currentQuestion) return;

    const interval = window.setInterval(() => {
      questionElapsedRef.current += 1;
      setTimeTakenPerQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: questionElapsedRef.current,
      }));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentQuestion?.id, isSubmitted]);

  const persistLocalAnswerState = (
    nextAnswers: Record<number, number | null>,
    nextTimeTaken: Record<number, number>,
  ) => {
    if (!activeAttemptId) return;

    try {
      localStorage.setItem(
        `dynoquizz_active_test_${activeAttemptId}`,
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
   * Jump directly to a question index
   */
  const handleJumpToQuestion = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    persistLocalAnswerState(answers, timeTakenPerQuestion);
    setCurrentIndex(targetIndex);

    if (typeof window !== "undefined" && activeAttemptId) {
      localStorage.setItem(
        `exam_index_${activeAttemptId}`,
        targetIndex.toString(),
      );
    }

    const targetQuestion = questions[targetIndex];
    setSelectedOption(
      targetQuestion ? (answers[Number(targetQuestion.id)] ?? null) : null,
    );
    setSaveStatus("idle");
  };

  /*
   * Previous Question handler
   */
  const handlePreviousQuestion = () => {
    if (currentIndex > 0) {
      handleJumpToQuestion(currentIndex - 1);
    }
  };

  /*
   * Move to next question or submit
   */
  const advanceOrSubmit = (latestAnswers: Record<number, number | null>) => {
    persistLocalAnswerState(latestAnswers, timeTakenPerQuestion);

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);

      if (typeof window !== "undefined" && activeAttemptId) {
        localStorage.setItem(
          `exam_index_${activeAttemptId}`,
          nextIndex.toString(),
        );
      }

      const nextQuestion = questions[nextIndex];
      setSelectedOption(
        nextQuestion ? (latestAnswers[Number(nextQuestion.id)] ?? null) : null,
      );
      setSaveStatus("idle");
    } else {
      finishAssessment(latestAnswers);
    }
  };

  /*
   * Handle Next Question.
   */
  const handleNextQuestion = () => {
    if (!currentQuestion) return;

    const questionId = Number(currentQuestion.id);

    if (!Number.isFinite(questionId) || questionId <= 0) {
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
    if (!activeAttemptId) return;

    const flushActiveState = () => {
      try {
        localStorage.setItem(
          `dynoquizz_active_test_${activeAttemptId}`,
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
      if (document.visibilityState === "hidden") {
        flushActiveState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushActiveState);
    window.addEventListener("beforeunload", flushActiveState);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushActiveState);
      window.removeEventListener("beforeunload", flushActiveState);
    };
  }, [answers, timeTakenPerQuestion, activeAttemptId]);

  /*
   * Submit assessment
   */
  const finishAssessment = async (
    latestAnswers: Record<number, number | null>,
  ) => {
    if (isSubmitted || !test) return;

    setIsSubmitted(true);

    const cleanCode = testCode.toUpperCase();
    persistLocalAnswerState(latestAnswers, timeTakenPerQuestion);

    try {
      const token = getClientAuthToken();
      const attemptId = activeAttemptId;

      if (!attemptId) {
        console.warn("No attemptId found. Cannot submit attempt.");
        setIsSubmitted(false);
        setSubmissionNotice(
          "Your attempt session is missing. Your answers remain stored locally.",
        );
        return;
      }

      const completeAnswers: Array<{
        questionId: number;
        selectedOptionIds: number[];
        responseTimeSeconds: number;
      }> = [];

      for (const question of questions) {
        const questionId = Number(question.id);

        if (!Number.isFinite(questionId) || questionId <= 0) {
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

      const rawText = await res.text();
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
        const returnedAttemptId = data?.attemptId;

        if (
          returnedAttemptId === undefined ||
          returnedAttemptId === null ||
          String(returnedAttemptId).trim() === ""
        ) {
          setIsSubmitted(false);
          setSubmissionNotice(
            "Your submission was received, but the attempt ID was not returned. Please contact the administrator before leaving this page.",
          );
          return;
        }

        const authoritativeAttemptId = String(returnedAttemptId);
        setSubmittedAttemptId(authoritativeAttemptId);

        localStorage.setItem(
          `dynoquizz_submittedAttemptId_${cleanCode}`,
          authoritativeAttemptId,
        );
        localStorage.setItem(
          "dynoquizz_submittedAttemptId",
          authoritativeAttemptId,
        );

        localStorage.removeItem(`dynoquizz_attemptId_${cleanCode}`);
        localStorage.removeItem("dynoquizz_attemptId");
        localStorage.removeItem(
          `dynoquizz_attemptTiming_${authoritativeAttemptId}`,
        );
        localStorage.removeItem(
          `dynoquizz_active_test_${authoritativeAttemptId}`,
        );
        localStorage.removeItem(`exam_index_${authoritativeAttemptId}`);

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
   * Handle backend-authoritative timer expiration.
   */
  const handleTimerExpired = () => {
    if (expiryHandledRef.current || isSubmitted || !currentQuestion) return;

    expiryHandledRef.current = true;
    const questionId = Number(currentQuestion.id);

    if (!Number.isFinite(questionId) || questionId <= 0) {
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
    finishAssessment(latestAnswers);
  };

  const parseBackendDeadline = (value: string): number => {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const timestamp = new Date(normalized).getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
  };

  const formatRemainingTime = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    if (isSubmitted || !effectiveDeadline) return;

    const deadlineMs = parseBackendDeadline(effectiveDeadline);

    if (!Number.isFinite(deadlineMs)) {
      setTestLoadError(
        "The server returned an invalid authoritative attempt deadline. Please return to the lobby and start the assessment again.",
      );
      return;
    }

    expiryHandledRef.current = false;

    const updateCountdown = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((deadlineMs - Date.now()) / 1000),
      );

      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        handleTimerExpired();
      }
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateCountdown();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    effectiveDeadline,
    isSubmitted,
    currentQuestion?.id,
    selectedOption,
    answers,
  ]);

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
              href={
                submittedAttemptId
                  ? `/dashboard/student/result/${submittedAttemptId}`
                  : "/dashboard/student"
              }
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
   * Loading state
   */
  if (isLoadingTest) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#165dfb] shadow-xs">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#111111]">
              Loading Assessment
            </h1>

            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              Preparing your secure assessment package. Please wait.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (testLoadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#fbeee8] border border-[#d1dee8]/70 text-[#8c381c] shadow-xs">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#111111]">
              Assessment Could Not Be Loaded
            </h1>

            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              {testLoadError}
            </p>
          </div>

          <Link
            href={`/test/${testCode.toUpperCase()}/lobby`}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-xs"
          >
            Return to Assessment Lobby
          </Link>
        </div>
      </main>
    );
  }

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
              No valid questions were found for session code{" "}
              <strong>&ldquo;{testCode?.toUpperCase()}&rdquo;</strong>.
            </p>
          </div>

          <Link
            href={`/test/${testCode.toUpperCase()}/lobby`}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-xs"
          >
            Back to Assessment Lobby
          </Link>
        </div>
      </main>
    );
  }

  /*
   * Main assessment UI
   */
  return (
    <div className="flex min-h-screen bg-[#f5f5f4] text-[#111111] p-3 md:p-6 font-sans selection:bg-[#f5f5f4] selection:text-[#165dfb] justify-center">
      {/* Hidden camera stream running background AI snapshot analysis without displaying mirror */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
        aria-hidden="true"
      />

      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-1 flex-col rounded-[16px] bg-white overflow-hidden border border-[#d1dee8]/80 shadow-md text-left max-w-5xl mx-auto w-full"
      >
        {/* Header Bar */}
        <header className="flex flex-wrap items-center justify-between bg-white px-5 py-3.5 gap-3 border-b border-[#d1dee8]/50">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#165dfb] px-3 py-1 text-xs font-bold text-white font-mono shadow-xs">
              {testCode.toUpperCase()}
            </span>

            <span className="text-xs font-bold text-[#78716b]">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {saveStatus === "saved" && (
              <span className="text-[11px] font-bold text-[#1d5237] bg-[#e2ede8] px-2 py-0.5 rounded-full border border-[#1d5237]/20">
                ✓ Saved locally
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-sans">
            {/* Real-time Warning Sign Status Pill */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all border shadow-xs ${
                warningsCount > 0
                  ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                  : "bg-[#e2ede8] text-[#1d5237] border-[#1d5237]/20"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>
                {warningsCount > 0
                  ? `⚠️ Warnings: ${warningsCount} / ${maxWarnings}`
                  : "AI Proctor: Clear (0 Warnings)"}
              </span>
            </div>

            {isOnline ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#f5f5f4] text-[#111111] border border-[#d1dee8] px-2.5 py-1 text-xs font-bold shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1d5237] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1d5237]" />
                </span>
                <Wifi className="h-3.5 w-3.5 text-[#1d5237]" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#f6efe1] text-[#73561a] border border-[#73561a]/20 px-2.5 py-1 text-xs font-bold shadow-xs">
                <WifiOff className="h-3.5 w-3.5 text-[#73561a]" />
                Offline
              </span>
            )}

            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs transition-colors border shadow-xs ${
                timeLeft <= 60
                  ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
                  : "bg-[#f5f5f4] text-[#111111] border-[#d1dee8]"
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-[#165dfb]" />
              {formatRemainingTime(timeLeft)}
            </div>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[#e6e3e2]/40 border-b border-[#d1dee8]/30">
          <div
            className="h-full bg-[#165dfb] transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Active Warning Banner */}
        <AnimatePresence>
          {currentWarningMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-50 border-b-2 border-rose-500 px-6 py-3 flex items-center justify-between text-rose-900 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 animate-bounce" />
                <div>
                  <p className="text-xs font-bold leading-tight">
                    {currentWarningMessage}
                  </p>
                  <p className="text-[11px] text-rose-700 font-medium">
                    Warning {warningsCount} of {maxWarnings} recorded. Reaching {maxWarnings} warnings triggers instant assessment submission.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={dismissWarning}
                className="text-[10px] font-bold bg-rose-200 hover:bg-rose-300 text-rose-900 px-3 py-1.5 rounded-[8px] transition-colors border border-rose-300 cursor-pointer shadow-xs"
              >
                Acknowledge
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question Palette Row */}
        <div className="px-6 py-2.5 bg-[#f5f5f4]/60 border-b border-[#d1dee8]/40 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] shrink-0">
            Questions:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {questions.map((q: any, idx: number) => {
              const isAnswered =
                answers[Number(q.id)] !== undefined &&
                answers[Number(q.id)] !== null;
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`h-7 w-7 rounded-[8px] text-xs font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs border ${
                    isCurrent
                      ? "bg-[#165dfb] text-white border-[#165dfb] ring-2 ring-[#165dfb]/30"
                      : isAnswered
                      ? "bg-[#e2ede8] text-[#1d5237] border-[#1d5237]/30 hover:bg-[#d0e5db]"
                      : "bg-white text-[#78716b] border-[#d1dee8] hover:border-[#165dfb]/40 hover:text-[#111111]"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${currentIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-[#165dfb] uppercase tracking-wider">
                  Question {currentIndex + 1}
                </span>
                <span className="text-xs font-semibold text-[#78716b]">
                  Marks: {currentQuestion.marks || 4}
                </span>
              </div>

              <h2 className="mb-6 text-lg font-bold leading-snug text-[#111111] md:text-xl tracking-tight">
                {currentQuestion.text}
              </h2>

              <div className="space-y-3">
                {currentQuestion.options.map((option: any, idx: number) => {
                  const optId = Number(option.optionId ?? option.id);
                  const isSelected =
                    Number(selectedOption ?? answers[currentQuestion.id]) ===
                    optId;

                  return (
                    <button
                      key={optId || idx}
                      onClick={() => handleSelectOption(optId)}
                      className={`w-full rounded-[12px] border p-4 text-left text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs ${
                        isSelected
                          ? "border-[#165dfb] bg-[#165dfb]/5 text-[#111111] ring-2 ring-[#165dfb]/20"
                          : "border-[#d1dee8]/80 bg-white text-[#78716b] hover:border-[#165dfb]/40 hover:text-[#111111] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-[8px] text-xs font-bold border transition-colors shadow-xs shrink-0 ${
                            isSelected
                              ? "bg-[#165dfb] border-[#165dfb] text-white"
                              : "bg-[#f5f5f4] text-[#78716b] border-[#d1dee8]/70"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>

                        <span className="text-sm font-medium text-[#111111]">
                          {option.optionText}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar with explicit Previous Question & Next Question buttons */}
        <footer className="border-t border-[#d1dee8]/60 bg-[#fbfbfb] px-6 py-4 flex justify-between items-center">
          <button
            type="button"
            onClick={handlePreviousQuestion}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8] bg-white px-4 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs transition-all active:scale-[0.98]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous Question</span>
          </button>

          <span className="text-xs font-semibold text-[#78716b]">
            {currentIndex + 1} of {questions.length} Questions
          </span>

          <button
            type="button"
            onClick={handleNextQuestion}
            className="flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all duration-200 shadow-md shadow-[#165dfb]/20 cursor-pointer border-0"
          >
            {currentIndex === questions.length - 1 ? (
              <>
                <span>Submit Assessment</span>
                <ChevronRight className="h-4 w-4 text-white" />
              </>
            ) : (
              <>
                <span>Next Question</span>
                <ChevronRight className="h-4 w-4 text-white" />
              </>
            )}
          </button>
        </footer>
      </motion.div>

      {/* Fullscreen Lockdown Modal */}
      {!isFullscreen && !isSubmitted && mounted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-center">
          <div className="max-w-md w-full rounded-[16px] bg-white p-6 md:p-8 space-y-4 shadow-2xl border border-[#d1dee8]/80 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-amber-50 border border-amber-200 text-amber-600 shadow-xs">
              <Maximize2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                Fullscreen Mode Required
              </h2>
              <p className="mt-1 text-xs text-[#78716b] leading-relaxed font-medium">
                AI Proctoring security directives require this assessment to run in full screen without window switching.
              </p>
            </div>
            <button
              type="button"
              onClick={requestFullscreen}
              className="w-full py-3 px-4 rounded-[10px] bg-[#165dfb] hover:bg-[#165dfb]/90 text-white font-bold text-xs shadow-md shadow-[#165dfb]/20 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer border-0 flex items-center justify-center gap-2"
            >
              <Maximize2 className="h-4 w-4 text-white" />
              <span>Enter Fullscreen Exam Mode</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
