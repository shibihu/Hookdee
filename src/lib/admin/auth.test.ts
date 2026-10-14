import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../prisma", () => ({
  prisma: {
    adminSession: {
      create: vi.fn().mockResolvedValue(undefined),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import { logger } from "../logger";
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
  getExpectedAdminSecret,
  isAdminAuthorized,
  revokeAdminSession,
  verifyAdminSecret,
} from "./auth";

const adminSecret = "test-admin-secret-9999";
const activeSession = {
  id: "session-1",
  tokenHash: "stored-hash",
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
};

describe("admin auth helper", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET", adminSecret);
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-12345678901234567890");
    vi.mocked(prisma.adminSession.create).mockResolvedValue(activeSession);
    vi.mocked(prisma.adminSession.findUnique).mockResolvedValue(activeSession);
    vi.mocked(prisma.adminSession.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("stores only a token hash with a 30-minute expiration", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);

    const token = await createAdminSession();
    const create = vi.mocked(prisma.adminSession.create).mock.calls[0][0].data;

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(create.tokenHash).not.toBe(token);
    expect(create.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const expiresAt = create.expiresAt instanceof Date ? create.expiresAt : new Date(create.expiresAt);
    expect(expiresAt.getTime()).toBe(1_000_000 + 30 * 60 * 1000);
  });

  it("authorizes a request with an unexpired admin session cookie", async () => {
    const request = new Request("http://localhost/api/admin/stats", {
      headers: {
        cookie: `${ADMIN_COOKIE_NAME}=opaque-session-token`,
      },
    });

    await expect(isAdminAuthorized(request)).resolves.toBe(true);
    expect(prisma.adminSession.findUnique).toHaveBeenCalledWith({
      where: {
        tokenHash: crypto.createHash("sha256").update("opaque-session-token").digest("hex"),
      },
    });
  });

  it("denies access when the session cookie is absent or expired", async () => {
    const requestWithoutCookie = new Request("http://localhost/api/admin/stats");
    await expect(isAdminAuthorized(requestWithoutCookie)).resolves.toBe(false);
    expect(prisma.adminSession.findUnique).not.toHaveBeenCalled();

    vi.mocked(prisma.adminSession.findUnique).mockResolvedValue({
      ...activeSession,
      expiresAt: new Date(Date.now() - 1),
    });
    const requestWithExpiredCookie = new Request("http://localhost/api/admin/stats", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=expired-token` },
    });
    await expect(isAdminAuthorized(requestWithExpiredCookie)).resolves.toBe(false);
  });

  const rawAdminApiCredentials: Array<Record<string, string>> = [
    { "x-admin-key": adminSecret },
    { authorization: `Bearer ${adminSecret}` },
  ];

  it.each(rawAdminApiCredentials)("does not authorize a raw API credential", async (headers) => {
    const request = new Request("http://localhost/api/admin/stats", { headers });

    await expect(isAdminAuthorized(request)).resolves.toBe(false);
  });

  it("revokes a session by its stored hash", async () => {
    await revokeAdminSession("opaque-session-token");

    expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
      where: {
        tokenHash: crypto.createHash("sha256").update("opaque-session-token").digest("hex"),
      },
    });
  });

  it("does not query the session store when revoking an absent token", async () => {
    await revokeAdminSession(null);

    expect(prisma.adminSession.deleteMany).not.toHaveBeenCalled();
  });

  it("logs and rethrows session-store errors without logging the token", async () => {
    const token = "opaque-session-token";
    vi.mocked(prisma.adminSession.findUnique).mockRejectedValue(new Error("database unavailable"));
    const request = new Request("http://localhost/api/admin/stats", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
    });

    await expect(isAdminAuthorized(request)).rejects.toThrow("database unavailable");
    expect(logger.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(token);
  });

  it("compares the configured admin secret and rejects different-length inputs", () => {
    expect(getExpectedAdminSecret()).toBe(adminSecret);
    expect(verifyAdminSecret(adminSecret)).toBe(true);
    expect(verifyAdminSecret("wrong")).toBe(false);
  });

  it("fails closed when neither admin secret is configured", () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "");

    expect(() => getExpectedAdminSecret()).toThrow(/not configured/i);
  });
});
