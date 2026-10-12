import { expect, it } from "vitest";
import { parseServerEnv } from "./env-schema";

const validEnv = {
  DATABASE_URL: "postgresql://localhost:5432/hookdee?schema=public",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  NODE_ENV: "test" as const,
};

it("rejects a missing or malformed required database URL", () => {
  expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: undefined })).toThrow(
    /DATABASE_URL/,
  );
  expect(() =>
    parseServerEnv({ ...validEnv, DATABASE_URL: "not-a-postgres-url" }),
  ).toThrow(/DATABASE_URL/);
});

it("rejects a missing required Auth.js secret", () => {
  expect(() => parseServerEnv({ ...validEnv, AUTH_SECRET: undefined })).toThrow(
    /AUTH_SECRET/,
  );
});

it("accepts valid required values", () => {
  expect(parseServerEnv(validEnv)).toMatchObject({
    DATABASE_URL: validEnv.DATABASE_URL,
    AUTH_SECRET: validEnv.AUTH_SECRET,
    APP_URL: validEnv.APP_URL,
  });
});

it("rejects Stripe live secret keys but accepts test keys", () => {
  expect(() =>
    parseServerEnv({ ...validEnv, STRIPE_SECRET_KEY: "sk_live_example" }),
  ).toThrow(/STRIPE_SECRET_KEY/);
  expect(
    parseServerEnv({ ...validEnv, STRIPE_SECRET_KEY: "sk_test_example" }),
  ).toHaveProperty("STRIPE_SECRET_KEY", "sk_test_example");
});

it("does not include invalid secret values in validation errors", () => {
  let message = "";
  try {
    parseServerEnv({
      ...validEnv,
      STRIPE_SECRET_KEY: "sk_live_do_not_print",
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(message).toContain("STRIPE_SECRET_KEY");
  expect(message).not.toContain("sk_live_do_not_print");
});
