export type ModelTier = "free" | "pro";

export const AI_MODELS = {
  free: {
    id: "claude-haiku-5-5",
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.5,
  },
  pro: {
    id: "claude-opus-5-5",
    inputUsdPerMillionTokens: 4,
    outputUsdPerMillionTokens: 20,
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
