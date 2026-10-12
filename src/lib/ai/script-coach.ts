import {
  InvalidScriptCoachOutputError,
  parseScriptCoachResult,
  type ScriptCoachInput,
  type ScriptCoachResult,
} from "./review-schema";
import { AI_MODELS, estimateCostUsd, type ModelTier } from "./model-config";
import type { GenerateStructuredReview } from "./gemini-client";

export interface VoiceProfileContext {
  catchphrases?: string[];
  tone?: string;
  sentenceRhythm?: string;
  jokePatterns?: string;
}

export interface ScriptCoachOptions {
  userId?: string | null;
  modelTier?: ModelTier;
  voiceProfile?: VoiceProfileContext;
}

export interface AIRequestLogInput {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  userId: string | null;
  createdAt: Date;
}

export interface ScriptCoachDependencies {
  generate: GenerateStructuredReview;
  logRequest: (entry: AIRequestLogInput) => Promise<void>;
}

export class ScriptCoachProviderError extends Error {
  constructor(options?: ErrorOptions) {
    super("The Script Coach provider request failed.", options);
    this.name = "ScriptCoachProviderError";
  }
}

export class ScriptCoachValidationError extends Error {
  constructor() {
    super("The Script Coach response failed validation after one retry.");
    this.name = "ScriptCoachValidationError";
  }
}

export async function reviewScript(
  input: ScriptCoachInput,
  options: ScriptCoachOptions,
  dependencies: ScriptCoachDependencies,
): Promise<ScriptCoachResult> {
  const model = AI_MODELS[options.modelTier ?? "free"];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let generated;
    try {
      generated = await dependencies.generate(input, model);
    } catch (error) {
      await dependencies.logRequest({
        model: model.id,
        inputTokens: null,
        outputTokens: null,
        estimatedCostUsd: null,
        userId: options.userId ?? null,
        createdAt: new Date(),
      });
      throw new ScriptCoachProviderError({ cause: error });
    }

    await dependencies.logRequest({
      model: model.id,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      estimatedCostUsd: estimateCostUsd(
        model,
        generated.inputTokens,
        generated.outputTokens,
      ),
      userId: options.userId ?? null,
      createdAt: new Date(),
    });

    try {
      return parseScriptCoachResult(generated.text, input);
    } catch (error) {
      if (!(error instanceof InvalidScriptCoachOutputError)) {
        throw error;
      }
      if (attempt === 1) {
        throw new ScriptCoachValidationError();
      }
    }
  }

  throw new ScriptCoachValidationError();
}
