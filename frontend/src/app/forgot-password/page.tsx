"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { APP_NAME } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSent(false);

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(ENDPOINTS.auth.forgotPassword, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: trimmed }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to request a password reset.",
        );
      }

      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to request a password reset.",
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
            {APP_NAME} Account Recovery
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Forgot Password</h1>
          <p className="mt-1 text-xs leading-relaxed text-[#78716b]">
            Enter your account email and the backend will send a password reset link.
          </p>

          {sent && (
            <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#1d5237]/20 bg-[#e2ede8] p-3 text-xs font-semibold text-[#1d5237]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                If the account is eligible, a reset link has been sent. Check your email.
              </span>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#8c381c]/20 bg-[#fbeee8] p-3 text-xs font-semibold text-[#8c381c]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-left">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                Email Address
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716b]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] py-2.5 pl-9 pr-3 text-xs font-medium outline-none focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
