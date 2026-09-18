"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  PlayCircle,
  Clock,
  CheckCircle2,
  ArrowLeft,
  UserCheck,
} from "lucide-react";

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
  if (localStorage.getItem("dynoquizz_user")) return "session_active";
  return null;
}

export default function TestLandingPage({
  params,
}: {
  params: Promise<{ testcode: string }>;
}) {
  const { testcode } = use(params);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [quizInfo, setQuizInfo] = useState<any>(null);
  const [registrationNo, setRegistrationNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const token = getClientAuthToken();
      if (!token) {
        router.push(`/login?role=student&redirect=/join/${testcode}`);
        return;
      }
    }
    const fetchQuizDetails = async () => {
      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(
          `${API_BASE}/api/v1/quizzes/code/${testcode}/package`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          setQuizInfo(data);
        } else {
          setQuizInfo({
            title: "Proctored Assessment Session",
            overallTimerSeconds: 3600,
            totalQuestions: 20,
          });
        }
      } catch (e) {
        console.warn("Backend offline — using default session package info.");
        setQuizInfo({
          title: "Proctored Assessment Session",
          overallTimerSeconds: 3600,
          totalQuestions: 20,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchQuizDetails();
  }, [testcode, router]);

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNo.trim()) {
      setError("Please enter your registered roll / registration number.");
      return;
    }

    const cleanCode = testcode.trim().toUpperCase();
    const cleanReg = registrationNo.trim().toUpperCase();

    // Check whitelist if configured
    if (quizInfo?.allowedRegistrationNumbers && Array.isArray(quizInfo.allowedRegistrationNumbers) && quizInfo.allowedRegistrationNumbers.length > 0) {
      const isAuthorized = quizInfo.allowedRegistrationNumbers.some(
        (r: string) => r.toUpperCase() === cleanReg,
      );
      if (!isAuthorized) {
        setError(`Registration number "${cleanReg}" is not authorized for assessment session ${cleanCode}. Please contact your instructor.`);
        return;
      }
    }

    setSubmitting(true);
    localStorage.setItem("dynoquizz_regNo", cleanReg);
    sessionStorage.setItem("dynoquizz_student_reg", cleanReg);
    router.push(`/test/${cleanCode}`);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans">
        <div className="text-xs text-steel-blue-gray">
          Loading session details...
        </div>
      </main>
    );
  }

  const title = quizInfo?.title || quizInfo?.quizName || "Assessment Session";
  const timeLimitMins = Math.floor(
    (quizInfo?.overallTimerSeconds || 3600) / 60,
  );
  const totalQuestions =
    quizInfo?.totalQuestions || quizInfo?.questions?.length || 20;

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-xl rounded-cards bg-paper-white p-6 md:p-8 border border-mist-blue shadow-xl text-left"
      >
        <Link
          href="/join"
          className="inline-flex items-center text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors mb-5"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Change Access Code
        </Link>

        <div className="mb-5 text-left">
          <span className="inline-flex items-center gap-1 rounded-pills bg-pastel-mint text-pastel-mint-text px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-pastel-mint-text" />{" "}
            Assessment Found
          </span>
          <h1 className="text-xl font-bold tracking-tight text-midnight-navy mb-0.5">
            {testcode.toUpperCase()} — {title}
          </h1>
          <p className="text-xs text-steel-blue-gray font-medium">
            Enter your registration credentials below to begin your exam
            attempt.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 text-left">
          <div className="rounded-inputs border border-mist-blue bg-paper-white p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-inputs bg-frost-surface text-signal-green border border-mist-blue/30 shadow-none">
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
          <div className="rounded-inputs border border-mist-blue bg-paper-white p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-inputs bg-pastel-mint text-pastel-mint-text border border-mist-blue/35 shadow-none">
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
                onChange={(e) => {
                  setRegistrationNo(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 21BCE1024"
                className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3 pl-9 pr-3 text-xs font-bold text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20 uppercase"
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
            className="flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green px-4 py-3 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0 disabled:opacity-50"
          >
            {submitting ? "Launching..." : "Start Assessment"}{" "}
            <PlayCircle className="h-4 w-4 text-white" />
          </button>
        </form>
      </motion.div>
    </main>
  );
}
