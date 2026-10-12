export type ModelTier = "free" | "pro";

export const AI_MODELS: Record<ModelTier, { id: string; inputUsdPerMillionTokens: number; outputUsdPerMillionTokens: number }> = {
  free: {
    id: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    inputUsdPerMillionTokens: 0.075,
    outputUsdPerMillionTokens: 0.3,
  },
  pro: {
    id: "gemini-2.5-pro",
    inputUsdPerMillionTokens: 1.25,
    outputUsdPerMillionTokens: 5.0,
  },
} as const;

export type AIModel = (typeof AI_MODELS)[ModelTier];

export function estimateCostUsd(
  model: AIModel,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * model.inputUsdPerMillionTokens +
      outputTokens * model.outputUsdPerMillionTokens) /
    1_000_000
  );
}
