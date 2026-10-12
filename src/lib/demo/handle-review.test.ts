import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  handleDemoReview,
  type DemoReviewDependencies,
} from "./handle-review";
import { ScriptCoachProviderError } from "../ai/script-coach";
import type { ScriptCoachInput, ScriptCoachResult } from "../ai/review-schema";

const input: ScriptCoachInput = {
  scriptText: "เดี๋ยวก่อน!\nวันนี้มีของมาแนะนำ",
};

const review: ScriptCoachResult = {
  scores: {
    hook: { score: 8, reason: "เริ่มด้วยคำเรียกความสนใจทันที" },
    pacing: { score: 7, reason: "ประโยคสั้นและเดินเรื่องต่อเนื่อง" },
    clarity: { score: 8, reason: "บอกจุดประสงค์ได้ตรงไปตรงมา" },
    cta: { score: 4, reason: "ยังไม่มีคำชวนให้ผู้ชมทำอะไรต่อ" },
    naturalThai: { score: 8, reason: "ใช้สำนวนที่ฟังเป็นภาษาพูด" },
  },
  weakSpots: [
    { quote: "วันนี้มีของมาแนะนำ", reason: "ยังไม่บอกว่าของนี้ช่วยอะไร" },
  ],
  rewrite: "เดี๋ยวก่อน! วันนี้มีของชิ้นหนึ่งที่อยากเล่าให้ฟัง",
};

function dependencies(
  overrides: Partial<DemoReviewDependencies> = {},
): DemoReviewDependencies {
  return {
    secret: "test-secret-that-is-long-enough",
    isProduction: false,
    getClientIp: () => "203.0.113.9",
    consumeAttempt: async () => ({ allowed: true, remaining: 1 }),
    reviewScript: async () => review,
    logError: () => {},
    createDeviceId: () => "device-test",
    ...overrides,
  };
}

function request(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/api/demo/review", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("handleDemoReview", () => {
  it("rejects malformed JSON and invalid review input before consuming an attempt", async () => {
    let consumed = 0;
    const deps = dependencies({
      consumeAttempt: async () => {
        consumed += 1;
        return { allowed: true, remaining: 1 };
      },
    });

    const malformed = await handleDemoReview(request("{"), deps);
    const invalid = await handleDemoReview(
      request(JSON.stringify({ scriptText: "" })),
      deps,
    );

    expect(malformed.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(consumed).toBe(0);
  });

  it("rejects requests without a trusted IP before consuming an attempt", async () => {
    let consumed = false;
    const response = await handleDemoReview(
      request(JSON.stringify(input)),
      dependencies({
        getClientIp: () => null,
        consumeAttempt: async () => {
          consumed = true;
          return { allowed: true, remaining: 1 };
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "REQUEST_VERIFICATION_FAILED",
    });
    expect(consumed).toBe(false);
  });

  it("does not call Claude when an attempt is blocked and directs the visitor to login", async () => {
    let reviewed = false;
    const response = await handleDemoReview(
      request(JSON.stringify(input)),
      dependencies({
        consumeAttempt: async () => ({ allowed: false, remaining: 0 }),
        reviewScript: async () => {
          reviewed = true;
          return review;
        },
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      code: "DEMO_LIMIT_REACHED",
      loginUrl: "/login",
    });
    expect(reviewed).toBe(false);
  });

  it("returns the real review shape and sets a signed device cookie", async () => {
    const response = await handleDemoReview(
      request(JSON.stringify(input)),
      dependencies(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ review, remaining: 1 });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("hookdee_demo_device=");
  });

  it("returns a friendly service error and logs unexpected persistence failures", async () => {
    const providerResponse = await handleDemoReview(
      request(JSON.stringify(input)),
      dependencies({
        reviewScript: async () => {
          throw new ScriptCoachProviderError();
        },
      }),
    );
    const errors: unknown[] = [];
    const unavailableResponse = await handleDemoReview(
      request(JSON.stringify(input)),
      dependencies({
        consumeAttempt: async () => {
          throw new Error("database unavailable");
        },
        logError: (error) => errors.push(error),
      }),
    );

    expect(providerResponse.status).toBe(502);
    expect(await providerResponse.json()).toMatchObject({
      code: "REVIEW_UNAVAILABLE",
    });
    expect(unavailableResponse.status).toBe(503);
    expect(await unavailableResponse.json()).not.toHaveProperty(
      "message",
      "database unavailable",
    );
    expect(errors).toHaveLength(1);
  });
});
