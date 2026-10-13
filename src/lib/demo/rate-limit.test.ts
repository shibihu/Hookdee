import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../prisma", () => ({ prisma: {} }));

import { consumeDemoAttempt, type RateLimitStore } from "./rate-limit";

function createMemoryStore() {
  const counts = new Map<string, number>();
  const subjects: string[] = [];
  const store: RateLimitStore = {
    async increment(scope, subjectHash, windowStart) {
      subjects.push(subjectHash);
      const key = `${scope}:${subjectHash}:${windowStart.toISOString()}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count;
    },
  };

  return { store, subjects };
}


describe("prismaRateLimitStore", () => {
  it("upserts the rate limit bucket correctly", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ count: 1 });
    const { prismaRateLimitStore } = await import("./rate-limit");
    const { prisma } = await import("../prisma");
    (prisma as unknown as { rateLimitBucket: { upsert: typeof upsertMock } }).rateLimitBucket = {
      upsert: upsertMock,
    };

    const windowStart = new Date("2025-01-01T00:00:00.000Z");
    const count = await prismaRateLimitStore.increment("demo-ip", "hash123", windowStart);

    expect(count).toBe(1);
    expect(upsertMock).toHaveBeenCalledWith({
      where: {
        scope_subjectHash_windowStart: {
          scope: "demo-ip",
          subjectHash: "hash123",
          windowStart,
        },
      },
      create: {
        scope: "demo-ip",
        subjectHash: "hash123",
        windowStart,
        count: 1,
      },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
  });
});

describe("consumeDemoAttempt", () => {
  it("allows two attempts and denies the third for the same IP and device", async () => {
    const { store } = createMemoryStore();
    const identifiers = { ip: "203.0.113.5", deviceId: "device-a" };

    await expect(
      consumeDemoAttempt(identifiers, store, "test-secret"),
    ).resolves.toEqual({ allowed: true, remaining: 1 });
    await expect(
      consumeDemoAttempt(identifiers, store, "test-secret"),
    ).resolves.toEqual({ allowed: true, remaining: 0 });
    await expect(
      consumeDemoAttempt(identifiers, store, "test-secret"),
    ).resolves.toEqual({ allowed: false, remaining: 0 });
  });

  it("handles concurrent requests safely without throwing", async () => {
    const { store } = createMemoryStore();
    const identifiers = { ip: "203.0.113.99", deviceId: "device-concurrent" };

    const [res1, res2] = await Promise.all([
      consumeDemoAttempt(identifiers, store, "test-secret"),
      consumeDemoAttempt(identifiers, store, "test-secret"),
    ]);

    expect(res1.allowed).toBe(true);
    expect(res2.allowed).toBe(true);
    const results = [res1.remaining, res2.remaining].sort();
    expect(results).toHaveLength(2);
  });

  it("enforces the IP and device limits independently and hashes identifiers", async () => {
    const { store, subjects } = createMemoryStore();

    await consumeDemoAttempt(
      { ip: "203.0.113.8", deviceId: "device-first" },
      store,
      "test-secret",
    );
    await consumeDemoAttempt(
      { ip: "203.0.113.8", deviceId: "device-second" },
      store,
      "test-secret",
    );
    await expect(
      consumeDemoAttempt(
        { ip: "203.0.113.8", deviceId: "device-third" },
        store,
        "test-secret",
      ),
    ).resolves.toEqual({ allowed: false, remaining: 0 });

    await consumeDemoAttempt(
      { ip: "203.0.113.20", deviceId: "device-shared" },
      store,
      "test-secret",
    );
    await consumeDemoAttempt(
      { ip: "203.0.113.21", deviceId: "device-shared" },
      store,
      "test-secret",
    );
    await expect(
      consumeDemoAttempt(
        { ip: "203.0.113.22", deviceId: "device-shared" },
        store,
        "test-secret",
      ),
    ).resolves.toEqual({ allowed: false, remaining: 0 });

    expect(subjects).not.toContain("203.0.113.8");
    expect(subjects).not.toContain("device-shared");
  });
});
