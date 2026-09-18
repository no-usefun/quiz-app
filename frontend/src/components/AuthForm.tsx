"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertTriangle,
  ArrowRight,
  School,
  BookOpen,
} from "lucide-react";

import { AppWordmark } from "@/components/Logo";
import { APP_NAME } from "@/lib/constants";


// ─── Social Icons ────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 fill-current text-[#111111]" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.88c.64-.78 1.08-1.86.96-2.88-.93.04-2.05.62-2.7 1.38-.58.67-1.09 1.77-.95 2.81 1.04.08 2.06-.54 2.69-1.31z" />
    </svg>
  );
}

// ─── Stagger Variants ────────────────────────────────────────────────────────
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  },
};

interface AuthFormProps {
  mode?: "login" | "signup";
}

export function AuthForm({ mode = "login" }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);
  const [role, setRole] = useState<"student" | "teacher">("student");

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentMode(mode);
  }, [mode]);

  useEffect(() => {
    if (searchParams) {
      const qRole = searchParams.get("role");
      if (qRole === "teacher" || qRole === "instructor" || qRole === "educator") {
        setRole("teacher");
      } else if (qRole === "student" || qRole === "candidate") {
        setRole("student");
      }
    }
  }, [searchParams]);

  const isLogin = currentMode === "login";

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!email.includes("@")) errs.email = "Please enter a valid email address.";
    if (password.length < 6) errs.password = "Password must be at least 6 characters.";

    if (!isLogin) {
      if (!firstName.trim()) errs.firstName = "First name is required.";
      if (!lastName.trim()) errs.lastName = "Last name is required.";
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validate()) return;
    setLoading(true);

    const fullName = isLogin
      ? email.split("@")[0].split(".").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")
      : `${firstName.trim()} ${lastName.trim()}`;

    if (isLogin) {
      // ─── LOGIN FLOW ──────────────────────────────────────────────────────────
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            role,
            name: fullName,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          if (typeof window !== "undefined") {
            const userObj = data.user || { email, role: role.toUpperCase(), name: data.user?.name || fullName };
            localStorage.setItem("dynoquizz_role", role.toUpperCase());
            localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
            if (data.token) {
              localStorage.setItem("dynoquizz_token", data.token);
              document.cookie = `dynoquizz_token=${data.token}; path=/`;
            }
          }
          router.refresh();
          window.location.href = role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
        } else {
          setError(data.error || "Login failed. Please check your credentials.");
        }
      } catch {
        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_role", role.toUpperCase());
          localStorage.setItem("dynoquizz_user", JSON.stringify({ email, role: role.toUpperCase(), name: fullName }));
        }
        window.location.href = role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
      } finally {
        setLoading(false);
      }
    } else {
      // ─── SIGNUP FLOW ─────────────────────────────────────────────────────────
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email,
            password,
            role,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          if (typeof window !== "undefined") {
            const userObj = data.user || { email, name: fullName, role: role.toUpperCase() };
            localStorage.setItem("dynoquizz_role", role.toUpperCase());
            localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
            if (data.token) {
              localStorage.setItem("dynoquizz_token", data.token);
              document.cookie = `dynoquizz_token=${data.token}; path=/`;
            }
          }
          router.refresh();
          window.location.href = role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
        } else {
          setError(data.error || "Failed to create account.");
        }
      } catch {
        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_role", role.toUpperCase());
          localStorage.setItem("dynoquizz_user", JSON.stringify({ email, name: fullName, role: role.toUpperCase() }));
        }
        window.location.href = role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
      } finally {
        setLoading(false);
      }
    }
  }

  const handleSocialAuth = (provider: "google" | "apple") => {
    router.push(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-[8.8px] border py-2.5 px-3 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium ${
      hasError ? "border-[#9c3535]/50 bg-[#fdebec]/40" : "border-[#d1dee8] bg-[#f5f5f4]"
    }`;

  const iconInputClass = (hasError?: boolean) => `${inputClass(hasError)} pl-9`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 py-8 font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
      <div className="w-full max-w-md">
        <motion.div
          variants={container}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          className="rounded-[8.8px] bg-white p-7 md:p-8 border border-[#d1dee8] text-left space-y-5"
        >
          {/* Header & Logo */}
          <motion.div variants={item} className="flex flex-col items-center text-center">
            <Link href="/" className="mb-3 hover:opacity-90 transition-opacity">
              <AppWordmark size="lg" />
            </Link>
            <h1 className="text-xl font-extrabold -tracking-wide text-[#111111]">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-xs text-[#78716b] font-medium">
              {isLogin
                ? "Sign in to access your assessments and scorecards."
                : `Join ${APP_NAME} for secure, synchronized assessments.`}
            </p>
          </motion.div>


          {/* Mode Switcher Tabs (Sign In / Sign Up) */}
          <motion.div
            variants={item}
            className="flex rounded-[8.8px] bg-[#f5f5f4] p-1 border border-[#d1dee8]"
          >
            <button
              type="button"
              onClick={() => {
                setCurrentMode("login");
                setError("");
                setValidationErrors({});
              }}
              className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-[8.8px] cursor-pointer border-0 ${
                isLogin
                  ? "bg-white text-[#111111] border border-[#d1dee8]/50 shadow-sm"
                  : "text-[#78716b] hover:text-[#111111] bg-transparent"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMode("signup");
                setError("");
                setValidationErrors({});
              }}
              className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-[8.8px] cursor-pointer border-0 ${
                !isLogin
                  ? "bg-white text-[#111111] border border-[#d1dee8]/50 shadow-sm"
                  : "text-[#78716b] hover:text-[#111111] bg-transparent"
              }`}
            >
              Sign Up
            </button>
          </motion.div>

          {/* Role Switcher Pill */}
          <motion.div
            variants={item}
            className="flex rounded-[8.8px] bg-[#f5f5f4] p-1 border border-[#d1dee8]"
          >
            {(["student", "teacher"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setValidationErrors({});
                }}
                className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-[8.8px] cursor-pointer border-0 ${
                  role === r
                    ? "bg-white text-[#111111] border border-[#d1dee8]/50"
                    : "text-[#78716b] hover:text-[#111111] bg-transparent"
                }`}
              >
                {r === "student" ? "Student" : "Instructor"}
              </button>
            ))}
          </motion.div>

          {/* Social Auth Buttons Row (Google & Apple) */}
          <motion.div variants={item} className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSocialAuth("google")}
              className="flex items-center justify-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-white py-2 px-3 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all cursor-pointer"
            >
              <GoogleIcon />
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={() => handleSocialAuth("apple")}
              className="flex items-center justify-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-white py-2 px-3 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all cursor-pointer"
            >
              <AppleIcon />
              <span>Apple</span>
            </button>
          </motion.div>

          {/* Divider */}
          <motion.div variants={item} className="relative flex items-center justify-center">
            <div className="w-full border-t border-[#d1dee8]/60" />
            <span className="absolute bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              or with email
            </span>
          </motion.div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 rounded-[8.8px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {/* First Name & Last Name (Signup only) */}
            {!isLogin && (
              <motion.div variants={item} className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                    First Name
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={iconInputClass(!!validationErrors.firstName)}
                      placeholder="e.g. Alex"
                      required={!isLogin}
                    />
                  </div>
                  {validationErrors.firstName && (
                    <p className="text-[10px] text-[#8c381c] font-bold">{validationErrors.firstName}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass(!!validationErrors.lastName)}
                    placeholder="e.g. Carter"
                    required={!isLogin}
                  />
                  {validationErrors.lastName && (
                    <p className="text-[10px] text-[#8c381c] font-bold">{validationErrors.lastName}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Email */}
            <motion.div variants={item} className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={iconInputClass(!!validationErrors.email)}
                  placeholder="you@university.edu"
                  required
                />
              </div>
              {validationErrors.email && (
                <p className="text-[10px] text-[#8c381c] font-bold">{validationErrors.email}</p>
              )}
            </motion.div>

            {/* Password */}
            <motion.div variants={item} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                  Password
                </label>
                {isLogin && (
                  <Link href="#" className="text-[10px] font-bold text-[#165dfb] hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${iconInputClass(!!validationErrors.password)} pr-9`}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#78716b] hover:text-[#111111] cursor-pointer bg-transparent border-0"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-[10px] text-[#8c381c] font-bold">{validationErrors.password}</p>
              )}
            </motion.div>

            {/* Submit Primary Button */}
            <motion.button
              variants={item}
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 border-0"
            >
              {loading
                ? isLogin
                  ? "Signing in…"
                  : "Creating account…"
                : isLogin
                ? `Sign In as ${role === "student" ? "Student" : "Instructor"}`
                : `Create ${role === "student" ? "Student" : "Instructor"} Account`}
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </motion.button>
          </form>

          {/* Footer Link */}
          <motion.div variants={item} className="text-center pt-1 border-t border-[#d1dee8]/40">
            {isLogin ? (
              <p className="text-xs text-[#78716b] font-medium">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMode("signup");
                    setError("");
                    setValidationErrors({});
                  }}
                  className="font-bold text-[#165dfb] hover:underline bg-transparent border-0 cursor-pointer p-0 text-xs"
                >
                  Sign up for free
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#78716b] font-medium">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMode("login");
                    setError("");
                    setValidationErrors({});
                  }}
                  className="font-bold text-[#165dfb] hover:underline bg-transparent border-0 cursor-pointer p-0 text-xs"
                >
                  Sign in here
                </button>
              </p>
            )}
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
