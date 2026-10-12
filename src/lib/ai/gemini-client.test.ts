import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

import {
  createGeminiGenerator,
  GeminiConfigurationError,
  GeminiStructuredOutputError,
} from "./gemini-client";

describe("createGeminiGenerator", () => {
  it("throws GeminiConfigurationError when apiKey is missing", () => {
    expect(() => createGeminiGenerator(undefined)).toThrow(
      GeminiConfigurationError,
    );
  });

  it("returns parsed text and usage metadata on successful generation", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '{"scores":{}}',
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 75 },
    });

    const generator = createGeminiGenerator("test-key");
    const result = await generator(
      { scriptText: "สคริปต์" },
      { id: "gemini-2.5-flash", inputUsdPerMillionTokens: 0.075, outputUsdPerMillionTokens: 0.3 },
    );

    expect(result).toEqual({
      text: '{"scores":{}}',
      inputTokens: 150,
      outputTokens: 75,
    });
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
      }),
    );
  });

  it("throws GeminiStructuredOutputError when output text is empty", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "   ",
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0 },
    });

    const generator = createGeminiGenerator("test-key");
    await expect(
      generator(
        { scriptText: "สคริปต์" },
        { id: "gemini-2.5-flash", inputUsdPerMillionTokens: 0.075, outputUsdPerMillionTokens: 0.3 },
      ),
    ).rejects.toThrow(GeminiStructuredOutputError);
  });
});
