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

const validatedServerEnvSchema = serverEnvSchema.superRefine((env, context) => {
  if (Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET)) {
    return;
  }

  const missingVariable = env.GOOGLE_CLIENT_ID
    ? "GOOGLE_CLIENT_SECRET"
    : "GOOGLE_CLIENT_ID";
  context.addIssue({
    code: "custom",
    path: [missingVariable],
    message: "must be configured together with the other Google credential",
  });
});

export type ServerEnv = z.infer<typeof validatedServerEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const parsed = validatedServerEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  return parsed.data;
}
