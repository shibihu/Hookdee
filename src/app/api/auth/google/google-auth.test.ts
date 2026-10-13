import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({
    GOOGLE_CLIENT_ID: "test-google-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    APP_URL: "http://localhost:3000",
  }),
}));

import { getGoogleAuthUrl } from "@/lib/auth/google";
import { GET as handleGoogleInit } from "./route";

describe("Google OAuth", () => {
  it("generates correct Google OAuth URL", () => {
    const url = getGoogleAuthUrl(
      "client-123",
      "http://localhost:3000/api/auth/callback/google",
      "state-456"
    );

    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback%2Fgoogle");
    expect(url).toContain("scope=openid+profile+email");
    expect(url).toContain("state=state-456");
  });

  it("redirects to Google OAuth authorization page on GET /api/auth/google", async () => {
    const req = new Request("http://localhost:3000/api/auth/google");
    const res = await handleGoogleInit(req);

    expect(res.status).toBe(307); // Next.js redirect status
    const location = res.headers.get("location");
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("test-google-client-id");
  });
});
