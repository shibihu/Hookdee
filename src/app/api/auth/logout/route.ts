import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/auth/google";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true, authenticated: false });
  response.cookies.delete(USER_SESSION_COOKIE);
  return response;
}
