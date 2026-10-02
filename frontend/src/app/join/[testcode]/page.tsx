"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PlayCircle,
  Clock,
  CalendarClock,
  ArrowLeft,
  UserCheck,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { ApiClientError, api, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { QuizAvailabilityResponse } from "@/lib/types";

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

type TestLandingPageProps = {
  params: Promise<{ testcode: string }>;
};

export default function TestLandingPage({ params }: TestLandingPageProps) {
  const { testcode } = use(params);

  const router = useRouter();

  const cleanCode = String(testcode || "")
    .trim()
    .toUpperCase();

  const [availability, setAvailability] =
    useState<QuizAvailabilityResponse | null>(null);

  const [registrationNo, setRegistrationNo] = useState("");

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!cleanCode) {
      setAvailability({
        quizCode: "",
        available: false,
        status: "NOT_FOUND",
        startTime: null,
        endTime: null,
      });
      setError("Assessment code is missing.");
      setLoading(false);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(
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
      // Ignore malformed cached user data.
    }

    let cancelled = false;

    const loadAvailability = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get<QuizAvailabilityResponse>(
          ENDPOINTS.student.availability(cleanCode),
        );

        if (cancelled) return;

        setAvailability(response);

        switch (response.status) {
          case "LIVE":
            if (response.available !== true) {
              setError("This assessment is not currently available.");
            }
            break;

          case "NOT_STARTED":
            setError(
              response.startTime
                ? `This assessment has not started yet. It starts at ${formatDateTime(
                    response.startTime,
                  )}.`
                : "This assessment has not started yet.",
            );
            break;

          case "NOT_PUBLISHED":
            setError(
              "This assessment is not open yet. Ask your instructor to publish it.",
            );
            break;

          case "ENDED":
            setError("This assessment has already ended.");
            break;

          case "NOT_FOUND":
            setError(`Assessment session code "${cleanCode}" was not found.`);
            break;

          default:
            setError("This assessment is not currently available.");
        }
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load assessment availability:", err);

        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            router.replace(
              `/login?role=student&redirect=/join/${encodeURIComponent(
                cleanCode,
              )}`,
            );
            return;
          }

          if (err.status === 403) {
            setError("You are not authorized to access this assessment.");
            return;
          }

          setError(
            err.message ||
              "Could not check assessment availability. Please try again.",
          );
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Could not check assessment availability. Please try again.",
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
  }, [cleanCode, router]);

  const handleContinue = (event: React.FormEvent) => {
    event.preventDefault();

    if (availability?.status !== "LIVE" || availability.available !== true) {
      setError("This assessment is not currently live.");
      return;
    }

    const cleanRegistrationNo = registrationNo.trim().toUpperCase();

    if (!cleanRegistrationNo) {
      setError("Please enter your registered roll / registration number.");
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(
        `/login?role=student&redirect=/join/${encodeURIComponent(cleanCode)}`,
      );
      return;
    }

    localStorage.setItem("dynoquizz_regNo", cleanRegistrationNo);
    sessionStorage.setItem("dynoquizz_student_reg", cleanRegistrationNo);

    setSubmitting(true);
    setError(null);

    /*
     * Do not create the attempt here.
     *
     * The backend flow is:
     * 1. availability check
     * 2. lobby
     * 3. POST /api/v1/student/quizzes/{quizCode}/attempts
     * 4. receive authoritative effectiveDeadline
     * 5. fetch the quiz package
     * 6. enter the exam arena
     *
     * The lobby owns steps 3-5 so an attempt is never created twice.
     */
    router.push(`/test/${encodeURIComponent(cleanCode)}/lobby`);
  };

  const isLive =
    availability?.status === "LIVE" && availability.available === true;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans">
        <div className="flex items-center gap-2 text-xs font-bold text-steel-blue-gray">
          <Loader2 className="h-4 w-4 animate-spin text-signal-green" />
          Checking assessment availability...
        </div>
      </main>
    );
  }

  if (!isLive) {
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
            {cleanCode || "UNKNOWN"}
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

        <div className="mb-6 text-left">
          <span className="inline-flex items-center gap-1 rounded-full bg-pastel-mint text-pastel-mint-text px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2 shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Assessment Found
          </span>

          <h1 className="text-xl font-bold tracking-tight text-midnight-navy">
            {cleanCode}
          </h1>

          <p className="mt-1 text-xs text-steel-blue-gray font-medium leading-relaxed">
            The assessment is live. Confirm your registration number and
            continue to the secure lobby.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-left">
          <div className="rounded-[12px] border border-mist-blue/70 bg-paper-white p-3.5 flex items-center gap-3 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-frost-surface text-signal-green border border-mist-blue/30 shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>

            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">
                Status
              </p>

              <p className="mt-0.5 font-bold text-midnight-navy text-xs">
                LIVE
              </p>
            </div>
          </div>

          <div className="rounded-[12px] border border-mist-blue/70 bg-paper-white p-3.5 flex items-center gap-3 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-frost-surface text-signal-green border border-mist-blue/30 shadow-xs">
              <Clock className="h-4 w-4" />
            </div>

            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">
                Ends
              </p>

              <p className="mt-0.5 font-bold text-midnight-navy text-xs">
                {availability?.endTime
                  ? formatDateTime(availability.endTime)
                  : "Not specified"}
              </p>
            </div>
          </div>

          <div className="rounded-[12px] border border-mist-blue/70 bg-paper-white p-3.5 flex items-center gap-3 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-frost-surface text-signal-green border border-mist-blue/30 shadow-xs">
              <CalendarClock className="h-4 w-4" />
            </div>

            <div>
              <p className="text-[10px] text-steel-blue-gray font-medium">
                Window
              </p>

              <p className="mt-0.5 font-bold text-midnight-navy text-xs">
                {availability?.startTime
                  ? formatDateTime(availability.startTime)
                  : "Open now"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleContinue} className="space-y-4">
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
              <p className="mt-1 text-xs font-bold text-pastel-pink-text">
                {error}
              </p>
            )}
          </div>

          <div className="rounded-[12px] border border-mist-blue/70 bg-frost-surface/70 p-4 text-xs text-steel-blue-gray leading-relaxed font-medium">
            <div className="flex items-center gap-2 font-bold text-midnight-navy mb-1.5">
              <ShieldCheck className="h-4 w-4 text-signal-green" />
              Secure flow
            </div>

            <p>
              This step only verifies that the assessment is currently live. The
              secure attempt and authoritative quiz package are initialized from
              the lobby.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-signal-green px-4 py-3 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-sm shadow-signal-green/25 hover:shadow-md cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Opening Lobby..." : "Continue to Assessment Lobby"}

            <PlayCircle className="h-4 w-4 text-white" />
          </button>
        </form>
      </motion.div>
    </main>
  );
}
