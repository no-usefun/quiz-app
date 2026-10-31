import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin proxy for the configured Spring Boot API in both LAN and online modes.
 *
 * Browser requests go to this Next.js route, so browser CORS enforcement does
 * not block the frontend. The upstream request deliberately omits the Origin
 * header; authentication is still forwarded through the Authorization header.
 * NEXT_PUBLIC_API_URL selects the upstream server for the active environment.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!apiBase) {
    return NextResponse.json(
      { message: "NEXT_PUBLIC_API_URL is not configured on the frontend server." },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const upstreamUrl = new URL(
    path.map((segment) => encodeURIComponent(segment)).join("/") +
      request.nextUrl.search,
    apiBase.endsWith("/") ? apiBase : apiBase + "/",
  );

  const headers = new Headers(request.headers);
  headers.delete("origin");
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");

  // ngrok's free-tier browser interstitial can otherwise be returned as HTML
  // or plain text instead of the API response. This header asks ngrok to pass
  // the request through to the upstream application.
  headers.set("ngrok-skip-browser-warning", "true");

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" || method === "OPTIONS"
      ? undefined
      : await request.arrayBuffer();

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("connection");

    const responseBody =
      method === "HEAD" ||
      upstreamResponse.status === 204 ||
      upstreamResponse.status === 205 ||
      upstreamResponse.status === 304
        ? null
        : await upstreamResponse.arrayBuffer();

    return new Response(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "The frontend proxy could not reach the API server. Check NEXT_PUBLIC_API_URL and the backend tunnel.",
      },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const HEAD = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
