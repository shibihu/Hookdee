import { describe, expect, it } from "vitest";
import { cleanCaption } from "./caption-remover";

describe("cleanCaption", () => {
  it("removes SRT and VTT timecodes and line numbers", () => {
    const rawSrt = `1\n00:00:01,500 --> 00:00:03,000\nสวัสดีครับทุกคนวันนี้พามาดูรีวิว\n\n2\n00:00:03,100 --> 00:00:06,000\nกล้องรุ่นใหม่น่าใช้มากครับ`;
    const result = cleanCaption(rawSrt);

    expect(result.cleanedText).toBe("สวัสดีครับทุกคนวันนี้พามาดูรีวิว\nกล้องรุ่นใหม่น่าใช้มากครับ");
    expect(result.removedItemsCount).toBeGreaterThan(0);
    expect(result.hasChanges).toBe(true);
  });

  it("removes bracketed audio and sound cues", () => {
    const rawScript = `[Music] สวัสดีครับ [เสียงดนตรี] วันนี้มีของดีมาแนะนำ (เสียงปรบมือ)`;
    const result = cleanCaption(rawScript);

    expect(result.cleanedText).toBe("สวัสดีครับ วันนี้มีของดีมาแนะนำ");
    expect(result.changesSummary.audioCuesRemoved).toBe(3);
  });

  it("removes inline timestamps and standalone time markers", () => {
    const rawScript = `[00:15] สวัสดีครับทุกคน (01:23) วันนี้มาจัดโปรพิเศษ`;
    const result = cleanCaption(rawScript);

    expect(result.cleanedText).toBe("สวัสดีครับทุกคน วันนี้มาจัดโปรพิเศษ");
    expect(result.changesSummary.timestampsRemoved).toBe(2);
  });

  it("strips speaker tags", () => {
    const rawScript = `Speaker 1: สวัสดีครับ\nคนพูด 2: ยินดีต้อนรับครับ\nHost: เริ่มกันเลย`;
    const result = cleanCaption(rawScript);

    expect(result.cleanedText).toBe("สวัสดีครับ\nยินดีต้อนรับครับ\nเริ่มกันเลย");
    expect(result.changesSummary.speakerLabelsRemoved).toBe(3);
  });

  it("strips social media hashtags, handles, and URLs", () => {
    const rawScript = `สคริปต์วิดีโอเด็ดๆ #fyp #รีวิว #tiktokshop @username https://example.com`;
    const result = cleanCaption(rawScript);

    expect(result.cleanedText).toBe("สคริปต์วิดีโอเด็ดๆ");
    expect(result.changesSummary.hashtagsRemoved).toBe(3);
  });

  it("leaves clean Thai script unchanged", () => {
    const cleanScript = `สวัสดีครับทุกคน วันนี้พามาดูวิธีทำคลิปวิดีโอสั้นแบบมือโปร`;
    const result = cleanCaption(cleanScript);

    expect(result.cleanedText).toBe(cleanScript);
    expect(result.removedItemsCount).toBe(0);
    expect(result.hasChanges).toBe(false);
  });
});
