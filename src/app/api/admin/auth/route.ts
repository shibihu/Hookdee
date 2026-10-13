import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, getExpectedAdminSecret, isAdminAuthorized } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorized = await isAdminAuthorized(request);
  return NextResponse.json({ authorized });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const secret = body.secret || body.key;
    const expectedSecret = getExpectedAdminSecret();

    if (secret !== expectedSecret) {
      void logger.warn("Unauthorized admin login attempt", { ip: request.headers.get("x-real-ip") ?? "unknown" }, "admin/auth");
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Invalid admin key" },
        { status: 401 }
      );
    }

    void logger.info("Admin logged in successfully", {}, "admin/auth");
    const response = NextResponse.json({ success: true, authorized: true });

    response.cookies.set(ADMIN_COOKIE_NAME, expectedSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    void logger.error("Admin auth request error", { error: String(error) }, "admin/auth");
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to process login" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, authorized: false });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
