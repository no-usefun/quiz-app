import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type TokenClaims = {
  exp?: number;
  role?: string;
  email?: string;
  userId?: number | string;
};

function decodeBase64Url(value: string): string {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");

  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  try {
    return atob(base64);
  } catch {
    return "";
  }
}

function normalizeRole(role: unknown): "teacher" | "student" | null {
  const value = String(role ?? "")
    .trim()
    .toUpperCase();

  if (value === "TEACHER" || value === "ROLE_TEACHER") {
    return "teacher";
  }

  if (value === "STUDENT" || value === "ROLE_STUDENT") {
    return "student";
  }

  return null;
}

function decodeToken(token: string): TokenClaims | null {
  const cleanToken = token.trim();

  if (!cleanToken) return null;

  const parts = cleanToken.split(".");

  if (parts.length !== 3) return null;

  try {
    const payloadJson = decodeBase64Url(parts[1]);

    if (!payloadJson) return null;

    const payload = JSON.parse(payloadJson) as TokenClaims;

    if (
      payload.exp !== undefined &&
      (!Number.isFinite(Number(payload.exp)) ||
        Date.now() / 1000 >= Number(payload.exp))
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function clearInvalidToken(
  request: NextRequest,
  redirectPath?: string,
): NextResponse {
  const url = new URL("/login", request.url);

  if (redirectPath) {
    url.searchParams.set("redirect", redirectPath);
  }

  const response = NextResponse.redirect(url);

  response.cookies.delete("dynoquizz_token");

  return response;
}

function redirectWithRole(
  request: NextRequest,
  role: "teacher" | "student",
): NextResponse {
  return NextResponse.redirect(
    new URL(
      role === "teacher" ? "/dashboard/teacher" : "/dashboard/student",
      request.url,
    ),
  );
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const rawCookieToken =
    request.cookies.get("dynoquizz_token")?.value?.trim() || "";

  /*
   * The proxy only performs lightweight route gating.
   *
   * It cannot safely reproduce the backend's HMAC signature verification
   * because the JWT secret must never be exposed to the Next.js runtime.
   * The Spring Security backend remains the authoritative authentication
   * and authorization layer for every protected API request.
   */
  const token = rawCookieToken
    ? (() => {
        try {
          return decodeURIComponent(rawCookieToken);
        } catch {
          return rawCookieToken;
        }
      })()
    : "";

  const claims = token ? decodeToken(token) : null;
  const role = normalizeRole(claims?.role);

  const isGuestRoute = path === "/login" || path === "/signup";

  const isDashboardRoute =
    path === "/dashboard" || path.startsWith("/dashboard/");
  const isSettingsRoute = path === "/settings" || path.startsWith("/settings/");

  const isStudentExamRoute =
    path === "/join" ||
    path.startsWith("/join/") ||
    path === "/test" ||
    path.startsWith("/test/");

  /*
   * Any route that needs an authenticated browser session.
   */
  if (isDashboardRoute || isSettingsRoute || isStudentExamRoute) {
    if (!claims || !role) {
      return clearInvalidToken(request, path + (request.nextUrl.search || ""));
    }
  }

  /*
   * /dashboard is a role-neutral entry point. Send the user to the
   * correct dashboard based on the role embedded in the backend-issued JWT.
   */
  if (path === "/dashboard") {
    return redirectWithRole(request, role);
  }

  /*
   * Teacher dashboard must never be shown to a student.
   */
  if (path.startsWith("/dashboard/teacher") && role !== "teacher") {
    return redirectWithRole(request, role);
  }

  /*
   * Student dashboard must never be shown to a teacher.
   */
  if (path.startsWith("/dashboard/student") && role !== "student") {
    return redirectWithRole(request, role);
  }

  /*
   * /join and /test are student exam routes.
   * The backend also enforces ROLE_STUDENT, but keeping the browser route
   * aligned avoids sending teachers into an exam UI they cannot use.
   */
  if (isStudentExamRoute && role !== "student") {
    return redirectWithRole(request, role);
  }

  /*
   * Authenticated users should not return to login/signup.
   * Their canonical dashboard is determined by the JWT role.
   */
  if (isGuestRoute && claims && role) {
    return redirectWithRole(request, role);
  }

  /*
   * A malformed/expired cookie on a guest route should not persist.
   */
  if (isGuestRoute && rawCookieToken && !claims) {
    const response = NextResponse.next();
    response.cookies.delete("dynoquizz_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/settings/:path*",
    "/join",
    "/join/:path*",
    "/test",
    "/test/:path*",
  ],
};
