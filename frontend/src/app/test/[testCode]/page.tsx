"use client";

// frontend/src/app/test/[testCode]/page.tsx

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Maximize2,
  ShieldAlert,
  Trash2,
  ShieldCheck,
} from "lucide-react";

import { type ProctoringEvent, useProctoring } from "@/hooks/useProctoring";
import { ApiClientError, api, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  AttemptResponse,
  AttemptStateResponse,
  QuizPackageResponse,
  QuestionResponse,
  SubmitAttemptResponse,
} from "@/lib/types";

type AuthoritativeAttemptResponse = AttemptResponse & {
  effectiveDeadline: string;
};

type ActiveAnswerState = Record<number, number[]>;

function formatRemainingTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
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
}

function parseBackendDeadline(value: string): number {
  /*
   * Spring LocalDateTime is returned without an offset.
   * Treat it as the browser's local wall-clock time. This matches the
   * current India-focused backend/frontend contract.
   */
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = new Date(normalized).getTime();

  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function getLoginRedirect(testCode: string): string {
  return `/login?role=student&redirect=${encodeURIComponent(
    `/test/${testCode}/lobby`,
  )}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function normalizeAnswers(raw: unknown): ActiveAnswerState {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result: ActiveAnswerState = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const questionId = Number(key);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      continue;
    }

    /*
     * Current format is number[].
     * Older frontend state could contain a single number, so normalize it.
     */
    if (Array.isArray(value)) {
      const ids = value
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0);

      result[questionId] = [...new Set(ids)];
      continue;
    }

    const legacyId = Number(value);

    if (Number.isFinite(legacyId) && legacyId > 0) {
      result[questionId] = [legacyId];
    } else {
      result[questionId] = [];
    }
  }

  return result;
}

function normalizeReviewState(raw: unknown): Record<number, boolean> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result: Record<number, boolean> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const questionId = Number(key);
    if (Number.isFinite(questionId) && questionId > 0 && value === true) {
      result[questionId] = true;
    }
  }

  return result;
}

function normalizeTimeTaken(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result: Record<number, number> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const questionId = Number(key);
    const seconds = Number(value);

    if (
      Number.isFinite(questionId) &&
      questionId > 0 &&
      Number.isFinite(seconds) &&
      seconds >= 0
    ) {
      result[questionId] = Math.floor(seconds);
    }
  }

  return result;
}

function persistAttemptState(
  attemptId: string | null,
  answers: ActiveAnswerState,
  timeTaken: Record<number, number>,
  reviewed: Record<number, boolean> = {},
) {
  if (typeof window === "undefined" || !attemptId) {
    return;
  }

  try {
    localStorage.setItem(
      `dynoquizz_active_test_${attemptId}`,
      JSON.stringify({
        answers,
        timeTaken,
        reviewed,
        lastUpdated: Date.now(),
      }),
    );
  } catch {
    // Ignore browser storage failures.
  }
}

function saveAttemptTiming(attempt: AuthoritativeAttemptResponse) {
  if (typeof window === "undefined") {
    return;
  }

  const attemptId = String(attempt.attemptId);

  localStorage.setItem("dynoquizz_attemptId", attemptId);
  localStorage.setItem(`dynoquizz_attemptId_${attempt.quizId}`, attemptId);

  localStorage.setItem(
    `dynoquizz_attemptTiming_${attemptId}`,
    JSON.stringify({
      attemptId: attempt.attemptId,
      quizId: attempt.quizId,
      studentId: attempt.studentId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt ?? null,
      status: attempt.status,
      currentQuestion: attempt.currentQuestion ?? null,
      totalTimeTaken: attempt.totalTimeTaken ?? null,
      effectiveDeadline: attempt.effectiveDeadline,
    }),
  );
}

function cachePackage(testCode: string, packageData: QuizPackageResponse) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(
      `dynoquizz_pkg_${testCode}`,
      JSON.stringify(packageData),
    );
  } catch {
    // Ignore sessionStorage failures.
  }
}

function readCachedPackage(testCode: string): QuizPackageResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `dynoquizz_pkg_${testCode}`;
  const raw = sessionStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as QuizPackageResponse;

    if (
      parsed &&
      typeof parsed.quizId === "number" &&
      Array.isArray(parsed.questions) &&
      parsed.questions.length > 0
    ) {
      return parsed;
    }

    sessionStorage.removeItem(key);
    return null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export default function TestArenaPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  const cleanCode = String(testCode || "")
    .trim()
    .toUpperCase();

  const [test, setTest] = useState<QuizPackageResponse | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [testLoadError, setTestLoadError] = useState<string | null>(null);

  const [activeAttemptId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return (
      localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`) ||
      localStorage.getItem("dynoquizz_attemptId")
    );
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ActiveAnswerState>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [timeTakenPerQuestion, setTimeTakenPerQuestion] = useState<
    Record<number, number>
  >({});
  const [effectiveDeadline, setEffectiveDeadline] = useState<string | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState(0);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedAttemptId, setSubmittedAttemptId] = useState<string | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  const answersRef = useRef<ActiveAnswerState>({});
  const timeTakenRef = useRef<Record<number, number>>({});
  const currentIndexRef = useRef(0);
  const currentQuestionRef = useRef<QuestionResponse | null>(null);
  const expiryHandledRef = useRef(false);
  const submissionInFlightRef = useRef(false);

  const syncProctoringEvent = useCallback(
    async (event: ProctoringEvent) => {
      if (!activeAttemptId || !event || isSubmitted) return;

      try {
        await api.post(
          ENDPOINTS.student.proctoringEvents(activeAttemptId),
          {
            type: event.type,
            metadata: { source: "browser" },
          },
        );
        if (event.type === "tab_switch") {
          const state = await api.get<AttemptStateResponse>(
            ENDPOINTS.student.attemptState(activeAttemptId),
          );

          if (state.status !== "IN_PROGRESS") {
            setSubmittedAttemptId(String(state.attemptId));
            setDeadlineNotice(
              state.status === "AUTO_SUBMITTED"
                ? "The server automatically submitted this attempt after the configured proctoring limit was exceeded."
                : "This assessment attempt is no longer active.",
            );
            setIsSubmitted(true);
          }
        }
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          (error.status === 404 || error.status === 405)
        ) {
          return;
        }

        console.warn("[Proctoring] Server event sync failed:", error);
      }
    },
    [activeAttemptId, isSubmitted],
  );

  const {
    flags,
    warnings,
    violationCount,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
  } = useProctoring(
    activeAttemptId ? `attempt_${activeAttemptId}` : `code_${cleanCode}`,
    syncProctoringEvent,
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeTakenRef.current = timeTakenPerQuestion;
  }, [timeTakenPerQuestion]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const questions = test?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  const progressPercentage =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  useEffect(() => {
    if (typeof window === "undefined" || isSubmitted) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitted]);

  useEffect(() => {
    if (isSubmitted) {
      void exitFullscreen();
    }
  }, [isSubmitted, exitFullscreen]);

  useEffect(() => {
    setMounted(true);

    if (!cleanCode) {
      setTestLoadError("Assessment code is missing.");
      setIsLoadingTest(false);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(getLoginRedirect(cleanCode));
      return;
    }

    let cancelled = false;

    const restoreLocalState = () => {
      if (!activeAttemptId) {
        setTestLoadError(
          "No active server attempt was found. Please return to the lobby and start the assessment again.",
        );
        return;
      }

      try {
        const timingRaw = localStorage.getItem(
          `dynoquizz_attemptTiming_${activeAttemptId}`,
        );

        if (!timingRaw) {
          throw new Error(
            "The authoritative assessment timing could not be restored.",
          );
        }

        const timing = JSON.parse(timingRaw);

        if (
          typeof timing?.effectiveDeadline !== "string" ||
          !timing.effectiveDeadline
        ) {
          throw new Error(
            "The server did not return the authoritative assessment deadline.",
          );
        }

        setEffectiveDeadline(timing.effectiveDeadline);
      } catch (error) {
        console.error("[Assessment Timing] Restore failed:", error);

        setTestLoadError(
          getErrorMessage(
            error,
            "The authoritative assessment timing could not be restored.",
          ),
        );
      }

      try {
        const stateRaw = localStorage.getItem(
          `dynoquizz_active_test_${activeAttemptId}`,
        );

        if (stateRaw) {
          const parsed = JSON.parse(stateRaw);

          const restoredAnswers = normalizeAnswers(parsed?.answers);
          const restoredReview = normalizeReviewState(parsed?.reviewed);
          const restoredTimeTaken = normalizeTimeTaken(parsed?.timeTaken);

          answersRef.current = restoredAnswers;
          setMarkedForReview(restoredReview);
          timeTakenRef.current = restoredTimeTaken;

          setAnswers(restoredAnswers);
          setTimeTakenPerQuestion(restoredTimeTaken);
        }

        const indexRaw = localStorage.getItem(`exam_index_${activeAttemptId}`);

        if (indexRaw) {
          const restoredIndex = Number.parseInt(indexRaw, 10);

          if (Number.isInteger(restoredIndex) && restoredIndex >= 0) {
            currentIndexRef.current = restoredIndex;
            setCurrentIndex(restoredIndex);
          }
        }
      } catch (error) {
        console.warn("[Assessment] Local state restore failed:", error);

        localStorage.removeItem(`dynoquizz_active_test_${activeAttemptId}`);
        localStorage.removeItem(`exam_index_${activeAttemptId}`);
      }
    };

    restoreLocalState();

    const loadTest = async () => {
      try {
        setIsLoadingTest(true);
        setTestLoadError(null);

        let packageData = readCachedPackage(cleanCode);

        if (!packageData) {
          packageData = await api.get<QuizPackageResponse>(
            ENDPOINTS.student.quizPackageByCode(cleanCode),
          );

          cachePackage(cleanCode, packageData);
        }

        if (
          !packageData ||
          !Array.isArray(packageData.questions) ||
          packageData.questions.length === 0
        ) {
          throw new Error(
            "The server returned an empty or invalid assessment package.",
          );
        }

        const invalidQuestion = packageData.questions.find(
          (question) =>
            !Number.isFinite(Number(question.questionId)) ||
            Number(question.questionId) <= 0 ||
            !Array.isArray(question.options),
        );

        if (invalidQuestion) {
          throw new Error(
            "The assessment package contains invalid question data.",
          );
        }

        if (activeAttemptId) {
          try {
            const timingRaw = localStorage.getItem(
              `dynoquizz_attemptTiming_${activeAttemptId}`,
            );

            if (timingRaw) {
              const timing = JSON.parse(timingRaw);

              if (
                timing?.quizId != null &&
                Number(timing.quizId) !== Number(packageData.quizId)
              ) {
                throw new Error(
                  "The active attempt does not belong to this assessment.",
                );
              }
            }
          } catch (error) {
            throw error;
          }
        }

        if (activeAttemptId) {
          try {
            const serverState = await api.get<AttemptStateResponse>(
              ENDPOINTS.student.attemptState(activeAttemptId),
            );

            if (!cancelled && serverState) {
              if (serverState.effectiveDeadline) {
                setEffectiveDeadline(serverState.effectiveDeadline);
              }

              if (Array.isArray(serverState.answers)) {
                const serverAnswers =
                  serverState.answers.reduce<ActiveAnswerState>(
                    (accumulator, answer) => {
                      const questionId = Number(answer.questionId);

                      if (
                        Number.isFinite(questionId) &&
                        questionId > 0 &&
                        Array.isArray(answer.selectedOptionIds)
                      ) {
                        accumulator[questionId] = answer.selectedOptionIds
                          .map(Number)
                          .filter((id) => Number.isFinite(id) && id > 0);
                      }

                      return accumulator;
                    },
                    {},
                  );

                const mergedAnswers = {
                  ...answersRef.current,
                  ...serverAnswers,
                };

                answersRef.current = mergedAnswers;
                setAnswers(mergedAnswers);

                const serverTimeTaken =
                  serverState.answers.reduce<Record<number, number>>(
                    (accumulator, answer) => {
                      const questionId = Number(answer.questionId);
                      const seconds = Number(answer.responseTimeSeconds ?? 0);

                      if (
                        Number.isFinite(questionId) &&
                        questionId > 0 &&
                        Number.isFinite(seconds) &&
                        seconds >= 0
                      ) {
                        accumulator[questionId] = Math.floor(seconds);
                      }

                      return accumulator;
                    },
                    {},
                  );

                const mergedTimeTaken = {
                  ...timeTakenRef.current,
                  ...serverTimeTaken,
                };

                timeTakenRef.current = mergedTimeTaken;
                setTimeTakenPerQuestion(mergedTimeTaken);
              }

              const serverQuestion = Number(serverState.currentQuestion ?? 0);
              const hasLocalQuestion =
                typeof window !== "undefined" &&
                !!localStorage.getItem(`exam_index_${activeAttemptId}`);

              if (
                !hasLocalQuestion &&
                Number.isInteger(serverQuestion) &&
                serverQuestion >= 1 &&
                serverQuestion <= packageData.questions.length
              ) {
                currentIndexRef.current = serverQuestion - 1;
                setCurrentIndex(serverQuestion - 1);
              }
            }
          } catch (error) {
            if (error instanceof ApiClientError && error.status === 401) {
              throw error;
            }

            throw new Error(
              getErrorMessage(
                error,
                "Unable to verify the server attempt state. Please return to the lobby and try again.",
              ),
            );
          }
        }

        if (!cancelled) {
          setTest(packageData);
        }
      } catch (error) {
        console.error("[Assessment Package] Load failed:", error);

        if (!cancelled) {
          if (error instanceof ApiClientError && error.status === 401) {
            router.replace(getLoginRedirect(cleanCode));
            return;
          }

          setTest(null);
          setTestLoadError(
            getErrorMessage(
              error,
              "Unable to load the assessment package. Please return to the lobby and try again.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTest(false);
        }
      }
    };

    void loadTest();

    return () => {
      cancelled = true;
    };
  }, [cleanCode, activeAttemptId, router]);

  useEffect(() => {
    if (!currentQuestion || isSubmitted || timeLeft <= 0) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      if (timeLeft <= 0) {
        return;
      }

      setTimeTakenPerQuestion((previous) => {
        const nextValue = (previous[questionId] ?? 0) + 1;
        const next = {
          ...previous,
          [questionId]: nextValue,
        };

        timeTakenRef.current = next;
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentQuestion?.questionId, isSubmitted, timeLeft]);
  const persistCurrentState = (
    nextAnswers: ActiveAnswerState = answersRef.current,
    nextTimeTaken: Record<number, number> = timeTakenRef.current,
    nextReviewed: Record<number, boolean> = markedForReview,
  ) => {
    persistAttemptState(
      activeAttemptId,
      nextAnswers,
      nextTimeTaken,
      nextReviewed,
    );
  };

  const setCurrentAnswers = (next: ActiveAnswerState) => {
    answersRef.current = next;
    setAnswers(next);
    persistCurrentState(next, timeTakenRef.current);
  };

  const handleSelectOption = (optionId: number) => {
    if (!currentQuestion || isSubmitted || timeLeft <= 0) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);
    const safeOptionId = Number(optionId);

    if (
      !Number.isFinite(questionId) ||
      questionId <= 0 ||
      !Number.isFinite(safeOptionId) ||
      safeOptionId <= 0
    ) {
      return;
    }

    const currentSelections = answersRef.current[questionId] ?? [];
    const isMultiSelect = currentQuestion.questionType === "MSQ";

    let nextSelections: number[];

    if (isMultiSelect) {
      if (currentSelections.includes(safeOptionId)) {
        nextSelections = currentSelections.filter((id) => id !== safeOptionId);
      } else {
        nextSelections = [...currentSelections, safeOptionId];
      }
    } else {
      nextSelections = [safeOptionId];
    }

    const nextAnswers: ActiveAnswerState = {
      ...answersRef.current,
      [questionId]: nextSelections,
    };

    setCurrentAnswers(nextAnswers);
  };

  const toggleReview = () => {
    if (!currentQuestion || isSubmitted) {
      return;
    }

    if (timeLeft <= 0) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    if (test?.allowReview === false) {
      return;
    }

    const next = {
      ...markedForReview,
      [questionId]: !markedForReview[questionId],
    };

    setMarkedForReview(next);
    persistCurrentState(answersRef.current, timeTakenRef.current, next);
  };

  const clearCurrentAnswer = () => {
    if (!currentQuestion || isSubmitted || timeLeft <= 0) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    const nextAnswers = {
      ...answersRef.current,
      [questionId]: [],
    };

    setCurrentAnswers(nextAnswers);
  };

  const goToQuestion = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= questions.length || isSubmitted) {
      return;
    }

    if (nextIndex < currentIndex && test?.allowReview === false) {
      return;
    }

    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);

    if (activeAttemptId && typeof window !== "undefined") {
      localStorage.setItem(`exam_index_${activeAttemptId}`, String(nextIndex));
    }

  };

  const finishAssessment = async (
    latestAnswers: ActiveAnswerState = answersRef.current,
    latestTimeTaken: Record<number, number> = timeTakenRef.current,
  ) => {
    if (
      submissionInFlightRef.current ||
      isSubmitted ||
      !test ||
      !activeAttemptId
    ) {
      if (!activeAttemptId && !isSubmitted) {
        setSubmissionNotice(
          "Your server attempt is missing. Your answers remain stored locally; return to the lobby to initialize the attempt again.",
        );
      }
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitted(true);
    setSubmissionNotice(null);

    persistCurrentState(latestAnswers, latestTimeTaken);

    try {
      const completeAnswers = questions.map((question) => {
        const questionId = Number(question.questionId);

        return {
          questionId,
          selectedOptionIds: (latestAnswers[questionId] ?? []).filter(
            (optionId) =>
              Number.isFinite(Number(optionId)) && Number(optionId) > 0,
          ),
          responseTimeSeconds: Math.max(
            0,
            Math.floor(latestTimeTaken[questionId] ?? 0),
          ),
        };
      });

      const payload = {
        answers: completeAnswers,
      };

      const result = await api.post<SubmitAttemptResponse>(
        ENDPOINTS.student.submitAttempt(activeAttemptId),
        payload,
      );

      const returnedAttemptId =
        result?.attemptId != null ? String(result.attemptId) : "";

      if (!returnedAttemptId) {
        throw new Error(
          "The server accepted the submission but did not return an attempt ID.",
        );
      }

      setSubmittedAttemptId(returnedAttemptId);

      localStorage.setItem(
        `dynoquizz_submittedAttemptId_${cleanCode}`,
        returnedAttemptId,
      );
      localStorage.setItem("dynoquizz_submittedAttemptId", returnedAttemptId);

      localStorage.removeItem(`dynoquizz_attemptId_${cleanCode}`);
      localStorage.removeItem("dynoquizz_attemptId");
      localStorage.removeItem(`dynoquizz_attemptTiming_${activeAttemptId}`);
      localStorage.removeItem(`dynoquizz_active_test_${activeAttemptId}`);
      localStorage.removeItem(`exam_index_${activeAttemptId}`);

      if (result.status === "AUTO_SUBMITTED") {
        setDeadlineNotice(
          "The server deadline was reached, so the attempt was automatically submitted.",
        );
      }

      /*
       * The backend response can contain a score, but result visibility is
       * controlled independently by quiz publication settings. The result
       * page remains the source of truth for whether results are available.
       */
      if (result.finalScore == null) {
        setSubmissionNotice(
          "Submitted successfully. Results will be available once published.",
        );
      }
    } catch (error) {
      console.error("[Assessment Submission] Failed:", error);

      setIsSubmitted(false);

      if (error instanceof ApiClientError && error.status === 401) {
        setSessionExpired(true);
      } else {
        setSubmissionNotice(
          getErrorMessage(
            error,
            "Submission failed. Your answers remain stored locally. Please try again.",
          ),
        );
      }
    } finally {
      submissionInFlightRef.current = false;
    }
  };

  const handleOverallTimerExpired = () => {
    if (
      expiryHandledRef.current ||
      isSubmitted ||
      !currentQuestionRef.current
    ) {
      return;
    }

    expiryHandledRef.current = true;

    setDeadlineNotice(
      test?.autoSubmit === false
        ? "The overall assessment time has ended. Your answers are locked until you submit the attempt."
        : "The overall assessment time has ended. Your attempt will be submitted automatically.",
    );

    const question = currentQuestionRef.current;
    const questionId = Number(question.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    const latestAnswers: ActiveAnswerState = {
      ...answersRef.current,
      [questionId]: answersRef.current[questionId] ?? [],
    };

    setAnswers(latestAnswers);
    answersRef.current = latestAnswers;

    persistCurrentState(latestAnswers, timeTakenRef.current);

    if (test?.autoSubmit !== false) {
      void finishAssessment(latestAnswers, timeTakenRef.current);
    }
  };

  useEffect(() => {
    if (isSubmitted || !effectiveDeadline) {
      return;
    }

    const deadlineMs = parseBackendDeadline(effectiveDeadline);

    if (!Number.isFinite(deadlineMs)) {
      setTestLoadError(
        "The server returned an invalid assessment deadline. Please return to the lobby and start the assessment again.",
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
        handleOverallTimerExpired();
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
  }, [effectiveDeadline, isSubmitted]);

  useEffect(() => {
    if (!activeAttemptId) {
      return;
    }

    const flush = () => {
      persistAttemptState(
        activeAttemptId,
        answersRef.current,
        timeTakenRef.current,
        markedForReview,
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [activeAttemptId]);

  if (sessionExpired) {
    const allowResume = test?.allowResume !== false;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md rounded-[14px] bg-white p-6 md:p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#fbeee8] border border-[#d1dee8]/70 text-[#8c381c] shadow-xs">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Authentication Notice
            </span>

            <h1 className="text-lg font-bold text-[#111111]">
              Session Expired Mid-Assessment
            </h1>

            <p className="text-xs text-[#78716b] leading-relaxed font-medium">
              {allowResume
                ? "Your authentication session has expired. Your answers have been preserved locally. Log in again to resume the assessment."
                : "Your authentication session has expired. This assessment does not permit resumption."}
            </p>
          </div>

          {allowResume ? (
            <Link
              href={getLoginRedirect(cleanCode)}
              className="flex items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
            >
              Log In to Resume
            </Link>
          ) : (
            <Link
              href="/dashboard/student"
              className="flex items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
            >
              Return to Dashboard
            </Link>
          )}
        </motion.div>
      </main>
    );
  }

  if (isSubmitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
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
              Your responses have been transmitted to the server for evaluation.
            </p>
          </div>

          {deadlineNotice && (
            <div className="rounded-[10px] border border-[#73561a]/20 bg-[#f6efe1] p-3 text-xs text-[#73561a] text-left font-medium">
              {deadlineNotice}
            </div>
          )}

          {submissionNotice && (
            <div className="rounded-[10px] border border-[#d1dee8]/70 bg-[#f5f5f4] p-3 text-xs text-[#111111] text-left font-medium">
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
            >
              View Scorecard <ChevronRight className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard/student"
              className="flex items-center justify-center rounded-[10px] border border-[#d1dee8]/70 bg-white py-2.5 px-4 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] transition-all"
            >
              Dashboard
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  if (isLoadingTest) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#165dfb]">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>

          <h1 className="text-xl font-bold text-[#111111]">
            Loading Assessment
          </h1>

          <p className="text-xs text-[#78716b] leading-relaxed font-medium">
            Preparing your secure assessment package.
          </p>
        </div>
      </main>
    );
  }

  if (testLoadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#fbeee8] border border-[#d1dee8]/70 text-[#8c381c]">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-[#111111]">
            Assessment Could Not Be Loaded
          </h1>

          <p className="text-xs text-[#78716b] leading-relaxed font-medium">
            {testLoadError}
          </p>

          <Link
            href={`/test/${cleanCode}/lobby`}
            className="flex w-full items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
          >
            Return to Assessment Lobby
          </Link>
        </div>
      </main>
    );
  }

  if (!test || questions.length === 0 || !activeAttemptId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="w-full max-w-md rounded-[14px] bg-white p-8 text-center border border-[#d1dee8]/70 shadow-xl space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#fbeee8] border border-[#d1dee8]/70 text-[#165dfb]">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-[#111111]">
            Assessment Session Not Found
          </h1>

          <p className="text-xs text-[#78716b] leading-relaxed font-medium">
            No valid active server attempt was found for{" "}
            <strong>&ldquo;{cleanCode}&rdquo;</strong>. Please return to the
            lobby and start the assessment again.
          </p>

          <Link
            href={`/test/${cleanCode}/lobby`}
            className="flex w-full items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
          >
            Back to Assessment Lobby
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div
      className="relative flex h-[100dvh] w-screen overflow-hidden bg-[#f5f5f4] text-[#111111] p-0 font-sans select-none"
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      {!isFullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[16px] border border-[#d1dee8] bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] text-[#8c381c]">
              <Maximize2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-[#111111]">
              Fullscreen Required
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#78716b]">
              The assessment must remain in fullscreen mode. Re-enter fullscreen to continue the attempt.
            </p>
            {violationCount > 0 && (
              <p className="mt-2 text-[10px] font-bold text-[#8c381c]">
                Suspicious activity events recorded: {violationCount}
              </p>
            )}
            <button
              type="button"
              onClick={() => void requestFullscreen()}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#111111] px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#222222] active:scale-[0.98]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}

      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex h-full w-full flex-1 flex-col bg-white overflow-hidden border-0 shadow-none text-left"
      >
        <header className="flex flex-wrap items-center justify-between bg-white px-6 py-4 gap-3 border-b border-[#d1dee8]/50">
          <div className="flex items-center gap-3.5">
            <span className="rounded-full bg-[#f5f5f4] px-3 py-1 text-xs font-bold text-[#165dfb] font-mono border border-[#d1dee8]/70">
              {cleanCode}
            </span>

            <span className="text-xs font-bold text-[#78716b]">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {markedForReview[Number(currentQuestion?.questionId)] && (
              <span className="flex items-center gap-1 rounded-full bg-[#f6efe1] px-2 py-1 text-[10px] font-bold text-[#73561a]">
                <Flag className="h-3 w-3" />
                Marked for review
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2">
              <div
                className={
                  "flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs border " +
                  (timeLeft <= 10
                    ? "bg-[#fbeee8] text-[#8c381c] border-[#8c381c]/30 animate-pulse"
                    : "bg-[#f5f5f4] text-[#78716b] border-[#d1dee8]/70")
                }
                title="Overall server-authoritative assessment deadline"
              >
                <Clock className="h-3.5 w-3.5" />
                Total: {formatRemainingTime(timeLeft)}
              </div>
            </div>
          </div>
        </header>

        <div className="h-1.5 w-full bg-[#e6e3e2]/40 border-b border-[#d1dee8]/30">
          <div
            className="h-full bg-[#165dfb] transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>


        <div className="border-b border-[#d1dee8]/50 bg-[#f8f8f7] px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Question Navigator
            </span>
            <span className="text-[10px] font-semibold text-[#78716b]">
              {Object.values(markedForReview).filter(Boolean).length} marked
            </span>
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {questions.map((question, index) => {
              const questionId = Number(question.questionId);
              const answered = (answers[questionId] ?? []).length > 0;
              const marked = markedForReview[questionId] === true;

              return (
                <button
                  key={questionId}
                  type="button"
                  onClick={() => goToQuestion(index)}
                  disabled={
                    isSubmitted ||
                    (test?.allowReview === false && index < currentIndex)
                  }
                  className={`relative flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[10px] font-bold transition-all ${
                    index === currentIndex
                      ? "border-[#165dfb] bg-[#165dfb] text-white"
                      : marked
                        ? "border-[#73561a]/40 bg-[#f6efe1] text-[#73561a]"
                        : answered
                          ? "border-[#1d5237]/25 bg-[#e2ede8] text-[#1d5237]"
                          : "border-[#d1dee8]/80 bg-white text-[#78716b]"
                  }`}
                >
                  {index + 1}
                  {marked && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#73561a]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {deadlineNotice && !isSubmitted && (
          <div className="border-b border-[#73561a]/20 bg-[#f6efe1] px-4 py-3 md:px-6">
            <div className="flex items-start gap-2 text-xs font-semibold text-[#73561a]">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{deadlineNotice}</span>
            </div>
          </div>
        )}

        {!isFullscreen && (
          <div className="border-b border-[#8c381c]/20 bg-[#fbeee8] px-4 py-3 md:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs text-[#8c381c]">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong className="font-bold">Fullscreen mode is off.</strong>
                  <p className="mt-0.5 font-medium">
                    Leaving fullscreen is recorded as suspicious activity. Re-enter fullscreen before continuing.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void requestFullscreen()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#8c381c]/30 bg-white px-3 py-2 text-[10px] font-bold text-[#8c381c] transition-all hover:bg-[#fffaf8]"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Enter Fullscreen
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${currentIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold leading-snug text-[#111111] md:text-xl tracking-tight">
                  {currentQuestion?.questionText}
                </h2>
              </div>

              <div className="mb-5 text-[11px] font-semibold text-[#78716b]">
                {currentQuestion?.questionType === "MSQ"
                  ? "Select all correct options."
                  : "Select one option."}
              </div>

              <div className="space-y-2.5">
                {currentQuestion?.options.map((option, idx) => {
                  const optionId = Number(option.optionId);
                  const selectedIds =
                    answersRef.current[Number(currentQuestion.questionId)] ??
                    [];
                  const isSelected = selectedIds.includes(optionId);

                  return (
                    <button
                      key={optionId || idx}
                      type="button"
                      onClick={() => handleSelectOption(optionId)}
                      disabled={
                        isSubmitted ||
                        timeLeft <= 0
                      }
                      className={`w-full rounded-[10px] border p-3.5 text-left text-xs font-bold transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? "border-[#165dfb] bg-[#165dfb]/5 text-[#111111] ring-2 ring-[#165dfb]/20"
                          : "border-[#d1dee8]/70 bg-white text-[#78716b] hover:border-[#165dfb]/40 hover:text-[#111111]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-[8px] text-xs font-bold border ${
                            isSelected
                              ? "bg-[#165dfb] border-[#165dfb] text-white"
                              : "bg-[#f5f5f4] text-[#78716b] border-[#d1dee8]/70"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>

                        <span className="flex-1">{option.optionText}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="border-t border-[#d1dee8]/50 bg-white px-4 py-3.5 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={
                  isSubmitted ||
                  currentIndex === 0 ||
                  test?.allowReview === false
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#d1dee8]/80 bg-white px-3 py-2 text-[10px] font-bold text-[#111111] transition-all hover:bg-[#f5f5f4] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <button
                type="button"
                onClick={toggleReview}
                disabled={isSubmitted || test?.allowReview === false}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold transition-all disabled:opacity-40 ${
                  markedForReview[Number(currentQuestion?.questionId)]
                    ? "border-[#73561a]/30 bg-[#f6efe1] text-[#73561a]"
                    : "border-[#d1dee8]/80 bg-white text-[#78716b] hover:bg-[#f5f5f4]"
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                {markedForReview[Number(currentQuestion?.questionId)]
                  ? "Marked"
                  : "Mark Review"}
              </button>

              <button
                type="button"
                onClick={clearCurrentAnswer}
                disabled={
                  isSubmitted ||
                  (answers[Number(currentQuestion?.questionId)] ?? []).length === 0
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#d1dee8]/80 bg-white px-3 py-2 text-[10px] font-bold text-[#78716b] transition-all hover:bg-[#f5f5f4] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (currentIndex < questions.length - 1) {
                  goToQuestion(currentIndex + 1);
                } else {
                  void finishAssessment(answersRef.current, timeTakenRef.current);
                }
              }}
              disabled={isSubmitted}
              className="inline-flex items-center gap-1 rounded-lg bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#0f4fd8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {currentIndex === questions.length - 1 ? (
                <>
                  Submit Assessment
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Next Question
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </footer>
      </motion.div>

      <aside className="hidden w-72 flex-col gap-4 pl-6 lg:flex text-left">
        <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-[#111111]">
              <ShieldAlert className="h-3.5 w-3.5 text-[#8c381c]" />
              Activity Monitor
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
              violationCount === 0
                ? "bg-[#e2ede8] text-[#1d5237]"
                : "bg-[#fbeee8] text-[#8c381c]"
            }`}>
              {violationCount} events
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["Tab switches", flags.tab_switch],
              ["Fullscreen exits", flags.fullscreen_exit],
              ["Copy / cut / paste", flags.copy_attempt + flags.cut_attempt + flags.paste_attempt],
              ["Focus / keyboard", flags.focus_loss + flags.keyboard_attempt],
              ["Right clicks", flags.right_click],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-[#d1dee8]/70 bg-[#f8f8f7] p-2">
                <p className="text-[9px] font-semibold text-[#78716b]">{label}</p>
                <p className="mt-0.5 text-sm font-black text-[#111111]">{value}</p>
              </div>
            ))}
          </div>

          {warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#73561a]/20 bg-[#f6efe1] p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#73561a]">Latest event</p>
              <p className="mt-1 text-[10px] font-semibold leading-relaxed text-[#73561a]">
                {warnings[warnings.length - 1]}
              </p>
            </div>
          )}
        </div>

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
              <strong className="text-[#111111] font-bold">{cleanCode}</strong>
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

            <div className="flex justify-between items-center text-[#78716b]">
              <span>Total Marks:</span>
              <span className="font-bold text-[#111111]">
                {String(test.totalMarks)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 shadow-sm space-y-2">
          <h3 className="flex items-center gap-1.5 font-bold text-[#111111] text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#165dfb]" />
            Assessment Directives
          </h3>

          <ul className="space-y-1.5 text-[10px] font-medium text-[#78716b]">
            <li className="flex items-start gap-1 leading-relaxed">
              <span className="mt-1 h-1 w-1 rounded-full bg-[#165dfb] shrink-0" />
              Select an option to answer the question. Unanswered questions may
              be skipped.
            </li>

            <li className="flex items-start gap-1 leading-relaxed">
              <span className="mt-1 h-1 w-1 rounded-full bg-[#165dfb] shrink-0" />
              The countdown is based on the server&apos;s authoritative attempt
              deadline.
            </li>

            <li className="flex items-start gap-1 leading-relaxed">
              <span className="mt-1 h-1 w-1 rounded-full bg-[#165dfb] shrink-0" />
              Backend scoring remains authoritative after submission.
            </li>

            <li className="flex items-start gap-1 leading-relaxed">
              <span className="mt-1 h-1 w-1 rounded-full bg-[#165dfb] shrink-0" />
              Browser-observable suspicious activity is reported to the server during the session.
            </li>

            {violationCount > 0 && (
              <li className="flex items-start gap-1 leading-relaxed text-[#8c381c]">
                <span className="mt-1 h-1 w-1 rounded-full bg-[#8c381c] shrink-0" />
                {violationCount} suspicious activity event{violationCount === 1 ? "" : "s"} detected.
              </li>
            )}

            {flags.tab_switch > 0 && (
              <li className="flex items-start gap-1 leading-relaxed text-[#8c381c]">
                <span className="mt-1 h-1 w-1 rounded-full bg-[#8c381c] shrink-0" />
                Tab-switch activity was detected.
              </li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
