"use client";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  GraduationCap,
  Presentation,
  ArrowRight,
} from "lucide-react";

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

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const qRole = searchParams?.get("role");
  const activeRole: "teacher" | "student" | null =
    qRole === "teacher" || qRole === "instructor" || qRole === "educator"
      ? "teacher"
      : qRole === "student" || qRole === "candidate"
        ? "student"
        : null;

  // Form Fields - Split into First and Last Name
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("dynoquizz_token");
      const role = (localStorage.getItem("dynoquizz_role") || "").toUpperCase();
      if (token && isTokenValid(token)) {
        const destination =
          role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
        const redirectTarget = searchParams?.get("redirect");
        window.location.href = redirectTarget || destination;
      } else if (token) {
        localStorage.removeItem("dynoquizz_token");
        localStorage.removeItem("dynoquizz_user");
        localStorage.removeItem("dynoquizz_role");
      }
    }
  }, [searchParams]);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRole) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter both your first and last name.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address format.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    const backendRole = activeRole === "teacher" ? "TEACHER" : "STUDENT";
    const combinedName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: combinedName,
          email: email.trim(),
          password,
          role: backendRole,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const returnedRole = (
          data.user?.role ||
          data.role ||
          backendRole
        ).toUpperCase();
        if (typeof window !== "undefined") {
          const userObj = data.user || {
            email: email.trim(),
            role: returnedRole,
            name: combinedName,
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
        const destination =
          returnedRole === "TEACHER"
            ? "/dashboard/teacher"
            : "/dashboard/student";
        window.location.href = redirectTarget || destination;
      } else {
        setError(
          data.error ||
            data.message ||
            "Failed to create account. Please try again.",
        );
      }
    } catch (err) {
      console.error("Signup connection error:", err);
      setError(
        "Cannot connect to the authentication server. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10";

  if (!activeRole) {
    return (
      <main className="relative min-h-screen w-full grid grid-cols-1 md:grid-cols-2 font-sans">
        <span className="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold tracking-tight text-[#111827] shadow-sm ring-1 ring-black/5 backdrop-blur">
          Quizly
        </span>

        <section className="group relative flex flex-col items-center justify-center p-8 sm:p-16 bg-[#F9FAFB] text-center transition-colors duration-300 hover:bg-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 45%, rgba(17,24,39,0.06), transparent 60%)",
            }}
          />
          <div className="relative w-full max-w-xs space-y-6">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#111827]/5 text-[#111827] ring-1 ring-[#111827]/10 transition-transform duration-300 group-hover:-translate-y-0.5">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827]">
                Student
              </h1>
              <p className="text-sm leading-relaxed text-[#6B7280]">
                Take quizzes with an access code
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/signup?role=student");
              }}
              className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] text-white py-3 px-5 text-sm font-medium shadow-sm ring-offset-2 transition-all hover:bg-black hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] cursor-pointer border-0"
            >
              Continue as Student
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
            </button>
          </div>
        </section>

        <section className="group relative flex flex-col items-center justify-center p-8 sm:p-16 bg-[#0F172A] text-center border-t md:border-t-0 md:border-l border-neutral-800 transition-colors duration-300 hover:bg-[#0B1220]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.07), transparent 60%)",
            }}
          />
          <div className="relative w-full max-w-xs space-y-6">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition-transform duration-300 group-hover:-translate-y-0.5">
              <Presentation className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Instructor
              </h1>
              <p className="text-sm leading-relaxed text-[#94A3B8]">
                Create and manage quizzes
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/signup?role=teacher");
              }}
              className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white text-[#0F172A] py-3 px-5 text-sm font-medium shadow-sm ring-offset-2 ring-offset-[#0F172A] transition-all hover:bg-neutral-100 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer border-0"
            >
              Continue as Instructor
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 sm:p-12 bg-neutral-50 text-[#111827] font-sans">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(17,24,39,0.05), transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] ring-1 ring-neutral-900/5 border border-neutral-100 p-8 space-y-6">
        <div>
          <button
            type="button"
            onClick={() => {
              setError("");
              router.push("/signup");
            }}
            className="group text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors mb-5 cursor-pointer bg-transparent border-0 p-0 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />{" "}
            Back to roles
          </button>
          <span
            className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${
              activeRole === "teacher"
                ? "bg-[#0F172A] text-white ring-[#0F172A]/20"
                : "bg-neutral-100 text-neutral-900 ring-neutral-900/10"
            }`}
          >
            {activeRole === "teacher" ? (
              <Presentation className="h-5 w-5" />
            ) : (
              <GraduationCap className="h-5 w-5" />
            )}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {activeRole === "teacher"
              ? "Sign up as Instructor"
              : "Sign up as Student"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">
            Create your account to get started.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-lg bg-red-50 p-3.5 text-sm text-red-700 font-medium border border-red-200/70"
          >
            <span
              aria-hidden
              className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
            />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignupSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 block">
                First name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                required
                autoFocus
                className={fieldClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 block">
                Last name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                className={fieldClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`${fieldClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              At least 6 characters.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`${fieldClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
              >
                {showConfirmPassword ? (
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
            className="w-full rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-900 py-3 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:from-neutral-900 hover:to-black hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 cursor-pointer border-0 mt-5"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="pt-1">
          <div className="h-px w-full bg-neutral-100" />
          <p className="text-center text-sm text-neutral-500 pt-4">
            Already have an account?{" "}
            <Link
              href={`/login?role=${activeRole}`}
              className="font-semibold text-neutral-900 underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 bg-neutral-50 text-sm text-neutral-400 font-medium">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-400" />
          Loading...
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
