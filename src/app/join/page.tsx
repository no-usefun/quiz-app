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
      setTimeout(() => setTestCode(queryCode.toUpperCase()), 0);
    }
  }, [queryCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = testCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setError("Please enter a valid 6-character test code.");
      return;
    }
    router.push(`/test/${cleanCode}/verify`);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Enter 6-Character Access Code
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
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
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-center font-mono text-lg font-black tracking-widest text-slate-900 outline-none transition-colors placeholder:font-sans placeholder:text-xs placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
            required
          />
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 font-medium">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
      >
        Validate &amp; Proceed <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

export default function JoinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-850 p-4 font-sans selection:bg-blue-100 selection:text-blue-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 text-center border border-slate-200 shadow-xs"
      >
        <div className="flex justify-start mb-4">
          <Link
            href="/dashboard/student"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Dashboard
          </Link>
        </div>

        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
            Student Gate
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Join Assessment
          </h1>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed font-medium">
            Enter the test code provided by your instructor to begin identity verification.
          </p>
        </div>

        <Suspense fallback={<div className="text-xs text-slate-500 font-medium">Loading code entry...</div>}>
          <JoinForm />
        </Suspense>
      </motion.div>
    </main>
  );
}
