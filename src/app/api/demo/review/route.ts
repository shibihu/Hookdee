import { isIP } from "node:net";
import { getServerEnv } from "@/lib/env.server";
import { createAnthropicGenerator } from "@/lib/ai/anthropic-client";
import { reviewScript } from "@/lib/ai/script-coach";
import { consumeDemoAttempt, prismaRateLimitStore } from "@/lib/demo/rate-limit";
import {
  handleDemoReview,
  type DemoReviewDependencies,
} from "@/lib/demo/handle-review";
import { prisma } from "@/lib/prisma";
import { th } from "@/lib/i18n/th";

export const runtime = "nodejs";

function getTrustedClientIp(request: Request): string | null {
  const forwardedAddress = request.headers.get("x-real-ip")?.trim();
  if (forwardedAddress && isIP(forwardedAddress) !== 0) {
    return forwardedAddress;
  }

  if (process.env.NODE_ENV !== "production") {
    const hostname = new URL(request.url).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
      return "127.0.0.1";
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
      ),
    reviewScript: (input) =>
      reviewScript(
        input,
        { userId: null, modelTier: "free" },
        {
          generate: createAnthropicGenerator(env.ANTHROPIC_API_KEY),
          logRequest: async (entry) => {
            await prisma.aIRequestLog.create({ data: entry });
          },
        },
      ),
    logError: (error) => console.error("Anonymous demo review failed", error),
  };

  return handleDemoReview(request, dependencies);
}
