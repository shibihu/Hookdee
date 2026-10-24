import { NextResponse } from "next/server";
import { CaptionCleanInputSchema, cleanCaption } from "@/lib/ai/caption-remover";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: "INVALID_JSON", message: "รูปแบบข้อมูล JSON ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const parseResult = CaptionCleanInputSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessage =
        parseResult.error.issues[0]?.message || "ข้อมูลสคริปต์ไม่ถูกต้อง";
      return NextResponse.json(
        { code: "INVALID_INPUT", message: errorMessage },
        { status: 400 },
      );
    }

    const result = cleanCaption(parseResult.data.scriptText);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Caption remover failed:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "ไม่สามารถล้างแคปชันได้ในขณะนี้" },
      { status: 500 },
    );
  }
}
