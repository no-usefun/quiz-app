"use client";

import { use, useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const shareLink = `http://localhost:3000/join?code=${testCode}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green">
      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 text-center border border-mist-blue shadow-xl space-y-5 text-left"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-inputs bg-frost-surface text-signal-green border border-mist-blue/30 shadow-none">
          <ShieldCheck className="h-5.5 w-5.5 text-signal-green" />
        </div>

        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-steel-blue-gray">
            Assessment Published
          </span>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-midnight-navy">
            Assessment Live!
          </h1>
          <p className="mt-0.5 text-xs text-steel-blue-gray font-medium">
            Share this invitation code or QR code with candidates.
          </p>
        </div>

        {/* QR Code & Center Code Container */}
        <div className="rounded-inputs border border-mist-blue bg-paper-white p-5 space-y-4 text-center">
          {/* Access Code Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-pills bg-frost-surface px-5 py-2 font-mono text-xl font-black tracking-widest text-signal-green border border-mist-blue/35 shadow-none">
            {testCode.toUpperCase()}
          </div>

          {/* Real QR Code Image Card */}
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-inputs bg-paper-white border border-mist-blue p-2.5 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrApiUrl}
              alt={`QR Code for ${testCode}`}
              className="h-full w-full object-contain rounded-lg"
            />
          </div>

          <p className="text-[10px] text-steel-blue-gray font-semibold leading-normal">
            Candidates can scan the QR code to auto-populate the join credentials.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={copyToClipboard}
            className="flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green py-2.5 text-xs font-bold text-white hover:bg-signal-green/90 active:scale-[0.98] transition-all duration-200 shadow-xl cursor-pointer border-0"
          >
            {copied ? (
              <><CheckCircle2 className="h-4.5 w-4.5 text-white" /> Link Copied</>
            ) : (
              <><Copy className="h-4.5 w-4.5 text-white" /> Copy Invitation Link</>
            )}
          </button>

          <Link
            href="/dashboard/teacher"
            className="flex w-full items-center justify-center gap-2 rounded-buttons border border-mist-blue bg-paper-white py-2.5 text-xs font-bold text-midnight-navy hover:bg-frost-surface active:scale-[0.98] transition-all duration-200 shadow-sm cursor-pointer"
          >
            <ArrowRight className="h-4.5 w-4.5 text-steel-blue-gray" /> Go to Dashboard
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
