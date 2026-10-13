import "server-only";

import { prisma } from "../prisma";

const DEMO_ATTEMPT_LIMIT = 2;
const DEMO_WINDOW_START = new Date(0);

export interface RateLimitStore {
  increment(
    scope: string,
    subjectHash: string,
    windowStart: Date,
  ): Promise<number>;
}

export const prismaRateLimitStore: RateLimitStore = {
  async increment(scope, subjectHash, windowStart) {
    const bucket = await prisma.rateLimitBucket.upsert({
      where: {
        scope_subjectHash_windowStart: { scope, subjectHash, windowStart },
      },
      create: { scope, subjectHash, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    return bucket.count;
  },
};

export async function checkGlobalUnlimitedQuota(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "unlimited_quota" },
    });
    return setting?.value === "true";
  } catch {
    return false;
  }
}

async function hashSubject(scope: string, subject: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${scope}:${subject}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function consumeDemoAttempt(
  identifiers: { ip: string; deviceId: string },
  store: RateLimitStore,
  secret: string,
  options?: {
    forceUnlimited?: boolean;
    checkUnlimitedQuota?: boolean;
    isUnlimitedQuotaActive?: () => Promise<boolean>;
  },
): Promise<{ allowed: boolean; remaining: number }> {
  const isUnlimited = options?.forceUnlimited ??
    (options?.isUnlimitedQuotaActive ? await options.isUnlimitedQuotaActive() : (options?.checkUnlimitedQuota ? await checkGlobalUnlimitedQuota() : false));

  if (isUnlimited) {
    return { allowed: true, remaining: 999999 };
  }

  const ipCount = await store.increment(
    "demo-ip",
    await hashSubject("demo-ip", identifiers.ip, secret),
    DEMO_WINDOW_START,
  );

  if (ipCount > DEMO_ATTEMPT_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  const deviceCount = await store.increment(
    "demo-device",
    await hashSubject("demo-device", identifiers.deviceId, secret),
    DEMO_WINDOW_START,
  );

  return {
    allowed: deviceCount <= DEMO_ATTEMPT_LIMIT,
    remaining: Math.max(
      0,
      Math.min(
        DEMO_ATTEMPT_LIMIT - ipCount,
        DEMO_ATTEMPT_LIMIT - deviceCount,
      ),
    ),
  };
}
