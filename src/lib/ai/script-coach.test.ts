import { describe, expect, it } from "vitest";
import {
  parseScriptCoachResult,
  type ScriptCoachInput,
  type ScriptCoachResult,
} from "./review-schema";
import { reviewScript } from "./script-coach";

const input: ScriptCoachInput = {
  scriptText: "เดี๋ยวก่อน!\nวันนี้มีของมาแนะนำ",
};

const validResult: ScriptCoachResult = {
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

describe("parseScriptCoachResult", () => {
  it("accepts five explained scores and exact complete source lines", () => {
    expect(parseScriptCoachResult(JSON.stringify(validResult), input)).toEqual(
      validResult,
    );
  });

  it("accepts trimmed line quotes and handles whitespace variations", () => {
    const trimmedResult = {
      ...validResult,
      weakSpots: [{ quote: "  วันนี้มีของมาแนะนำ  ", reason: "เหตุผล" }],
    };
    expect(parseScriptCoachResult(JSON.stringify(trimmedResult), input)).toEqual(trimmedResult);
  });

  it("rejects scores outside 0 to 10 and weak spots that are not exact lines", () => {
    const outOfRange = {
      ...validResult,
      scores: {
        ...validResult.scores,
        hook: { score: 11, reason: "เหตุผล" },
      },
    };
    const partialQuote = {
      ...validResult,
      weakSpots: [
        { quote: "มีของมา", reason: "ยังไม่บอกว่าของนี้ช่วยอะไร" },
      ],
    };

    expect(() => parseScriptCoachResult(JSON.stringify(outOfRange), input)).toThrow();
    expect(() => parseScriptCoachResult(JSON.stringify(partialQuote), input)).toThrow();
  });
});

describe("reviewScript", () => {
  it("retries invalid structured output once, returns the valid review, and logs both calls", async () => {
    const logged: {
      model: string;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCostUsd: number | null;
      userId: string | null;
      createdAt: Date;
    }[] = [];
    let calls = 0;

    const result = await reviewScript(
      input,
      { userId: null, voiceProfile: { catchphrases: ["เดี๋ยวก่อน"] } },
      {
        generate: async () => {
          calls += 1;
          return {
            text: calls === 1 ? '{"scores":{}}' : JSON.stringify(validResult),
            inputTokens: 100,
            outputTokens: 80,
          };
        },
        logRequest: async (entry) => {
          logged.push(entry);
        },
      },
    );

    expect(result).toEqual(validResult);
    expect(calls).toBe(2);
    expect(logged).toHaveLength(2);
    expect(logged[0]).toMatchObject({
      model: "claude-haiku-5-5",
      inputTokens: 100,
      outputTokens: 80,
      estimatedCostUsd: 0.00005,
      userId: null,
    });
    expect(logged[0].createdAt).toBeInstanceOf(Date);
  });

  it("logs request with null tokens and throws ScriptCoachProviderError when generate fails", async () => {
    const logged: unknown[] = [];
    await expect(
      reviewScript(input, {}, {
        generate: async () => {
          throw new Error("Provider timeout");
        },
        logRequest: async (entry) => {
          logged.push(entry);
        },
      }),
    ).rejects.toMatchObject({ name: "ScriptCoachProviderError" });

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      model: "claude-haiku-5-5",
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
    });
  });

  it("returns a validation error after the second invalid response", async () => {
    let calls = 0;
    const logged: number[] = [];

    await expect(
      reviewScript(input, {}, {
        generate: async () => {
          calls += 1;
          return {
            text: '{"scores":{}}',
            inputTokens: 20,
            outputTokens: 10,
          };
        },
        logRequest: async () => {
          logged.push(calls);
        },
      }),
    ).rejects.toMatchObject({ name: "ScriptCoachValidationError" });

    expect(calls).toBe(2);
    expect(logged).toEqual([1, 2]);
  });
});
