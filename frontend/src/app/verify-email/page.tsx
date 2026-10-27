"use client";

import LoadingIndicator from "@/components/LoadingIndicator";
import SkeletonBlock from "@/components/SkeletonBlock";
import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, MailCheck, ArrowRight } from "lucide-react";
import { ENDPOINTS } from "@/lib/api/endpoints";

function VerifyEmailContent() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Query parameters are read after hydration to keep server/client rendering consistent.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client URL initialization
    setToken(params.get("token") || "");
    setLoading(false);
  }, []);

  const handleVerify = async () => {
    if (!token) {
      setError("Verification token is missing or invalid.");
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        ENDPOINTS.auth.verifyEmail + "?token=" + encodeURIComponent(token),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.message ||
            data?.error ||
            "The verification link is invalid or has expired.",
        );
      }

      setVerified(true);
      setMessage("Your email has been verified. You can now log in.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify your email.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Enter the email address used to create your account.");
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(ENDPOINTS.auth.resendVerification, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to resend the verification email.",
        );
      }

      setMessage("A new verification email has been requested.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to resend the verification email.",
      );
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-8 font-sans dark:bg-slate-950 sm:px-8" aria-busy="true" aria-label="Loading email verification">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
          <section className="w-full rounded-2xl border border-neutral-100 bg-white p-7 shadow-[0_18px_55px_-24px_rgba(15,23,42,0.25)] dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            <div className="mb-6"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 dark:bg-slate-800 dark:text-slate-100"><MailCheck className="h-5 w-5" /></div><SkeletonBlock className="h-5 w-44 rounded" /><SkeletonBlock className="mt-2 h-3 w-3/4 rounded" /></div>
            <div className="space-y-4"><SkeletonBlock className="h-10 w-full rounded-lg" /><SkeletonBlock className="h-10 w-full rounded-lg" /></div>
            <p className="sr-only" role="status">Loading email verification</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 font-sans text-neutral-900 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-2xl border border-neutral-100 bg-white p-7 shadow-[0_18px_55px_-24px_rgba(15,23,42,0.25)] sm:p-8">
          <div className="mb-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900">
              {verified ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <MailCheck className="h-5 w-5" />
              )}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
              DynoQuizz Authentication
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">
              Verify your email
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              Confirm the email address attached to your DynoQuizz account before signing in.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-lg border border-green-100 bg-green-50 p-3 text-sm font-medium text-green-700">
              {message}
            </div>
          )}

          {!verified && token && (
            <button
              type="button"
              onClick={() => void handleVerify()}
              disabled={verifying}
              className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? <LoadingIndicator label="Verifying email" size="sm" /> : "Verify Email"}
              {!verifying && <ArrowRight className="h-4 w-4" />}
            </button>
          )}

          <div className="border-t border-neutral-100 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">
              Resend verification email
            </p>

            <form onSubmit={handleResend} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white"
              />

              <button
                type="submit"
                disabled={resending}
                className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-all hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? <LoadingIndicator label="Sending verification email" size="sm" /> : "Resend Email"}
              </button>
            </form>
          </div>

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-sm font-bold text-neutral-900 hover:underline"
            >
              Return to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-neutral-50 px-4 py-8 font-sans dark:bg-slate-950"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center"><section className="w-full space-y-4 rounded-2xl border border-neutral-100 bg-white p-7 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><MailCheck className="h-5 w-5 text-[#165dfb] dark:text-blue-300" /><SkeletonBlock className="h-5 w-36 rounded" /></div><SkeletonBlock className="h-3 w-4/5 rounded" /><SkeletonBlock className="h-10 w-full rounded-lg" /></section></div></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
