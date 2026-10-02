"use client";

import { useState, useEffect, Suspense } from "react";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { Eye, EyeOff, ArrowLeft } from "lucide-react";

import { ENDPOINTS } from "@/lib/api/endpoints";

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

function clearStoredSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("dynoquizz_token");

  localStorage.removeItem("dynoquizz_user");

  localStorage.removeItem("dynoquizz_role");

  localStorage.removeItem("dynoquizz_attemptId");

  localStorage.removeItem("dynoquizz_regNo");

  document.cookie = "dynoquizz_token=; path=/; max-age=0; samesite=lax";
}

function getRoleDestination(role: string): string {
  return role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
}

function normalizeRole(role: unknown): "TEACHER" | "STUDENT" | null {
  const normalized = String(role ?? "")
    .trim()

    .toUpperCase();

  if (normalized === "TEACHER") return "TEACHER";

  if (normalized === "STUDENT") return "STUDENT";

  return null;
}

function LoginContent() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const qRole = searchParams?.get("role");

  const activeRole: "teacher" | "student" | null =
    qRole === "teacher" || qRole === "instructor" || qRole === "educator"
      ? "teacher"
      : qRole === "student" || qRole === "candidate"
        ? "student"
        : null;

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("dynoquizz_token");

    if (!token) return;

    if (!isTokenValid(token)) {
      clearStoredSession();

      return;
    }

    const redirectTarget = searchParams?.get("redirect");

    // Do not trust cached role as the authority for a live session.

    // Ask the backend for the canonical authenticated user profile.

    const validateExistingSession = async () => {
      try {
        const res = await fetch(ENDPOINTS.auth.me, {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,

            "Content-Type": "application/json",
          },

          cache: "no-store",
        });

        if (!res.ok) {
          clearStoredSession();

          return;
        }

        const user = await res.json();

        const role = normalizeRole(user?.role);

        if (!role) {
          clearStoredSession();

          return;
        }

        localStorage.setItem("dynoquizz_user", JSON.stringify(user));

        localStorage.setItem("dynoquizz_role", role);

        const destination = getRoleDestination(role);

        window.location.href = redirectTarget || destination;
      } catch {
        // Keep the login page available when the backend cannot be reached.
      }
    };

    void validateExistingSession();
  }, [searchParams]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeRole) return;

    setError("");

    const trimmedEmail = email.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address format.");

      return;
    }

    if (!password) {
      setError("Please enter your password.");

      return;
    }

    setLoading(true);

    try {
      // Backend LoginRequest requires email, password, and the requested role.

      const res = await fetch(ENDPOINTS.auth.login, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: trimmedEmail,
          password,
          role: activeRole === "teacher" ? "TEACHER" : "STUDENT",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data?.message ||
            data?.error ||
            (data?.code === "EMAIL_NOT_VERIFIED"
              ? "Please verify your email before logging in."
              : "Invalid email or password."),
        );

        return;
      }

      const token =
        typeof data?.token === "string" && data.token.length > 0
          ? data.token
          : typeof data?.accessToken === "string" && data.accessToken.length > 0
            ? data.accessToken
            : null;

      if (!token || !isTokenValid(token)) {
        setError("Login succeeded but no valid session token was returned.");

        return;
      }

      // The login response already contains UserSummaryResponse, but /me is

      // the canonical source for the authenticated user profile and role.

      let user = data?.user ?? null;

      try {
        const meRes = await fetch(ENDPOINTS.auth.me, {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,

            "Content-Type": "application/json",
          },

          cache: "no-store",
        });

        if (meRes.ok) {
          user = await meRes.json();
        }
      } catch {
        // Fall back to the user object returned by /login.
      }

      const backendRole = normalizeRole(user?.role);

      if (!backendRole) {
        clearStoredSession();

        setError("The backend returned an invalid user role.");

        return;
      }

      // The backend determines the actual account role.

      // The URL role is only the role the user selected on the login screen.

      const selectedRole = activeRole === "teacher" ? "TEACHER" : "STUDENT";

      if (backendRole !== selectedRole) {
        clearStoredSession();

        setError(
          `This account is registered as ${backendRole === "TEACHER" ? "Instructor" : "Student"}. Please use the corresponding login option.`,
        );

        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("dynoquizz_token", token);

        localStorage.setItem("dynoquizz_role", backendRole);

        localStorage.setItem(
          "dynoquizz_user",

          JSON.stringify(user ?? data.user ?? {}),
        );

        const expiresInMs = Number(data?.expiresIn);

        const maxAgeSeconds =
          Number.isFinite(expiresInMs) && expiresInMs > 0
            ? Math.max(1, Math.floor(expiresInMs / 1000))
            : 86400;

        document.cookie =
          `dynoquizz_token=${token}; ` +
          `path=/; max-age=${maxAgeSeconds}; samesite=lax`;
      }

      router.refresh();

      const redirectTarget = searchParams?.get("redirect");

      const destination = getRoleDestination(backendRole);

      window.location.href = redirectTarget || destination;
    } catch (err) {
      console.error("Login connection error:", err);

      setError(
        "Cannot connect to the authentication server. Please ensure the backend is reachable.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!activeRole) {
    return (
      <main className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 font-sans">
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
              className="w-full rounded-lg bg-[#111827] text-white py-3 px-5 text-sm font-medium hover:bg-black active:scale-[0.99] transition-all cursor-pointer shadow-sm border-0"
            >
              Continue as Student
            </button>
          </div>
        </section>

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
              className="w-full rounded-lg bg-white text-[#0F172A] py-3 px-5 text-sm font-medium hover:bg-neutral-100 active:scale-[0.99] transition-all cursor-pointer shadow-sm border-0"
            >
              Continue as Instructor
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 bg-neutral-50 text-[#111827] font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.05)] border border-neutral-100 p-8 space-y-6">
        <div>
          <button
            type="button"
            onClick={() => {
              setError("");

              router.push("/login");
            }}
            className="text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors mb-4 cursor-pointer bg-transparent border-0 p-0 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to roles
          </button>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {activeRole === "teacher"
              ? "Log in as Instructor"
              : "Log in as Student"}
          </h1>

          <p className="text-sm text-neutral-500 mt-1">
            Enter your credentials to continue.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 font-medium border border-red-100/50">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 block">
              Email Address
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoFocus
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 block">
                Password
              </label>

              <span className="text-xs text-neutral-400 cursor-not-allowed hover:text-neutral-600 transition-colors">
                Forgot password?
              </span>
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 pr-10 text-sm text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer border-0 bg-transparent p-0 flex items-center justify-center"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-linear-to-b from-neutral-800 to-neutral-900 py-2.5 px-4 text-sm font-bold text-white hover:from-neutral-900 hover:to-black active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer border-0 mt-4 shadow-sm"
          >
            {loading ? "Signing in..." : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 pt-2">
          Don't have an account?{" "}
          <Link
            href={`/signup?role=${activeRole}`}
            className="font-bold text-neutral-900 hover:underline"
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
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-400 font-medium">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
