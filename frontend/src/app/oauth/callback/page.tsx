"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { ApiClientError, api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

type BackendRole = "TEACHER" | "STUDENT";

type OAuthUser = {
  id?: number;
  userId?: number;
  firstName?: string;
  lastName?: string | null;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string;
  registrationNo?: string | null;
  profileComplete?: boolean;
  active?: boolean;
  [key: string]: unknown;
};

type OAuthStatus = "processing" | "success" | "error";

function normalizeRole(value: unknown): BackendRole | null {
  const role = String(value ?? "").trim().toUpperCase();

  if (role === "TEACHER" || role === "ROLE_TEACHER") {
    return "TEACHER";
  }

  if (role === "STUDENT" || role === "ROLE_STUDENT") {
    return "STUDENT";
  }

  return null;
}

function getSafeRedirect(value: string | null): string | null {
  const target = String(value ?? "").trim();

  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return null;
  }

  return target;
}

function getCallbackValue(
  searchParams: URLSearchParams,
  hashParams: URLSearchParams,
  names: string[],
): string | null {
  for (const name of names) {
    const searchValue = searchParams.get(name);
    if (searchValue) return searchValue;

    const hashValue = hashParams.get(name);
    if (hashValue) return hashValue;
  }

  return null;
}

function parseHashParams(): URLSearchParams {
  if (typeof window === "undefined" || !window.location.hash) {
    return new URLSearchParams();
  }

  const rawHash = window.location.hash.replace(/^#\/?/, "");
  return new URLSearchParams(rawHash);
}

function cleanOAuthStorage() {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem("dynoquizz_google_role");
  sessionStorage.removeItem("dynoquizz_post_login_redirect");
}

function clearOAuthSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("dynoquizz_token");
  localStorage.removeItem("token");
  localStorage.removeItem("dynoquizz_user");
  localStorage.removeItem("dynoquizz_role");
  localStorage.removeItem("dynoquizz_regNo");

  document.cookie =
    "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=lax";
}

function persistOAuthSession(token: string, user: OAuthUser, expiresIn: unknown) {
  if (typeof window === "undefined") return;

  const cleanToken = token.replace(/^["']|["']$/g, "").trim();

  if (!cleanToken || cleanToken === "undefined" || cleanToken === "null") {
    throw new Error("Google authentication did not return a valid session token.");
  }

  const role = normalizeRole(user.role);

  if (!role) {
    throw new Error("Google authentication returned an invalid account role.");
  }

  localStorage.setItem("dynoquizz_token", cleanToken);
  localStorage.removeItem("token");
  localStorage.setItem("dynoquizz_user", JSON.stringify(user));
  localStorage.setItem("dynoquizz_role", role);

  if (user.registrationNo) {
    localStorage.setItem(
      "dynoquizz_regNo",
      String(user.registrationNo).trim().toUpperCase(),
    );
  } else {
    localStorage.removeItem("dynoquizz_regNo");
  }

  const expiresInMs = Number(expiresIn);
  const maxAgeSeconds =
    Number.isFinite(expiresInMs) && expiresInMs > 0
      ? Math.max(1, Math.floor(expiresInMs / 1000))
      : 86400;

  document.cookie =
    "dynoquizz_token=" +
    encodeURIComponent(cleanToken) +
    "; path=/; max-age=" +
    maxAgeSeconds +
    "; samesite=lax";
}

function getOAuthErrorMessage(code: string | null, fallback: string | null) {
  const normalizedCode = String(code ?? "").trim().toUpperCase();

  switch (normalizedCode) {
    case "ROLE_MISMATCH":
      return "This Google account is registered for a different role. Please return to the role-selection login and choose the correct option.";
    case "SSO_EMAIL_ALREADY_EXISTS":
      return "An account with this email already exists. Please use the existing account instead of creating another one with Google.";
    case "SSO_AUTHENTICATION_FAILED":
      return "We could not complete Google sign-in. Please try again.";
    case "SSO_EMAIL_NOT_VERIFIED":
      return "Your Google account email must be verified before you can sign in.";
    case "SSO_STATE_INVALID":
      return "The Google sign-in session is no longer valid. Please start the sign-in again.";
    case "SSO_IDENTITY_INVALID":
      return "Google did not return the account information required to complete sign-in.";
    case "ACCESS_DENIED":
    case "USER_CANCELLED":
      return "Google sign-in was cancelled.";
    default:
      return fallback?.trim() || "Google sign-in could not be completed. Please try again.";
  }
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<OAuthStatus>("processing");
  const [message, setMessage] = useState("Completing Google sign-in...");

  useEffect(() => {
    let cancelled = false;

    const completeOAuth = async () => {
      if (typeof window === "undefined") return;

      const hashParams = parseHashParams();
      const selectedRole = normalizeRole(
        sessionStorage.getItem("dynoquizz_google_role"),
      );
      const savedRedirect =
        getSafeRedirect(
          sessionStorage.getItem("dynoquizz_post_login_redirect"),
        ) ||
        getSafeRedirect(
          searchParams.get("redirect"),
        );

      const token = getCallbackValue(
        searchParams,
        hashParams,
        ["token", "access_token", "jwt"],
      );

      const code = getCallbackValue(
        searchParams,
        hashParams,
        ["code", "errorCode", "error"],
      );

      const callbackMessage = getCallbackValue(
        searchParams,
        hashParams,
        ["message", "error_description"],
      );

      /*
       * Remove callback query/hash values from the visible URL immediately.
       * The token is never rendered or logged by the frontend.
       */
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );

      if (!token) {
        const errorMessage = getOAuthErrorMessage(code, callbackMessage);

        clearOAuthSession();
        cleanOAuthStorage();

        if (!cancelled) {
          setStatus("error");
          setMessage(errorMessage);
        }
        return;
      }

      try {
        const expiresInParam = getCallbackValue(
          searchParams,
          hashParams,
          ["expiresIn", "expires_in"],
        );

        const meData = await api.get<OAuthUser>(ENDPOINTS.auth.me, {
          token,
          cache: "no-store",
        });

        const backendRole = normalizeRole(meData?.role);

        if (!backendRole) {
          throw new Error("Google authentication returned an invalid account role.");
        }

        if (selectedRole && backendRole !== selectedRole) {
          clearOAuthSession();
          cleanOAuthStorage();

          if (!cancelled) {
            setStatus("error");
            setMessage(
              "The Google account role does not match the role you selected. Please return to login and choose the correct role.",
            );
          }
          return;
        }

        if (meData?.active === false) {
          throw new Error("Your account is disabled.");
        }

        const normalizedUser: OAuthUser = {
          ...meData,
          role: backendRole,
          name:
            meData.fullName ||
            meData.name ||
            [meData.firstName, meData.lastName].filter(Boolean).join(" "),
        };

        persistOAuthSession(token, normalizedUser, expiresInParam);

        const destination =
          normalizedUser.profileComplete === false
            ? "/settings?profile=complete"
            : savedRedirect ||
              (backendRole === "TEACHER"
                ? "/dashboard/teacher"
                : "/dashboard/student");

        cleanOAuthStorage();

        if (!cancelled) {
          setStatus("success");
          setMessage("Google sign-in completed. Redirecting...");
          window.setTimeout(() => {
            if (!cancelled) {
              router.replace(destination);
            }
          }, 250);
        }
      } catch (error) {
        clearOAuthSession();
        cleanOAuthStorage();

        let nextMessage = "We could not complete Google sign-in. Please try again.";

        if (error instanceof ApiClientError) {
          nextMessage = getOAuthErrorMessage(
            error.errorCode,
            error.message,
          );
        } else if (error instanceof Error) {
          nextMessage = error.message;
        }

        if (!cancelled) {
          setStatus("error");
          setMessage(nextMessage);
        }
      }
    };

    void completeOAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] px-4 font-sans text-[#111111]">
      <section className="w-full max-w-md rounded-[16px] border border-[#d1dee8]/70 bg-white p-7 text-center shadow-sm">
        {status === "processing" && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e6e3e2] text-[#165dfb]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {status === "success" && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e2ede8] text-[#1d5237]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        )}

        {status === "error" && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] text-[#8c381c]">
            <ShieldAlert className="h-6 w-6" />
          </div>
        )}

        <h1 className="mt-4 text-xl font-extrabold">
          {status === "processing"
            ? "Signing you in"
            : status === "success"
              ? "Signed in"
              : "Google sign-in failed"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[#78716b]">{message}</p>

        {status === "error" && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#111111] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#222222]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Login
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-xs font-semibold text-[#78716b]">
          Completing Google sign-in...
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
