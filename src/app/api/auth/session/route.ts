import { NextResponse } from "next/server";
import { verifyJWT } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("dynoquizz_token")?.value;
    
    if (!token) {
      return NextResponse.json({ user: null });
    }
    
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ user: null });
    }
    
    return NextResponse.json({ user: payload });
  } catch (e) {
    return NextResponse.json({ user: null });
  }
}
