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
  CheckCircle2,
} from "lucide-react";

import { AppWordmark } from "@/components/Logo";
import { APP_NAME } from "@/lib/constants";
import { ENDPOINTS } from "@/lib/api/endpoints";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as const,
    },
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

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentMode(mode);
  }, [mode]);

  useEffect(() => {
    const qRole = searchParams?.get("role");

    if (qRole === "teacher" || qRole === "instructor" || qRole === "educator") {
      setRole("teacher");
    } else if (qRole === "student" || qRole === "candidate") {
      setRole("student");
    }
  }, [searchParams]);

  const isLogin = currentMode === "login";

  function resetMessages() {
    setError("");
    setSuccessMessage("");
    setValidationErrors({});
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!email.trim() || !email.includes("@")) {
      errs.email = "Please enter a valid email address.";
    }

    if (password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }

    if (!isLogin) {
      if (!firstName.trim()) {
        errs.firstName = "First name is required.";
      }

      if (role === "student" && !registrationNo.trim()) {
        errs.registrationNo = "Registration number is required.";
      }
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    resetMessages();

    if (!validate()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success || !data.token) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Login failed. Please check your credentials.",
          );
        }

        const returnedRole = String(
          data?.user?.role || data?.role || "",
        ).toUpperCase();

        const selectedRole = role === "teacher" ? "TEACHER" : "STUDENT";

        if (returnedRole && returnedRole !== selectedRole) {
          throw new Error(
            `This account is registered as ${returnedRole.toLowerCase()}, not ${role}.`,
          );
        }

        const userObj = data.user;

        if (!userObj) {
          throw new Error("Login succeeded but no user profile was returned.");
        }

        localStorage.setItem("dynoquizz_token", String(data.token));
        localStorage.removeItem("token");

        localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));

        localStorage.setItem("dynoquizz_role", returnedRole || selectedRole);

        if (userObj.registrationNo) {
          localStorage.setItem(
            "dynoquizz_regNo",
            String(userObj.registrationNo).trim().toUpperCase(),
          );
        }

        const cleanRedirect = searchParams?.get("redirect") || "";

        const destination =
          cleanRedirect ||
          (returnedRole === "TEACHER"
            ? "/dashboard/teacher"
            : "/dashboard/student");

        router.replace(destination);
        router.refresh();
        return;
      }

      const backendRole = role === "teacher" ? "TEACHER" : "STUDENT";

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          role: backendRole,
          ...(backendRole === "STUDENT"
            ? {
                registrationNo: registrationNo.trim().toUpperCase(),
              }
            : {}),
        }),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data?.message || data?.error || "Failed to create account.",
        );
      }

      /*
       * Current backend signup returns SignupResponse and requires
       * email verification before login. Do not create a local
       * authenticated session and do not redirect to a dashboard.
       */
      localStorage.removeItem("dynoquizz_token");
      localStorage.removeItem("token");
      localStorage.removeItem("dynoquizz_user");
      localStorage.removeItem("dynoquizz_role");
      localStorage.removeItem("dynoquizz_regNo");

      setCurrentMode("login");
      setSuccessMessage(
        data?.message ||
          "Account created. Please verify your email before logging in.",
      );
      setError("");
      setPassword("");
      setValidationErrors({});
    } catch (requestError: any) {
      console.error("Authentication request failed:", requestError);
      setError(
        requestError?.message ||
          "Could not connect to the authentication server.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleAuth() {
    const redirect = searchParams?.get("redirect");
    const googleUrl = ENDPOINTS.auth.googleLogin;

    if (redirect) {
      sessionStorage.setItem("dynoquizz_post_login_redirect", redirect);
    }

    window.location.href = googleUrl;
  }

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-[8.8px] border py-2.5 px-3 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium ${
      hasError
        ? "border-[#9c3535]/50 bg-[#fdebec]/40"
        : "border-[#d1dee8] bg-[#f5f5f4]"
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
          <motion.div
            variants={item}
            className="flex flex-col items-center text-center"
          >
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

          <motion.div
            variants={item}
            className="flex rounded-[8.8px] bg-[#f5f5f4] p-1 border border-[#d1dee8]"
          >
            <button
              type="button"
              onClick={() => {
                setCurrentMode("login");
                resetMessages();
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
                resetMessages();
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

          <motion.div
            variants={item}
            className="flex rounded-[8.8px] bg-[#f5f5f4] p-1 border border-[#d1dee8]"
          >
            {(["student", "teacher"] as const).map((candidateRole) => (
              <button
                key={candidateRole}
                type="button"
                onClick={() => {
                  setRole(candidateRole);
                  setValidationErrors({});
                  setError("");
                }}
                className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-[8.8px] cursor-pointer border-0 ${
                  role === candidateRole
                    ? "bg-white text-[#111111] border border-[#d1dee8]/50"
                    : "text-[#78716b] hover:text-[#111111] bg-transparent"
                }`}
              >
                {candidateRole === "student" ? "Student" : "Instructor"}
              </button>
            ))}
          </motion.div>

          <motion.div variants={item} className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="flex items-center justify-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-white py-2 px-3 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all cursor-pointer"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>
          </motion.div>

          <motion.div
            variants={item}
            className="relative flex items-center justify-center"
          >
            <div className="w-full border-t border-[#d1dee8]/60" />
            <span className="absolute bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              or with email
            </span>
          </motion.div>

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-2 rounded-[8.8px] bg-[#ecfdf3] border border-[#15803d]/20 p-3 text-xs text-[#166534] font-semibold"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </motion.div>
          )}

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

          <form className="space-y-3.5" onSubmit={handleSubmit}>
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
                      onChange={(event) => setFirstName(event.target.value)}
                      className={iconInputClass(!!validationErrors.firstName)}
                      placeholder="e.g. Alex"
                      required
                    />
                  </div>

                  {validationErrors.firstName && (
                    <p className="text-[10px] text-[#8c381c] font-bold">
                      {validationErrors.firstName}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                    Last Name
                  </label>

                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={inputClass(!!validationErrors.lastName)}
                    placeholder="e.g. Carter"
                  />

                  {validationErrors.lastName && (
                    <p className="text-[10px] text-[#8c381c] font-bold">
                      {validationErrors.lastName}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {!isLogin && role === "student" && (
              <motion.div variants={item} className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                  Registration / Roll Number
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                    <School className="h-4 w-4" />
                  </div>

                  <input
                    type="text"
                    value={registrationNo}
                    onChange={(event) =>
                      setRegistrationNo(event.target.value.toUpperCase())
                    }
                    className={iconInputClass(
                      !!validationErrors.registrationNo,
                    )}
                    placeholder="e.g. 21BCE1024"
                    maxLength={30}
                    required
                  />
                </div>

                {validationErrors.registrationNo && (
                  <p className="text-[10px] text-[#8c381c] font-bold">
                    {validationErrors.registrationNo}
                  </p>
                )}
              </motion.div>
            )}

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
                  onChange={(event) => setEmail(event.target.value)}
                  className={iconInputClass(!!validationErrors.email)}
                  placeholder="you@university.edu"
                  required
                />
              </div>

              {validationErrors.email && (
                <p className="text-[10px] text-[#8c381c] font-bold">
                  {validationErrors.email}
                </p>
              )}
            </motion.div>

            <motion.div variants={item} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] block">
                  Password
                </label>

                {isLogin && (
                  <span className="text-[10px] font-semibold text-[#78716b]">
                    Minimum 6 characters
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <Lock className="h-4 w-4" />
                </div>

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${iconInputClass(
                    !!validationErrors.password,
                  )} pr-9`}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#78716b] hover:text-[#111111] cursor-pointer bg-transparent border-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {validationErrors.password && (
                <p className="text-[10px] text-[#8c381c] font-bold">
                  {validationErrors.password}
                </p>
              )}
            </motion.div>

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
                  ? `Sign In as ${
                      role === "student" ? "Student" : "Instructor"
                    }`
                  : `Create ${
                      role === "student" ? "Student" : "Instructor"
                    } Account`}
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </motion.button>
          </form>

          <motion.div
            variants={item}
            className="text-center pt-1 border-t border-[#d1dee8]/40"
          >
            {isLogin ? (
              <p className="text-xs text-[#78716b] font-medium">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMode("signup");
                    resetMessages();
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
                    resetMessages();
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
