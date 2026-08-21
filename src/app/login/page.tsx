"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function isTokenValid(token: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Role derived directly from URL query param
  const qRole = searchParams?.get("role");
  const activeRole: "teacher" | "student" | null =
    qRole === "teacher" || qRole === "instructor" || qRole === "educator"
      ? "teacher"
      : qRole === "student" || qRole === "candidate"
        ? "student"
        : null;

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already authenticated
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("dynoquizz_token");
      const role = (localStorage.getItem("dynoquizz_role") || "").toUpperCase();
      if (token) {
        if (isTokenValid(token)) {
          const destination = role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
          const redirectTarget = searchParams?.get("redirect");
          window.location.href = redirectTarget || destination;
          return;
        } else {
          // Token expired: silently clear
          localStorage.removeItem("dynoquizz_token");
          localStorage.removeItem("dynoquizz_user");
          localStorage.removeItem("dynoquizz_role");
        }
      }
    }
  }, [searchParams]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRole) return;

    setError("");
    setLoading(true);

    const backendRole = activeRole === "teacher" ? "TEACHER" : "STUDENT";
    const fullName = email
      .split("@")[0]
      .split(".")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          role: backendRole,
          name: fullName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const returnedRole = (data.user?.role || data.role || backendRole).toUpperCase();
        if (typeof window !== "undefined") {
          const userObj = data.user || {
            email: email.trim(),
            role: returnedRole,
            name: data.user?.name || fullName,
          };
          localStorage.setItem("dynoquizz_role", returnedRole);
          localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
          if (data.token) {
            localStorage.setItem("dynoquizz_token", data.token);
            document.cookie = `dynoquizz_token=${data.token}; path=/; max-age=86400`;
          }
        }
        router.refresh();
        const redirectTarget = searchParams?.get("redirect");
        const destination = returnedRole === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
        window.location.href = redirectTarget || destination;
      } else {
        setError(data.error || "Invalid email or password.");
      }
    } catch {
      // Offline fallback
      const returnedRole = backendRole;
      if (typeof window !== "undefined") {
        localStorage.setItem("dynoquizz_role", returnedRole);
        localStorage.setItem(
          "dynoquizz_user",
          JSON.stringify({ email: email.trim(), role: returnedRole, name: fullName }),
        );
      }
      const redirectTarget = searchParams?.get("redirect");
      const destination = returnedRole === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
      window.location.href = redirectTarget || destination;
    } finally {
      setLoading(false);
    }
  };

  // ─── 1. SPLIT-SCREEN ROLE SELECTION (When no role is selected) ───────────────
  if (!activeRole) {
    return (
      <main className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 font-sans">
        {/* Left Half: Student Side */}
        <section className="flex flex-col items-center justify-center p-8 sm:p-16 bg-[#F9FAFB] text-center">
          <div className="w-full max-w-xs space-y-4">
            <div className="space-y-1.5">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827]">
                Student
              </h1>
              <p className="text-sm text-[#6B7280]">
                Take quizzes with an access code
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/login?role=student");
              }}
              className="w-full rounded-lg bg-[#111827] text-white py-3 px-5 text-sm font-medium hover:bg-black active:scale-[0.99] transition-all cursor-pointer shadow-none border-0"
            >
              Continue as Student
            </button>
          </div>
        </section>

        {/* Right Half: Instructor Side */}
        <section className="flex flex-col items-center justify-center p-8 sm:p-16 bg-[#0F172A] text-center border-t md:border-t-0 md:border-l border-neutral-800">
          <div className="w-full max-w-xs space-y-4">
            <div className="space-y-1.5">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Instructor
              </h1>
              <p className="text-sm text-[#94A3B8]">
                Create and manage quizzes
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/login?role=teacher");
              }}
              className="w-full rounded-lg bg-white text-[#0F172A] py-3 px-5 text-sm font-medium hover:bg-neutral-100 active:scale-[0.99] transition-all cursor-pointer shadow-none border-0"
            >
              Continue as Instructor
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ─── 2. MINIMAL SINGLE-COLUMN CREDENTIALS PAGE ──────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 bg-white text-[#111827] font-sans">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <button
            type="button"
            onClick={() => {
              setError("");
              router.push("/login");
            }}
            className="text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors mb-3 cursor-pointer bg-transparent border-0 p-0 inline-flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {activeRole === "teacher" ? "Log in as Instructor" : "Log in as Student"}
          </h1>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
              className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-700 block">
                Password
              </label>
              <span className="text-xs text-neutral-400 cursor-not-allowed">
                Forgot password?
              </span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neutral-900 py-2.5 px-4 text-sm font-medium text-white hover:bg-black active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer border-0 mt-2"
          >
            {loading ? "Signing in..." : "Log in"}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup?role=${activeRole}`}
            className="font-semibold text-neutral-900 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-xs text-neutral-400 font-medium">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

