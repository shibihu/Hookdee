import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  PENDING_2FA_COOKIE_NAME,
  generateAdminTokenForSecret,
  getExpectedAdminSecret,
  verifyPendingChallengeToken,
} from "@/lib/admin/auth";
import {
  decryptSecret,
  getAdmin2FASetting,
  saveAdmin2FASetting,
  verifyAndConsumeRecoveryCode,
  verifyTotpCode,
} from "@/lib/admin/totp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secret = getExpectedAdminSecret();
    const cookieHeader = request.headers.get("cookie");

    // Parse pending cookie
    let pendingToken: string | null = null;
    if (cookieHeader) {
      for (const item of cookieHeader.split(";")) {
        const [k, ...v] = item.trim().split("=");
        if (k === PENDING_2FA_COOKIE_NAME) {
          pendingToken = decodeURIComponent(v.join("="));
          break;
        }
      }
    }

    if (!verifyPendingChallengeToken(pendingToken, secret)) {
      void logger.warn("Admin 2FA verification attempt with expired/invalid pending challenge", {}, "admin/auth");
      return NextResponse.json(
        { code: "EXPIRED_CHALLENGE", message: "2FA challenge expired or invalid. Please re-enter Admin Secret Key." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const inputCode = String(body.totpCode || body.code || body.recoveryCode || "").trim();

    if (!inputCode) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "Please provide a 6-digit TOTP code or recovery code" },
        { status: 400 }
      );
    }

    const setting = await getAdmin2FASetting();
    if (!setting || !setting.isEnrolled) {
      return NextResponse.json(
        { code: "NOT_ENROLLED", message: "Admin 2FA is not enrolled" },
        { status: 400 }
      );
    }

    const plaintextSecret = decryptSecret(setting.encryptedSecret, setting.iv, setting.authTag);
    let isValid = verifyTotpCode(plaintextSecret, inputCode);

    // Check if user submitted a single-use recovery code instead
    if (!isValid && setting.recoveryCodeHashes.length > 0) {
      const recoveryResult = verifyAndConsumeRecoveryCode(inputCode, setting.recoveryCodeHashes);
      if (recoveryResult.valid) {
        isValid = true;
        await saveAdmin2FASetting({
          encryptedSecret: setting.encryptedSecret,
          iv: setting.iv,
          authTag: setting.authTag,
          isEnrolled: true,
          recoveryCodeHashes: recoveryResult.remainingHashes,
        });
        void logger.info("Admin single-use recovery code consumed", { remainingCount: recoveryResult.remainingHashes.length }, "admin/auth");
      }
    }

    if (!isValid) {
      void logger.warn("Invalid Admin 2FA TOTP / recovery code attempt", {}, "admin/auth");
      return NextResponse.json(
        { code: "INVALID_TOTP", message: "Invalid 6-digit TOTP code or recovery code" },
        { status: 401 }
      );
    }

    const sessionToken = generateAdminTokenForSecret(secret);
    void logger.info("Admin 2FA verification succeeded", { token: sessionToken }, "admin/auth");

    const response = NextResponse.json({
      success: true,
      authorized: true,
      token: sessionToken,
    });

    // Clear pending challenge cookie and issue full admin session cookie
    response.cookies.delete(PENDING_2FA_COOKIE_NAME);
    response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    void logger.error("Admin 2FA verification error", { error: String(error) }, "admin/auth");
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to verify 2FA code" }, { status: 500 });
  }
}
