import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

function decodeToken(token: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const jsonStr = base64urlDecode(parts[1]);
    if (!jsonStr) return null;
    const payload = JSON.parse(jsonStr);
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get("dynoquizz_token")?.value;

  let user: any = null;
  if (token) {
    user = decodeToken(token);
  }

  const isAuthRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/settings");

  const isGuestRoute = path === "/login" || path === "/signup";

  const isStudentExamRoute = path === "/join" || path.startsWith("/join/") || path.startsWith("/test/");

  if (isAuthRoute) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(loginUrl);
    }

    const role = (user.role || "").toLowerCase();

    if (path.startsWith("/dashboard/teacher") && role !== "teacher") {
      return NextResponse.redirect(new URL("/dashboard/student", request.url));
    }
    if (path.startsWith("/dashboard/student") && role !== "student") {
      return NextResponse.redirect(new URL("/dashboard/teacher", request.url));
    }
  }

  if (isStudentExamRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("role", "student");
    loginUrl.searchParams.set("redirect", path + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestRoute && user) {
    const role = (user.role || "").toLowerCase();
    const dashboardPath =
      role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  if (isGuestRoute && !user && token) {
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
    "/test/:path*",
  ],
};
