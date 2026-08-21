"use client";

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
} from "lucide-react";

import { getTestByCode } from "@/lib/storage";

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
      const token = getClientAuthToken();
      if (!token) {
        router.push(
          `/login?role=student&redirect=/join${queryCode ? `?code=${queryCode}` : ""}`,
        );
        return;
      }
      const stored = localStorage.getItem("dynoquizz_regNo");
      if (stored) setRegistrationNo(stored);
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

    setLoading(true);
    setError(null);

    try {
      // 1. Verify existence of the assessment either locally or on backend
      const localTest = getTestByCode(cleanCode);
      let backendPackage: any = null;

      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(`${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          backendPackage = await res.json();
        }
      } catch {
        // Backend offline fallback
      }

      if (!localTest && !backendPackage) {
        setError(`Assessment session code "${cleanCode}" was not found. Please verify the code.`);
        setLoading(false);
        return;
      }

      // 2. Validate against Whitelist if configured
      let allowedList = localTest?.allowedRegistrationNumbers;
      if (!allowedList || allowedList.length === 0) {
        if (backendPackage?.allowedRegistrationNumbers && Array.isArray(backendPackage.allowedRegistrationNumbers)) {
          allowedList = backendPackage.allowedRegistrationNumbers;
        }
      }

      if (allowedList && allowedList.length > 0) {
        const isAuthorized = allowedList.some(
          (r: string) => r.toUpperCase() === cleanReg,
        );
        if (!isAuthorized) {
          setError(
            `Registration number "${cleanReg}" is not authorized for assessment session ${cleanCode}. Please contact your instructor.`,
          );
          setLoading(false);
          return;
        }
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("dynoquizz_regNo", cleanReg);
        sessionStorage.setItem("dynoquizz_student_reg", cleanReg);
      }

      router.push(`/test/${cleanCode}`);
    } catch {
      setError("An error occurred while validating the assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
          Enter Test Access Code
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-steel-blue-gray">
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
            className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3 pl-9 pr-3 text-center font-mono text-lg font-black tracking-widest text-midnight-navy outline-none transition-all placeholder:font-sans placeholder:text-xs placeholder:tracking-normal placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20"
            required
          />
        </div>
      </div>

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
              setRegistrationNo(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. 21BCE1024"
            maxLength={20}
            className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-2.5 pl-9 pr-3 text-xs font-bold uppercase text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20"
            required
          />
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-pastel-pink-text mt-1 font-bold">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green px-4 py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0 disabled:opacity-50"
      >
        {loading ? "Launching Assessment..." : "Start Assessment"}{" "}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

export default function JoinPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl text-left"
      >
        <div className="flex justify-start mb-4 text-left">
          <Link
            href="/dashboard/student"
            className="inline-flex items-center text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Dashboard
          </Link>
        </div>

        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg bg-signal-green text-white shadow-xl">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-signal-green block mb-1">
            Student Gate
          </span>
          <h1 className="text-xl font-bold tracking-tight text-midnight-navy">
            Join Assessment
          </h1>
          <p className="mt-1 text-xs text-steel-blue-gray leading-relaxed font-medium">
            Enter the test code provided by your instructor to begin identity
            verification.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-xs text-steel-blue-gray font-medium">
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
