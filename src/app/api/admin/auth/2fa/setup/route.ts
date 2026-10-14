import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/auth";
import {
  encryptSecret,
  generateOtpAuthUri,
  generateQrCodeDataUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  saveAdmin2FASetting,
} from "@/lib/admin/totp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin authorization required" }, { status: 401 });
  }

  try {
    const secretBase32 = generateTotpSecret();
    const otpAuthUri = generateOtpAuthUri(secretBase32, "Hookdee Admin");
    const qrCodeUrl = await generateQrCodeDataUrl(otpAuthUri);
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    const encrypted = encryptSecret(secretBase32);
    await saveAdmin2FASetting({
      encryptedSecret: encrypted.encryptedSecret,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isEnrolled: false, // Pending confirmation
      recoveryCodeHashes: hashedCodes,
    });

    void logger.info("Admin initiated 2FA setup", {}, "admin/auth");

    return NextResponse.json({
      success: true,
      qrCodeUrl,
      secretBase32,
      recoveryCodes: rawCodes,
    });
  } catch (error) {
    void logger.error("Failed to generate 2FA setup QR code", { error: String(error) }, "admin/auth");
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to generate 2FA setup" }, { status: 500 });
  }
}
