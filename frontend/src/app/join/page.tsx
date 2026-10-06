"use client";

// join/page.tsx

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  Loader2,
} from "lucide-react";

import { ApiClientError, api, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { QuizAvailabilityResponse } from "@/lib/types";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCode = searchParams.get("code") || "";

  const [testCode, setTestCode] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (queryCode) {
      setTestCode(queryCode.toUpperCase());
    }

    if (typeof window !== "undefined") {
      const token = getAuthToken();

      if (!token) {
        router.push(
          `/login?role=student&redirect=/join${
            queryCode ? `?code=${encodeURIComponent(queryCode)}` : ""
          }`,
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
    }
  }, [queryCode, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = testCode.trim().toUpperCase();
    const cleanReg = registrationNo.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 2) {
      setError("Please enter a valid assessment code.");
      return;
    }

    if (!cleanReg) {
      setError("Please enter your Student Registration / Roll Number.");
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.push(
        `/login?role=student&redirect=/join${
          cleanCode ? `?code=${encodeURIComponent(cleanCode)}` : ""
        }`,
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      /*
       * The backend identifies the student from the authenticated JWT.
       * The registration number entered here is only a local confirmation;
       * eligibility/whitelist enforcement happens later in startAttempt.
       */
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
        String(accountRegistration).trim().toUpperCase() !== cleanReg
      ) {
        setError(
          "The registration number does not match the registration number linked to your account.",
        );
        return;
      }

      localStorage.setItem("dynoquizz_regNo", cleanReg);
      sessionStorage.setItem("dynoquizz_student_reg", cleanReg);

      /*
       * Availability is authoritative on the backend.
       *
       * The endpoint returns HTTP 200 with a typed status:
       * NOT_FOUND, NOT_PUBLISHED, NOT_STARTED, LIVE, or ENDED.
       */
      const availability = await api.get<QuizAvailabilityResponse>(
        ENDPOINTS.student.availability(cleanCode),
      );

      switch (availability.status) {
        case "NOT_FOUND":
          setError(
            `Assessment session code "${cleanCode}" was not found or is not available.`,
          );
          return;

        case "NOT_PUBLISHED":
          setError(
            "This assessment is not open yet. Ask your teacher to publish it.",
          );
          return;

        case "NOT_STARTED":
          setError(
            availability.startTime
              ? `This assessment has not started yet. It starts at ${formatStartTime(
                  availability.startTime,
                )}.`
              : "This assessment has not started yet.",
          );
          return;

        case "ENDED":
          setError("This assessment has already ended.");
          return;

        case "LIVE":
          if (availability.available !== true) {
            setError("This assessment is not currently available.");
            return;
          }
          break;

        default:
          setError("The assessment availability could not be determined.");
          return;
      }

      router.push(`/test/${encodeURIComponent(cleanCode)}/lobby`);
    } catch (err) {
      console.error("Join validation error:", err);

      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          router.push(
            `/login?role=student&redirect=/join?code=${encodeURIComponent(
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
            "Could not connect to the assessment server. Please try again.",
        );
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while connecting to the assessment server. Please check your network.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
          Assessment Access Code
        </label>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-steel-blue-gray/70">
            <KeyRound className="h-4 w-4" />
          </div>

          <input
            type="text"
            value={testCode}
            onChange={(e) => {
              setTestCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. 849201"
            maxLength={10}
            className="w-full rounded-[10px] border border-mist-blue/80 bg-frost-surface py-3.5 pl-10 pr-3 text-center font-mono text-xl font-black tracking-[0.2em] text-midnight-navy outline-none transition-all placeholder:font-sans placeholder:text-xs placeholder:font-medium placeholder:tracking-normal placeholder:text-steel-blue-gray/50 hover:border-mist-blue focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15 shadow-xs"
            required
          />
        </div>

        <p className="text-[10.5px] text-steel-blue-gray/80 font-medium pl-0.5">
          Provided by your instructor for this session
        </p>
      </div>

      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
          Student Registration / Roll Number
        </label>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-steel-blue-gray/70">
            <UserCheck className="h-4 w-4" />
          </div>

          <input
            type="text"
            value={registrationNo}
            onChange={(e) => {
              setRegistrationNo(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. 21BCE1024"
            maxLength={30}
            className="w-full rounded-[10px] border border-mist-blue/80 bg-frost-surface py-3 pl-10 pr-3 text-xs font-bold uppercase text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/50 hover:border-mist-blue focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15 shadow-xs"
            required
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] border border-pastel-pink-text/25 bg-pastel-pink/20 p-3 text-left shadow-xs"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-px text-pastel-pink-text" />

          <p className="text-xs font-bold leading-relaxed text-pastel-pink-text">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group flex w-full items-center justify-center gap-2 rounded-[10px] bg-signal-green px-4 py-3 text-xs font-bold text-white shadow-sm shadow-signal-green/25 transition-all duration-200 hover:bg-signal-green/90 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none cursor-pointer border-0"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking Assessment...
          </>
        ) : (
          <>
            Join Assessment
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}

function formatStartTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function JoinPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(22,93,251,0.06), transparent 55%)",
        }}
      />

      <span className="absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold tracking-tight text-midnight-navy shadow-xs ring-1 ring-black/5 backdrop-blur">
        Quizly
      </span>

      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-[16px] bg-paper-white p-6 md:p-8 border border-mist-blue/70 shadow-xl text-left"
      >
        <div className="flex justify-start mb-6 text-left">
          <Link
            href="/dashboard/student"
            className="group inline-flex items-center text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />{" "}
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-7 flex flex-col items-center justify-center text-center">
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-signal-green/25 blur-lg animate-pulse"
            />

            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-signal-green to-[#0e7a53] text-white shadow-md shadow-signal-green/30 ring-1 ring-signal-green/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider text-signal-green block mb-1.5">
            Student Gate
          </span>

          <h1 className="text-2xl font-extrabold tracking-tight text-midnight-navy">
            Join Assessment
          </h1>

          <p className="mt-1.5 max-w-xs text-xs text-steel-blue-gray leading-relaxed font-medium">
            Enter the test code provided by your instructor to begin identity
            verification.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-2 text-xs text-steel-blue-gray font-medium text-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading code entry...
            </div>
          }
        >
          <JoinForm />
        </Suspense>
      </motion.div>
    </main>
  );
}
