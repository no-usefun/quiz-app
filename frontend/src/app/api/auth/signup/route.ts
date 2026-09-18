import { NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { cookies } from "next/headers";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();
    const normalizedRole = (role || "STUDENT").toUpperCase();

    // 1. Attempt Spring Boot backend registration
    try {
      const backendRes = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: normalizedRole }),
      });

      if (backendRes.ok) {
        const backendData = await backendRes.json();
        const returnedRole = (backendData.role || backendData.user?.role || normalizedRole).toUpperCase();
        const finalToken = backendData.token || backendData.accessToken;

        const payload = {
          userId: backendData.userId || email,
          email,
          role: returnedRole,
          name: backendData.name || backendData.user?.name || name || "New User",
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        };

        const token = finalToken || (await signJWT(payload));
        const cookieStore = await cookies();
        cookieStore.set("dynoquizz_token", token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24,
          path: "/",
        });

        return NextResponse.json({
          success: true,
          token,
          user: payload,
          role: returnedRole,
        });
      } else if (backendRes.status === 400 || backendRes.status === 409) {
        const errorData = await backendRes.json().catch(() => ({}));
        return NextResponse.json(
          { success: false, error: errorData.message || errorData.error || "Email is already registered." },
          { status: backendRes.status },
        );
      }
    } catch {
      // Backend not running/unreachable, fallback to local creation
    }

    // 2. Offline fallback registration
    const payload = {
      userId: email,
      email,
      role: normalizedRole,
      name: name || "New User",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };

    const token = await signJWT(payload);
    const cookieStore = await cookies();
    cookieStore.set("dynoquizz_token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return NextResponse.json({ success: true, token, user: payload, role: normalizedRole });
  } catch {
    return NextResponse.json({ success: false, error: "Signup failed." }, { status: 400 });
  }
}
