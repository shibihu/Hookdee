import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  hookdeePrisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
const adapterConfig = connectionString ? { connectionString } : {};

export const prisma =
  prismaGlobal.hookdeePrisma ??
  new PrismaClient({
    adapter: new PrismaPg(adapterConfig),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.hookdeePrisma = prisma;
}
