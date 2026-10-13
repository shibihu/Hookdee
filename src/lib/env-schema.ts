import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "must be a PostgreSQL connection URL",
    ),
  AUTH_SECRET: z.string().min(32),
  ADMIN_SECRET: z.string().min(1).optional(),
  APP_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z
    .string()
    .refine((value) => value.startsWith("sk_test_"), "must be a Stripe test key")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .refine((value) => value.startsWith("whsec_"), "must be a Stripe webhook secret")
    .optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  return parsed.data;
}
