import { NextResponse } from "next/server";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export async function GET() {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${API_BASE}/ping`, {
      method: "GET",
      cache: "no-store",
    });

    const responseTimeMs = Date.now() - startedAt;

    /*
     * 401/403 means the backend was successfully reached,
     * but the /ping endpoint is protected by Spring Security.
     *
     * The backend is therefore reachable/alive, even though
     * the health endpoint did not allow anonymous access.
     */
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        status: "UP",
        backendStatus: response.status,
        authenticated: false,
        responseTimeMs,
        checkedAt: new Date().toISOString(),
        message:
          "Backend is reachable, but the health endpoint requires authentication.",
      });
    }

    /*
     * Any other non-2xx response means the backend responded
     * but the health check itself failed.
     */
    if (!response.ok) {
      return NextResponse.json(
        {
          status: "DOWN",
          backendStatus: response.status,
          responseTimeMs,
          checkedAt: new Date().toISOString(),
          message: `Backend responded with HTTP ${response.status}.`,
        },
        { status: 503 },
      );
    }

    /*
     * Normal healthy response.
     */
    let backendData: unknown = null;

    try {
      backendData = await response.json();
    } catch {
      // Backend returned a successful response but no JSON body.
    }

    return NextResponse.json({
      status: "UP",
      backendStatus: response.status,
      authenticated: true,
      backend: backendData,
      responseTimeMs,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    /*
     * Network error, timeout, DNS error, Render unavailable,
     * or backend could not be reached.
     */
    const responseTimeMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        status: "DOWN",
        backendStatus: null,
        responseTimeMs,
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : "Unable to reach backend.",
      },
      { status: 503 },
    );
  }
}
