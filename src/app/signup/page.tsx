"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, ShieldCheck } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");

  function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("dynoquizz_token", "mock_local_dev_token");
    if (role === "teacher") {
      router.push("/dashboard/teacher");
    } else {
      router.push("/dashboard/student");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 p-4 font-sans selection:bg-blue-100 selection:text-blue-900">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white p-6 md:p-8 shadow-xs border border-slate-200"
      >
        {/* Header */}
        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <Link
            href="/"
            className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Create an Account
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Get started with DynoQuizz today.
          </p>
        </div>

        {/* Role Segment Control */}
        <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
              role === "student"
                ? "bg-white text-slate-905 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setRole("teacher")}
            className={`flex-1 rounded-md py-2 text-xs font-bold transition-all ${
              role === "teacher"
                ? "bg-white text-slate-905 shadow-xs"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Teacher
          </button>
        </div>

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSignup}>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Full Name
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                placeholder="Alex Carter"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                placeholder="you@university.edu"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                placeholder="Create a password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-650 focus:outline-none"
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
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-750 active:scale-95 transition-all shadow-xs"
          >
            Create {role.charAt(0).toUpperCase() + role.slice(1)} Account
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500 font-medium">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-blue-600 hover:underline"
          >
            Log in here
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
