import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockAdminClient, sessions } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockAdminClient: vi.fn(() => null),
  sessions: [] as Array<{
    id: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminSession: {
      create: vi.fn().mockImplementation(({ data }) => {
        const session = {
          id: `session-${sessions.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        sessions.push(session);
        return Promise.resolve(session);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(
        sessions.find((session) => session.tokenHash === where.tokenHash) ?? null,
      )),
      deleteMany: vi.fn().mockImplementation(({ where }) => {
        const initialCount = sessions.length;
        const remaining = sessions.filter((session) => session.tokenHash !== where.tokenHash);
        sessions.splice(0, sessions.length, ...remaining);
        return Promise.resolve({ count: initialCount - sessions.length });
      }),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("./admin-client", () => ({
  default: mockAdminClient,
}));

import AdminPage from "./page";
import { ADMIN_COOKIE_NAME, createAdminSession, isAdminAuthorized } from "@/lib/admin/auth";

describe("admin page entry", () => {
  beforeEach(() => {
    mockAdminClient.mockClear();
    sessions.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("revokes the incoming session before rendering the admin client", async () => {
    const token = await createAdminSession();
    const request = new Request("http://localhost/api/admin/stats", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
    });
    await expect(isAdminAuthorized(request)).resolves.toBe(true);
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
    });

    const page = await AdminPage();

    expect(page.type).toBe(mockAdminClient);
    await expect(isAdminAuthorized(request)).resolves.toBe(false);
  });

  it("renders the admin client when no session cookie exists", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    const page = await AdminPage();

    expect(page.type).toBe(mockAdminClient);
    expect(sessions).toHaveLength(0);
  });
});
