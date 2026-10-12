import { z } from "zod";

export const ScriptCoachInputSchema = z.object({
  scriptText: z.string().trim().min(1).max(12_000),
  niche: z.enum(["review", "lifestyle", "education", "tiktok_shop"]).optional(),
  targetDurationSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
});

const ScoreSchema = z.object({
  score: z.number().min(0).max(10),
  reason: z.string().trim().min(1).max(500),
}).strict();

export const ScriptCoachResultSchema = z.object({
  scores: z.object({
    hook: ScoreSchema,
    pacing: ScoreSchema,
    clarity: ScoreSchema,
    cta: ScoreSchema,
    naturalThai: ScoreSchema,
  }).strict(),
  weakSpots: z.array(z.object({
    quote: z.string().min(1).max(2_000),
    reason: z.string().trim().min(1).max(500),
  }).strict()).max(8),
  rewrite: z.string().trim().min(1).max(20_000),
}).strict();

export type ScriptCoachInput = z.infer<typeof ScriptCoachInputSchema>;
export type ScriptCoachResult = z.infer<typeof ScriptCoachResultSchema>;

export class InvalidScriptCoachOutputError extends Error {
  constructor() {
    super("Claude returned output that does not satisfy the Script Coach schema.");
    this.name = "InvalidScriptCoachOutputError";
  }
}

export function parseScriptCoachResult(
  rawText: string,
  input: ScriptCoachInput,
): ScriptCoachResult {
  let unvalidated: unknown;
  try {
    unvalidated = JSON.parse(rawText);
  } catch {
    throw new InvalidScriptCoachOutputError();
  }

  const parsed = ScriptCoachResultSchema.safeParse(unvalidated);
  if (!parsed.success) {
    throw new InvalidScriptCoachOutputError();
  }

  const sourceLines = input.scriptText.split(/\r?\n/);
  if (!parsed.data.weakSpots.every(({ quote }) => sourceLines.includes(quote))) {
    throw new InvalidScriptCoachOutputError();
  }

  return parsed.data;
}
