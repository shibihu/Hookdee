import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  PENDING_2FA_COOKIE_NAME,
  createAdminSession,
  createPendingChallengeToken,
  getExpectedAdminSecret,
  isAdminAuthorized,
  revokeAdminSession,
  verifyAdminSecret,
} from "@/lib/admin/auth";
import { getAdmin2FASetting } from "@/lib/admin/totp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorized = await isAdminAuthorized(request);
  const setting = await getAdmin2FASetting();
  const is2FAEnrolled = Boolean(setting?.isEnrolled);

  return NextResponse.json({
    authorized,
    is2FAEnrolled,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providedSecret = (body.secret || body.key || "").trim();
    const expectedSecret = getExpectedAdminSecret();

    if (!providedSecret || !verifyAdminSecret(providedSecret)) {
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

    const token = await createAdminSession();
    void logger.info("Admin logged in successfully (2FA not yet enrolled)", {}, "admin/auth");

    const response = NextResponse.json({
      success: true,
      authorized: true,
      pending2FA: false,
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60, // 30 minutes
    });

    return response;
  } catch (error) {
    void logger.error("Admin auth request error", { error: String(error) }, "admin/auth");
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to process login" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_COOKIE_NAME}=`));
  const token = cookie ? decodeURIComponent(cookie.slice(ADMIN_COOKIE_NAME.length + 1)) : null;
  await revokeAdminSession(token);

  const response = NextResponse.json({ success: true, authorized: false });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  response.cookies.delete(PENDING_2FA_COOKIE_NAME);
  return response;
}
