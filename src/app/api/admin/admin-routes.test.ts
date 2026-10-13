import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({
    AUTH_SECRET: "test-auth-secret-12345678901234567890",
    ADMIN_SECRET: "test-admin-secret-key",
    GEMINI_API_KEY: "test-gemini-key",
  }),
}));

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
import { GET as getLogs } from "./logs/route";
import { GET as getQuota, POST as postQuota } from "./quota/route";
import { GET as getStats } from "./stats/route";

describe("Admin API routes", () => {
  it("authenticates valid admin key via POST /api/admin/auth", async () => {
    const req = new Request("http://localhost/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "test-admin-secret-key" }),
    });

    const res = await postAuth(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
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
