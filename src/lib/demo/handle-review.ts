import "server-only";

import {
  GeminiConfigurationError,
} from "../ai/gemini-client";
import {
  ScriptCoachProviderError,
  ScriptCoachValidationError,
} from "../ai/script-coach";
import {
  ScriptCoachInputSchema,
  type ScriptCoachInput,
  type ScriptCoachResult,
} from "../ai/review-schema";
import { th } from "../i18n/th";
import {
  createDemoDeviceId,
  DEMO_DEVICE_COOKIE_NAME,
  readDemoDeviceId,
  serializeDemoDeviceCookie,
  signDemoDeviceId,
} from "./device-cookie";

export interface DemoReviewDependencies {
  secret: string;
  isProduction: boolean;
  getClientIp: (request: Request) => string | null;
  consumeAttempt: (identifiers: {
    ip: string;
    deviceId: string;
  }) => Promise<{ allowed: boolean; remaining: number }>;
  reviewScript: (input: ScriptCoachInput) => Promise<ScriptCoachResult>;
  logError: (error: unknown) => void;
  createDeviceId?: () => string;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function handleDemoReview(
  request: Request,
  dependencies: DemoReviewDependencies,
): Promise<Response> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    return json(
      { code: "INVALID_INPUT", message: th.demo.invalidInput },
      400,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { code: "INVALID_INPUT", message: th.demo.invalidInput },
      400,
    );
  }

  const parsedInput = ScriptCoachInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return json(
      { code: "INVALID_INPUT", message: th.demo.invalidInput },
      400,
    );
  }

  const ip = dependencies.getClientIp(request);
  if (!ip) {
    return json(
      {
        code: "REQUEST_VERIFICATION_FAILED",
        message: th.demo.requestVerificationFailed,
      },
      400,
    );
  }

  const existingDeviceId = await readDemoDeviceId(
    getCookieValue(request.headers.get("cookie"), DEMO_DEVICE_COOKIE_NAME),
    dependencies.secret,
  );
  const deviceId = existingDeviceId ?? dependencies.createDeviceId?.() ?? createDemoDeviceId();
  const responseCookie = existingDeviceId
    ? null
    : serializeDemoDeviceCookie(
        await signDemoDeviceId(deviceId, dependencies.secret),
        dependencies.isProduction,
      );
  const respond = (data: unknown, status: number): Response => {
    const response = json(data, status);
    if (responseCookie) {
      response.headers.append("set-cookie", responseCookie);
    }
    return response;
  };

  try {
    const attempt = await dependencies.consumeAttempt({ ip, deviceId });
    if (!attempt.allowed) {
      return respond(
        {
          code: "DEMO_LIMIT_REACHED",
          message: th.demo.limitReached,
          loginUrl: "/login",
        },
        429,
      );
    }

    const review = await dependencies.reviewScript(parsedInput.data);
    return respond({ review, remaining: attempt.remaining }, 200);
  } catch (error) {
    if (
      error instanceof ScriptCoachProviderError ||
      error instanceof ScriptCoachValidationError
    ) {
      return respond(
        { code: "REVIEW_UNAVAILABLE", message: th.demo.reviewUnavailable },
        502,
      );
    }

    if (error instanceof GeminiConfigurationError) {
      dependencies.logError(error);
      return respond(
        { code: "SERVICE_UNAVAILABLE", message: th.demo.serviceUnavailable },
        503,
      );
    }

    dependencies.logError(error);
    return respond(
      { code: "SERVICE_UNAVAILABLE", message: th.demo.serviceUnavailable },
      503,
    );
  }
}
