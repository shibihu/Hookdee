import "server-only";

import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & {
  hookdeePrisma?: PrismaClient;
};

export const prisma =
  prismaGlobal.hookdeePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.hookdeePrisma = prisma;
}
