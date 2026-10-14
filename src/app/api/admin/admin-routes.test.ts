import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({
    AUTH_SECRET: "test-auth-secret-12345678901234567890",
    ADMIN_SECRET: "test-admin-secret-key",
    GEMINI_API_KEY: "test-gemini-key",
  }),
}));

let mock2FASetting: {
  id: string;
  encryptedSecret: string;
  iv: string;
  authTag: string;
  isEnrolled: boolean;
  recoveryCodeHashes: string[];
} | null = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue({ key: "unlimited_quota", value: "true" }),
      upsert: vi.fn().mockResolvedValue({ key: "unlimited_quota", value: "true" }),
    },
    admin2FASetting: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(mock2FASetting)),
      upsert: vi.fn().mockImplementation(({ create, update }) => {
        mock2FASetting = { ...mock2FASetting, ...create, ...update };
        return Promise.resolve(mock2FASetting);
      }),
      update: vi.fn().mockImplementation(({ data }) => {
        if (mock2FASetting) mock2FASetting = { ...mock2FASetting, ...data };
        return Promise.resolve(mock2FASetting);
      }),
    },
    rateLimitBucket: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({ id: "u1", email: "user@test.com", hasUnlimitedQuota: true }),
    },
    aIRequestLog: {
      count: vi.fn().mockResolvedValue(5),
      aggregate: vi.fn().mockResolvedValue({
        _sum: { inputTokens: 100, outputTokens: 200, estimatedCostUsd: 0.001 },
      }),
    },
    script: { count: vi.fn().mockResolvedValue(2) },
    review: { count: vi.fn().mockResolvedValue(2) },
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

import { POST as postAuth } from "./auth/route";
import { POST as verify2FA } from "./auth/verify-2fa/route";
import { GET as setup2FA } from "./auth/2fa/setup/route";
import { GET as getLogs } from "./logs/route";
import { GET as getQuota, POST as postQuota } from "./quota/route";
import { GET as getStats } from "./stats/route";
import { encryptSecret, generateTotpSecret } from "@/lib/admin/totp";
import * as OTPAuth from "otpauth";

describe("Admin API routes and 2FA authentication flow", () => {
  it("authenticates valid admin key via POST /api/admin/auth when 2FA not enrolled", async () => {
    mock2FASetting = null;
    const req = new Request("http://localhost/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test-admin-secret-key" }),
    });

    const res = await postAuth(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.authorized).toBe(true);
    expect(data.pending2FA).toBe(false);
  });

  it("returns unauthorized for invalid admin key in POST /api/admin/auth", async () => {
    const req = new Request("http://localhost/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "wrong-key" }),
    });

    const res = await postAuth(req);
    expect(res.status).toBe(401);
  });

  it("produces pending2FA challenge without granting full authorization when 2FA is enrolled", async () => {
    const secret = generateTotpSecret();
    const enc = encryptSecret(secret);
    mock2FASetting = {
      id: "default",
      encryptedSecret: enc.encryptedSecret,
      iv: enc.iv,
      authTag: enc.authTag,
      isEnrolled: true,
      recoveryCodeHashes: [],
    };

    const req = new Request("http://localhost/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test-admin-secret-key" }),
    });

    const res = await postAuth(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pending2FA).toBe(true);
    expect(data.authorized).toBe(false);
    expect(res.headers.get("set-cookie")).toContain("hookdee_admin_pending_2fa=");
  });

  it("rejects 2FA verification when pending challenge cookie is missing or invalid", async () => {
    const req = new Request("http://localhost/api/admin/auth/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totpCode: "123456" }),
    });

    const res = await verify2FA(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("EXPIRED_CHALLENGE");
  });

  it("verifies valid TOTP code in Step 2 and issues full admin session", async () => {
    const totpSecret = generateTotpSecret();
    const enc = encryptSecret(totpSecret);
    mock2FASetting = {
      id: "default",
      encryptedSecret: enc.encryptedSecret,
      iv: enc.iv,
      authTag: enc.authTag,
      isEnrolled: true,
      recoveryCodeHashes: [],
    };

    // Step 1: get pending challenge
    const step1Req = new Request("http://localhost/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test-admin-secret-key" }),
    });
    const step1Res = await postAuth(step1Req);
    const cookieHeader = step1Res.headers.get("set-cookie") || "";

    // Generate valid TOTP token using OTPAuth
    const totp = new OTPAuth.TOTP({
      issuer: "Hookdee",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(totpSecret),
    });
    const validCode = totp.generate();

    // Step 2: verify 2FA
    const step2Req = new Request("http://localhost/api/admin/auth/verify-2fa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ totpCode: validCode }),
    });

    const step2Res = await verify2FA(step2Req);
    expect(step2Res.status).toBe(200);
    const data = await step2Res.json();
    expect(data.authorized).toBe(true);
    expect(step2Res.headers.get("set-cookie")).toContain("hookdee_admin_session=");
  });

  it("denies access to setup 2FA when unauthenticated", async () => {
    const req = new Request("http://localhost/api/admin/auth/2fa/setup");
    const res = await setup2FA(req);
    expect(res.status).toBe(401);
  });

  it("fetches system logs when authorized", async () => {
    const req = new Request("http://localhost/api/admin/logs?level=ALL", {
      headers: { "x-admin-key": "test-admin-secret-key" },
    });

    const res = await getLogs(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("logs");
    expect(data).toHaveProperty("summary");
  });

  it("fetches quota settings when authorized", async () => {
    const req = new Request("http://localhost/api/admin/quota", {
      headers: { "x-admin-key": "test-admin-secret-key" },
    });

    const res = await getQuota(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("globalUnlimited");
    expect(data).toHaveProperty("rateLimitBuckets");
  });

  it("toggles global unlimited quota via POST /api/admin/quota", async () => {
    const req = new Request("http://localhost/api/admin/quota", {
      method: "POST",
      headers: {
        "x-admin-key": "test-admin-secret-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "toggle_global_unlimited", enabled: true }),
    });

    const res = await postQuota(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.globalUnlimited).toBe(true);
  });

  it("fetches aggregate stats via GET /api/admin/stats", async () => {
    const req = new Request("http://localhost/api/admin/stats", {
      headers: { "x-admin-key": "test-admin-secret-key" },
    });

    const res = await getStats(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.health.databaseConnected).toBe(true);
    expect(data.aiMetrics.totalRequests).toBe(5);
  });
});
