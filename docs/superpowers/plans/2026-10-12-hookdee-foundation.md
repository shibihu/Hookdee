# Hookdee Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a buildable Next.js foundation for Hookdee, with the approved Thai-first design system, PostgreSQL/Prisma data model, environment configuration, and Windows setup documentation.

**Architecture:** Keep the application in one Next.js App Router project at the workspace root, with route code under `src/app`, focused server-side helpers under `src/lib`, and Prisma schema/migrations under `prisma`. This foundation establishes the entities and boundaries required by later milestones without implementing the landing experience, AI review flow, authentication flow, or billing behavior.

**Tech Stack:** TypeScript, Next.js App Router, Tailwind CSS, PostgreSQL, Prisma 6.19.3, Zod, Vitest, IBM Plex Sans Thai.

## Global Constraints

- TypeScript, Next.js App Router, Tailwind CSS, and PostgreSQL.
- Prisma is the ORM and migration tool, providing a simple relational schema for users, projects, reviews, usage, AI logs, and subscriptions.
- Auth.js supports email/password and Google sign-in.
- Thai is the default UI language, organized so additional locales can be added.
- Use a Thai-capable font such as IBM Plex Sans Thai or Noto Sans Thai.
- Secrets are environment-configured and never exposed to client bundles.
- Provide `.env.example` with required database, Auth.js, Google OAuth, Anthropic, and Stripe test-mode configuration variables, without real secrets.
- README setup instructions cover Windows PowerShell, PostgreSQL database setup, migrations, Google OAuth configuration, and Stripe CLI local webhook forwarding. Include test-mode setup only; do not add live keys.
- Do not promise views, sales, or results. Product copy may promise time saved and better script quality.
- The workspace is not a Git repository; do not include Git commit steps.

---

## File Structure

- `package.json`, `package-lock.json`: scripts and pinned npm dependency resolution.
- `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`: application tooling configuration.
- `src/app/layout.tsx`: root document metadata and Thai language declaration.
- `src/app/globals.css`: Tailwind import and small global design tokens.
- `src/app/page.tsx`: minimal Thai foundation screen, not the finished landing page.
- `src/lib/env-schema.ts`: pure Zod environment schema and typed parser.
- `src/lib/env.server.ts`: server-only reader for `process.env`.
- `src/lib/env-schema.test.ts`: validation tests for required and optional environment settings.
- `prisma/schema.prisma`: PostgreSQL datasource, generated client, and Phase 1 plus Voice Profile schema.
- `prisma/migrations/`: generated foundation migration.
- `.env.example`: variable names and safe local/test placeholders only.
- `README.md`: PowerShell-first PostgreSQL, migration, app run, and Stripe CLI instructions.

## Task 1: Create the Next.js application shell

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, and `test`.
- Produces a Thai root layout that later route and page components inherit.

- [ ] **Step 1: Initialize npm and install the application dependencies**

Run in PowerShell from the workspace root:

```powershell
npm init -y
npm install next react react-dom
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss eslint eslint-config-next vitest
npm install zod @prisma/client@6.19.3
npm install -D prisma@6.19.3
npm install @fontsource/ibm-plex-sans-thai server-only
```

Expected: `package.json` and `package-lock.json` exist and all installs exit with code 0.

- [ ] **Step 2: Configure scripts, TypeScript, Next.js, Tailwind, and ESLint**

Add these npm scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:validate": "prisma validate",
    "prisma:migrate:dev": "prisma migrate dev"
  }
}
```

Configure the TypeScript compiler for strict checking, Next.js App Router types, and the `@/*` alias. Configure PostCSS with `@tailwindcss/postcss`, and configure ESLint with the installed Next.js flat config. Keep generated `.next`, `node_modules`, and `coverage` out of lint and source control.

Add `.env`, `.env.*`, `!.env.example`, `node_modules/`, `.next/`, `coverage/`, and `src/generated/prisma/` to `.gitignore`.

- [ ] **Step 3: Add a Thai root layout, styles, and temporary home screen**

Set `<html lang="th">` and add Thai title/description metadata without performance or sales promises. Import `@fontsource/ibm-plex-sans-thai` in `src/app/globals.css` so the Thai font is bundled locally and does not need a network fetch during production builds. Start the stylesheet with `@import "tailwindcss";`. Make `src/app/page.tsx` a small Thai foundation placeholder that can be replaced by the landing page in Milestone 2.

- [ ] **Step 4: Run the application-shell checks**

Run:

```powershell
npm run lint
npm run typecheck
npm run build
```

Expected: all commands succeed; the home route renders Thai text and its HTML root declares `lang="th"`.

## Task 2: Add typed server-side environment configuration

**Files:**
- Create: `src/lib/env-schema.ts`
- Create: `src/lib/env.server.ts`
- Create: `src/lib/env-schema.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv`, which parses a supplied environment using Zod and throws a descriptive configuration error if required values are invalid.
- Produces `getServerEnv(): ServerEnv`, which reads `process.env` in server-only code and delegates to `parseServerEnv`.
- Produces `ServerEnv` with `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_URL`; reject live-mode Stripe API keys and validate webhook-secret format when set.

- [ ] **Step 1: Write environment validation tests**

Create `src/lib/env-schema.test.ts` with these imports, valid baseline, and assertions:

```ts
import { expect, it } from "vitest";
import { parseServerEnv } from "./env-schema";

const validEnv = {
  DATABASE_URL: "postgresql://localhost:5432/hookdee?schema=public",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  NODE_ENV: "test" as const,
};

it("rejects a missing or malformed required database URL", () => {
  expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: "not-a-postgres-url" })).toThrow(/DATABASE_URL/);
});

it("rejects a missing required Auth.js secret", () => {
  expect(() => parseServerEnv({ ...validEnv, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET/);
});

it("accepts valid required values", () => {
  expect(parseServerEnv(validEnv)).toMatchObject({
    DATABASE_URL: validEnv.DATABASE_URL,
    AUTH_SECRET: validEnv.AUTH_SECRET,
    APP_URL: validEnv.APP_URL,
  });
});

it("rejects Stripe live secret keys but accepts test keys", () => {
  expect(() => parseServerEnv({ ...validEnv, STRIPE_SECRET_KEY: "sk_live_example" })).toThrow(/STRIPE_SECRET_KEY/);
  expect(parseServerEnv({ ...validEnv, STRIPE_SECRET_KEY: "sk_test_example" })).toHaveProperty("STRIPE_SECRET_KEY", "sk_test_example");
});

it("does not include invalid secret values in validation errors", () => {
  let message = "";
  try {
    parseServerEnv({ ...validEnv, STRIPE_SECRET_KEY: "sk_live_do_not_print" });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(message).toContain("STRIPE_SECRET_KEY");
  expect(message).not.toContain("sk_live_do_not_print");
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
npx vitest run src/lib/env-schema.test.ts
```

Expected: FAIL because `src/lib/env-schema.ts` does not yet export `parseServerEnv`.

- [ ] **Step 3: Implement the server-only environment parser**

Implement `parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv` in the pure `src/lib/env-schema.ts`; require `DATABASE_URL`, `AUTH_SECRET`, and `APP_URL`, allow Google, Anthropic, and Stripe credentials to be absent during foundation-only development, and validate their formats when present. Validate `AUTH_SECRET` at 32 or more characters and reject a Stripe API key beginning with `sk_live_`. Format validation errors with variable names only, never values. In `src/lib/env.server.ts`, import `server-only` and export `getServerEnv(): ServerEnv`, which calls `parseServerEnv(process.env)`.

- [ ] **Step 4: Run environment tests and type checks**

Run:

```powershell
npx vitest run src/lib/env-schema.test.ts
npm run typecheck
```

Expected: all environment tests pass and TypeScript reports no errors.

## Task 3: Define and validate the Prisma schema

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Produces Prisma models for Auth.js `User`, `Account`, `Session`, and `VerificationToken`; `Project`, `Script`, `Review`, `MonthlyUsage`, `AIRequestLog`, `RateLimitBucket`, `Subscription`, `StripeEvent`, and `VoiceProfile`.
- `Review` stores five 0–10 score values with a required reason for each, weak-spot quotations, and the rewrite.
- `AIRequestLog.userId` is nullable for anonymous demo calls.
- `VoiceProfile.sourceScriptIds` records the script identifiers that informed the optional Phase 2 profile.
- `RateLimitBucket` stores hashed subjects, scope, window start, and count; raw IP addresses are not stored.

- [ ] **Step 1: Define PostgreSQL datasource and Prisma client generator**

Set the datasource provider to `postgresql`, read the connection string from `DATABASE_URL`, and use the standard Prisma Client generator.

- [ ] **Step 2: Define account, project, and review models**

Define unique email users with optional password hash, Auth.js provider account, session, and verification-token models, projects owned by users, scripts owned by projects, and reviews owned by scripts. Use cascading deletes from a user through owned projects, scripts, and reviews. Keep niche and target duration optional. Store `scores` as JSON with keys `hook`, `pacing`, `clarity`, `cta`, and `naturalThai`; each value has numeric `score` and string `reason`. Store `weakSpots` as JSON objects with exact `quote` and `reason` strings. Validate these structures with Zod in the coach milestone.

- [ ] **Step 3: Define usage, logging, billing, and Voice Profile models**

Define `MonthlyUsage` with user, UTC calendar month, consumed review count, and a unique `(userId, monthStart)` key. Define `AIRequestLog` with nullable user, model, input/output token counts, estimated cost, and timestamp. Define `RateLimitBucket` with `scope`, `subjectHash`, `windowStart`, `count`, and unique `(scope, subjectHash, windowStart)`; later milestones use a one-minute window for account/IP limits at 5 reviews per minute per account and IP, and a non-resetting bucket for the two-use anonymous IP/device cap. Hash subject identifiers with a server secret before storing them. Define one current `Subscription` per user with a unique user ID, unique Stripe customer/subscription IDs, plan interval, webhook-derived status, and current period timestamps. Define `StripeEvent` with unique event ID and processing timestamp. Define one `VoiceProfile` per user with catchphrases, tone, sentence rhythm, joke patterns, and source script IDs. Add indexes for user/time and lookup fields used by future API handlers.

- [ ] **Step 4: Validate Prisma schema and generate the client**

Set a temporary local-format connection URL for the validation process:

```powershell
$env:DATABASE_URL = "postgresql://localhost:5432/hookdee?schema=public"
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev -- --name foundation
```

Expected: Prisma schema validation and client generation succeed without requiring a running database server. Migration creation succeeds when the local PostgreSQL service and database are running.

## Task 4: Add safe configuration template and Windows setup guide

**Files:**
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Documents local PostgreSQL, environment setup, migration, app run, and local Stripe webhook workflows for Windows PowerShell.

- [ ] **Step 1: Add `.env.example` with non-secret placeholders**

Include `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. Use clearly fake/local values and Stripe test-mode prefixes only. Do not include a real credential or usable key.

- [ ] **Step 2: Document the local setup sequence**

In `README.md`, document Node.js LTS and npm prerequisites, PostgreSQL installation or local service setup, creating the `hookdee` database, copying `.env.example` to `.env`, generating an Auth.js secret with PowerShell's `node -e` and `crypto.randomBytes(32)`, Prisma schema validation, client generation, migration commands, and starting the Next.js development server.

- [ ] **Step 3: Document Google and Stripe test configuration**

Explain where to configure Google OAuth redirect URLs and Stripe test-mode API keys. Document installing Stripe CLI, authenticating it, and running `stripe listen --forward-to localhost:3000/api/stripe/webhook` after the webhook route is added in the billing milestone. State that checkout, live keys, and webhook route are not part of this foundation deliverable.

- [ ] **Step 4: Verify documentation paths and run all foundation checks**

Run:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev -- --name foundation
npm run test
npm run lint
npm run typecheck
npm run build
```

Expected: every command succeeds with a locally configured PostgreSQL connection string and running local PostgreSQL service. Prisma validation and client generation do not require PostgreSQL to be running. `.env` must remain ignored by Git.

## Foundation acceptance criteria

- The app starts and builds as a strict TypeScript Next.js App Router application.
- Default document language is Thai and the configured font supports Thai glyphs.
- Environment parsing fails clearly for missing required configuration without revealing values.
- Prisma validates and generates models for Phase 1 features and the Phase 2 Voice Profile.
- A foundation migration is created against the local PostgreSQL database.
- README instructions are specific to PowerShell and use Stripe test mode only.
- No landing-page behavior, sign-in flow, AI calls, usage enforcement, or billing behavior is represented as implemented in this milestone.

## Next subsystem plans

After this foundation plan is implemented and reviewed, create separate
implementation plans against the actual file tree for:

1. Thai landing page and anonymous demo.
2. Script Coach, structured output, and AI cost logging.
3. Auth.js login, projects, dashboard, and saved reviews.
4. Monthly credits, account/IP rate limits, model selection, and exports.
5. Stripe subscriptions, webhooks, Customer Portal, and Team stub.
