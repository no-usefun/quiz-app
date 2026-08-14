import { NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();
    
    const payload = {
      userId: email,
      email,
      role: role || "student",
      name: name || "New User",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    };
    
    const token = await signJWT(payload);
    
    const response = NextResponse.json({ success: true, user: payload });
    
    const cookieStore = await cookies();
    cookieStore.set("dynoquizz_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
    
    return response;
  } catch (e) {
    return NextResponse.json({ success: false, error: "Signup failed" }, { status: 400 });
  }
}
