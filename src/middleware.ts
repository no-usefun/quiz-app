import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const JWT_SECRET = "dynoquizz-super-secret-key-change-in-prod";

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyToken(token: string): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  try {
    const key = await getCryptoKey(JWT_SECRET);
    const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    
    // Decode signature
    const signatureBin = new Uint8Array(
      atob(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    
    const isValid = await crypto.subtle.verify("HMAC", key, signatureBin, data);
    if (!isValid) return null;
    
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get("dynoquizz_token")?.value;
  
  // Decrypt and verify
  let user = null;
  if (token) {
    user = await verifyToken(token);
  }
  
  const isAuthRoute = path.startsWith("/dashboard") || path.startsWith("/settings") || path.startsWith("/test");
  const isGuestRoute = path === "/" || path === "/login" || path === "/signup";
  
  if (isAuthRoute) {
    if (!user) {
      // Unauthenticated -> redirect to /login
      const url = new URL("/login", request.url);
      // Keep search params like original path if necessary
      return NextResponse.redirect(url);
    }
    
    // Role checks
    if (path.startsWith("/dashboard/teacher") && user.role !== "teacher") {
      return NextResponse.redirect(new URL("/dashboard/student", request.url));
    }
    if (path.startsWith("/dashboard/student") && user.role !== "student") {
      return NextResponse.redirect(new URL("/dashboard/teacher", request.url));
    }
  }
  
  if (isGuestRoute && user) {
    // Authenticated user -> redirect to their dashboard
    const dashboardPath = user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student";
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/settings/:path*",
    "/test/:path*",
  ],
};
