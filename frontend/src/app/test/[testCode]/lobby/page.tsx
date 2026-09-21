"use client";

// src/app/test/[testCode]/lobby/page.tsx

import { use, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Download,
  CheckCircle2,
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

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Backend attempt initialization
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [hasExistingAttempt, setHasExistingAttempt] = useState(false);

  // New availability state
  const [availabilityStatus, setAvailabilityStatus] =
    useState<AvailabilityStatus | null>(null);

  const [availabilityData, setAvailabilityData] =
    useState<QuizAvailabilityResponse | null>(null);

  useEffect(() => {
    const cleanCode = testCode.toUpperCase();

    if (typeof window !== "undefined") {
      const token = getClientAuthToken();

      if (!token) {
        router.push(`/login?role=student&redirect=/test/${cleanCode}/lobby`);
        return;
      }

      const existingAttempt = localStorage.getItem(
        `dynoquizz_attemptId_${cleanCode}`,
      );

      if (existingAttempt) {
        setHasExistingAttempt(true);
      }
    }

    const checkAvailability = async () => {
      setLoading(true);
      setPackageError(null);
      setStartError(null);
      setAvailabilityStatus(null);
      setAvailabilityData(null);

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

        setAvailabilityData(data);

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

            // The actual configured exam duration will come
            // from the quiz package in the next step.
            totalTimeLimitMinutes: 0,

            // The package has NOT been downloaded yet.
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
        setAvailabilityData(null);
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

    /*
     * Preserve the existing cached-package flag for now.
     *
     * The actual package download/cache flow will be
     * corrected in the next frontend step.
     */
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem(`dynoquizz_pkg_${cleanCode}`);

      if (cached === "true") {
        setIsDownloaded(true);
      }
    }
  }, [testCode, regParam, router]);

  /*
   * Existing simulated download behavior.
   *
   * This will be replaced in the next step so that
   * the real package is downloaded from the backend
   * after the attempt is created.
   */
  const handleDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(20);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }

        return prev + 25;
      });
    }, 350);

    setTimeout(() => {
      clearInterval(interval);
      setDownloadProgress(100);
      setIsDownloading(false);
      setIsDownloaded(true);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `dynoquizz_pkg_${testCode.toUpperCase()}`,
          "true",
        );
      }
    }, 1500);
  };

  /*
   * Existing attempt-start flow.
   *
   * This is intentionally kept for now.
   * In the next step we will change this function so:
   *
   * availability LIVE
   *       ↓
   * POST /attempts
   *       ↓
   * GET /package
   *       ↓
   * store package
   *       ↓
   * navigate to Arena
   */
  const handleStartAssessment = async () => {
    const cleanCode = testCode.toUpperCase();

    const existingAttempt =
      typeof window !== "undefined"
        ? localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`)
        : null;

    if (existingAttempt) {
      // Existing attempt → resume directly.
      router.push(`/test/${cleanCode}`);
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

      const res = await fetch(
        `${API_BASE}/api/v1/student/quizzes/${cleanCode}/attempts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        const errorCode = errorData.error;
        const errorMessage = errorData.message || errorCode;

        /*
         * If candidate has already attempted,
         * preserve the existing result behavior.
         */
        if (res.status === 409 && errorCode === "ALREADY_ATTEMPTED") {
          router.push(`/dashboard/student/result/${cleanCode}`);
          return;
        }

        if (
          typeof errorMessage === "string" &&
          errorMessage.toLowerCase().includes("not available to students")
        ) {
          throw new Error(
            "This assessment is not open yet. Ask your teacher to publish it.",
          );
        }

        /*
         * Keep compatibility with the older backend
         * error code while the new availability endpoint
         * becomes the primary check.
         */
        if (
          res.status === 409 &&
          (errorCode === "QUIZ_NOT_ACTIVE" ||
            (typeof errorMessage === "string" &&
              errorMessage.includes("QUIZ_NOT_ACTIVE")))
        ) {
          throw new Error("This assessment is not open right now.");
        }

        if (errorCode === "QUIZ_NOT_STARTED") {
          throw new Error("This assessment has not started yet.");
        }

        if (errorCode === "QUIZ_ENDED") {
          throw new Error("This assessment has already ended.");
        }

        if (res.status === 403) {
          throw new Error(
            errorMessage || "You are not authorized to take this assessment.",
          );
        }

        throw new Error(
          errorMessage ||
            "Failed to initialize assessment attempt on the server.",
        );
      }

      const data = await res.json();

      /*
       * Save the server-generated attemptId.
       */
      if (typeof window !== "undefined" && data.attemptId) {
        localStorage.setItem(
          `dynoquizz_attemptId_${cleanCode}`,
          data.attemptId.toString(),
        );

        localStorage.setItem("dynoquizz_attemptId", data.attemptId.toString());
      }

      /*
       * For this step, navigation remains unchanged.
       * Package fetching will be moved here in Step 2/3.
       */
      router.push(`/test/${cleanCode}`);
    } catch (err: any) {
      console.error("Start attempt error:", err);

      setStartError(
        err.message ||
          "Could not start the assessment. Please check your connection.",
      );

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

        {!isDownloaded && (
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
                The assessment package will be loaded after your secure server
                session is initialized.
              </p>
            </div>

            <div className="space-y-2 text-xs text-[#78716b] font-medium">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#165dfb]" />
                <span>Assessment availability verified by server</span>
              </div>

              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#165dfb]" />
                <span>
                  Secure attempt session required before package access
                </span>
              </div>
            </div>

            {isDownloading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#111111]">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
                    Downloading Assessment Package...
                  </span>

                  <span>{downloadProgress}%</span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e3e2]">
                  <motion.div
                    className="h-full bg-[#165dfb]"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${downloadProgress}%`,
                    }}
                    transition={{ ease: "linear" }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-[10px] bg-[#165dfb] py-3 text-sm font-bold text-white hover:bg-[#0f4fd8] active:scale-[0.98] shadow-sm shadow-[#165dfb]/25 hover:shadow-md transition-all cursor-pointer border-0"
              >
                <Download className="h-4 w-4" />
                Download Assessment Package
              </button>
            )}
          </motion.div>
        )}

        {isDownloaded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="rounded-[12px] bg-[#e7f7ef] border border-[#1d5237]/20 p-4 text-xs text-[#1d5237] shadow-xs">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#1d5237]" />

                <div className="space-y-1">
                  <p className="font-bold text-sm">
                    Package Verified &amp; Ready
                  </p>

                  <p className="leading-relaxed opacity-90 font-medium">
                    All questions are cached. You can complete this exam
                    securely.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/60 p-5 space-y-3 text-left shadow-xs">
              <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-3">
                <span className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#165dfb]" />
                  Candidate Ready Room
                </span>

                <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#165dfb] border border-[#d1dee8]/80 shadow-xs">
                  READY
                </span>
              </div>

              <div className="space-y-2 text-xs text-[#78716b]">
                <p className="font-semibold text-[#111111]">Directives:</p>

                <ul className="list-disc pl-4 space-y-1 font-medium">
                  <li>
                    The timer starts immediately once you click &ldquo;Start
                    Assessment&rdquo;.
                  </li>

                  <li>
                    Your answers are automatically saved locally and
                    synchronized upon completion.
                  </li>
                </ul>
              </div>
            </div>

            {startError && (
              <div className="rounded-[10px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold flex items-center gap-2 shadow-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {startError}
              </div>
            )}

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
                    Initializing Server Session...
                  </>
                ) : (
                  <>
                    {hasExistingAttempt
                      ? "Resume Assessment"
                      : "Start Assessment"}

                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
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
