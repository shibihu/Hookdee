import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/auth";
import {
  decryptSecret,
  disableAdmin2FA,
  getAdmin2FASetting,
  verifyTotpCode,
} from "@/lib/admin/totp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin authorization required" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const totpCode = String(body.totpCode || body.code || "").trim();

    const setting = await getAdmin2FASetting();
    if (!setting || !setting.isEnrolled) {
      return NextResponse.json({ code: "NOT_ENROLLED", message: "2FA is not enabled" }, { status: 400 });
    }

    if (!totpCode) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "Please provide a valid TOTP code to disable 2FA" }, { status: 400 });
    }

    const plaintextSecret = decryptSecret(setting.encryptedSecret, setting.iv, setting.authTag);
    const isValid = verifyTotpCode(plaintextSecret, totpCode);

    if (!isValid) {
      void logger.warn("Invalid TOTP code provided during 2FA disable request", {}, "admin/auth");
      return NextResponse.json({ code: "INVALID_TOTP", message: "Invalid TOTP code" }, { status: 400 });
    }

    await disableAdmin2FA();
    void logger.info("Admin 2FA disabled", {}, "admin/auth");

    return NextResponse.json({
      success: true,
      isEnrolled: false,
      message: "Two-factor authentication disabled successfully",
    });
  } catch (error) {
    void logger.error("Failed to disable 2FA", { error: String(error) }, "admin/auth");
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to disable 2FA" }, { status: 500 });
  }
}
