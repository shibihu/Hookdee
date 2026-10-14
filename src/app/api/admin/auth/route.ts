import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  generateAdminTokenForSecret,
  getExpectedAdminSecret,
  isAdminAuthorized,
} from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorized = await isAdminAuthorized(request);
  const secret = getExpectedAdminSecret();
  const token = authorized ? generateAdminTokenForSecret(secret) : null;
  return NextResponse.json({ authorized, token });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providedSecret = (body.secret || body.key || "").trim();
    const expectedSecret = getExpectedAdminSecret();

    if (!providedSecret || providedSecret !== expectedSecret) {
      void logger.warn("Unauthorized admin login attempt", { ip: request.headers.get("x-real-ip") ?? "unknown" }, "admin/auth");
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Invalid admin secret key" },
        { status: 401 }
      );
    }

    const token = generateAdminTokenForSecret(expectedSecret);

    void logger.info("Admin logged in successfully", { token }, "admin/auth");

    const response = NextResponse.json({
      success: true,
      authorized: true,
      token,
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
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
  const response = NextResponse.json({ success: true, authorized: false, token: null });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
