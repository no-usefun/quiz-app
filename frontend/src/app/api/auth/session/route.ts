import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("dynoquizz_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const nextResponse = NextResponse.json(
        { user: null },
        { status: response.status === 401 ? 401 : 200 },
      );

      if (response.status === 401 || response.status === 403) {
        nextResponse.cookies.delete("dynoquizz_token");
      }

      return nextResponse;
    }

    const user = await response.json();
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
