import { NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { cookies } from "next/headers";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export async function POST(request: Request) {
  try {
    const { email, password, role, name } = await request.json();
    const normalizedRole = (role || "STUDENT").toUpperCase();

    // 1. Attempt Spring Boot backend authentication
    try {
      const backendRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: normalizedRole }),
      });

      if (backendRes.ok) {
        const backendData = await backendRes.json();
        const returnedRole = (backendData.role || backendData.user?.role || normalizedRole).toUpperCase();
        const finalToken = backendData.token || backendData.accessToken;

        const payload = {
          userId: backendData.userId || email,
          email,
          role: returnedRole,
          name: backendData.name || backendData.user?.name || name || "User",
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
      } else if (backendRes.status === 401 || backendRes.status === 400) {
        const errorData = await backendRes.json().catch(() => ({}));
        return NextResponse.json(
          { success: false, error: errorData.message || errorData.error || "Invalid email or password." },
          { status: backendRes.status },
        );
      }
    } catch {
      // Backend not running/unreachable, fallback to local authentication
    }

    // 2. Offline fallback authentication
    const finalName = name || (normalizedRole === "TEACHER" ? "Instructor Account" : "Student User");
    const payload = {
      userId: email,
      email,
      role: normalizedRole,
      name: finalName,
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
    return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 400 });
  }
}
