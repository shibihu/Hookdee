import "server-only";

import { createHmac } from "node:crypto";
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

function hashSubject(scope: string, subject: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${scope}:${subject}`)
    .digest("hex");
}

export async function consumeDemoAttempt(
  identifiers: { ip: string; deviceId: string },
  store: RateLimitStore,
  secret: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const ipCount = await store.increment(
    "demo-ip",
    hashSubject("demo-ip", identifiers.ip, secret),
    DEMO_WINDOW_START,
  );

  if (ipCount > DEMO_ATTEMPT_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  const deviceCount = await store.increment(
    "demo-device",
    hashSubject("demo-device", identifiers.deviceId, secret),
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
