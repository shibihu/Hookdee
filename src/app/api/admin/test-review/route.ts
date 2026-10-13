import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/auth";
import { getServerEnv } from "@/lib/env.server";
import { createGeminiGenerator } from "@/lib/ai/gemini-client";
import { reviewScript } from "@/lib/ai/script-coach";
import { ScriptCoachInputSchema } from "@/lib/ai/review-schema";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return NextResponse.json(
      { code: "SERVICE_UNAVAILABLE", message: "Server configuration missing required API keys" },
      { status: 503 }
    );
  }

  if (!env.GEMINI_API_KEY) {
    return NextResponse.json(
      { code: "SERVICE_UNAVAILABLE", message: "GEMINI_API_KEY is not configured on server" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsedInput = ScriptCoachInputSchema.safeParse(body);

    if (!parsedInput.success) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "Invalid script input provided" },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const result = await reviewScript(
      parsedInput.data,
      { userId: null, modelTier: "free" },
      {
        generate: createGeminiGenerator(env.GEMINI_API_KEY),
        logRequest: async (entry) => {
          await prisma.aIRequestLog.create({ data: entry });
        },
      }
    );
    const durationMs = Date.now() - startTime;

    await logger.info(
      "Admin test script review completed successfully",
      { durationMs, scriptLength: parsedInput.data.scriptText.length },
      "admin/test-review"
    );

    return NextResponse.json({
      success: true,
      review: result,
      durationMs,
    });
  } catch (error) {
    await logger.error("Admin test script review failed", { error: String(error) }, "admin/test-review");
    return NextResponse.json(
      { code: "REVIEW_FAILED", message: String(error) },
      { status: 500 }
    );
  }
}
