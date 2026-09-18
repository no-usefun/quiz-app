"use client";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

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
                router.push("/signup?role=student");
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
                router.push("/signup?role=teacher");
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
              router.push("/signup");
            }}
            className="text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors mb-4 cursor-pointer bg-transparent border-0 p-0 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to roles
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {activeRole === "teacher"
              ? "Sign up as Instructor"
              : "Sign up as Student"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create your account to get started.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 font-medium border border-red-100/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSignupSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 block">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                required
                autoFocus
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 block">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
              />
            </div>
          </div>

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
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 block">
              Password
            </label>
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

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 block">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 pr-10 text-sm text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer border-0 bg-transparent p-0 flex items-center justify-center"
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
            className="w-full rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-900 py-2.5 px-4 text-sm font-bold text-white hover:from-neutral-900 hover:to-black active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer border-0 mt-4 shadow-sm"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 pt-2">
          Already have an account?{" "}
          <Link
            href={`/login?role=${activeRole}`}
            className="font-bold text-neutral-900 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-400 font-medium">
          Loading...
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
