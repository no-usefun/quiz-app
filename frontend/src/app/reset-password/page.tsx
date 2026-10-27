"use client";

import LoadingIndicator from "@/components/LoadingIndicator";
import SkeletonBlock from "@/components/SkeletonBlock";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ENDPOINTS } from "@/lib/api/endpoints";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(ENDPOINTS.auth.resetPassword, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token: token.trim(),
          newPassword: password,
        }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to reset your password.",
        );
      }

      setComplete(true);
      window.setTimeout(() => router.push("/login?role=student"), 1200);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reset your password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5f4] px-4 py-8 font-sans text-[#111111]">
      <div className="mx-auto max-w-md">
        <Link
          href="/login?role=student"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#78716b] hover:text-[#111111]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Login
        </Link>

        <section className="mt-5 rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#78716b]">
            Account Security
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Reset Password</h1>

          {complete ? (
            <div className="mt-5 flex items-start gap-2 rounded-[10px] border border-[#1d5237]/20 bg-[#e2ede8] p-3 text-xs font-semibold text-[#1d5237]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Password reset successfully. Returning to login...
            </div>
          ) : (
            <>
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#8c381c]/20 bg-[#fbeee8] p-3 text-xs font-semibold text-[#8c381c]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={submit} className="mt-5 space-y-4">
                <label className="block text-left">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                    Reset Token
                  </span>
                  <input
                    type="text"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="Paste your reset token"
                    className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] px-3 py-2.5 text-xs font-medium outline-none focus:border-[#165dfb]"
                  />
                </label>

                <label className="block text-left">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                    New Password
                  </span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716b]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] py-2.5 pl-9 pr-3 text-xs font-medium outline-none focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10"
                    />
                  </div>
                </label>

                <label className="block text-left">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                    Confirm Password
                  </span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] px-3 py-2.5 text-xs font-medium outline-none focus:border-[#165dfb]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <LoadingIndicator label="Updating password" size="sm" /> : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] px-4 py-8 font-sans dark:bg-slate-950">
          <section className="w-full max-w-md space-y-5 rounded-2xl border border-[#d1dee8]/70 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8" aria-busy="true">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#165dfb] dark:bg-slate-800 dark:text-blue-300"><Lock className="h-5 w-5" /></span><div className="flex-1 space-y-2"><SkeletonBlock className="h-5 w-36 rounded" /><SkeletonBlock className="h-3 w-52 max-w-full rounded" /></div></div>
            {[1, 2].map((field) => <div key={field} className="space-y-2"><SkeletonBlock className="h-3 w-24 rounded" /><SkeletonBlock className="h-11 w-full rounded-lg" /></div>)}
            <SkeletonBlock className="h-11 w-full rounded-lg" />
            <p className="sr-only" role="status">Loading password reset form</p>
          </section>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
