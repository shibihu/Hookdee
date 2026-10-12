import "server-only";

import Anthropic from "@anthropic-ai/sdk";
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

export class AnthropicConfigurationError extends Error {
  constructor() {
    super("Anthropic API key is not configured.");
    this.name = "AnthropicConfigurationError";
  }
}

export class AnthropicStructuredOutputError extends Error {
  constructor() {
    super("Anthropic returned no structured text content.");
    this.name = "AnthropicStructuredOutputError";
  }
}

export function createAnthropicGenerator(
  apiKey: string | undefined,
): GenerateStructuredReview {
  if (!apiKey) {
    throw new AnthropicConfigurationError();
  }

  const client = new Anthropic({ apiKey });
  const schema = z.toJSONSchema(ScriptCoachResultSchema);

  return async (input, model) => {
    const message = await client.messages.create({
      model: model.id,
      max_tokens: 2_048,
      system: SCRIPT_COACH_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            scriptText: input.scriptText,
            niche: input.niche,
            targetDurationSeconds: input.targetDurationSeconds,
          }),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema,
        },
      },
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!text) {
      throw new AnthropicStructuredOutputError();
    }

    return {
      text,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  };
}
