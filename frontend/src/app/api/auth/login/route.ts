import { NextResponse } from "next/server";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function getErrorMessage(data: any): string {
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  return "Login failed.";
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      {
        success: false,
        error: "Email and password are required.",
      },
      { status: 400 },
    );
  }

  try {
    /*
     * This route is only a compatibility proxy for the legacy AuthForm.
     *
     * Spring Boot owns:
     * - credential validation;
     * - email verification;
     * - account status;
     * - JWT generation;
     * - authenticated user/role.
     *
     * Do NOT generate another JWT in Next.js.
     */
    const backendResponse = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
      cache: "no-store",
    });

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(data),
          message: data?.message,
          code: data?.error,
        },
        {
          status: backendResponse.status,
        },
      );
    }

    const token = typeof data?.token === "string" ? data.token.trim() : "";

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication server did not return a session token.",
        },
        { status: 502 },
      );
    }

    const user = data?.user ?? null;
    const role =
      typeof user?.role === "string" ? user.role.toUpperCase() : undefined;

    /*
     * AuthResponse.expiresIn is returned by the backend in milliseconds.
     * Convert it to cookie max-age seconds, with a safe one-day fallback.
     */
    const expiresInMs =
      Number.isFinite(Number(data?.expiresIn)) && Number(data.expiresIn) > 0
        ? Number(data.expiresIn)
        : 24 * 60 * 60 * 1000;

    const maxAgeSeconds = Math.max(1, Math.floor(expiresInMs / 1000));

    const response = NextResponse.json(
      {
        success: true,
        token,
        user,
        role,
        tokenType: data?.tokenType || "Bearer",
        expiresIn: data?.expiresIn,
      },
      { status: backendResponse.status },
    );

    /*
     * Keep the cookie readable because the current route-protection proxy
     * and browser session helpers use dynoquizz_token.
     *
     * The token itself is still created and cryptographically signed only
     * by Spring Boot.
     */
    response.cookies.set("dynoquizz_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAgeSeconds,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Authentication proxy error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Cannot connect to the authentication server.",
      },
      { status: 503 },
    );
  }
}
