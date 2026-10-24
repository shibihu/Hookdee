import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/demo/clean-caption/route";

describe("POST /api/demo/clean-caption", () => {
  it("cleans script text successfully via API", async () => {
    const req = new Request("http://localhost/api/demo/clean-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptText: "1\n00:00:01 --> 00:00:03\nสวัสดีครับ #fyp",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.cleanedText).toBe("สวัสดีครับ");
    expect(json.result.removedItemsCount).toBeGreaterThan(0);
  });

  it("returns 400 status for empty script text", async () => {
    const req = new Request("http://localhost/api/demo/clean-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptText: "",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.code).toBe("INVALID_INPUT");
  });

  it("returns 400 status for invalid JSON payload", async () => {
    const req = new Request("http://localhost/api/demo/clean-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.code).toBe("INVALID_JSON");
  });
});
