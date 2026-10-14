import "server-only";

import crypto from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { getExpectedAdminSecret } from "./auth";

/**
 * Derives a 32-byte key for AES-256-GCM.
 */
function getEncryptionKey(): Buffer {
  const customKey = process.env.ADMIN_2FA_ENCRYPTION_KEY;
  if (customKey && customKey.trim().length >= 16) {
    return crypto.createHash("sha256").update(customKey.trim()).digest();
  }
  const secret = getExpectedAdminSecret();
  return crypto.createHash("sha256").update(`${secret}-hookdee-admin-2fa-salt-v1`).digest();
}

/**
 * Encrypts a plaintext TOTP secret using AES-256-GCM.
 */
export function encryptSecret(plaintextSecret: string): {
  encryptedSecret: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const ivBuffer = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, ivBuffer);

  let encrypted = cipher.update(plaintextSecret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedSecret: encrypted,
    iv: ivBuffer.toString("hex"),
    authTag,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret.
 */
export function decryptSecret(
  encryptedSecret: string,
  ivHex: string,
  authTagHex: string,
): string {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(ivHex, "hex");
  const authTagBuffer = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  let decrypted = decipher.update(encryptedSecret, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates a new random Base32 encoded TOTP secret.
 */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Creates an otpauth:// URI for Google Authenticator.
 */
export function generateOtpAuthUri(
  secretBase32: string,
  accountName = "Hookdee Admin",
): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Hookdee",
    label: accountName,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.toString();
}

/**
 * Generates a QR Code image Data URL (PNG) from an otpauth:// URI.
 */
export async function generateQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri);
}

/**
 * Verifies a 6-digit TOTP token against a Base32 secret with a ±1 step (±30s) clock skew window.
 */
export function verifyTotpCode(secretBase32: string, token: string): boolean {
  const cleanToken = token.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  try {
    const totp = new OTPAuth.TOTP({
      issuer: "Hookdee",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    const delta = totp.validate({ token: cleanToken, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * Hashes a single-use recovery code.
 */
export function hashRecoveryCode(code: string): string {
  const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return crypto.createHash("sha256").update(`recovery-${cleanCode}`).digest("hex");
}

/**
 * Generates 8 single-use recovery codes and their SHA-256 hashes.
 */
export function generateRecoveryCodes(count = 8): {
  rawCodes: string[];
  hashedCodes: string[];
} {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 character code
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
    rawCodes.push(formattedCode);
    hashedCodes.push(hashRecoveryCode(formattedCode));
  }

  return { rawCodes, hashedCodes };
}

/**
 * Verifies a recovery code against a list of hashed codes and returns remaining hashes if valid.
 */
export function verifyAndConsumeRecoveryCode(
  providedCode: string,
  hashedCodes: string[],
): { valid: boolean; remainingHashes: string[] } {
  const providedHash = hashRecoveryCode(providedCode);
  const index = hashedCodes.indexOf(providedHash);

  if (index === -1) {
    return { valid: false, remainingHashes: hashedCodes };
  }

  const remaining = [...hashedCodes];
  remaining.splice(index, 1);

  return { valid: true, remainingHashes: remaining };
}

import { prisma } from "../prisma";

export async function getAdmin2FASetting() {
  try {
    return await prisma.admin2FASetting.findUnique({
      where: { id: "default" },
    });
  } catch {
    return null;
  }
}

export async function saveAdmin2FASetting(data: {
  encryptedSecret: string;
  iv: string;
  authTag: string;
  isEnrolled?: boolean;
  recoveryCodeHashes?: string[];
}) {
  return await prisma.admin2FASetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      encryptedSecret: data.encryptedSecret,
      iv: data.iv,
      authTag: data.authTag,
      isEnrolled: data.isEnrolled ?? false,
      recoveryCodeHashes: data.recoveryCodeHashes ?? [],
    },
    update: {
      encryptedSecret: data.encryptedSecret,
      iv: data.iv,
      authTag: data.authTag,
      ...(data.isEnrolled !== undefined ? { isEnrolled: data.isEnrolled } : {}),
      ...(data.recoveryCodeHashes !== undefined ? { recoveryCodeHashes: data.recoveryCodeHashes } : {}),
    },
  });
}

export async function disableAdmin2FA() {
  try {
    return await prisma.admin2FASetting.update({
      where: { id: "default" },
      data: { isEnrolled: false },
    });
  } catch {
    return null;
  }
}
