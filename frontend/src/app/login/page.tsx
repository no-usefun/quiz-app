"use client";

import LoadingIndicator from "@/components/LoadingIndicator";
import SkeletonBlock from "@/components/SkeletonBlock";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, Presentation, Lock } from "lucide-react";
import { ApiClientError, api, clearApiCache } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { isLanExamMode } from "@/lib/examMode";
import { PublicNavbar } from "@/components/PublicNavbar";
import type { AuthResponse } from "@/lib/types";

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

type Role = "teacher" | "student";

function isTokenUsable(token: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64));
    return !payload.exp || Date.now() / 1000 < Number(payload.exp);
  } catch {
    return false;
  }
}

function clearStoredSession() {
  if (typeof window === "undefined") return;

  for (const key of [
    "dynoquizz_token",
    "token",
    "dynoquizz_user",
    "dynoquizz_role",
    "dynoquizz_attemptId",
    "dynoquizz_regNo",
  ]) {
    localStorage.removeItem(key);
  }

  sessionStorage.removeItem("dynoquizz_google_role");
  sessionStorage.removeItem("dynoquizz_post_login_redirect");

  document.cookie =
    "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=lax";
}

function normalizeRole(value: unknown): "TEACHER" | "STUDENT" | null {
  const role = String(value ?? "").trim().toUpperCase();
  if (role === "TEACHER") return "TEACHER";
  if (role === "STUDENT") return "STUDENT";
  return null;
}

function getRoleFromQuery(value: string | null): Role | null {
  if (value === "teacher" || value === "instructor" || value === "educator") return "teacher";
  if (value === "student" || value === "candidate") return "student";
  return null;
}

function roleToBackendRole(role: Role): "TEACHER" | "STUDENT" {
  return role === "teacher" ? "TEACHER" : "STUDENT";
}

function roleDestination(role: "TEACHER" | "STUDENT"): string {
  return role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
}

function getPostAuthDestination(
  role: "TEACHER" | "STUDENT",
  redirectTarget: string,
): string {
  return redirectTarget || roleDestination(role);
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeRole = getRoleFromQuery(searchParams.get("role"));
  const redirectTarget = searchParams.get("redirect") || "";
  const selectedBackendRole = activeRole ? roleToBackendRole(activeRole) : null;
  const lanExamMode = isLanExamMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("dynoquizz_token");
    if (!token) return;

    if (!isTokenUsable(token)) {
      clearStoredSession();
      return;
    }

    let cancelled = false;

    const verifyExistingSession = async () => {
      try {
        const response = await fetch(ENDPOINTS.auth.me, {
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          clearStoredSession();
          return;
        }

        const user = await response.json();
        const backendRole = normalizeRole(user?.role);

        if (!backendRole || cancelled) return;

        localStorage.setItem("dynoquizz_user", JSON.stringify(user));
        localStorage.setItem("dynoquizz_role", backendRole);
        window.location.href = getPostAuthDestination(backendRole, redirectTarget);
      } catch {
        // Keep the login screen usable when the backend is temporarily offline.
      }
    };

    void verifyExistingSession();

    return () => {
      cancelled = true;
    };
  }, [redirectTarget]);

  const handleGoogleAuth = async () => {
    if (!selectedBackendRole) return;

    if (lanExamMode) {
      setError("Google sign-in is unavailable in LAN exam mode. Use your local exam account.");
      return;
    }

    setError("");

    // OAuth is a top-level browser redirect, not an API fetch. Start it against
    // the backend origin directly so the backend's OAuth state/session cookie is
    // stored for the same host that receives Google's callback. Routing the
    // initial redirect through the frontend proxy can scope that cookie to the
    // frontend host and break callback state validation across different hosts.
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

      // OAuth must start at the backend origin itself, not through Next.js's
      // same-origin /backend proxy. That lets Spring Security save and recover
      // the OAuth authorization request/session on the same backend host.
      const backendPath = backendBaseUrl.pathname.endsWith("/")
        ? backendBaseUrl.pathname.slice(0, -1)
        : backendBaseUrl.pathname;
      if (backendPath && backendPath !== "/") {
        throw new Error(
          "NEXT_PUBLIC_API_URL must be the backend origin only (for example, http://localhost:8080), without an API path or /backend proxy prefix.",
        );
      }

      if (backendBaseUrl.origin === window.location.origin) {
        throw new Error(
          "Google sign-in is pointing at the frontend instead of the backend. Set NEXT_PUBLIC_API_URL to the Spring Boot server address (for example, http://localhost:8080 or your deployed backend URL), then restart Next.js.",
        );
      }

      googleAuthUrl = new URL("/oauth2/authorization/google", backendBaseUrl);
      googleAuthUrl.searchParams.set("role", selectedBackendRole);
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
    try {
      const preflightResponse = await fetch(
        `/api/oauth/google/start?role=${encodeURIComponent(selectedBackendRole)}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      const preflight = (await preflightResponse.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!preflightResponse.ok || preflight.ok !== true) {
        setGoogleLoading(false);
        setError(
          preflight.message ||
            "Google sign-in could not be started. Check the backend OAuth configuration.",
        );
        return;
      }
    } catch {
      setGoogleLoading(false);
      setError(
        "Could not verify Google sign-in with the backend. Check the connection and NEXT_PUBLIC_API_URL, then try again.",
      );
      return;
    }

    sessionStorage.setItem("dynoquizz_google_role", selectedBackendRole);

    if (redirectTarget) {
      sessionStorage.setItem("dynoquizz_post_login_redirect", redirectTarget);
    }

    window.location.assign(googleAuthUrl.toString());
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBackendRole) return;

    setError("");

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const data = await api.post<AuthResponse>(
        ENDPOINTS.auth.login,
        {
          email: trimmedEmail,
          password,
        },
        {
          skipAuth: true,
          cache: "no-store",
        },
      );

      const token = typeof data?.token === "string" ? data.token.trim() : "";
      if (!token) {
        throw new Error("Login succeeded but the backend did not return a session token.");
      }

      const meData = await api.get<AuthResponse["user"]>(ENDPOINTS.auth.me, {
        token,
        retry: 2,
        retryDelayMs: 300,
        cache: "no-store",
      });

      const backendRole = normalizeRole(meData?.role || data?.user?.role);
      if (!backendRole) {
        throw new Error("The backend returned an invalid account role.");
      }

      if (backendRole !== selectedBackendRole) {
        throw new Error("This account is registered for a different role. Please use the corresponding login option.");
      }

      clearApiCache();
      localStorage.setItem("dynoquizz_token", token);
      localStorage.removeItem("token");
      localStorage.setItem("dynoquizz_user", JSON.stringify(meData));
      localStorage.setItem("dynoquizz_role", backendRole);

      if (meData?.registrationNo) {
        localStorage.setItem("dynoquizz_regNo", String(meData.registrationNo).trim().toUpperCase());
      }

      const expiresInMs = Number(data?.expiresIn);
      const maxAgeSeconds = Number.isFinite(expiresInMs) && expiresInMs > 0
        ? Math.max(1, Math.floor(expiresInMs / 1000))
        : 86400;

      document.cookie =
        "dynoquizz_token=" +
        encodeURIComponent(token) +
        "; path=/; max-age=" +
        maxAgeSeconds +
        "; samesite=lax";

      router.refresh();
      window.location.href = getPostAuthDestination(backendRole, redirectTarget);
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError && requestError.status === 0
          ? lanExamMode
            ? "Unable to reach the local exam server. Check the LAN connection, backend status, and NEXT_PUBLIC_API_URL."
            : "Unable to reach the authentication service through the frontend API proxy. Check your connection, NEXT_PUBLIC_API_URL, and whether the backend tunnel is online."
          : requestError instanceof Error
            ? requestError.message
            : "Cannot connect to the authentication server.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!activeRole) {
    return (
      <>
      <PublicNavbar redirectTarget={redirectTarget} />
      <main className="public-role-selection min-h-[calc(100vh-4rem)] w-full grid grid-cols-1 md:grid-cols-2 font-sans transition-colors">
        <section className="role-student-panel group relative flex flex-col items-center justify-center bg-[#F9FAFB] p-8 text-center transition-colors duration-300 dark:bg-slate-950 sm:p-16">
          <div className="relative z-10 w-full max-w-xs space-y-6">
            <span className="role-panel-icon mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#111827]/5 text-[#111827] ring-1 ring-[#111827]/10 transition-transform duration-300 group-hover:-translate-y-0.5">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="role-panel-title text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-slate-100">Student</h1>
              <p className="role-panel-description mt-1 text-sm leading-relaxed text-[#6B7280] dark:text-slate-400">Take quizzes with an access code</p>
            </div>
            <Link href={"/login?role=student" + (redirectTarget ? "&redirect=" + encodeURIComponent(redirectTarget) : "")} className="role-panel-cta group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-black hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] dark:bg-blue-600 dark:hover:bg-blue-500">
              Continue as Student
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="role-instructor-panel group relative flex flex-col items-center justify-center border-t border-neutral-800 bg-[#0F172A] p-8 text-center transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 sm:p-16 md:border-l md:border-t-0">
          <div className="relative z-10 w-full max-w-xs space-y-6">
            <span className="role-panel-icon mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition-transform duration-300 group-hover:-translate-y-0.5">
              <Presentation className="h-6 w-6" />
            </span>
            <div>
              <h1 className="role-panel-title text-3xl sm:text-4xl font-bold tracking-tight text-white">Instructor</h1>
              <p className="role-panel-description mt-1 text-sm leading-relaxed text-[#94A3B8]">Create and manage quizzes</p>
            </div>
            <Link href={"/login?role=teacher" + (redirectTarget ? "&redirect=" + encodeURIComponent(redirectTarget) : "")} className="role-panel-cta group/btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-[#0F172A] shadow-sm transition-all hover:bg-neutral-100 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              Continue as Instructor
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      </>
    );
  }

  const roleLabel = activeRole === "teacher" ? "Instructor" : "Student";

  return (
    <>
    <PublicNavbar redirectTarget={redirectTarget} />
    <main className="public-auth min-h-[calc(100vh-4rem)] bg-neutral-50 px-4 py-8 font-sans text-[#111827] transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
        <div className="w-full rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-none sm:p-8">
          <button type="button" onClick={() => router.push("/login" + (redirectTarget ? "?redirect=" + encodeURIComponent(redirectTarget) : ""))} className="mb-6 inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-neutral-400 transition-colors hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-100">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to roles
          </button>

          <div className="mb-6">
            {lanExamMode && (
              <span className="mt-2 inline-flex rounded-full bg-[#e8f0ff] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#165dfb] dark:bg-blue-950 dark:text-blue-200">
                LAN Exam Mode · Local Authentication
              </span>
            )}
            <span
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${
                activeRole === "teacher"
                  ? "bg-[#0F172A] text-white ring-[#0F172A]/20 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                  : "bg-neutral-100 text-neutral-900 ring-neutral-900/10 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900"
              }`}
            >
              {activeRole === "teacher" ? (
                <Presentation className="h-5 w-5" />
              ) : (
                <GraduationCap className="h-5 w-5" />
              )}
            </span>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-slate-100">Log in as {roleLabel}</h1>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-200">{error}</div>
          )}

          {!lanExamMode && (
          <button type="button" onClick={handleGoogleAuth} disabled={loading || googleLoading} aria-busy={googleLoading} className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-700">
            <GoogleIcon />
            {googleLoading ? <LoadingIndicator label="Connecting to Google" size="sm" /> : "Sign in with Google"}
          </button>
          )}

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-100 dark:bg-slate-700" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-slate-500">or</span>
            <div className="h-px flex-1 bg-neutral-100 dark:bg-slate-700" />
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700 dark:text-slate-300">Email address</label>
              <input type="email" value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder="name@example.com" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required aria-invalid={!!error} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-[#165dfb]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-400" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-slate-300">Password</label>
                {!lanExamMode && activeRole && (
                  <Link
                    href={"/forgot-password?role=" + activeRole}
                    className="text-[10px] font-bold text-[#165dfb] hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }} placeholder="••••••••" autoComplete="current-password" required aria-invalid={!!error} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 pr-10 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-[#165dfb]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-950 dark:focus:ring-blue-400" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2.5 top-1/2 -translate-y-1/2 border-0 bg-transparent p-1.5 text-neutral-400 transition-colors hover:text-neutral-800 dark:text-slate-400 dark:hover:text-slate-100">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#165dfb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#104bd0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <LoadingIndicator label="Signing in" size="sm" /> : "Log in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-neutral-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href={`/signup?role=${activeRole}${redirectTarget ? `&redirect=${encodeURIComponent(redirectTarget)}` : ""}`} className="font-bold text-neutral-900 hover:underline dark:text-slate-100">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <>
          <PublicNavbar />
          <main className="public-auth min-h-[calc(100vh-4rem)] bg-neutral-50 px-4 py-8 font-sans dark:bg-slate-950 sm:px-8" aria-busy="true">
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center">
              <section className="w-full space-y-6 rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#165dfb] dark:bg-slate-800 dark:text-blue-300"><Lock className="h-5 w-5" /></span>
                  <div className="flex-1 space-y-2"><SkeletonBlock className="h-5 w-40 rounded" /><SkeletonBlock className="h-3 w-56 max-w-full rounded" /></div>
                </div>
                <div className="space-y-4">
                  {[1, 2].map((field) => <div key={field} className="space-y-2"><SkeletonBlock className="h-3 w-20 rounded" /><SkeletonBlock className="h-11 w-full rounded-lg" /></div>)}
                </div>
                <SkeletonBlock className="h-11 w-full rounded-lg" />
                <div className="flex items-center gap-3"><SkeletonBlock className="h-px flex-1 rounded" /><SkeletonBlock className="h-3 w-8 rounded" /><SkeletonBlock className="h-px flex-1 rounded" /></div>
                <SkeletonBlock className="h-11 w-full rounded-lg" />
              </section>
            </div>
            <p className="sr-only" role="status">Preparing login form</p>
          </main>
        </>
      }
    >
      <LoginContent />
    </Suspense>
  );
}