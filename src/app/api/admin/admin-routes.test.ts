import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let mock2FASetting: {
  id: string;
  encryptedSecret: string;
  iv: string;
  authTag: string;
  isEnrolled: boolean;
  recoveryCodeHashes: string[];
} | null = null;
let mockAdminSessions: Array<{
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminSession: {
      create: vi.fn().mockImplementation(({ data }) => {
        const session = {
          id: `session-${mockAdminSessions.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        mockAdminSessions.push(session);
        return Promise.resolve(session);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(
        mockAdminSessions.find((session) => session.tokenHash === where.tokenHash) ?? null,
      )),
      deleteMany: vi.fn().mockImplementation(({ where }) => {
        const initialCount = mockAdminSessions.length;
        mockAdminSessions = mockAdminSessions.filter((session) => session.tokenHash !== where.tokenHash);
        return Promise.resolve({ count: initialCount - mockAdminSessions.length });
      }),
    },
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
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST as postAuth } from "./auth/route";
import { GET as getAuth, DELETE as deleteAuth } from "./auth/route";
import { POST as verify2FA } from "./auth/verify-2fa/route";
import { GET as setup2FA } from "./auth/2fa/setup/route";
import { GET as getLogs } from "./logs/route";
import { GET as getQuota, POST as postQuota } from "./quota/route";
import { GET as getStats } from "./stats/route";
import { encryptSecret, generateTotpSecret } from "@/lib/admin/totp";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/auth";
import { logger } from "@/lib/logger";
import * as OTPAuth from "otpauth";

const adminSecret = "test-admin-secret-key";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-12345678901234567890");
  vi.stubEnv("ADMIN_SECRET", adminSecret);
  mock2FASetting = null;
  mockAdminSessions = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loginCookie(): Promise<string> {
  const response = await postAuth(new Request("http://localhost/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: adminSecret }),
  }));
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (response.status !== 200 || !cookie) {
    throw new Error("Could not create an admin test session");
  }
  return cookie;
}

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
    expect(data).not.toHaveProperty("token");
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    const sessionToken = cookie.slice(cookie.indexOf("=") + 1);
    expect(cookie).toContain(`${ADMIN_COOKIE_NAME}=`);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=1800");
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(sessionToken);
  });

  it("reports authorization state without returning the session token", async () => {
    const cookie = await loginCookie();
    const req = new Request("http://localhost/api/admin/auth", {
      headers: { cookie },
    });

    const res = await getAuth(req);
    const data = await res.json();
    expect(data.authorized).toBe(true);
    expect(data).not.toHaveProperty("token");
  });

  it("fails closed when neither admin secret is configured", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "");
    const req = new Request("http://localhost/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "attempted-key" }),
    });

    const res = await postAuth(req);
    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("attempted-key");
  });

  it("rejects raw admin secrets on protected API routes", async () => {
    const req = new Request("http://localhost/api/admin/stats", {
      headers: { "x-admin-key": adminSecret },
    });

    expect((await getStats(req)).status).toBe(401);
  });

  it("revokes the server-side session on logout", async () => {
    const cookie = await loginCookie();
    const token = cookie.slice(cookie.indexOf("=") + 1);

    const res = await deleteAuth(new Request("http://localhost/api/admin/auth", {
      headers: { cookie },
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${ADMIN_COOKIE_NAME}=;`);
    expect(res.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(mockAdminSessions).toHaveLength(0);
    const data = await res.json();
    expect(data).not.toHaveProperty("token");
    expect(JSON.stringify(data)).not.toContain(token);
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
    expect(data).not.toHaveProperty("token");
    expect(step2Res.headers.get("set-cookie")).toContain("hookdee_admin_session=");
    const sessionToken = step2Res.headers.get("set-cookie")?.match(/hookdee_admin_session=([^;,]+)/)?.[1];
    expect(sessionToken).toBeDefined();
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(sessionToken);
  });

  it("denies access to setup 2FA when unauthenticated", async () => {
    const req = new Request("http://localhost/api/admin/auth/2fa/setup");
    const res = await setup2FA(req);
    expect(res.status).toBe(401);
  });

  it("fetches system logs when authorized", async () => {
    const cookie = await loginCookie();
    const req = new Request("http://localhost/api/admin/logs?level=ALL", {
      headers: { cookie },
    });

    const res = await getLogs(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("logs");
    expect(data).toHaveProperty("summary");
  });

  it("fetches quota settings when authorized", async () => {
    const cookie = await loginCookie();
    const req = new Request("http://localhost/api/admin/quota", {
      headers: { cookie },
    });

    const res = await getQuota(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("globalUnlimited");
    expect(data).toHaveProperty("rateLimitBuckets");
  });

  it("toggles global unlimited quota via POST /api/admin/quota", async () => {
    const cookie = await loginCookie();
    const req = new Request("http://localhost/api/admin/quota", {
      method: "POST",
      headers: {
        cookie,
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
    const cookie = await loginCookie();
    const req = new Request("http://localhost/api/admin/stats", {
      headers: { cookie },
    });

    const res = await getStats(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.health.databaseConnected).toBe(true);
    expect(data.aiMetrics.totalRequests).toBe(5);
  });
});
