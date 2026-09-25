"use client";

// src/app/test/[testCode]/lobby/page.tsx

import { use, useState, useEffect, Suspense } from "react";
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
        // Ignore localStorage errors.
      }
    }
  }

  if (token) return token;

  return null;
}

type AvailabilityStatus =
  | "NOT_FOUND"
  | "NOT_PUBLISHED"
  | "NOT_STARTED"
  | "LIVE"
  | "ENDED";

type QuizAvailabilityResponse = {
  quizCode?: string;
  available?: boolean;
  status?: AvailabilityStatus | string;
  startTime?: string | null;
  endTime?: string | null;
  message?: string;
  error?: string;
};

function LobbyInner({ testCode }: { testCode: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regParam = searchParams.get("reg") || "";

  const [test, setTest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrationNumber, setRegistrationNumber] = useState(regParam);

  // Backend attempt initialization
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);

  // New availability state
  const [availabilityStatus, setAvailabilityStatus] =
    useState<AvailabilityStatus | null>(null);

  useEffect(() => {
    const cleanCode = testCode.toUpperCase();

    if (typeof window !== "undefined") {
      const token = getClientAuthToken();

      if (!token) {
        router.push(`/login?role=student&redirect=/test/${cleanCode}/lobby`);
        return;
      }
    }

    const checkAvailability = async () => {
      setLoading(true);
      setPackageError(null);
      setStartError(null);
      setAvailabilityStatus(null);

      try {
        const token = getClientAuthToken();

        if (!token) {
          router.push(`/login?role=student&redirect=/test/${cleanCode}/lobby`);
          return;
        }

        const res = await fetch(
          `${API_BASE}/api/v1/student/quizzes/${cleanCode}/availability`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const data: QuizAvailabilityResponse = await res
          .json()
          .catch(() => ({}));

        if (!res.ok) {
          const errorMessage =
            data.message ||
            data.error ||
            "Unable to check assessment availability.";

          setAvailabilityStatus(res.status === 404 ? "NOT_FOUND" : null);

          setPackageError(errorMessage);
          setTest(null);
          return;
        }

        const status = data.status;

        if (status === "LIVE" && data.available === true) {
          /*
           * IMPORTANT:
           *
           * LIVE only means that the student is allowed
           * to proceed to the next step.
           *
           * We intentionally DO NOT download the quiz
           * package here.
           *
           * The package will be fetched only after:
           *
           * POST /api/v1/student/quizzes/{code}/attempts
           *
           * succeeds.
           */

          setAvailabilityStatus("LIVE");

          setTest({
            testCode: cleanCode,
            quizName: "Assessment Ready",
            description:
              "This assessment is currently live. Start the assessment to initialize your secure session.",
            targetClass: "General Batch",
            totalTimeLimitMinutes: 0,
            questions: [],
          });

          setLoading(false);
          return;
        }

        setAvailabilityStatus(status as AvailabilityStatus | null);

        setTest(null);

        switch (status) {
          case "NOT_STARTED":
            setPackageError(
              data.startTime
                ? `This assessment has not started yet. It starts at ${new Date(
                    data.startTime,
                  ).toLocaleString()}`
                : "This assessment has not started yet.",
            );
            break;

          case "ENDED":
            setPackageError("This assessment has already ended.");
            break;

          case "NOT_PUBLISHED":
            setPackageError(
              "This assessment is not open yet. Ask your teacher to publish it.",
            );
            break;

          case "NOT_FOUND":
            setPackageError(`The assessment code ${cleanCode} does not exist.`);
            break;

          default:
            setPackageError("This assessment is not currently available.");
            break;
        }
      } catch (error) {
        console.error("Assessment availability check failed:", error);

        setAvailabilityStatus(null);
        setTest(null);

        setPackageError(
          "Could not check assessment availability. Please check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    checkAvailability();

    if (!regParam && typeof window !== "undefined") {
      const storedReg =
        localStorage.getItem("dynoquizz_regNo") ||
        sessionStorage.getItem("dynoquizz_student_reg");

      if (storedReg) {
        setRegistrationNumber(storedReg);
      }
    }
  }, [testCode, regParam, router]);

  /*
   * Start the server attempt and then download the authoritative
   * quiz package. The Arena only opens after both succeed.
   */
  const handleStartAssessment = async () => {
    const cleanCode = testCode.toUpperCase();

    if (availabilityStatus !== "LIVE") {
      setStartError("This assessment is not currently live.");
      return;
    }

    setIsStarting(true);
    setStartError(null);

    const reg = registrationNumber || "CANDIDATE";

    if (typeof window !== "undefined") {
      localStorage.setItem("dynoquizz_regNo", reg);
      sessionStorage.setItem("dynoquizz_student_reg", reg);
    }

    try {
      const token = getClientAuthToken();

      if (!token) {
        throw new Error("Your login session has expired. Please log in again.");
      }

      /*
       * Step 1: Always ask the backend to create or resume the attempt
       * for the CURRENTLY authenticated student.
       *
       * IMPORTANT:
       * Never trust an attemptId from localStorage here.
       *
       * localStorage belongs to the browser, not to the logged-in
       * account. A previous student's attemptId can remain after
       * switching accounts.
       *
       * The backend uses the current JWT to determine ownership
       * and returns the correct attemptId for this student.
       */
      const attemptRes = await fetch(
        `${API_BASE}/api/v1/student/quizzes/${cleanCode}/attempts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // Read the response body exactly once.
      const attemptData = await attemptRes.json().catch(() => ({}));

      if (!attemptRes.ok) {
        const errorCode = attemptData.error;
        const errorMessage = attemptData.message || errorCode;

        if (attemptRes.status === 409 && errorCode === "ALREADY_ATTEMPTED") {
          throw new Error("This assessment has already been submitted.");
        }

        if (errorCode === "QUIZ_NOT_STARTED") {
          throw new Error("This assessment has not started yet.");
        }

        if (errorCode === "QUIZ_ENDED") {
          throw new Error("This assessment has already ended.");
        }

        if (
          errorCode === "QUIZ_NOT_AVAILABLE" ||
          errorCode === "QUIZ_NOT_ACTIVE"
        ) {
          throw new Error("This assessment is not currently available.");
        }

        if (
          typeof errorMessage === "string" &&
          errorMessage.toLowerCase().includes("not available to students")
        ) {
          throw new Error(
            "This assessment is not open yet. Ask your teacher to publish it.",
          );
        }

        if (attemptRes.status === 403) {
          throw new Error(
            errorMessage || "You are not authorized to take this assessment.",
          );
        }

        throw new Error(
          errorMessage ||
            "Failed to initialize assessment attempt on the server.",
        );
      }

      if (!attemptData.attemptId) {
        throw new Error(
          "The server created/resumed the attempt but did not return an attemptId.",
        );
      }

      if (typeof attemptData.effectiveDeadline !== "string") {
        console.error(
          "[Assessment Timing] Start-attempt response missing effectiveDeadline:",
          attemptData,
        );
        throw new Error(
          "The server did not return the authoritative attempt timing information.",
        );
      }

      const attemptId = String(attemptData.attemptId);

      /*
       * Replace any stale browser value with the authoritative attemptId
       * returned for the currently authenticated student.
       */
      localStorage.setItem(`dynoquizz_attemptId_${cleanCode}`, attemptId);
      localStorage.setItem("dynoquizz_attemptId", attemptId);

      // Persist the complete authoritative attempt timing response so the Arena
      // can survive refreshes without inventing a client-side deadline.
      localStorage.setItem(
        `dynoquizz_attemptTiming_${attemptId}`,
        JSON.stringify({
          attemptId,
          startedAt: attemptData.startedAt ?? null,
          submittedAt: attemptData.submittedAt ?? null,
          status: attemptData.status ?? null,
          currentQuestion: attemptData.currentQuestion ?? null,
          totalTimeTaken: attemptData.totalTimeTaken ?? null,
          effectiveDeadline: attemptData.effectiveDeadline,
        }),
      );

      /*
       * Step 2: Reuse a valid cached package if one exists.
       * Otherwise download the authoritative package from the backend.
       */
      const packageKey = `dynoquizz_pkg_${cleanCode}`;
      let packageData: any = null;

      const cachedPackage =
        typeof window !== "undefined"
          ? sessionStorage.getItem(packageKey)
          : null;

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
          sessionStorage.removeItem(packageKey);
        }
      }

      if (!packageData) {
        const packageRes = await fetch(
          `${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const packageErrorData = await packageRes.json().catch(() => ({}));

        if (!packageRes.ok) {
          throw new Error(
            packageErrorData.message ||
              packageErrorData.error ||
              "The assessment package could not be downloaded.",
          );
        }

        packageData = packageErrorData;

        if (
          !packageData ||
          !Array.isArray(packageData.questions) ||
          packageData.questions.length === 0
        ) {
          throw new Error(
            "The server returned an invalid or empty assessment package.",
          );
        }

        sessionStorage.setItem(packageKey, JSON.stringify(packageData));
      }

      /*
       * Step 3: Only enter the Arena after the attempt and package
       * are both ready.
       */
      router.push(`/test/${cleanCode}`);
    } catch (err: any) {
      console.error("Start assessment error:", err);

      setStartError(
        err?.message ||
          "Could not start the assessment. Please check your connection and try again.",
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

  /*
   * Any non-LIVE state stops here.
   *
   * No quiz package has been downloaded.
   */
  if (!test || availabilityStatus !== "LIVE") {
    return (
      <div className="mx-auto max-w-md rounded-[14px] border border-[#d1dee8]/70 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#fbeee8] text-[#8c381c] shadow-xs">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-lg font-bold text-[#111111]">
          Assessment Unavailable
        </h2>

        <p className="mt-2 text-xs text-[#78716b] leading-relaxed font-medium">
          {packageError || (
            <>
              The access code{" "}
              <span className="font-mono font-bold text-[#111111]">
                {testCode}
              </span>{" "}
              does not exist, has been archived, or is not currently open.
            </>
          )}
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
              {test.testCode}
            </span>

            <span className="text-xs font-semibold text-[#78716b]">
              Target Class:{" "}
              <span className="font-bold text-[#111111]">
                {test.targetClass}
              </span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight">
            {test.quizName}
          </h1>

          <p className="mt-2 text-xs text-[#78716b] leading-relaxed font-medium">
            {test.description}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <FileQuestion className="h-3.5 w-3.5 text-[#165dfb]" />
              Questions
            </div>

            <p className="mt-1 text-sm font-bold text-[#111111]">
              {test.questions.length > 0
                ? `${test.questions.length} Items`
                : "Available after start"}
            </p>
          </div>

          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <Clock className="h-3.5 w-3.5 text-[#165dfb]" />
              Time Limit
            </div>

            <p className="mt-1 text-sm font-bold text-[#111111]">
              {test.totalTimeLimitMinutes > 0
                ? `${test.totalTimeLimitMinutes} Minutes`
                : "Provided in package"}
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
              This assessment is live. Start the secure server session to
              download the authoritative assessment package.
            </p>
          </div>

          <div className="space-y-2 text-xs text-[#78716b] font-medium">
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#165dfb]" />
              <span>Assessment availability verified by server</span>
            </div>

            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#165dfb]" />
              <span>Server attempt created before package access</span>
            </div>

            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#165dfb]" />
              <span>Package is cached locally before entering the Arena</span>
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
                  The timer starts once the secure assessment session is
                  initialized.
                </li>
                <li>
                  Your answers are automatically saved locally and submitted
                  when you complete the assessment.
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
