import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  generateAdminToken,
  getActiveAdminToken,
  getExpectedAdminSecret,
  isAdminAuthorized,
  setActiveAdminToken,
} from "@/lib/admin/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorized = await isAdminAuthorized(request);
  const activeToken = authorized ? await getActiveAdminToken() : null;
  return NextResponse.json({ authorized, token: activeToken });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const secret = body.secret || body.key;
    const expectedSecret = getExpectedAdminSecret();
    const activeToken = await getActiveAdminToken();

    // Check if provided secret matches expected secret OR existing active token
    const isValidSecret = secret && (secret === expectedSecret || (activeToken && secret === activeToken));

    if (!isValidSecret) {
      void logger.warn("Unauthorized admin login attempt", { ip: request.headers.get("x-real-ip") ?? "unknown" }, "admin/auth");
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Invalid admin key" },
        { status: 401 }
      );
    }

    // Generate fresh 64-character token
    const newToken = generateAdminToken();
    await setActiveAdminToken(newToken);

    void logger.info("Admin logged in successfully", { token: newToken }, "admin/auth");

    const response = NextResponse.json({
      success: true,
      authorized: true,
      token: newToken,
    });

    response.cookies.set(ADMIN_COOKIE_NAME, newToken, {
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
