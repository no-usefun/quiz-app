"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  UserCheck,
  KeyRound,
  CheckCircle2,
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const token = getClientAuthToken();
      if (!token) {
        router.push(`/login?role=student&redirect=/test/${testCode}/verify`);
        return;
      }
      const stored = localStorage.getItem("dynoquizz_regNo");
      if (stored) setRegistrationNo(stored);
    }
  }, [router, testCode]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNo.trim()) {
      setError("Please enter your student registration number.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cleanCode = (sessionCode || testCode).toUpperCase();
      const cleanReg = registrationNo.trim().toUpperCase();
      localStorage.setItem("dynoquizz_regNo", cleanReg);
      sessionStorage.setItem("dynoquizz_student_reg", cleanReg);

      router.push(`/test/${cleanCode}`);
    } catch (err) {
      console.error("Verification error:", err);
      router.push(`/test/${testCode}`);
    } finally {
      setSubmitting(false);
    }
  };

  const primaryBtn =
    "flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green hover:bg-signal-green/90 py-3 text-xs font-semibold text-white active:scale-[0.98] transition-all duration-200 shadow-none disabled:opacity-40 cursor-pointer border-0";

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl relative overflow-hidden text-left"
      >
        <div className="mb-5 flex items-center justify-between border-b border-mist-blue/30 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-nav bg-signal-green text-white shadow-none">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-bold tracking-tight text-midnight-navy">
              Candidate Verification
            </span>
          </div>
          <span className="text-[10px] font-bold text-steel-blue-gray bg-frost-surface px-2.5 py-0.5 rounded-pills border border-mist-blue/30 font-mono">
            {testCode.toUpperCase()}
          </span>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="text-center mb-4">
            <h2 className="text-sm font-bold text-midnight-navy">
              Enter Examination Credentials
            </h2>
            <p className="mt-0.5 text-xs text-steel-blue-gray leading-relaxed font-medium">
              Confirm your registration number and access code to proceed into
              the assessment lobby.
            </p>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
              Session Access Code
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-steel-blue-gray">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3 pl-9 pr-3 text-xs font-bold text-midnight-navy outline-none font-mono tracking-widest uppercase"
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
                  setRegistrationNo(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 21BCE1024"
                className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3 pl-9 pr-3 text-xs font-bold text-midnight-navy outline-none uppercase placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20"
                required
              />
            </div>
            {error && (
              <p className="text-xs text-pastel-pink-text font-bold mt-1">
                {error}
              </p>
            )}
          </div>

          <button type="submit" disabled={submitting} className={primaryBtn}>
            {submitting ? "Verifying..." : "Continue to Lobby"}{" "}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </motion.div>
    </main>
  );
}
