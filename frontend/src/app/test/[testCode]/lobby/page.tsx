"use client";

// src/app/test/[testCode]/lobby/page.tsx

import { use, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Clock,
  FileQuestion,
  User,
  ArrowRight,
  Loader2,
  Lock,
  AlertCircle,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";

import { ApiClientError, api, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  AttemptResponse,
  QuizAvailabilityResponse,
  QuizPackageResponse,
} from "@/lib/types";

function formatDateTime(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function saveAttemptTiming(attempt: AttemptResponse) {
  if (typeof window === "undefined") return;

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

function savePackage(testCode: string, packageData: QuizPackageResponse) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(
    `dynoquizz_pkg_${testCode}`,
    JSON.stringify(packageData),
  );
}

function getCachedPackage(testCode: string): QuizPackageResponse | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(`dynoquizz_pkg_${testCode}`);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as QuizPackageResponse;

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.questions) &&
      parsed.questions.length > 0
    ) {
      return parsed;
    }
  } catch {
    sessionStorage.removeItem(`dynoquizz_pkg_${testCode}`);
  }

  return null;
}

function getLoginRedirect(testCode: string): string {
  return `/login?role=student&redirect=${encodeURIComponent(
    `/test/${testCode}/lobby`,
  )}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function LobbyInner({ testCode }: { testCode: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regParam = searchParams.get("reg") || "";

  const cleanCode = String(testCode || "")
    .trim()
    .toUpperCase();

  const [availability, setAvailability] =
    useState<QuizAvailabilityResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [registrationNumber, setRegistrationNumber] = useState(regParam);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!cleanCode) {
      setAvailability({
        quizCode: "",
        available: false,
        status: "NOT_FOUND",
        startTime: null,
        endTime: null,
      });
      setStartError("Assessment code is missing.");
      setLoading(false);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(getLoginRedirect(cleanCode));
      return;
    }

    try {
      const storedUser = JSON.parse(
        localStorage.getItem("dynoquizz_user") || "{}",
      );

      const storedRegistration =
        regParam ||
        storedUser?.registrationNo ||
        localStorage.getItem("dynoquizz_regNo") ||
        sessionStorage.getItem("dynoquizz_student_reg") ||
        "";

      if (storedRegistration) {
        setRegistrationNumber(String(storedRegistration).trim().toUpperCase());
      }
    } catch {
      // Ignore malformed cached user data.
    }

    let cancelled = false;

    const loadAvailability = async () => {
      try {
        setLoading(true);
        setStartError(null);

        const result = await api.get<QuizAvailabilityResponse>(
          ENDPOINTS.student.availability(cleanCode),
        );

        if (cancelled) return;

        setAvailability(result);
      } catch (error) {
        if (cancelled) return;

        console.error("Assessment availability check failed:", error);

        if (error instanceof ApiClientError && error.status === 401) {
          router.replace(getLoginRedirect(cleanCode));
          return;
        }

        setStartError(
          getApiErrorMessage(
            error,
            "Could not check assessment availability. Please try again.",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [cleanCode, regParam, router]);

  const status = availability?.status;
  const isLive = status === "LIVE" && availability?.available === true;

  const handleStartAssessment = async () => {
    if (!isLive) {
      setStartError("This assessment is not currently live.");
      return;
    }

    const cleanRegistration = registrationNumber.trim().toUpperCase();

    if (!cleanRegistration) {
      setStartError("Please enter your registered roll / registration number.");
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(getLoginRedirect(cleanCode));
      return;
    }

    setIsStarting(true);
    setStartError(null);

    try {
      // Fullscreen is required before the server creates the attempt.
      // Starting an attempt outside fullscreen would bypass the exam UI
      // protection, so a denied fullscreen request stops the flow here.
      try {
        if (typeof document !== "undefined" && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        throw new Error(
          "Fullscreen permission is required to start this assessment. Please allow fullscreen and try again.",
        );
      }

      if (
        typeof document !== "undefined" &&
        !document.fullscreenElement
      ) {
        throw new Error(
          "The assessment can only start in fullscreen mode. Please re-enter fullscreen and try again.",
        );
      }
      const storedUser = JSON.parse(
        localStorage.getItem("dynoquizz_user") || "{}",
      );

      const accountRegistration =
        storedUser?.registrationNo ||
        localStorage.getItem("dynoquizz_regNo") ||
        sessionStorage.getItem("dynoquizz_student_reg") ||
        "";

      if (
        accountRegistration &&
        String(accountRegistration).trim().toUpperCase() !== cleanRegistration
      ) {
        throw new Error(
          "The registration number does not match the registration number linked to your account.",
        );
      }

      localStorage.setItem("dynoquizz_regNo", cleanRegistration);
      sessionStorage.setItem("dynoquizz_student_reg", cleanRegistration);

      /*
       * Step 1:
       * Ask the backend to create or resume the attempt for the
       * currently authenticated student.
       *
       * The backend derives student identity from the JWT.
       * No registration number or attempt ID is sent in the request.
       */
      let attempt: AttemptResponse;

      try {
        attempt = await api.post<AttemptResponse>(
          ENDPOINTS.student.startAttempt(cleanCode),
        );
      } catch (error) {
        if (error instanceof ApiClientError) {
          const code = String(error.errorCode || "").toUpperCase();

          if (error.status === 401) {
            router.replace(getLoginRedirect(cleanCode));
            return;
          }

          if (error.status === 409 && code === "ATTEMPT_ALREADY_SUBMITTED") {
            throw new Error("This assessment has already been submitted.");
          }

          if (code === "QUIZ_NOT_STARTED") {
            throw new Error("This assessment has not started yet.");
          }

          if (code === "QUIZ_ENDED") {
            throw new Error("This assessment has already ended.");
          }

          if (code === "QUIZ_NOT_AVAILABLE") {
            throw new Error("This assessment is not currently available.");
          }

          if (code === "STUDENT_REGISTRATION_NOT_ALLOWED") {
            throw new Error(
              "Your registration number is not allowed for this assessment.",
            );
          }

          if (code === "STUDENT_NOT_ELIGIBLE") {
            throw new Error(
              "Your account is not eligible for this assessment.",
            );
          }

          if (
            code === "ATTEMPT_RESUME_NOT_ALLOWED" ||
            code === "RESUME_NOT_ALLOWED"
          ) {
            throw new Error(
              "You already have an unfinished attempt for this assessment, but the instructor has disabled resume.",
            );
          }

          if (code === "ATTEMPT_EXPIRED") {
            throw new Error(
              "Your previous assessment attempt has expired and cannot be resumed.",
            );
          }

          if (error.status === 403) {
            throw new Error(
              error.message ||
                "You are not authorized to take this assessment.",
            );
          }
        }

        throw error;
      }

      if (!attempt?.attemptId) {
        throw new Error(
          "The server did not return a valid assessment attempt ID.",
        );
      }

      if (
        typeof attempt.effectiveDeadline !== "string" ||
        !attempt.effectiveDeadline
      ) {
        throw new Error(
          "The server did not return the authoritative assessment deadline.",
        );
      }

      saveAttemptTiming(attempt);

      /*
       * Step 2:
       * Download the backend-owned student-safe quiz package.
       *
       * A cached package may be reused for this quiz, but a missing or
       * invalid cache is always replaced with the backend response.
       */
      let packageData = getCachedPackage(cleanCode);

      if (!packageData) {
        packageData = await api.get<QuizPackageResponse>(
          ENDPOINTS.student.quizPackageByCode(cleanCode),
        );
      }

      if (
        !packageData ||
        !Array.isArray(packageData.questions) ||
        packageData.questions.length === 0
      ) {
        throw new Error(
          "The server returned an invalid or empty assessment package.",
        );
      }

      savePackage(cleanCode, packageData);

      /*
       * Step 3:
       * Only enter the exam Arena after both the authoritative attempt
       * and the student-safe package are ready.
       */
      router.push(`/test/${encodeURIComponent(cleanCode)}`);
    } catch (error) {
      console.error("Start assessment error:", error);

      if (error instanceof ApiClientError && error.status === 401) {
        router.replace(getLoginRedirect(cleanCode));
        return;
      }

      setStartError(
        getApiErrorMessage(
          error,
          "Could not start the assessment. Please check your connection and try again.",
        ),
      );
    } finally {
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
          <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
          Checking Assessment Availability...
        </div>
      </div>
    );
  }

  if (!availability || !isLive) {
    let availabilityMessage =
      startError || "This assessment is not currently available.";

    if (!startError) {
      switch (status) {
        case "NOT_STARTED":
          availabilityMessage = availability?.startTime
            ? `This assessment has not started yet. It starts at ${formatDateTime(
                availability.startTime,
              )}.`
            : "This assessment has not started yet.";
          break;

        case "ENDED":
          availabilityMessage = "This assessment has already ended.";
          break;

        case "NOT_PUBLISHED":
          availabilityMessage =
            "This assessment is not open yet. Ask your instructor to publish it.";
          break;

        case "NOT_FOUND":
          availabilityMessage = `The assessment code ${cleanCode} does not exist.`;
          break;

        case "LIVE":
          availabilityMessage = "This assessment is not currently available.";
          break;

        default:
          break;
      }
    }

    return (
      <div className="mx-auto max-w-md rounded-[14px] border border-[#d1dee8]/70 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#fbeee8] text-[#8c381c] shadow-xs">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-lg font-bold text-[#111111]">
          Assessment Unavailable
        </h2>

        <p className="mt-2 text-xs text-[#78716b] leading-relaxed font-medium">
          {availabilityMessage}
        </p>

        <Link
          href="/join"
          className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#111111] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#222222] active:scale-[0.98] shadow-sm transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Return to Join Gateway
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl w-full">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#78716b] hover:text-[#111111] transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Gateway
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#165dfb] animate-pulse" />

          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
            Assessment Lobby
          </span>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#d1dee8]/70 bg-white p-6 md:p-8 space-y-6 shadow-xl">
        <div className="border-b border-[#d1dee8]/50 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="rounded-full bg-[#165dfb] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-xs">
              {cleanCode}
            </span>

            <span className="text-xs font-semibold text-[#78716b]">
              Assessment Status:{" "}
              <span className="font-bold text-[#111111]">LIVE</span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight">
            Secure Assessment Lobby
          </h1>

          <p className="mt-2 text-xs text-[#78716b] leading-relaxed font-medium">
            Confirm your registration number before the server creates or
            resumes your assessment attempt.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <FileQuestion className="h-3.5 w-3.5 text-[#165dfb]" />
              Questions
            </div>

            <p className="mt-1 text-sm font-bold text-[#111111]">
              Loaded after start
            </p>
          </div>

          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <Clock className="h-3.5 w-3.5 text-[#165dfb]" />
              Exam Window
            </div>

            <p className="mt-1 text-sm font-bold text-[#111111]">
              {availability.endTime
                ? `Ends ${formatDateTime(availability.endTime)}`
                : "Open now"}
            </p>
          </div>

          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-3.5 col-span-2 sm:col-span-1 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <User className="h-3.5 w-3.5 text-[#165dfb]" />
              Candidate Reg
            </div>

            <p className="mt-1 text-sm font-mono font-bold text-[#111111] truncate">
              {registrationNumber || "NOT SPECIFIED"}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-4 text-xs text-[#78716b] space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-[#111111]">
              <ShieldCheck className="h-4 w-4 text-[#165dfb]" />
              Secure Assessment Architecture
            </div>

            <p className="leading-relaxed font-medium">
              The assessment is live. Starting the secure server session will
              establish your attempt timing and load the authoritative
              student-safe quiz package.
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#78716b] font-medium">
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#165dfb]" />
              <span>Assessment availability verified by server</span>
            </div>

            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#165dfb]" />
              <span>Server creates or resumes the student attempt</span>
            </div>

            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#165dfb]" />
              <span>Authoritative deadline is stored before Arena entry</span>
            </div>
          </div>

          {startError && (
            <div className="rounded-[10px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold flex items-center gap-2 shadow-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {startError}
            </div>
          )}

          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-5 space-y-3 text-left shadow-xs">
            <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-3">
              <span className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#165dfb]" />
                Candidate Ready Room
              </span>

              <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#165dfb] border border-[#d1dee8]/80 shadow-xs">
                LIVE
              </span>
            </div>

            <div className="space-y-2 text-xs text-[#78716b]">
              <p className="font-semibold text-[#111111]">Directives:</p>

              <ul className="list-disc pl-4 space-y-1 font-medium">
                <li>
                  The server starts or resumes the attempt for the logged-in
                  student.
                </li>
                <li>
                  The authoritative assessment deadline comes from the server
                  response.
                </li>
                <li>
                  The exam package is loaded only after the attempt is ready.
                </li>
                <li>
                  Fullscreen is requested before entering the assessment. Leaving
                  fullscreen may be recorded as suspicious activity.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleStartAssessment}
              disabled={isStarting}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] bg-[#111111] py-3.5 text-sm font-bold text-white hover:bg-[#222222] active:scale-[0.98] shadow-sm hover:shadow-md transition-all cursor-pointer border-0 disabled:opacity-70"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing Session &amp; Loading Package...
                </>
              ) : (
                <>
                  Start / Resume Assessment
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function AssessmentLobbyPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  return (
    <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
      <header className="sticky top-0 z-40 w-full border-b border-[#d1dee8]/70 bg-white/95 backdrop-blur-sm px-4 md:px-8 py-3">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <Logo />

          <Link
            href="/dashboard/student"
            className="rounded-[10px] border border-[#d1dee8]/80 bg-[#f5f5f4] px-3.5 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:border-[#b9cbd9] hover:text-[#111111] shadow-xs active:scale-95 transition-all"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
              <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
              Loading Assessment Lobby...
            </div>
          }
        >
          <LobbyInner testCode={testCode} />
        </Suspense>
      </main>
    </div>
  );
}
