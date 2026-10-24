import { z } from "zod";

export interface CaptionCleanResult {
  cleanedText: string;
  originalText: string;
  removedItemsCount: number;
  hasChanges: boolean;
  changesSummary: {
    timestampsRemoved: number;
    audioCuesRemoved: number;
    hashtagsRemoved: number;
    speakerLabelsRemoved: number;
  };
}

export const CaptionCleanInputSchema = z.object({
  scriptText: z.string().min(1, "กรุณากรอกข้อความสคริปต์").max(20_000, "ข้อความยาวเกิน 20,000 ตัวอักษร"),
  useAi: z.boolean().optional().default(false),
});

export const CaptionCleanResponseSchema = z.object({
  cleanedText: z.string(),
  originalText: z.string(),
  removedItemsCount: z.number(),
  hasChanges: z.boolean(),
  changesSummary: z.object({
    timestampsRemoved: z.number(),
    audioCuesRemoved: z.number(),
    hashtagsRemoved: z.number(),
    speakerLabelsRemoved: z.number(),
  }),
});

export type CaptionCleanInput = z.infer<typeof CaptionCleanInputSchema>;

/**
 * Deterministically removes captions, subtitles, timestamps, sound cues,
 * speaker labels, and social clutter from video transcripts and scripts.
 */
export function cleanCaption(rawText: string): CaptionCleanResult {
  let text = rawText;

  let timestampsRemoved = 0;
  let audioCuesRemoved = 0;
  let hashtagsRemoved = 0;
  let speakerLabelsRemoved = 0;

  // 1. Remove SRT line numbers (standalone digits followed by timestamp line)
  text = text.replace(/^\d+\r?\n(?=\d{1,2}:\d{2})/gm, () => {
    timestampsRemoved += 1;
    return "";
  });

  // 2. Remove SRT / VTT timecode ranges (00:00:01,000 --> 00:00:04,000 or 00:01 --> 00:04)
  const timecodeRangeRegex = /\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?/g;
  text = text.replace(timecodeRangeRegex, () => {
    timestampsRemoved += 1;
    return "";
  });

  // 3. Remove standalone timestamps like [00:15], (01:23), 00:15:, 0:15
  const timestampRegex = /(?:\[|\()?\b\d{1,2}:\d{2}(?::\d{2})?\b(?:\]|\))?:?/g;
  text = text.replace(timestampRegex, () => {
    timestampsRemoved += 1;
    return "";
  });

  // 4. Remove bracketed sound effects / audio cues ([Music], (เสียงเพลง), [Laughter], [ดนตรี], etc.)
  const audioCueRegex = /\[(?:\s*music|\s*applause|\s*laughter|\s*cheering|\s*audio|\s*sound|\s*เสียงดนตรี|\s*เสียงหัวเราะ|\s*เสียงปรบมือ|\s*ดนตรี|\s*เพลง|\s*ซาวด์|\s*บรรยากาศ).*?\]|\((?:\s*music|\s*applause|\s*laughter|\s*cheering|\s*audio|\s*sound|\s*เสียงดนตรี|\s*เสียงหัวเราะ|\s*เสียงปรบมือ|\s*ดนตรี|\s*เพลง|\s*ซาวด์|\s*บรรยากาศ).*?\)/gi;
  text = text.replace(audioCueRegex, () => {
    audioCuesRemoved += 1;
    return "";
  });

  // 5. Remove speaker tags (Speaker 1:, คนพูด 1:, Host:, Guest:, A:)
  const speakerRegex = /^(?:Speaker\s*\d+|คนพูด\s*\d+|Host|Guest|A|B|ผู้พูด\s*\d+|พิธีกร):\s*/gim;
  text = text.replace(speakerRegex, () => {
    speakerLabelsRemoved += 1;
    return "";
  });

  // 6. Remove social media hashtags (#fyp, #รีวิว, #tiktokshop)
  const hashtagRegex = /#[\w\u0e00-\u0e7f_]+/g;
  text = text.replace(hashtagRegex, () => {
    hashtagsRemoved += 1;
    return "";
  });

  // 7. Remove web links and @mentions
  text = text.replace(/https?:\/\/\S+|www\.\S+/gi, "");
  text = text.replace(/@[\w\u0e00-\u0e7f_.]+/g, "");

  // 8. Clean VTT/HTML formatting tags like <b>, <c>, </c>
  text = text.replace(/<\/?[^>]+(>|$)/g, "");

  // 9. Normalize line breaks and multiple whitespace
  const cleanedLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);

  const cleanedText = cleanedLines.join("\n");
  const totalRemoved =
    timestampsRemoved + audioCuesRemoved + hashtagsRemoved + speakerLabelsRemoved;

  return {
    cleanedText,
    originalText: rawText,
    removedItemsCount: totalRemoved,
    hasChanges: cleanedText !== rawText.trim(),
    changesSummary: {
      timestampsRemoved,
      audioCuesRemoved,
      hashtagsRemoved,
      speakerLabelsRemoved,
    },
  };
}
