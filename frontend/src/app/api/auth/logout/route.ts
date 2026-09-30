import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function clearAuthCookie() {
  const cookieStore = await cookies();

  cookieStore.set("dynoquizz_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function POST() {
  await clearAuthCookie();

  return NextResponse.json({ success: true });
}

export async function GET() {
  await clearAuthCookie();

  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  );
}
