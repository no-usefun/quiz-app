"use client";
// frontend/src/app/test/[testCode]/page.tsx
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
  Camera,
  Eye,
  Volume2,
  ShieldAlert,
  Maximize2,
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

  /*
   * Authoritative attempt ID returned by the backend after submission.
   *
   * IMPORTANT:
   * testCode != quizId != attemptId
   *
   * The result page expects attemptId, so after successful submission
   * we store the backend-returned attemptId here.
   */
  const [submittedAttemptId, setSubmittedAttemptId] = useState<string | null>(
    null,
  );

  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const [activeAttemptId, setActiveAttemptId] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const cleanCode = testCode.toUpperCase();
      const stored =
        localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`) ||
        localStorage.getItem("dynoquizz_attemptId");
      return stored ? Number(stored) : null;
    }
    return null;
  });

  const {
    videoRef,
    warningsCount,
    maxWarnings,
    violations,
    proctorStatus,
    statusMessage,
    faceStatus,
    isFullscreen,
    hasCameraPermission,
    requestFullscreen,
  } = useProctoring({
    attemptId: activeAttemptId,
    maxWarnings: 3,
    onAutoSubmit: () => {
      if (!isSubmitted) {
        finishAssessment(answers);
      }
    },
    enabled: !isSubmitted,
  });

  // Sync candidate ID snapshot to backend attempt once attempt is active
  useEffect(() => {
    if (!activeAttemptId) return;
    const cleanCode = testCode.toUpperCase();
    const idPhoto = sessionStorage.getItem(`dynoquizz_id_photo_${cleanCode}`);
    if (idPhoto) {
      const token = getClientAuthToken();
      fetch(`${API_BASE}/api/v1/attempts/${activeAttemptId}/id-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ idPhotoData: idPhoto }),
      }).catch((err) => console.warn("Could not sync ID photo snapshot:", err));
    }
  }, [activeAttemptId, testCode]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  /*
   * Load the authoritative quiz package.
   *
   * The lobby downloads and caches the package before entering the Arena.
   * The Arena therefore reads the cached package first and only falls back
   * to the backend when the cache is missing or invalid.
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

      const cached = localStorage.getItem(`dynoquizz_active_test_${cleanCode}`);

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
          // Ignore malformed local answer state.
        }
      }
    }

    const loadTest = async () => {
      setIsLoadingTest(true);
      setTestLoadError(null);

      try {
        let packageData: any = null;

        /*
         * First source: package cached by the lobby.
         */
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

        /*
         * Fallback: fetch the package directly if the lobby cache
         * is unavailable. This keeps the Arena resilient on refresh.
         */
        if (!packageData) {
          const token = getClientAuthToken();

          if (!token) {
            throw new Error(
              "Your login session has expired. Please log in again.",
            );
          }

          const res = await fetch(
            `${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`,
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
        localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`) ||
        localStorage.getItem("dynoquizz_attemptId");

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
        /*
         * IMPORTANT:
         *
         * The backend response is authoritative.
         *
         * We must NOT use:
         *   testCode
         *   quizId
         *   or any inferred value
         *
         * as the result-page identifier.
         *
         * The result endpoint expects:
         *
         *   /api/v1/student/attempts/{attemptId}/result
         *
         * Therefore use the attemptId returned by the submission API.
         */
        const returnedAttemptId = data?.attemptId;

        if (
          returnedAttemptId === undefined ||
          returnedAttemptId === null ||
          String(returnedAttemptId).trim() === ""
        ) {
          console.error(
            "[Assessment Submission] Backend submission succeeded but did not return attemptId:",
            data,
          );

          setIsSubmitted(false);

          setSubmissionNotice(
            "Your submission was received, but the attempt ID was not returned. Please contact the administrator before leaving this page.",
          );

          return;
        }

        const authoritativeAttemptId = String(returnedAttemptId);

        /*
         * Keep the authoritative attempt ID in React state so the
         * scorecard button routes to the correct result.
         */
        setSubmittedAttemptId(authoritativeAttemptId);

        /*
         * Preserve the submitted attempt ID in localStorage as a
         * safety fallback if the result page is refreshed.
         */
        localStorage.setItem(
          `dynoquizz_submittedAttemptId_${cleanCode}`,
          authoritativeAttemptId,
        );

        localStorage.setItem(
          "dynoquizz_submittedAttemptId",
          authoritativeAttemptId,
        );

        /*
         * Remove only the active exam state.
         *
         * Do NOT remove the attempt ID here because the result
         * page may still need it during the transition.
         */
        localStorage.removeItem(`dynoquizz_active_test_${cleanCode}`);

        localStorage.removeItem(`exam_index_${cleanCode}`);

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
    if (isSubmitted || questions.length === 0 || !currentQuestion) {
      return;
    }

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
   * Loading / package error / invalid package
   *
   * "Not Found" is only shown after loading has completed and the
   * package is genuinely missing or empty. It is never used as the
   * initial loading state.
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
              <strong>&ldquo;{testCode?.toUpperCase()}&rdquo;</strong>. Please
              return to the lobby and try again.
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
                <Wifi className="h-3.5 w-3.5 text-[#1d5237]" />
                Local Save Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#f6efe1] text-[#73561a] border border-[#73561a]/20 px-2.5 py-0.5 text-xs font-bold shadow-xs">
                <WifiOff className="h-3.5 w-3.5 text-[#73561a]" />
                Offline Mode
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

      <aside className="hidden w-80 flex-col gap-4 pl-6 lg:flex text-left">
        {/* Live Edge-AI Proctoring Webcam & Gaze Monitor */}
        <div className="overflow-hidden rounded-[16px] bg-white border border-[#d1dee8]/80 shadow-md">
          <div className="p-3.5 border-b border-[#d1dee8]/50 bg-midnight-navy text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-green" />
              </span>
              <span className="text-[11px] font-bold tracking-tight">
                AI Proctor & Eye Tracker
              </span>
            </div>
            <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-white/90">
              {faceStatus === "OK"
                ? "TRACKING"
                : faceStatus === "LOOKING_AWAY"
                ? "AWAY"
                : "ALERT"}
            </span>
          </div>

          <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Live AI Overlay Status Pill */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm ${
                  faceStatus === "OK"
                    ? "bg-emerald-600/90 text-white"
                    : faceStatus === "LOOKING_AWAY"
                    ? "bg-amber-500/95 text-white animate-pulse"
                    : "bg-rose-600/95 text-white animate-pulse"
                }`}
              >
                <Eye className="h-3 w-3" />
                {faceStatus === "OK"
                  ? "Gaze Aligned"
                  : faceStatus === "LOOKING_AWAY"
                  ? "Looking Away!"
                  : faceStatus === "NO_FACE"
                  ? "No Face Detected!"
                  : "Multiple Faces!"}
              </span>

              <span className="text-[9px] font-mono bg-black/60 text-white/90 px-1.5 py-0.5 rounded">
                LIVE
              </span>
            </div>

            {/* Warnings Alert Counter */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1 ${
                  warningsCount > 0
                    ? "bg-rose-600 text-white"
                    : "bg-black/60 text-white/90"
                }`}
              >
                <ShieldAlert className="h-3 w-3" />
                Warnings: {warningsCount} / {maxWarnings}
              </span>

              <span className="text-[9px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Volume2 className="h-3 w-3 text-signal-green" />
                Mic Active
              </span>
            </div>
          </div>

          {/* Real-time Status Details */}
          <div className="p-3 bg-frost-surface border-t border-[#d1dee8]/50 text-[11px] font-medium text-steel-blue-gray space-y-1">
            <p className="flex items-center justify-between text-midnight-navy font-semibold text-[10px]">
              <span>Proctoring Engine:</span>
              <span className="text-signal-green font-bold">Edge AI (Active)</span>
            </p>
            <p className="text-[10px] text-steel-blue-gray leading-tight">
              {statusMessage}
            </p>
          </div>
        </div>

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
            <ShieldCheck className="h-3.5 w-3.5 text-[#165dfb]" />
            Security & Integrity Directives
          </h3>

          <ul className="space-y-1.5 text-[10px] font-medium text-[#78716b]">
            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-signal-green shrink-0" />
              Do not switch tabs, minimize window, or exit fullscreen mode.
            </li>

            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-signal-green shrink-0" />
              Maintain eye contact with the screen. Looking away or multiple faces triggers warnings.
            </li>

            <li className="flex items-start gap-1 leading-relaxed">
              <div className="mt-1 h-1 w-1 rounded-full bg-signal-green shrink-0" />
              Exceeding {maxWarnings} warnings results in automatic test submission.
            </li>
          </ul>
        </div>
      </aside>

      {/* Fullscreen Integrity Enforcement Overlay */}
      {!isFullscreen && mounted && !isSubmitted && !isLoadingTest && test && (
        <div className="fixed inset-0 z-50 bg-midnight-navy/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper-white rounded-[20px] p-6 text-center border-2 border-rose-500 shadow-2xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-8 w-8 animate-bounce" />
            </div>
            <div>
              <h2 className="text-base font-bold text-midnight-navy">
                Fullscreen Mode Required
              </h2>
              <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
                To preserve examination integrity, you must remain in Fullscreen Mode throughout the assessment. Exiting fullscreen logs a security violation.
              </p>
            </div>
            <button
              type="button"
              onClick={requestFullscreen}
              className="w-full py-3.5 px-4 rounded-[12px] bg-signal-green hover:bg-signal-green/90 text-white font-bold text-xs shadow-md shadow-signal-green/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
            >
              <Maximize2 className="h-4 w-4" />
              <span>Enter Fullscreen & Resume Assessment</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
