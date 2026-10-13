import type { ScriptCoachInput, ScriptCoachResult } from "./review-schema";

export function generateFallbackReview(input: ScriptCoachInput): ScriptCoachResult {
  const text = input.scriptText.trim();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const wordCount = text.length;
  const firstLine = lines[0] || text.slice(0, 30);

  const hasHookQuestion = /[\?？ไหมไหมครับไหมคะเปล่าใช่ไหมชอบไหมกำลังตามหา]/.test(firstLine);
  const hasStrongStart = firstLine.length >= 10 && firstLine.length <= 60;
  const hookScore = hasHookQuestion || hasStrongStart ? 8 : 6;

  const hasCTA = /[กด|สั่ง|พิกัด|ตะกร้า|ลิงก์|เมนต์|ติดตาม|แชร์|ซื้อ]/.test(text);
  const ctaScore = hasCTA ? 8 : 5;

  const targetSec = input.targetDurationSeconds ?? 30;
  const idealLength = targetSec * 10; // ~10 characters per sec in Thai
  const pacingDiff = Math.abs(wordCount - idealLength);
  const pacingScore = pacingDiff < 50 ? 9 : pacingDiff < 100 ? 7 : 5;

  return {
    scores: {
      hook: {
        score: hookScore,
        reason: hasHookQuestion
          ? "มีประโยคเปิดหัวเรื่องหรือคำถามที่ดึงดูดความสนใจได้ดี"
          : "การเปิดเรื่องกระชับ แนะนำให้ปรับเป็นคำถามหรือจุดขยี้ความเจ็บปวด (Pain Point) เพื่อดึงคนดูตั้งแต่ 3 วินาทีแรก",
      },
      pacing: {
        score: pacingScore,
        reason: `ความยาวสคริปต์ประมาณ ${wordCount} ตัวอักษร เหมาะสมกับคลิปความยาวเป้าหมาย ${targetSec} วินาที`,
      },
      clarity: {
        score: 8,
        reason: "ประโยคเข้าใจง่าย ใช้ภาษาพูดที่เป็นธรรมชาติสำหรับวิดีโอสั้น",
      },
      cta: {
        score: ctaScore,
        reason: hasCTA
          ? "มีคำเชิญชวน (Call to Action) ที่ชัดเจนในช่วงท้าย"
          : "ช่วงท้ายสคริปต์ยังขาด คำเชิญชวนให้คนดูคอมเมนต์ กดติดตาม หรือกดตะกร้า/ลิงก์",
      },
      naturalThai: {
        score: 9,
        reason: "ใช้ภาษาไทยที่เป็นธรรมชาติ ลื่นไหล เข้ากับสไตล์คลิปสั้น",
      },
    },
    weakSpots: [
      {
        quote: firstLine,
        reason: "สามารถเพิ่มพลังของฮุก (Hook) ในช่วงต้นเพื่อหยุดนิ้วคนดูได้ดียิ่งขึ้น",
      },
    ],
    rewrite: `${firstLine}\n\n${
      lines.length > 1 ? lines.slice(1).join("\n") : "สคริปต์เนื้อหาหลักเพิ่มจุดเด่นของผลิตภัณฑ์หรือเรื่องราวสั้นๆ"
    }\n\n${hasCTA ? "" : "อย่าลืมกดติดตามและคอมเมนต์คุยกันได้นะครับ!"}`,
  };
}
