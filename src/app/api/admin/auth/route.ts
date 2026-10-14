import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  PENDING_2FA_COOKIE_NAME,
  createPendingChallengeToken,
  generateAdminTokenForSecret,
  getExpectedAdminSecret,
  isAdminAuthorized,
} from "@/lib/admin/auth";
import { getAdmin2FASetting } from "@/lib/admin/totp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorized = await isAdminAuthorized(request);
  const secret = getExpectedAdminSecret();
  const token = authorized ? generateAdminTokenForSecret(secret) : null;
  const setting = await getAdmin2FASetting();
  const is2FAEnrolled = Boolean(setting?.isEnrolled);

  return NextResponse.json({
    authorized,
    token,
    is2FAEnrolled,
  });
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

    const setting = await getAdmin2FASetting();
    const is2FAEnrolled = Boolean(setting?.isEnrolled);

    if (is2FAEnrolled) {
      // Step 1 passed, produce short-lived pending 2FA challenge
      const pendingToken = createPendingChallengeToken(expectedSecret);

      void logger.info("Admin Step 1 authentication succeeded, requiring TOTP 2FA", {}, "admin/auth");

      const response = NextResponse.json({
        success: true,
        authorized: false,
        pending2FA: true,
        message: "Step 1 complete. Please provide 6-digit TOTP code.",
      });

      response.cookies.set(PENDING_2FA_COOKIE_NAME, pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 300, // 5 minutes
      });

      return response;
    }

    // If 2FA is not yet enrolled, issue session token
    const token = generateAdminTokenForSecret(expectedSecret);
    void logger.info("Admin logged in successfully (2FA not yet enrolled)", { token }, "admin/auth");

    const response = NextResponse.json({
      success: true,
      authorized: true,
      pending2FA: false,
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
  response.cookies.delete(PENDING_2FA_COOKIE_NAME);
  return response;
}
