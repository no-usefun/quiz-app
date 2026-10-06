"use client";

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
import { ENDPOINTS } from "@/lib/api/endpoints";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}


function isTokenValid(token: string): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    while (base64.length % 4) {
      base64 += "=";
    }

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

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  // Password validation
  const passwordRequirements = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const isPasswordValid =
    passwordRequirements.minLength &&
    passwordRequirements.uppercase &&
    passwordRequirements.lowercase &&
    passwordRequirements.number &&
    passwordRequirements.special;

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeRole) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter both your first and last name.");
      setSuccess("");
      return;
    }

    // Registration number is required by the backend for students,
    // but is optional for teacher accounts.
    if (activeRole === "student" && !registrationNo.trim()) {
      setError("Please enter your student registration / roll number.");
      setSuccess("");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address format.");
      setSuccess("");
      return;
    }

    if (phone.trim() && !/^[0-9+()\-\s]{7,15}$/.test(phone.trim())) {
      setError("Please enter a valid phone number.");
      setSuccess("");
      return;
    }

    if (password.length > 100) {
      setError("Password must not exceed 100 characters.");
      setSuccess("");
      return;
    }

    if (!isPasswordValid) {
      setError(
        "Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.",
      );
      setSuccess("");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const backendRole = (activeRole === "teacher" ? "TEACHER" : "STUDENT") as "STUDENT" | "TEACHER";
      const res = await fetch(
        ENDPOINTS.auth.signup(backendRole),
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          college: college.trim() || null,
          department: department.trim() || null,
          registrationNo: registrationNo.trim()
            ? registrationNo.trim().toUpperCase()
            : null,
          phone: phone.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const verificationRequired = data?.verificationRequired === true;

        setSuccess(
          verificationRequired
            ? data?.message ||
                "Account created. Please verify your email before logging in."
            : data?.message ||
                "Account created successfully. You can now log in.",
        );
        setError("");

        // Signup does not return an authenticated JWT.
        if (typeof window !== "undefined") {
          localStorage.removeItem("dynoquizz_token");
          localStorage.removeItem("token");
          localStorage.removeItem("dynoquizz_user");
          localStorage.removeItem("dynoquizz_role");

          const normalizedRegistrationNo = registrationNo.trim().toUpperCase();

          if (normalizedRegistrationNo) {
            localStorage.setItem("dynoquizz_regNo", normalizedRegistrationNo);
          } else {
            localStorage.removeItem("dynoquizz_regNo");
          }
        }
      } else {
        setSuccess("");
        setError(
          data.message ||
            data.error ||
            "Signup failed. Please check your details and try again.",
        );
      }
    } catch (err) {
      console.error("Signup connection error:", err);
      setSuccess("");
      setError(
        "Cannot connect to the authentication server. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10";

  const requirementClass = (valid: boolean) =>
    `flex items-center gap-2 text-[11px] transition-colors ${
      valid ? "text-green-600" : "text-neutral-400"
    }`;

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
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/signup");
              }}
              className="group text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer bg-transparent border-0 p-0 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Back to roles
            </button>
          </div>

          <span
            className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${
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
            {activeRole === "teacher"
              ? "Create your instructor account to manage assessments."
              : "Create your student account to take assessments."}
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

        {success && (
          <div
            role="status"
            className="rounded-lg bg-green-50 p-3.5 text-sm text-green-700 font-medium border border-green-200/70"
          >
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const backendRole = activeRole === "teacher" ? "TEACHER" : "STUDENT";
            sessionStorage.setItem("dynoquizz_google_role", backendRole);

            const redirect = searchParams.get("redirect") || "";
            if (redirect) {
              sessionStorage.setItem("dynoquizz_post_login_redirect", redirect);
            }

            window.location.href =
              ENDPOINTS.auth.googleLogin +
              "?role=" +
              encodeURIComponent(backendRole);
          }}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          Sign up with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-100" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-neutral-100" />
        </div>

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

          {activeRole === "student" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 block">
                Registration / Roll number
              </label>

              <input
                type="text"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                placeholder="e.g. 21BCE1024"
                required
                maxLength={30}
                className={fieldClass}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 block">
                College
                <span className="ml-1 font-normal text-neutral-400">
                  (optional)
                </span>
              </label>

              <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="Example University"
                maxLength={100}
                className={fieldClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 block">
                Department
                <span className="ml-1 font-normal text-neutral-400">
                  (optional)
                </span>
              </label>

              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="CSE"
                maxLength={100}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">
              Phone number
              <span className="ml-1 font-normal text-neutral-400">
                (optional)
              </span>
            </label>

            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              inputMode="tel"
              maxLength={15}
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
                onChange={(e) => {
                  setPassword(e.target.value);

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="••••••••"
                required
                aria-describedby="password-requirements"
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

            <div
              id="password-requirements"
              className="grid grid-cols-1 gap-1 pt-1"
            >
              <p className={requirementClass(passwordRequirements.minLength)}>
                <span className="w-3 text-center">
                  {passwordRequirements.minLength ? "✓" : "○"}
                </span>
                At least 8 characters
              </p>

              <p className={requirementClass(passwordRequirements.uppercase)}>
                <span className="w-3 text-center">
                  {passwordRequirements.uppercase ? "✓" : "○"}
                </span>
                At least 1 uppercase letter
              </p>

              <p className={requirementClass(passwordRequirements.lowercase)}>
                <span className="w-3 text-center">
                  {passwordRequirements.lowercase ? "✓" : "○"}
                </span>
                At least 1 lowercase letter
              </p>

              <p className={requirementClass(passwordRequirements.number)}>
                <span className="w-3 text-center">
                  {passwordRequirements.number ? "✓" : "○"}
                </span>
                At least 1 number
              </p>

              <p className={requirementClass(passwordRequirements.special)}>
                <span className="w-3 text-center">
                  {passwordRequirements.special ? "✓" : "○"}
                </span>
                At least 1 special character
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-700 block">
              Confirm password
            </label>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);

                  if (error) {
                    setError("");
                  }
                }}
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

            {confirmPassword.length > 0 && (
              <p
                className={`text-[11px] ${
                  passwordsMatch ? "text-green-600" : "text-red-500"
                }`}
              >
                {passwordsMatch
                  ? "✓ Passwords match"
                  : "Passwords do not match"}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              loading || !isPasswordValid || !passwordsMatch || !!success
            }
            className="w-full rounded-lg bg-linear-to-b from-neutral-800 to-neutral-900 py-3 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:from-neutral-900 hover:to-black hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 cursor-pointer border-0 mt-5"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating account...
              </span>
            ) : success ? (
              "Account Created"
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
