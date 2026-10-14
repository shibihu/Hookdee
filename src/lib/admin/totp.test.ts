import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateOtpAuthUri,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyAndConsumeRecoveryCode,
  verifyTotpCode,
} from "./totp";
import * as OTPAuth from "otpauth";

describe("Admin TOTP utilities", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-for-totp-encryption");
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("ADMIN_2FA_ENCRYPTION_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts a TOTP secret at rest with AES-256-GCM", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(secret);

    expect(encrypted.encryptedSecret).not.toBe(secret);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = decryptSecret(
      encrypted.encryptedSecret,
      encrypted.iv,
      encrypted.authTag,
    );
    expect(decrypted).toBe(secret);
  });

  it("generates a valid TOTP secret and verifies correct tokens", () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);

    const totp = new OTPAuth.TOTP({
      issuer: "Hookdee",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const currentToken = totp.generate();
    expect(verifyTotpCode(secret, currentToken)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("creates valid otpauth URI for Google Authenticator", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const uri = generateOtpAuthUri(secret, "Admin Test");
    expect(uri).toContain("otpauth://totp/Hookdee:Admin%20Test");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });

  it("generates and consumes single-use recovery codes", () => {
    const { rawCodes, hashedCodes } = generateRecoveryCodes(4);
    expect(rawCodes).toHaveLength(4);
    expect(hashedCodes).toHaveLength(4);

    const firstCode = rawCodes[0];
    const result1 = verifyAndConsumeRecoveryCode(firstCode, hashedCodes);
    expect(result1.valid).toBe(true);
    expect(result1.remainingHashes).toHaveLength(3);

    // Cannot reuse same code
    const result2 = verifyAndConsumeRecoveryCode(firstCode, result1.remainingHashes);
    expect(result2.valid).toBe(false);

    // Invalid code fails
    const result3 = verifyAndConsumeRecoveryCode("INVALID-CODE", hashedCodes);
    expect(result3.valid).toBe(false);
  });
});
