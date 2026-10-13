import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../env.server", () => ({
  getServerEnv: () => ({
    AUTH_SECRET: "test-auth-secret-12345678901234567890",
    ADMIN_SECRET: "test-admin-secret-9999",
  }),
}));

import { isAdminAuthorized } from "./auth";

describe("admin auth helper", () => {
  it("authorizes request with matching x-admin-key header", async () => {
    const request = new Request("http://localhost/api/admin/stats", {
      headers: {
        "x-admin-key": "test-admin-secret-9999",
      },
    });

    const authorized = await isAdminAuthorized(request);
    expect(authorized).toBe(true);
  });

  it("authorizes request with matching admin session cookie", async () => {
    const request = new Request("http://localhost/api/admin/stats", {
      headers: {
        cookie: "hookdee_admin_session=test-admin-secret-9999",
      },
    });

    const authorized = await isAdminAuthorized(request);
    expect(authorized).toBe(true);
  });

  it("denies unauthorized request with wrong secret", async () => {
    const request = new Request("http://localhost/api/admin/stats", {
      headers: {
        "x-admin-key": "wrong-secret",
      },
    });

    const authorized = await isAdminAuthorized(request);
    expect(authorized).toBe(false);
  });
});
