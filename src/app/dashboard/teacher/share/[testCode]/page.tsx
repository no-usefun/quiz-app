"use client";

import { use, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Copy, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function ShareAssessmentPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const [copied, setCopied] = useState(false);

  const shareLink = `http://localhost:3000/join?code=${testCode}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-850 p-4 font-sans selection:bg-blue-105 selection:text-blue-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 text-center border border-slate-200 shadow-xs"
      >
        <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
          Package Ready
        </span>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Assessment Published!</h1>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed font-medium">
          Share this test code or link with your students so they can download the secure assessment package.
        </p>

        {/* Real QR Code Image Card */}
        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl bg-white p-2.5 shadow-xs border border-slate-200 mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrApiUrl}
            alt={`QR Code for ${testCode}`}
            className="h-full w-full object-contain rounded-lg"
          />
        </div>

        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            6-Character Access Code
          </label>
          <div className="text-3xl font-black tracking-widest text-slate-905 font-mono">
            {testCode}
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={copyToClipboard}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all border ${
              copied
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {copied ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Link Copied!</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copy Shareable Link</>
            )}
          </button>

          <Link
            href={`/dashboard/teacher/live/${testCode}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
          >
            Open Live Proctoring Monitor <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
