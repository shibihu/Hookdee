import { describe, expect, it, vi } from "vitest";

const { nextAuthMock } = vi.hoisted(() => ({
  nextAuthMock: vi.fn(
    (config: { pages?: { error?: string; signIn?: string } }) => ({
      auth: vi.fn(),
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      config,
    }),
  ),
}));

vi.mock("next-auth", () => ({ default: nextAuthMock }));
vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));
vi.mock("@/lib/env.server", () => ({
  getServerEnv: () => ({
    AUTH_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
  }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("Auth.js error routing", () => {
  it("routes Auth.js errors to the login UI without overriding sign-in routing", async () => {
    await import("@/auth");

    expect(nextAuthMock).toHaveBeenCalledTimes(1);
    const config = nextAuthMock.mock.results[0]?.value.config;

    expect(config?.pages?.error).toBe("/login");
    expect(config?.pages?.signIn).toBeUndefined();
  });
});
