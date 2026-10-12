import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => {
    throw new Error("Invalid server environment: missing local values");
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";

it("returns a sanitized service-unavailable response for invalid server configuration", async () => {
  const response = await POST(
    new Request("http://localhost/api/demo/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scriptText: "สคริปต์ทดสอบ" }),
    }),
  );

  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    code: "SERVICE_UNAVAILABLE",
    message: expect.any(String),
  });
});

it("handles requests with custom headers safely", async () => {
  const response = await POST(
    new Request("http://localhost/api/demo/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "203.0.113.100",
      },
      body: JSON.stringify({ scriptText: "สคริปต์ทดสอบ" }),
    }),
  );

  expect(response.status).toBe(503);
});
