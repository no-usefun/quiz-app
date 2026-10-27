"use client";

import LoadingIndicator from "@/components/LoadingIndicator";
import SkeletonBlock from "@/components/SkeletonBlock";
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

async function readSignupResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.toLowerCase().includes("text/html") || /^\\s*<(?:!doctype\\s+html|html|head|body)\\b/i.test(text)) {
    throw new Error(
      `The API returned an HTML page instead of JSON (HTTP ${response.status}). Check NEXT_PUBLIC_API_URL and the backend signup/login endpoints. Request: ${response.url}`,
    );
  }

  if (!text.trim()) return {};
  try {
    const data: unknown = JSON.parse(text);
    return data && typeof data === "object" ? data as Record<string, unknown> : {};
  } catch {
    if (!response.ok) {
      throw new Error(`The API returned an unreadable response (HTTP ${response.status}). Request: ${response.url}`);
    }
    throw new Error("The API returned an invalid JSON response.");
  }
}


function getResponseMessage(data: Record<string, unknown>, fallback: string): string {
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const error = typeof data.error === "string" ? data.error.trim() : "";
  return message || error || fallback;
}import { PublicNavbar } from "@/components/PublicNavbar";
import { isLanExamMode } from "@/lib/examMode";

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
  const lanExamMode = isLanExamMode();

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
  const [googleLoading, setGoogleLoading] = useState(false);
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

      const data = await readSignupResponse(res);

      if (res.ok) {
        const verificationRequired = data?.verificationRequired === true;

        setError("");

        if (verificationRequired) {
          setSuccess(
            getResponseMessage(
              data,
              "Account created. Please verify your email before signing in.",
            ),
          );

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

          return;
        }

        setSuccess("Account created successfully.");

        const loginRes = await fetch(ENDPOINTS.auth.login, {
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

        const loginData = await readSignupResponse(loginRes);

        if (!loginRes.ok) {
          throw new Error(
            getResponseMessage(
              loginData,
              "Account was created, but automatic sign-in failed. Please try logging in.",
            ),
          );
        }

        const token =
          typeof loginData?.token === "string" ? loginData.token.trim() : "";

        if (!token) {
          throw new Error(
            "Account was created, but the authentication token was not returned.",
          );
        }

        const meRes = await fetch(ENDPOINTS.auth.me, {
          method: "GET",
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const meData = await readSignupResponse(meRes);

        if (!meRes.ok) {
          throw new Error(
            getResponseMessage(
              meData,
              "Account was created, but the authenticated session could not be verified.",
            ),
          );
        }

        const backendRole = String(meData?.role || "").trim().toUpperCase();

        if (
          backendRole !== "TEACHER" &&
          backendRole !== "STUDENT"
        ) {
          throw new Error(
            "Account was created, but the backend returned an invalid account role.",
          );
        }

        const normalizedRegistrationNo = String(
          meData?.registrationNo || registrationNo || "",
        )
          .trim()
          .toUpperCase();

        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_token", token);
          localStorage.removeItem("token");
          localStorage.setItem("dynoquizz_user", JSON.stringify(meData));
          localStorage.setItem("dynoquizz_role", backendRole);

          if (normalizedRegistrationNo) {
            localStorage.setItem("dynoquizz_regNo", normalizedRegistrationNo);
          } else {
            localStorage.removeItem("dynoquizz_regNo");
          }

          const expiresInMs = Number(loginData?.expiresIn);
          const maxAgeSeconds =
            Number.isFinite(expiresInMs) && expiresInMs > 0
              ? Math.max(1, Math.floor(expiresInMs / 1000))
              : 86400;

          document.cookie =
            "dynoquizz_token=" +
            encodeURIComponent(token) +
            "; path=/; max-age=" +
            maxAgeSeconds +
            "; samesite=lax";
        }

        setSuccess("Account created successfully.");

        const redirectTarget = searchParams?.get("redirect");
        const destination =
          redirectTarget ||
          (backendRole === "TEACHER"
            ? "/dashboard/teacher"
            : "/dashboard/student");

        window.setTimeout(() => router.replace(destination), 900);
      } else {
        setSuccess("");
        setError(
          getResponseMessage(
            data,
            "Signup failed. Please check your details and try again.",
          ),
        );
      }
    } catch (err) {
      console.error("Signup connection error:", err);
      setSuccess("");
      setError(
        err instanceof Error
          ? err.message
          : "Cannot connect to the authentication server. Please ensure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:border-[#165dfb] focus:bg-white focus:ring-2 focus:ring-[#165dfb]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-400/20";

  const requirementClass = (valid: boolean) =>
    `flex items-center gap-2 text-[11px] font-medium transition-colors duration-200 ${
      valid
        ? "text-green-700 dark:text-green-400"
        : "text-red-600 dark:text-red-400"
    }`;

  if (!activeRole) {
    return (
      <>
      <PublicNavbar redirectTarget={searchParams?.get("redirect") || undefined} />
      <main className="public-signup-role-selection relative min-h-[calc(100vh-4rem)] w-full grid grid-cols-1 md:grid-cols-2 font-sans transition-colors">

        <section className="signup-role-student-panel group relative flex flex-col items-center justify-center p-8 sm:p-16 bg-[#F9FAFB] text-center transition-colors duration-300 hover:bg-white">
          <div className="relative w-full max-w-xs space-y-6">
            <span className="signup-role-icon mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#111827]/5 text-[#111827] ring-1 ring-[#111827]/10 transition-transform duration-300 group-hover:-translate-y-0.5">
              <GraduationCap className="h-6 w-6" />
            </span>

            <div className="space-y-2">
              <h1 className="signup-role-title text-3xl sm:text-4xl font-bold tracking-tight text-[#111827]">
                Student
              </h1>

              <p className="signup-role-description text-sm leading-relaxed text-[#6B7280]">
                Take quizzes with an access code
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/signup?role=student" + (searchParams.get("redirect") ? "&redirect=" + encodeURIComponent(searchParams.get("redirect") || "") : ""));
              }}
              className="signup-role-cta group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] text-white py-3 px-5 text-sm font-medium shadow-sm transition-all hover:bg-black hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] cursor-pointer border-0"
            >
              Continue as Student
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="signup-role-instructor-panel group relative flex flex-col items-center justify-center p-8 sm:p-16 bg-[#0F172A] text-center border-t md:border-t-0 md:border-l border-neutral-800 transition-colors duration-300 hover:bg-[#0B1220]">
          <div className="relative w-full max-w-xs space-y-6">
            <span className="signup-role-icon mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition-transform duration-300 group-hover:-translate-y-0.5">
              <Presentation className="h-6 w-6" />
            </span>

            <div className="space-y-2">
              <h1 className="signup-role-title text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Instructor
              </h1>

              <p className="signup-role-description text-sm leading-relaxed text-[#94A3B8]">
                Create and manage quizzes
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/signup?role=teacher" + (searchParams.get("redirect") ? "&redirect=" + encodeURIComponent(searchParams.get("redirect") || "") : ""));
              }}
              className="signup-role-cta group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white text-[#0F172A] py-3 px-5 text-sm font-medium shadow-sm transition-all duration-200 hover:bg-neutral-100 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] cursor-pointer border-0"
            >
              Continue as Instructor
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>
      </>
    );
  }

  return (
    <>
    <PublicNavbar redirectTarget={searchParams?.get("redirect") || undefined} />
    <main className="public-auth min-h-[calc(100vh-4rem)] bg-neutral-50 px-4 py-8 font-sans text-[#111827] transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
      <div className="w-full space-y-6 rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-none sm:p-8">
        <div>
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setError("");
                router.push("/signup" + (searchParams.get("redirect") ? "?redirect=" + encodeURIComponent(searchParams.get("redirect") || "") : ""));
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

          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-slate-100">
            {activeRole === "teacher"
              ? "Sign up as Instructor"
              : "Sign up as Student"}
          </h1>

          <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-slate-400">
            {lanExamMode
              ? "Create an account on the local exam server using email and password."
              : activeRole === "teacher"
                ? "Create your instructor account to manage assessments."
                : "Create your student account to take assessments."}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-200"
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
            className="fixed right-4 top-4 z-[100] max-w-sm rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-300"
          >
            {success}
          </div>
        )}

        {!lanExamMode && (
          <>
            <button
              type="button"
              onClick={() => {
                const backendRole = activeRole === "teacher" ? "TEACHER" : "STUDENT";
                setError("");

                const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
                let googleAuthUrl: URL;
                try {
                  if (!configuredApiBase) {
                    throw new Error(
                      "Google sign-in is not configured: NEXT_PUBLIC_API_URL must point to the Spring Boot backend.",
                    );
                  }

                  const backendBaseUrl = new URL(configuredApiBase);
                  if (
                    backendBaseUrl.protocol !== "http:" &&
                    backendBaseUrl.protocol !== "https:"
                  ) {
                    throw new Error(
                      "Google sign-in requires the backend URL to use HTTP or HTTPS.",
                    );
                  }

                  // Start OAuth on the backend origin, not through the Next.js
                  // /backend API proxy, so Spring Security can recover the same
                  // session that stored the OAuth authorization request.
                  const backendPath = backendBaseUrl.pathname.endsWith("/")
                    ? backendBaseUrl.pathname.slice(0, -1)
                    : backendBaseUrl.pathname;
                  if (backendPath && backendPath !== "/") {
                    throw new Error(
                      "NEXT_PUBLIC_API_URL must be the backend origin only, without an API path or /backend proxy prefix.",
                    );
                  }

                  if (backendBaseUrl.origin === window.location.origin) {
                    throw new Error(
                      "Google sign-in is pointing at the frontend instead of the backend. Set NEXT_PUBLIC_API_URL to your Spring Boot server URL, then restart Next.js.",
                    );
                  }

                  googleAuthUrl = new URL(
                    "/oauth2/authorization/google",
                    backendBaseUrl,
                  );
                  googleAuthUrl.searchParams.set("role", backendRole);
                } catch (configurationError) {
                  setGoogleLoading(false);
                  setError(
                    configurationError instanceof Error
                      ? configurationError.message
                      : "Google sign-in is not configured correctly. Check NEXT_PUBLIC_API_URL.",
                  );
                  return;
                }

                setGoogleLoading(true);
                sessionStorage.setItem("dynoquizz_google_role", backendRole);

                const redirect = searchParams.get("redirect") || "";
                if (redirect) {
                  sessionStorage.setItem("dynoquizz_post_login_redirect", redirect);
                } else {
                  sessionStorage.removeItem("dynoquizz_post_login_redirect");
                }

                window.location.assign(googleAuthUrl.toString());
              }}
              disabled={loading || googleLoading}
              aria-busy={googleLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {googleLoading ? <LoadingIndicator label="Connecting to Google" size="sm" /> : "Continue with Google"}
            </button>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-100" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                or continue with email
              </span>
              <div className="h-px flex-1 bg-neutral-100" />
            </div>
          </>
        )}

        <form onSubmit={handleSignupSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-slate-300 block">
                First name
              </label>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                autoComplete="given-name"
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
                autoComplete="family-name"
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
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
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
                autoComplete="off"
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
              autoComplete="tel"
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
                autoComplete="new-password"
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
              aria-live="polite"
              aria-atomic="false"
              className="grid grid-cols-1 gap-1 pt-1"
            >
              <p className={requirementClass(passwordRequirements.minLength)}>
                <span className="w-3 text-center">
                  {passwordRequirements.minLength ? "✓" : "×"}
                </span>
                At least 8 characters
              </p>

              <p className={requirementClass(passwordRequirements.uppercase)}>
                <span className="w-3 text-center">
                  {passwordRequirements.uppercase ? "✓" : "×"}
                </span>
                At least 1 uppercase letter
              </p>

              <p className={requirementClass(passwordRequirements.lowercase)}>
                <span className="w-3 text-center">
                  {passwordRequirements.lowercase ? "✓" : "×"}
                </span>
                At least 1 lowercase letter
              </p>

              <p className={requirementClass(passwordRequirements.number)}>
                <span className="w-3 text-center">
                  {passwordRequirements.number ? "✓" : "×"}
                </span>
                At least 1 number
              </p>

              <p className={requirementClass(passwordRequirements.special)}>
                <span className="w-3 text-center">
                  {passwordRequirements.special ? "✓" : "×"}
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
                autoComplete="new-password"
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
            className="mt-5 w-full cursor-pointer rounded-lg border-0 bg-[#165dfb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#104bd0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            {loading ? (
              <LoadingIndicator label="Creating account" size="sm" />
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="pt-1">
          <div className="h-px w-full bg-neutral-100 dark:bg-slate-700" />

          <p className="pt-4 text-center text-sm text-neutral-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              href={"/login?role=" + activeRole + (searchParams.get("redirect") ? "&redirect=" + encodeURIComponent(searchParams.get("redirect") || "") : "")}
              className="font-semibold text-neutral-900 underline-offset-4 hover:underline dark:text-slate-100"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
      </div>
    </main>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <>
          <PublicNavbar />
          <main className="public-auth min-h-[calc(100vh-4rem)] bg-neutral-50 px-4 py-8 font-sans dark:bg-slate-950 sm:px-8" aria-busy="true">
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
              <section className="w-full space-y-6 rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#165dfb] dark:bg-slate-800 dark:text-blue-300"><GraduationCap className="h-5 w-5" /></span>
                  <div className="flex-1 space-y-2"><SkeletonBlock className="h-5 w-44 rounded" /><SkeletonBlock className="h-3 w-56 max-w-full rounded" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map((field) => <div key={field} className="space-y-2"><SkeletonBlock className="h-3 w-16 rounded" /><SkeletonBlock className="h-11 w-full rounded-lg" /></div>)}
                </div>
                {[1, 2, 3].map((field) => <div key={field} className="space-y-2"><SkeletonBlock className="h-3 w-24 rounded" /><SkeletonBlock className="h-11 w-full rounded-lg" /></div>)}
                <SkeletonBlock className="h-11 w-full rounded-lg" />
                <p className="sr-only" role="status">Preparing signup form</p>
              </section>
            </div>
          </main>
        </>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
