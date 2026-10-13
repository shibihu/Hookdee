import "server-only";

import { prisma } from "../prisma";

const DEMO_ATTEMPT_LIMIT = 2;
const DEMO_WINDOW_START = new Date(0);
const USER_SESSION_COOKIE = "hookdee_user_session";

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

export async function checkUnlimitedQuotaForRequest(request?: Request): Promise<boolean> {
  try {
    // 1. Check global unlimited quota setting
    const globalUnlimited = await checkGlobalUnlimitedQuota();
    if (globalUnlimited) return true;

    if (!request) return false;

    // 2. Check logged in user session and their hasUnlimitedQuota flag
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return false;

    const cookies: Record<string, string> = {};
    for (const item of cookieHeader.split(";")) {
      const [k, ...v] = item.trim().split("=");
      if (k) cookies[k.trim()] = decodeURIComponent(v.join("="));
    }

    const sessionToken = cookies[USER_SESSION_COOKIE];
    if (!sessionToken) return false;

    const dbSession = await prisma.session.findUnique({
      where: { sessionToken },
      select: {
        expires: true,
        user: { select: { hasUnlimitedQuota: true } },
      },
    });

    if (dbSession && dbSession.expires > new Date() && dbSession.user?.hasUnlimitedQuota) {
      return true;
    }

    return false;
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
    request?: Request;
    isUnlimitedQuotaActive?: () => Promise<boolean>;
  },
): Promise<{ allowed: boolean; remaining: number }> {
  const isUnlimited = options?.forceUnlimited ??
    (options?.isUnlimitedQuotaActive
      ? await options.isUnlimitedQuotaActive()
      : (options?.checkUnlimitedQuota ? await checkUnlimitedQuotaForRequest(options.request) : false));

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
