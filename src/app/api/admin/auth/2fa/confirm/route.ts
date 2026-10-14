import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/auth";
import {
  decryptSecret,
  getAdmin2FASetting,
  saveAdmin2FASetting,
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

    if (!totpCode) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "Please provide a 6-digit TOTP code" }, { status: 400 });
    }

    const setting = await getAdmin2FASetting();
    if (!setting) {
      return NextResponse.json({ code: "NOT_FOUND", message: "2FA setup not initiated. Call setup first." }, { status: 400 });
    }

    const plaintextSecret = decryptSecret(setting.encryptedSecret, setting.iv, setting.authTag);
    const isValid = verifyTotpCode(plaintextSecret, totpCode);

    if (!isValid) {
      void logger.warn("Invalid TOTP code during 2FA setup confirmation", {}, "admin/auth");
      return NextResponse.json({ code: "INVALID_TOTP", message: "Invalid 6-digit TOTP code" }, { status: 400 });
    }

    await saveAdmin2FASetting({
      encryptedSecret: setting.encryptedSecret,
      iv: setting.iv,
      authTag: setting.authTag,
      isEnrolled: true,
      recoveryCodeHashes: setting.recoveryCodeHashes,
    });

    void logger.info("Admin 2FA enrolled successfully", {}, "admin/auth");

    return NextResponse.json({
      success: true,
      isEnrolled: true,
      message: "Google Authenticator 2FA enrolled successfully!",
    });
  } catch (error) {
    void logger.error("Failed to confirm 2FA setup", { error: String(error) }, "admin/auth");
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to confirm 2FA" }, { status: 500 });
  }
}
