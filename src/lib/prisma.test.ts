import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@prisma/client", () => ({ PrismaClient: vi.fn() }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

describe("Prisma client configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Reflect.deleteProperty(globalThis, "hookdeePrisma");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("configures the PostgreSQL driver adapter from DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/hookdee");

    await import("./prisma");

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: "postgresql://localhost:5432/hookdee",
    });
    expect(PrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: expect.any(PrismaPg) }),
    );
  });

  it("allows build-time client setup without a database connection", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(import("./prisma")).resolves.toBeDefined();
    expect(PrismaPg).toHaveBeenCalledWith({});
  });
});
