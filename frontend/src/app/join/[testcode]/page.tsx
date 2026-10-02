"use client";

import { use, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import Link from "next/link";

import { motion } from "framer-motion";

import {
  PlayCircle,
  Clock,
  CheckCircle2,
  ArrowLeft,
  UserCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { ENDPOINTS } from "@/lib/api/endpoints";

type AvailabilityStatus =
  | "NOT_FOUND"
  | "NOT_PUBLISHED"
  | "NOT_STARTED"
  | "LIVE"
  | "ENDED";

type AvailabilityResponse = {
  quizCode?: string;

  available?: boolean;

  status?: AvailabilityStatus | string;

  startTime?: string | null;

  endTime?: string | null;
};

type QuizPackage = {
  title?: string;

  description?: string;

  totalQuestions?: number;

  overallTimerSeconds?: number;

  questions?: unknown[];
};

function getClientAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("dynoquizz_token");

  if (!token || token === "undefined" || token === "null") {
    return null;
  }

  return token.trim();
}

function formatStartTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",

    timeStyle: "short",
  });
}

export default function TestLandingPage({
  params,
}: {
  params: Promise<{ testcode: string }>;
}) {
  const { testcode } = use(params);

  const router = useRouter();

  const [quizInfo, setQuizInfo] = useState<QuizPackage | null>(null);

  const [registrationNo, setRegistrationNo] = useState("");

  const [availabilityStatus, setAvailabilityStatus] =
    useState<AvailabilityStatus | null>(null);

  const [mounted, setMounted] = useState(false);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const cleanCode = String(testcode || "")
      .trim()

      .toUpperCase();

    if (!cleanCode) {
      setAvailabilityStatus("NOT_FOUND");

      setError("Assessment code is missing.");

      setLoading(false);

      return;
    }

    const token = getClientAuthToken();

    if (!token) {
      router.push(
        `/login?role=student&redirect=/join/${encodeURIComponent(cleanCode)}`,
      );

      return;
    }

    try {
      const storedUser = JSON.parse(
        localStorage.getItem("dynoquizz_user") || "{}",
      );

      const storedRegistration =
        storedUser?.registrationNo ||
        localStorage.getItem("dynoquizz_regNo") ||
        sessionStorage.getItem("dynoquizz_student_reg") ||
        "";

      if (storedRegistration) {
        setRegistrationNo(String(storedRegistration).toUpperCase());
      }
    } catch {
      // Ignore malformed local user data.
    }

    let cancelled = false;

    const loadAssessment = async () => {
      try {
        setLoading(true);

        setError(null);

        setAvailabilityStatus(null);

        const headers = {
          Authorization: `Bearer ${token}`,

          "Content-Type": "application/json",
        };

        // First use the backend's availability endpoint. It is the

        // authoritative check for published state and exam window.

        const availabilityRes = await fetch(
          ENDPOINTS.student.availability(cleanCode),

          {
            method: "GET",

            headers,

            cache: "no-store",
          },
        );

        const availability: AvailabilityResponse = await availabilityRes

          .json()

          .catch(() => ({}));

        if (!availabilityRes.ok) {
          throw new Error(
            `Unable to check assessment availability (${availabilityRes.status}).`,
          );
        }

        const status = availability.status as AvailabilityStatus | undefined;

        if (cancelled) return;

        setAvailabilityStatus(status ?? null);

        if (status !== "LIVE" || availability.available !== true) {
          switch (status) {
            case "NOT_STARTED":
              setError(
                availability.startTime
                  ? `This assessment has not started yet. It starts at ${formatStartTime(
                      availability.startTime,
                    )}.`
                  : "This assessment has not started yet.",
              );

              break;

            case "ENDED":
              setError("This assessment has already ended.");

              break;

            case "NOT_PUBLISHED":
              setError(
                "This assessment is not open yet. Ask your teacher to publish it.",
              );

              break;

            case "NOT_FOUND":
              setError(`Assessment session code "${cleanCode}" was not found.`);

              break;

            default:
              setError("This assessment is not currently available.");
          }

          setQuizInfo(null);

          return;
        }

        // The package endpoint is used only after the availability check says

        // the assessment is live. No mock/default package is created.

        const packageRes = await fetch(
          ENDPOINTS.student.quizPackageByCode(cleanCode),

          {
            method: "GET",

            headers,

            cache: "no-store",
          },
        );

        const packageData: QuizPackage = await packageRes

          .json()

          .catch(() => ({}));

        if (!packageRes.ok) {
          throw new Error(
            (packageData as any)?.message ||
              (packageData as any)?.error ||
              `Unable to load assessment details (${packageRes.status}).`,
          );
        }

        if (cancelled) return;

        setQuizInfo(packageData);
      } catch (e: any) {
        if (cancelled) return;

        console.error("Failed to load assessment:", e);

        setQuizInfo(null);

        setAvailabilityStatus(null);

        setError(
          e?.message ||
            "Could not connect to the assessment server. Please try again.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [testcode, router]);

  const handleStartExam = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanCode = String(testcode || "")
      .trim()

      .toUpperCase();

    if (availabilityStatus !== "LIVE") {
      setError("This assessment is not currently live.");

      return;
    }

    const cleanReg = registrationNo.trim().toUpperCase();

    if (!cleanReg) {
      setError("Please enter your registered roll / registration number.");

      return;
    }

    const token = getClientAuthToken();

    if (!token) {
      router.push(
        `/login?role=student&redirect=/join/${encodeURIComponent(cleanCode)}`,
      );

      return;
    }

    setSubmitting(true);

    setError(null);

    try {
      /**

 * The current backend identifies the student from the JWT.

 * The registration number is therefore only a local confirmation

 * field; it is NOT sent as a request body to startAttempt.

 */

      const storedUser = JSON.parse(
        localStorage.getItem("dynoquizz_user") || "{}",
      );

      const accountRegistration =
        storedUser?.registrationNo ||
        localStorage.getItem("dynoquizz_regNo") ||
        "";

      if (
        accountRegistration &&
        String(accountRegistration).trim().toUpperCase() !== cleanReg
      ) {
        throw new Error(
          "The registration number does not match the registration number linked to your account.",
        );
      }

      localStorage.setItem("dynoquizz_regNo", cleanReg);

      sessionStorage.setItem("dynoquizz_student_reg", cleanReg);

      /**

 * Always let the backend create/resume the authenticated student's

 * attempt. Do not trust a browser-cached attempt ID.

 */

      const attemptRes = await fetch(
        ENDPOINTS.student.startAttempt(cleanCode),

        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,

            "Content-Type": "application/json",
          },

          cache: "no-store",
        },
      );

      const attemptData = await attemptRes.json().catch(() => ({}));

      if (!attemptRes.ok) {
        const code = String(attemptData?.error ?? "").toUpperCase();

        const message = String(
          attemptData?.message ?? attemptData?.error ?? "",
        );

        if (
          attemptRes.status === 409 &&
          (code === "ATTEMPT_ALREADY_SUBMITTED" || code === "ALREADY_ATTEMPTED")
        ) {
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
          throw new Error("Your account is not eligible for this assessment.");
        }

        if (attemptRes.status === 403) {
          throw new Error(
            message || "You are not authorized to take this assessment.",
          );
        }

        throw new Error(
          message || "Failed to initialize the assessment attempt.",
        );
      }

      if (!attemptData.attemptId) {
        throw new Error("The server did not return an assessment attempt ID.");
      }

      const attemptId = String(attemptData.attemptId);

      localStorage.setItem("dynoquizz_attemptId", attemptId);

      localStorage.setItem(`dynoquizz_attemptId_${cleanCode}`, attemptId);

      localStorage.setItem(
        `dynoquizz_attemptTiming_${attemptId}`,

        JSON.stringify({
          attemptId,

          startedAt: attemptData.startedAt ?? null,

          submittedAt: attemptData.submittedAt ?? null,

          status: attemptData.status ?? null,

          currentQuestion: attemptData.currentQuestion ?? null,

          totalTimeTaken: attemptData.totalTimeTaken ?? null,
        }),
      );

      // The lobby is responsible for the final attempt/package initialization

      // flow and will resume this same server-side attempt safely.

      router.push(`/test/${cleanCode}/lobby`);
    } catch (err: any) {
      console.error("Failed to start assessment:", err);

      setError(
        err?.message ||
          "Could not start the assessment. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans">
        <div className="flex items-center gap-2 text-xs font-bold text-steel-blue-gray">
          <Loader2 className="h-4 w-4 animate-spin text-signal-green" />
          Loading assessment details...
        </div>
      </main>
    );
  }

  const title = quizInfo?.title || "Assessment Session";

  const timeLimitMins = Math.floor((quizInfo?.overallTimerSeconds || 0) / 60);

  const totalQuestions =
    quizInfo?.totalQuestions ??
    (Array.isArray(quizInfo?.questions) ? quizInfo.questions.length : 0);

  if (!quizInfo || availabilityStatus !== "LIVE") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-md rounded-[16px] bg-paper-white p-7 text-center border border-mist-blue/70 shadow-xl"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-pastel-pink/30 text-pastel-pink-text shadow-xs">
            <AlertCircle className="h-6 w-6" />
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray">
            Assessment Unavailable
          </span>

          <h1 className="mt-1 text-xl font-extrabold text-midnight-navy">
            {testcode.toUpperCase()}
          </h1>

          <p className="mt-2 text-xs text-steel-blue-gray leading-relaxed font-medium">
            {error || "This assessment is not currently available."}
          </p>

          <Link
            href="/join"
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-midnight-navy px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 active:scale-[0.98] shadow-sm transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Join Gateway
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-xl rounded-[16px] bg-paper-white p-6 md:p-8 border border-mist-blue/70 shadow-xl text-left"
      >
        <Link
          href="/join"
          className="inline-flex items-center text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors mb-5 group"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Change Access Code
        </Link>

        <div className="mb-5 text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-pastel-mint text-pastel-mint-text px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2 shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text" />
            Assessment Found
          </span>

          <h1 className="text-xl font-bold tracking-tight text-midnight-navy mb-0.5">
            {testcode.toUpperCase()} — {title}
          </h1>

          <p className="text-xs text-steel-blue-gray font-medium">
            Confirm your registration number below before entering the
            assessment lobby.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 text-left">
          <div className="rounded-[12px] border border-mist-blue/70 bg-paper-white p-3.5 flex items-center gap-3 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-frost-surface text-signal-green border border-mist-blue/30 shadow-xs">
              <Clock className="h-4 w-4" />
            </div>

            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">
                Time Limit
              </p>

              <p className="font-bold text-midnight-navy text-xs">
                {timeLimitMins} Minutes
              </p>
            </div>
          </div>

          <div className="rounded-[12px] border border-mist-blue/70 bg-paper-white p-3.5 flex items-center gap-3 shadow-xs">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-pastel-mint text-pastel-mint-text border border-mist-blue/35 shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </div>

            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">
                Questions
              </p>

              <p className="font-bold text-midnight-navy text-xs">
                {totalQuestions} Questions
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleStartExam} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
              Student Registration / Roll Number
            </label>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-steel-blue-gray">
                <UserCheck className="h-4 w-4" />
              </div>

              <input
                type="text"
                value={registrationNo}
                onChange={(event) => {
                  setRegistrationNo(event.target.value.toUpperCase());

                  setError(null);
                }}
                placeholder="e.g. 21BCE1024"
                maxLength={30}
                className="w-full rounded-[10px] border border-mist-blue/80 bg-frost-surface py-3 pl-9 pr-3 text-xs font-bold text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15 uppercase shadow-xs"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-pastel-pink-text font-bold mt-1">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-signal-green px-4 py-3 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-sm shadow-signal-green/25 hover:shadow-md cursor-pointer border-0 disabled:opacity-50"
          >
            {submitting ? "Launching..." : "Continue to Assessment Lobby"}

            <PlayCircle className="h-4 w-4 text-white" />
          </button>
        </form>
      </motion.div>
    </main>
  );
}
