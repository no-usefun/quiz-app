"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  UserCheck,
  KeyRound,
  AlertCircle,
  Loader2,
  Download,
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

export default function IdentityVerificationPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  const [registrationNo, setRegistrationNo] = useState("");
  const [sessionCode, setSessionCode] = useState(testCode || "");
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const cleanCode = String(testCode || "")
      .trim()
      .toUpperCase();

    if (!cleanCode) {
      setError("Assessment access code is missing.");
      setLoadingSession(false);
      return;
    }

    const token = getClientAuthToken();

    if (!token) {
      router.push(
        `/login?role=student&redirect=/test/${encodeURIComponent(
          cleanCode,
        )}/verify`,
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

    const checkAvailability = async () => {
      try {
        setLoadingSession(true);
        setError(null);

        const availabilityRes = await fetch(
          ENDPOINTS.student.availability(cleanCode),
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          },
        );

        const data: AvailabilityResponse = await availabilityRes
          .json()
          .catch(() => ({}));

        if (!availabilityRes.ok) {
          throw new Error(
            `Unable to verify assessment (${availabilityRes.status}).`,
          );
        }

        if (cancelled) return;

        if (data.status !== "LIVE" || data.available !== true) {
          switch (data.status as AvailabilityStatus | undefined) {
            case "NOT_STARTED":
              setError(
                data.startTime
                  ? `This assessment has not started yet. It starts at ${formatStartTime(
                      data.startTime,
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
          return;
        }

        setSessionCode(cleanCode);
      } catch (err: any) {
        if (cancelled) return;

        console.error("Assessment verification failed:", err);
        setError(
          err?.message ||
            "Could not verify the assessment. Please check your connection and try again.",
        );
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    };

    void checkAvailability();

    return () => {
      cancelled = true;
    };
  }, [router, testCode]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanCode = sessionCode.trim().toUpperCase();
    const cleanReg = registrationNo.trim().toUpperCase();

    if (!cleanCode) {
      setError("Please enter the assessment access code.");
      return;
    }

    if (!cleanReg) {
      setError("Please enter your student registration number.");
      return;
    }

    const token = getClientAuthToken();

    if (!token) {
      router.push(
        `/login?role=student&redirect=/test/${encodeURIComponent(
          cleanCode,
        )}/verify`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      localStorage.setItem("dynoquizz_regNo", cleanReg);
      sessionStorage.setItem("dynoquizz_student_reg", cleanReg);

      /*
       * Canonical flow:
       * verify -> lobby -> POST /student/quizzes/{code}/attempts
       * -> store server attempt/deadline -> enter assessment.
       */
      router.push(`/test/${cleanCode}/lobby?reg=${encodeURIComponent(cleanReg)}`);
    } catch (err: any) {
      console.error("Identity verification error:", err);

      setError(
        err?.message ||
          "Could not verify your examination credentials. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const primaryBtn =
    "flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#165dfb] hover:bg-[#165dfb]/90 py-3 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0";

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans">
        <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
          <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
          Verifying assessment session...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans selection:bg-[#165dfb]/20">
      <motion.div
        initial={mounted ? { opacity: 0, y: 10 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg rounded-[20px] bg-white p-6 md:p-8 text-left border border-[#d1dee8]/80 shadow-2xl relative overflow-hidden"
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#d1dee8]/50 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#165dfb] text-white shadow-xs">
              {error ? (
                <AlertCircle className="h-4 w-4 text-white" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-white" />
              )}
            </div>

            <span className="text-xs font-bold tracking-tight text-[#111111]">
              Candidate Verification
            </span>
          </div>

          <span className="text-[10px] font-bold text-[#78716b] bg-[#f5f5f4] px-2.5 py-0.5 rounded-full border border-[#d1dee8]/60 font-mono shadow-xs">
            {sessionCode.toUpperCase()}
          </span>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-rose-300 bg-rose-50 p-3 text-left">
              <p className="text-xs font-bold leading-relaxed text-rose-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/join")}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#111111] px-4 py-3 text-xs font-bold text-white hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer border-0"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Return to Join Gateway
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-sm font-bold text-[#111111]">
                Enter Examination Credentials
              </h2>

              <p className="mt-0.5 text-xs text-[#78716b] leading-relaxed font-medium">
                Confirm your student registration number before entering the assessment lobby.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                Session Access Code
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <KeyRound className="h-4 w-4" />
                </div>

                <input
                  type="text"
                  value={sessionCode}
                  onChange={(event) =>
                    setSessionCode(event.target.value.toUpperCase())
                  }
                  className="w-full rounded-[10px] border border-[#d1dee8]/90 bg-[#f5f5f4] py-3 pl-9 pr-3 text-xs font-bold text-[#111111] outline-none font-mono tracking-widest uppercase focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/15 shadow-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                Student Registration / Roll Number
              </label>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <UserCheck className="h-4 w-4" />
                </div>

                <input
                  type="text"
                  value={registrationNo}
                  onChange={(event) => {
                    setRegistrationNo(event.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. 23BCE8830"
                  maxLength={30}
                  className="w-full rounded-[10px] border border-[#d1dee8]/90 bg-[#f5f5f4] py-3 pl-9 pr-3 text-xs font-bold text-[#111111] outline-none uppercase placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/15 shadow-xs"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className={primaryBtn}>
              {submitting ? "Verifying..." : "Continue to Lobby"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            {/* Extension Download Helper */}
            <div className="pt-2 border-t border-[#d1dee8]/40 text-center">
              <a
                href="/dynoquizz-proctor-shield.zip"
                download="dynoquizz-proctor-shield.zip"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#165dfb] hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download Proctor Shield Extension (.zip)
              </a>
            </div>
          </form>
        )}
      </motion.div>
    </main>
  );
}
