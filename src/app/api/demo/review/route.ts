function isIpAddress(ip: string): boolean {
  if (!ip) {
    return false;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (ipv4Match) {
    return ipv4Match.slice(1).every((octet) => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255 && octet === String(num);
    });
  }

  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length < 3 || parts.length > 8) {
      return false;
    }
    return parts.every((part) => part === "" || /^[0-9a-fA-F]{1,4}$/.test(part));
  }

  return false;
}

import { getServerEnv } from "@/lib/env.server";
import { createGeminiGenerator } from "@/lib/ai/gemini-client";
import { reviewScript } from "@/lib/ai/script-coach";
import { consumeDemoAttempt, prismaRateLimitStore } from "@/lib/demo/rate-limit";
import {
  handleDemoReview,
  type DemoReviewDependencies,
} from "@/lib/demo/handle-review";
import { prisma } from "@/lib/prisma";
import { th } from "@/lib/i18n/th";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function getTrustedClientIp(request: Request): string | null {
  const forwardedAddress = request.headers.get("x-real-ip")?.trim();
  if (forwardedAddress && isIpAddress(forwardedAddress)) {
    return forwardedAddress;
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const hostname = new URL(request.url).hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
        return "127.0.0.1";
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function POST(request: Request): Promise<Response> {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (error) {
    console.error("Anonymous demo configuration unavailable", error);
    void logger.error("Anonymous demo configuration unavailable", { error: String(error) }, "api/demo/review");
    return Response.json(
      {
        code: "SERVICE_UNAVAILABLE",
        message: th.demo.serviceUnavailable,
      },
      { status: 503 },
    );
  }

  const dependencies: DemoReviewDependencies = {
    secret: env.AUTH_SECRET,
    isProduction: process.env.NODE_ENV === "production",
    getClientIp: getTrustedClientIp,
    consumeAttempt: ({ ip, deviceId }) =>
      consumeDemoAttempt(
        { ip, deviceId },
        prismaRateLimitStore,
        env.AUTH_SECRET,
        { checkUnlimitedQuota: true, request },
      ),
    reviewScript: (input) =>
      reviewScript(
        input,
        { userId: null, modelTier: "free" },
        {
          generate: createGeminiGenerator(env.GEMINI_API_KEY),
          logRequest: async (entry) => {
            await prisma.aIRequestLog.create({ data: entry });
          },
        },
      ),
    logError: (error) => {
      console.error("Anonymous demo review failed", error);
      void logger.error("Anonymous demo review failed", { error: String(error) }, "api/demo/review");
    },
  };

  return handleDemoReview(request, dependencies);
}
