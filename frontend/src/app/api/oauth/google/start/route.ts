import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BackendRole = "STUDENT" | "TEACHER";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Probes the backend's OAuth authorization endpoint server-side before the
 * browser leaves the login/signup page. If Spring Boot returns a 4xx/5xx HTML
 * error page, the UI receives safe JSON instead of navigating to that page.
 *
 * This is only a preflight: the browser still starts the real OAuth flow
 * directly against the backend so the backend owns its OAuth session cookie.
 */
export async function GET(request: NextRequest) {
  const requestedRole = request.nextUrl.searchParams.get("role")?.trim().toUpperCase();
  if (requestedRole !== "STUDENT" && requestedRole !== "TEACHER") {
    return errorResponse("Choose Student or Instructor before signing in with Google.", 400);
  }

  const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configuredApiBase) {
    return errorResponse(
      "Google sign-in is not configured. NEXT_PUBLIC_API_URL must point to the Spring Boot backend.",
      503,
    );
  }

  let backendBaseUrl: URL;
  try {
    backendBaseUrl = new URL(configuredApiBase);
    if (
      (backendBaseUrl.protocol !== "http:" && backendBaseUrl.protocol !== "https:") ||
      !backendBaseUrl.hostname ||
      backendBaseUrl.username ||
      backendBaseUrl.password ||
      backendBaseUrl.search ||
      backendBaseUrl.hash
    ) {
      throw new Error("Invalid backend origin");
    }

    const normalizedPath = backendBaseUrl.pathname.endsWith("/")
      ? backendBaseUrl.pathname.slice(0, -1)
      : backendBaseUrl.pathname;
    if (normalizedPath && normalizedPath !== "") {
      throw new Error("NEXT_PUBLIC_API_URL must be a backend origin, not a path or proxy URL");
    }
  } catch {
    return errorResponse(
      "Google sign-in is not configured correctly. Set NEXT_PUBLIC_API_URL to the backend origin only (for example, https://your-api.example.com), without /backend or an API path.",
      503,
    );
  }

  const authorizationUrl = new URL("/oauth2/authorization/google", backendBaseUrl);
  authorizationUrl.searchParams.set("role", requestedRole as BackendRole);

  try {
    const upstream = await fetch(authorizationUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "text/html" },
    });

    const location = upstream.headers.get("location");
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      let destination: URL;
      try {
        destination = new URL(location, backendBaseUrl);
      } catch {
        return errorResponse(
          "The backend returned an invalid Google authorization redirect. Check the backend OAuth configuration.",
          502,
        );
      }

      const isGoogleAuthorization =
        destination.protocol === "https:" &&
        (destination.hostname === "accounts.google.com" ||
          destination.hostname.endsWith(".google.com"));

      if (isGoogleAuthorization) {
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      return errorResponse(
        "The backend did not redirect to Google's authorization page. Check the backend's OAuth profile and Google client configuration.",
        502,
      );
    }

    // Never forward a backend Whitelabel HTML page to the browser.
    const statusHint = upstream.status >= 400
      ? ` (HTTP ${upstream.status})`
      : "";
    return errorResponse(
      `Google sign-in could not be started${statusHint}. Check the backend logs and verify that OAuth is enabled and the Google client configuration is loaded.`,
      502,
    );
  } catch {
    return errorResponse(
      "The frontend could not reach the configured backend to start Google sign-in. Check NEXT_PUBLIC_API_URL and backend availability.",
      502,
    );
  }
}
