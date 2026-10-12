# Hookdee Landing Page and Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the foundation screen with Hookdee's Thai landing page and implement a real anonymous Script Coach demo with two-attempt IP/device limits.

**Architecture:** Use server-rendered landing sections and a small client-side demo form. Pull the minimum Claude/Zod service into this milestone so the demo returns genuine reviews; retain the approved prompt file boundary and log every Claude attempt. Persist IP/device demo limits in the existing Prisma `RateLimitBucket` model. Full authenticated history, projects, monthly allowances, and billing remain later milestones. The local PostgreSQL migration is currently deferred by user choice, so the landing page and unit tests can be completed now, but the persistent demo flow cannot be manually confirmed until PostgreSQL is started and migrated.

**Tech Stack:** TypeScript, Next.js App Router, Tailwind CSS, Prisma 6.19.3, Zod, Vitest, `@anthropic-ai/sdk`, IBM Plex Sans Thai.

## Global Constraints

- TypeScript, Next.js App Router, Tailwind CSS, and PostgreSQL.
- Prisma is the ORM and migration tool, providing a simple relational schema for users, projects, reviews, usage, AI logs, and subscriptions.
- Keep editable Script Coach prompts in `prompts/script-coach.ts`; API routes should delegate to shared services rather than contain prompts or business logic.
- Anthropic Claude and Stripe are called only from server-side code. Secrets are environment-configured and never exposed to client bundles.
- Thai is the default UI language, organized so additional locales can be added. Use IBM Plex Sans Thai.
- The mobile-first Thai landing page includes the interactive review demo, generic-versus-coached comparison, pricing, FAQ, and footer.
- The anonymous demo is available without registration for two attempts, enforced independently by anonymous browser cookie and IP-based rate limiting; whichever limit is reached first blocks further anonymous reviews.
- The output has scores from 0 to 10 for Hook, Pacing, Clarity, CTA, and Natural Thai tone; each score has a specific reason.
- On schema validation failure, retry once; if validation still fails, return a friendly Thai error.
- Log each AI call, including failed attempts, with model, token counts when returned, estimated cost, nullable user ID, and timestamp.
- Do not promise views, sales, or results. Product copy may promise time saved and better script quality.
- Use `claude-haiku-5-5` for the free anonymous demo and reserve `claude-opus-5-5` as the Pro model for the later account/usage milestone. Keep the model and price snapshot in one server-only module.
- The workspace is not a Git repository; do not include Git commit steps.

---

## File Structure

- `src/app/page.tsx`: compose the server-rendered landing page.
- `src/app/api/demo/review/route.ts`: validate a POST request and delegate to a testable demo handler.
- `src/app/login/page.tsx`: honest sign-in gate placeholder until the Auth.js milestone.
- `src/components/landing/site-header.tsx`: logo and navigation links.
- `src/components/landing/hero.tsx`: Thai pain-focused headline, CTA, and demo entry point.
- `src/components/landing/before-after.tsx`: clearly labeled illustrative script comparison.
- `src/components/landing/pricing.tsx`: approved Free/Pro prices and Team coming-soon state.
- `src/components/landing/faq.tsx`: accessible FAQ disclosure rows.
- `src/components/landing/site-footer.tsx`: footer and non-promissory product copy.
- `src/components/demo/review-form.tsx`: client form, request states, attempt count, and login gate.
- `src/components/demo/review-result.tsx`: scores/reasons, exact-line weak spots, rewrite, and copy action.
- `src/lib/ai/review-schema.ts`: Zod input/output schemas and domain types.
- `src/lib/ai/model-config.ts`: model IDs and per-token USD estimate rates.
- `src/lib/ai/anthropic-client.ts`: server-only Claude structured-output client.
- `src/lib/ai/script-coach.ts`: retry-on-validation service with optional voice-profile input and per-attempt logging.
- `src/lib/ai/script-coach.test.ts`: service schema, retry, quote-exactness, and logging tests.
- `src/lib/i18n/th.ts`: centralized Thai UI copy for the landing page, demo, and friendly API messages.
- `src/lib/demo/device-cookie.ts`: signed anonymous device identifier.
- `src/lib/demo/rate-limit.ts`: atomic Prisma counter for IP and device attempts.
- `src/lib/demo/rate-limit.test.ts`: limit accounting tests against a deterministic in-memory store.
- `src/lib/demo/handle-review.ts`: testable request orchestration and friendly response mapping.
- `src/lib/demo/handle-review.test.ts`: input, limit, review result, and service-failure tests.
- `src/lib/prisma.ts`: development-safe Prisma Client singleton.
- `prompts/script-coach.ts`: editable Thai coach instructions.
- `src/app/globals.css`: mobile-first brand tokens and layout additions.
- `package.json`, `package-lock.json`: Anthropic SDK dependency.
- `README.md`: update setup and manual demo verification steps.

## Interfaces

- `ScriptCoachInput` has required `scriptText`, optional `niche` (`review`, `lifestyle`, `education`, `tiktok_shop`), and optional `targetDurationSeconds` (`15 | 30 | 60`).
- `ScriptCoachResult` contains `scores` (`hook`, `pacing`, `clarity`, `cta`, and `naturalThai`; each is `{ score: number; reason: string }`), `weakSpots` (`{ quote: string; reason: string }[]`), and `rewrite`.
- `VoiceProfileContext` has optional catchphrases, tone, sentence rhythm, and joke patterns. `reviewScript` accepts it in options but does not alter Phase 1 output based on it.
- `reviewScript(input, options, dependencies): Promise<ScriptCoachResult>` receives injectable `generate` and `logRequest` dependencies so tests exercise real validation/retry behavior without network or database access.
- `handleDemoReview(request, dependencies): Promise<Response>` validates the request, consumes IP/device attempts, invokes `reviewScript`, and maps typed errors to HTTP responses.
- `consumeDemoAttempt({ ip, deviceId }, store, now): Promise<{ allowed: boolean; remaining: number }>` counts both independent permanent demo buckets, denies if either exceeds two, and sets `remaining` to `max(0, min(2 - ipCount, 2 - deviceCount))`.

## Task 1: Implement structured Claude review service

**Files:**
- Create: `src/lib/ai/review-schema.ts`
- Create: `src/lib/ai/model-config.ts`
- Create: `src/lib/ai/anthropic-client.ts`
- Create: `src/lib/ai/script-coach.ts`
- Create: `src/lib/ai/script-coach.test.ts`
- Create: `prompts/script-coach.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces the input, output, and optional voice-profile types described above.
- Produces `reviewScript(input, options, dependencies): Promise<ScriptCoachResult>`.
- Produces `createAnthropicGenerator(apiKey)` that requests Claude structured JSON and returns parsed text plus token usage.

- [ ] **Step 1: Add a failing test for validated review output and exact quotations**

Add a valid fixture with all five scores/reasons and this source/weak-spot pair:

```ts
const input = {
  scriptText: "เดี๋ยวก่อน!\nวันนี้มีของมาแนะนำ",
};

const validResult = {
  scores: {
    hook: { score: 8, reason: "เริ่มด้วยคำเรียกความสนใจทันที" },
    pacing: { score: 7, reason: "ประโยคสั้นและเดินเรื่องต่อเนื่อง" },
    clarity: { score: 8, reason: "บอกจุดประสงค์ได้ตรงไปตรงมา" },
    cta: { score: 4, reason: "ยังไม่มีคำชวนให้ผู้ชมทำอะไรต่อ" },
    naturalThai: { score: 8, reason: "ใช้สำนวนที่ฟังเป็นภาษาพูด" },
  },
  weakSpots: [
    { quote: "วันนี้มีของมาแนะนำ", reason: "ยังไม่บอกว่าของนี้ช่วยอะไร" },
  ],
  rewrite: "เดี๋ยวก่อน! วันนี้มีของชิ้นหนึ่งที่อยากเล่าให้ฟัง",
};
```

Test that all five numeric scores are bounded from 0 through 10, every score has a non-empty reason, weak-spot quotations match complete original lines, and the rewrite is non-empty. Test rejection when a quotation is not present verbatim in the input.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npx vitest run src/lib/ai/script-coach.test.ts
```

Expected: FAIL because the review schema/service has not been implemented.

- [ ] **Step 3: Add the Anthropic SDK and define the schemas and model table**

Run:

```powershell
npm install @anthropic-ai/sdk
```

Define the schemas in `review-schema.ts`. Set free/demo to `claude-haiku-5-5` at an estimated `$0.10` per million input tokens and `$0.50` per million output tokens; set Pro to `claude-opus-5-5` at `$4` and `$20` per million tokens. Keep these model IDs and estimate rates together in `model-config.ts`; estimate cost as `(inputTokens * inputUsdPerMillion + outputTokens * outputUsdPerMillion) / 1_000_000`.

- [ ] **Step 4: Add the editable Thai prompt and Claude structured-output generator**

Keep all coach instructions in `prompts/script-coach.ts`. Require short-form spoken Thai, specific reasons for all five scores, weak spots copied as exact complete source lines, and a rewrite that sounds natural aloud. Use the Anthropic Messages API with `output_config.format.type = "json_schema"` and `z.toJSONSchema(ScriptCoachResultSchema)`. Read only text content blocks and retain `usage.input_tokens` and `usage.output_tokens`. Read `ANTHROPIC_API_KEY` through `getServerEnv()` in server-only code; return a typed missing-configuration error without echoing the key.

- [ ] **Step 5: Implement one validation retry and log each attempt**

In `script-coach.ts`, export `reviewScript(input, options, dependencies)`. Call `generate` at most twice, parse the returned JSON, validate it with Zod, and additionally require each weak-spot quote to match a complete input line exactly. Retry once only for JSON/schema/quote validation failures. Call `logRequest` for every generated response with model ID, returned token counts, estimated USD cost, `userId: null` for the anonymous demo, and timestamp. If a provider call fails before usage is returned, log the request with null token counts and null estimated cost, then return a typed provider error; do not hide a logging failure or provider failure.

- [ ] **Step 6: Run the focused service tests and type checks**

Run:

```powershell
npx vitest run src/lib/ai/script-coach.test.ts
npm run lint
npm run typecheck
```

Expected: tests verify a valid result, a malformed first response followed by a valid second response, two malformed responses producing a typed validation error, exactly one retry, exact-line rejection, optional voice-profile input acceptance, and a log entry for every Claude attempt.

## Task 2: Add durable anonymous attempt limits and request handler

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/demo/device-cookie.ts`
- Create: `src/lib/demo/rate-limit.ts`
- Create: `src/lib/demo/rate-limit.test.ts`
- Create: `src/lib/demo/handle-review.ts`
- Create: `src/lib/demo/handle-review.test.ts`
- Create: `src/app/api/demo/review/route.ts`

**Interfaces:**
- Consumes `reviewScript` and the validated input/result schemas from Task 1.
- Produces `consumeDemoAttempt({ ip, deviceId }, store, now)` and `handleDemoReview(request, dependencies)`.
- A production route uses the PostgreSQL `RateLimitBucket` model; no in-memory fallback is permitted.

- [ ] **Step 1: Write rate-limit tests for independent IP and device counters**

Create a small deterministic fake store implementing `increment(scope, subjectHash, windowStart): Promise<number>`. Verify the first two requests pass, the third is denied, exhausting only the IP bucket denies a fresh device ID, and exhausting only the device bucket denies a fresh IP. Verify hashes do not contain the raw IP or device ID.

- [ ] **Step 2: Run the limit tests and verify they fail**

Run:

```powershell
npx vitest run src/lib/demo/rate-limit.test.ts
```

Expected: FAIL because `consumeDemoAttempt` is not implemented.

- [ ] **Step 3: Implement the Prisma singleton, signed device cookie, and atomic counters**

Use a development-safe `globalThis` Prisma singleton in `src/lib/prisma.ts`. Sign a random UUID in an HttpOnly, SameSite=Lax, path-root cookie using HMAC-SHA256 and `AUTH_SECRET`; use Secure in production and verify signatures with timing-safe comparison. Hash IP and device identifiers with HMAC-SHA256 before persistence; never save a raw IP or cookie identifier. Increment PostgreSQL counters with one `upsert` per unique `(scope, subjectHash, windowStart)` bucket, setting `count: 1` on create and atomically incrementing on update. Use one fixed UTC epoch window for all-time demo attempts and a maximum of two per IP and per device. Do not fall back to a process-local counter if the database fails.

- [ ] **Step 4: Implement a testable, validated demo request handler**

Accept only JSON POST bodies matching the Task 1 input schema. Reject invalid JSON and invalid fields with HTTP 400 and a Thai message. Resolve the client IP only from a header the deployment's trusted reverse proxy overwrites; never trust a caller-supplied forwarding header. If the trusted address is absent, return an explicit Thai request-verification error rather than inventing an IP. Verify or create the signed device cookie and set it on the response when newly created, consume both attempt buckets before calling Claude, then return `{ review, remaining }`. When either cap is reached, return HTTP 429 with Thai login-required copy and `/login` as the destination. Map typed provider/validation errors to a friendly HTTP 502 response. Log unexpected server failures and return a generic Thai HTTP 503 without provider details. The route must not return success if rate-limit storage or AI-request logging fails.

- [ ] **Step 5: Run limit and handler tests**

Run:

```powershell
npx vitest run src/lib/demo/rate-limit.test.ts src/lib/demo/handle-review.test.ts
```

Expected: tests cover malformed JSON, invalid input, missing trusted IP, both limit dimensions, successful review response, blocked request not invoking Claude, provider failure mapping, and database failure returning non-success.

## Task 3: Build the responsive Thai landing page and demo experience

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Create: `src/lib/i18n/th.ts`
- Create: `src/components/landing/site-header.tsx`
- Create: `src/components/landing/hero.tsx`
- Create: `src/components/landing/before-after.tsx`
- Create: `src/components/landing/pricing.tsx`
- Create: `src/components/landing/faq.tsx`
- Create: `src/components/landing/site-footer.tsx`
- Create: `src/components/demo/review-form.tsx`
- Create: `src/components/demo/review-result.tsx`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- `page.tsx` composes server components for each section.
- `review-form.tsx` submits to `/api/demo/review` and passes a `ScriptCoachResult` to `review-result.tsx`.
- `review-result.tsx` presents all scores with their reasons, quoted weak spots, and rewrite; it exposes a copy action.

- [ ] **Step 1: Add semantic landing-section components**

Build a responsive header, Thai pain-focused hero, before/after example, pricing, FAQ using native `<details>`/`<summary>`, and footer. Keep user-facing Thai strings in `src/lib/i18n/th.ts` so another locale can be added without changing the section structure. Use the requested pain headline in natural Thai: “สคริปต์ AI ที่ฟังดูไม่เหมือนคุณ? พอได้แล้ว”. Keep the generic/coached pair explicitly illustrative, with no view/sales claims. Show Free forever with 10 reviews/month, up to 3 projects, and watermark; Pro at ฿199/month or ฿1,990/year with 1,000 reviews/month, unlimited projects, and no watermark; Team per-seat as coming soon with disabled checkout.

- [ ] **Step 2: Add the client-side demo form and result view**

The form includes required script text, optional niche, and 15/30/60-second target controls; it submits to the demo endpoint, prevents duplicate submission while waiting, reports friendly Thai errors, and shows remaining attempts when provided. Render every score reason and quoted weak spot. Copy only the rewrite using `navigator.clipboard.writeText`; report copy failure instead of silently changing the displayed state. When the API returns login-required, show the remaining-limit gate and link to `/login`.

- [ ] **Step 3: Add the honest pre-auth login gate page**

Until the authentication milestone, `/login` must clearly say account sign-in is not enabled yet and link back to the landing page. Do not present a fake login form or claim an account was created.

- [ ] **Step 4: Run automated checks**

Run:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all automated checks pass and the static landing route prerenders successfully.

- [ ] **Step 5: Manually inspect desktop and mobile layout**

Start the app with `npm run dev`, open `http://localhost:3000` at 375px and desktop width, and verify the hero and form fit without horizontal scrolling; the pricing cards stack on mobile; the before/after comparison remains readable; FAQ items open by keyboard; and the footer is present. With PostgreSQL migration and a test Anthropic key available, submit one valid script, verify all five explained scores, exact source-line weak spots, natural spoken-Thai rewrite, copy action, remaining-attempt copy, and third-attempt login gate. If PostgreSQL is unavailable, verify the form displays the handler's explicit friendly unavailable state and do not count that as a successful demo.

## Task 4: Update Windows setup and milestone notes

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents Anthropic test setup, demo behavior, and the prerequisites for persistent attempt counters.

- [ ] **Step 1: Add demo configuration and verification instructions**

Document setting `ANTHROPIC_API_KEY`, starting PostgreSQL, applying the foundation migration, starting Next.js, and trying the anonymous demo. Explain that a missing database, an unapplied migration, or a missing Anthropic key produces a friendly error and does not return mock review output. Document the local Stripe CLI instructions as later billing work and keep live Stripe keys out.

- [ ] **Step 2: Run the complete non-database verification suite**

Run:

```powershell
$env:DATABASE_URL = "postgresql://localhost:5432/hookdee?schema=public"
npm run prisma:validate
npm run prisma:generate
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all commands pass. The database-backed migration and end-to-end demo remain pending until the local PostgreSQL service is started and migrated; report this explicitly.

## Milestone 2 acceptance criteria

- Thai landing includes headline, demo, illustrative before/after, Free/Pro/Team pricing, FAQ, and footer.
- Demo output comes from Claude structured JSON, not a hard-coded fake review.
- Every score includes its own explanation; weak-spot quotations are exact complete input lines.
- Zod validation retries once; the second invalid result is a friendly failure.
- Every Claude attempt is logged with model, returned tokens when available, cost estimate when available, nullable user ID, and timestamp.
- Two attempts are enforced independently by browser device ID and IP through PostgreSQL; no process-local or client-only success fallback exists.
- No secrets are sent to client code and no copy promises views, sales, or results.
- If local PostgreSQL remains stopped, automated tests/build pass but persistent limits and a live end-to-end demo remain explicitly incomplete.
