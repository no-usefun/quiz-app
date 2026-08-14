"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCode = searchParams.get("code") || "";

  const [testCode, setTestCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (queryCode) {
      setTestCode(queryCode.toUpperCase());
    }
  }, [queryCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = testCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setError("Please enter a valid test code.");
      return;
    }
    router.push(`/test/${cleanCode}/verify`);
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
            placeholder="e.g. CS-101"
            maxLength={10}
            className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3 pl-9 pr-3 text-center font-mono text-lg font-black tracking-widest text-midnight-navy outline-none transition-all placeholder:font-sans placeholder:text-xs placeholder:tracking-normal placeholder:text-steel-blue-gray/60 focus:border-signal-green focus:ring-2 focus:ring-signal-green/20"
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
        className="flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green px-4 py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-none cursor-pointer border-0"
      >
        Validate &amp; Proceed <ArrowRight className="h-4 w-4" />
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
            Enter the test code provided by your instructor to begin identity verification.
          </p>
        </div>

        <Suspense fallback={<div className="text-xs text-steel-blue-gray font-medium">Loading code entry...</div>}>
          <JoinForm />
        </Suspense>
      </motion.div>
    </main>
  );
}
