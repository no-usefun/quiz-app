"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, ShieldCheck } from "lucide-react";

export default function SignupPage() {
  // TODO: BACKEND INTEGRATION - On mount, check if dynoquizz_token exists and is valid
  // by calling GET /api/auth/validate. If valid, skip signup and redirect to dashboard.
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");

  function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    // TODO: BACKEND INTEGRATION - Replace mock token with real registration call.
    // POST /api/auth/register with body: { name: string, email: string, password: string, role: 'student'|'teacher' }
    // Expected response: { token: string, role: 'student'|'teacher', userId: number, name: string }
    // On success: localStorage.setItem("dynoquizz_token", response.token) then redirect.
    // On failure (e.g. email already exists): show an inline error message.
    localStorage.setItem("dynoquizz_token", "mock_local_dev_token");
    if (role === "teacher") {
      router.push("/dashboard/teacher");
    } else {
      router.push("/dashboard/student");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3eefc] p-4 font-sans">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl border border-white/50">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <Link
            href="/"
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-transform hover:scale-105"
          >
            <ShieldCheck className="h-7 w-7" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create an account
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Start testing smarter with DynoQuizz.
          </p>
        </div>

        {/* Role Toggle */}
        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              role === "student"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole("teacher")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              role === "teacher"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Teacher
          </button>
        </div>

        {/* Divider */}
        <div className="mb-6 flex items-center justify-center text-sm text-slate-400">
          <span className="h-[1px] w-full bg-slate-100" />
          <span className="px-3">sign up with email</span>
          <span className="h-[1px] w-full bg-slate-100" />
        </div>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSignup}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Full Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                placeholder="you@university.edu"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                placeholder="Create a strong password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]"
          >
            Create {role.charAt(0).toUpperCase() + role.slice(1)} Account
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-blue-600 hover:underline"
          >
            Log in here
          </Link>
        </p>
      </div>
    </main>
  );
}
