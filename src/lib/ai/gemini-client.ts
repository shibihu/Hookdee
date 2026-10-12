import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { SCRIPT_COACH_SYSTEM_PROMPT } from "../../../prompts/script-coach";
import { ScriptCoachResultSchema, type ScriptCoachInput } from "./review-schema";
import type { AIModel } from "./model-config";

export interface GeneratedReview {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type GenerateStructuredReview = (
  input: ScriptCoachInput,
  model: AIModel,
) => Promise<GeneratedReview>;

export class GeminiConfigurationError extends Error {
  constructor() {
    super("Gemini API key is not configured.");
    this.name = "GeminiConfigurationError";
  }
}

export class GeminiStructuredOutputError extends Error {
  constructor() {
    super("Gemini returned no structured text content.");
    this.name = "GeminiStructuredOutputError";
  }
}

export function createGeminiGenerator(
  apiKey: string | undefined,
): GenerateStructuredReview {
  if (!apiKey) {
    throw new GeminiConfigurationError();
  }

  const ai = new GoogleGenAI({ apiKey });
  const schema = z.toJSONSchema(ScriptCoachResultSchema);

  return async (input, model) => {
    const response = await ai.models.generateContent({
      model: model.id,
      contents: JSON.stringify({
        scriptText: input.scriptText,
        niche: input.niche,
        targetDurationSeconds: input.targetDurationSeconds,
      }),
      config: {
        systemInstruction: SCRIPT_COACH_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new GeminiStructuredOutputError();
    }

    return {
      text,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  };
}
