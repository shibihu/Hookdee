# Hookdee Phase 1 Design

Date: 2026-10-12

## Goal and scope

Build a Thai-first SaaS for short-form video creators. Its core loop is write,
review, fix, and post. Phase 1 includes the public landing page and limited
anonymous demo; the Script Coach; email/password and Google authentication;
projects and review history; free-plan usage controls; Pro subscriptions and a
Team checkout stub. Phase 2 Voice Profile behavior is explicitly out of scope.

Do not promise views, sales, or results. Product copy may promise time saved and
better script quality.

## Technical architecture

- TypeScript, Next.js App Router, Tailwind CSS, and PostgreSQL.
- Prisma is the ORM and migration tool, providing a simple relational schema for
  users, projects, reviews, usage, AI logs, and subscriptions.
- Auth.js provides email/password credentials and Google sign-in.
- Store only password hashes for email/password accounts. Auth.js Credentials
  uses JWT-backed sessions; Google OAuth accounts use the configured Prisma
  adapter.
- Anthropic Claude and Stripe are called only from server-side code. Secrets
  are environment-configured and never exposed to client bundles.
- Thai is the default UI language, organized so additional locales can be added.
  Use a Thai-capable font such as IBM Plex Sans Thai or Noto Sans Thai.
- Keep editable Script Coach prompts in `prompts/script-coach.ts`; API routes
  should delegate to shared services rather than contain prompts or business
  logic.

## Data model

- Auth.js `User`, `Account`, `Session`, and `VerificationToken` records.
- `Project` belongs to a user and contains scripts and reviews.
- `Script` belongs to a project and stores creator-provided text and optional
  niche and target duration.
- `Review` belongs to a script and stores validated scores/reasons, exact-line
  weak spots, and the improved spoken-Thai rewrite.
- Monthly usage records support plan allowances and reset periods. Allowances
  reset on UTC calendar-month boundaries.
- `RateLimitBucket` stores hashed account, IP, or demo-device identifiers with
  request counts and windows; do not persist raw IP addresses.
- AI request logs store model, input/output tokens, estimated cost, nullable
  user ID for anonymous usage, and timestamp.
- Subscription/customer records store Stripe identifiers and webhook-derived
  status; processed webhook event IDs support idempotency.
- `VoiceProfile` belongs to a user and stores extracted style attributes and
  source script IDs. It is a Phase 2 schema provision only; no profile learning
  or quiz behavior is built in Phase 1.
- Coach and rewrite service interfaces accept an optional voice profile, unused
  in Phase 1.

## Main user and data flows

### Landing page and demo

The mobile-first Thai landing page includes the interactive review demo,
generic-versus-coached comparison, pricing, FAQ, and footer. An anonymous demo
is available without registration for two attempts, enforced independently by
anonymous browser cookie and IP-based rate limiting; whichever limit is reached
first blocks further anonymous reviews. After the limit, prompt the visitor to
sign in. Authenticated review usage is tracked against the account and subject
to IP limits as well.

### Script Coach

The client submits script text and optional niche and target duration to a
validated server API. A shared server-side service calls Claude with a
structured-output contract validated by Zod. The output has scores from 0 to 10
for Hook, Pacing, Clarity, CTA, and Natural Thai tone; each score has a
specific reason. It also contains weak spots quoting exact source lines and a
spoken-Thai rewrite. On schema validation failure, retry once; if validation
still fails, return a friendly Thai error.

Successful reviews are stored for projects and history. Provide copy and save
actions. Export output includes a small Hookdee watermark on Free and no
watermark on Pro. Log each AI call, including failed attempts, with model,
token counts when returned, estimated cost, nullable user ID, and timestamp.

### Plans and limits

- Free: 10 reviews per month, at most 3 saved projects, cheaper model, and
  watermarked exports.
- Pro: 1,000 reviews per month, unlimited projects, best model, and no
  watermark. Pricing is ฿199/month or ฿1,990/year (two months free).
- Team: show per-seat pricing as coming soon; no checkout is available.
- Show friendly usage language such as “ใช้ไป 8/10 ครั้งในเดือนนี้” and an
  upgrade action. Do not expose raw rate-limit or provider errors.
- Apply account and IP rate limits. Anonymous demo attempts are separately
  limited to two. Signed-in AI review requests are limited to 5 per minute for
  each account and IP.

### Authentication and billing

Auth.js supports email/password and Google sign-in. Email/password accounts
store password hashes only and use JWT-backed sessions; Google OAuth accounts
use the Prisma adapter. Credentials, OAuth secrets, and session operations
remain server-side.

Use Stripe test mode. Checkout starts Pro subscriptions; the Stripe Customer
Portal handles cancellation, upgrades/downgrades, and payment-method changes.
Verify webhook signatures and handle `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`, and
`invoice.payment_failed`. Subscription access in the database is driven only
by processed webhooks, never by the checkout success redirect. Process webhook
events idempotently. Allow Stripe's dashboard-configured payment methods to
determine availability, including PromptPay and Thai cards where supported.

The billing page shows plan and usage and links to the Customer Portal.

## Error handling and security

- Validate every API input using Zod and return consistent, user-safe errors.
- Keep Anthropic and Stripe keys server-side; verify Stripe webhook signatures.
- Do not silently convert AI, database, or billing failures into successful
  responses. Log operational details server-side without returning raw provider
  errors to users.
- Enforce demo, account, and IP limits on the server; never trust client-only
  usage counters.
- Store rate-limit subject hashes rather than raw IP addresses.
- Use Stripe webhook idempotency so retries do not duplicate subscription
  processing.

## Configuration and documentation

Provide `.env.example` with required database, Auth.js, Google OAuth,
Anthropic, and Stripe test-mode configuration variables, without real secrets.
README setup instructions cover Windows PowerShell, PostgreSQL
database setup, migrations, Google OAuth configuration, and Stripe CLI local
webhook forwarding. Include test-mode setup only; do not add live keys.

## Milestones and acceptance checks

1. **Foundation:** scaffold app, styles/font, Prisma schema, environment
   template, and Windows setup docs. Verify migrations and a production build.
2. **Landing and anonymous demo:** implement Thai landing sections, responsive
   layout, cookie/IP two-attempt enforcement, and login gate. Verify demo
   availability before and after the allowance on desktop and mobile widths.
3. **Script Coach:** implement prompt, API validation, schema retry, output UI,
   request logs, copy and save integration. Test valid output, malformed output
   with one retry, final friendly failure, and per-score reasons.
4. **Accounts and projects:** add email/password and Google authentication,
   dashboard, saved review history, and project management. Test authorization
   boundaries and project limits.
5. **Usage and rate limits:** add plan allowances, monthly reset accounting,
   account/IP throttles, model selection, watermarks, and friendly upgrade UX.
   Verify Free and Pro thresholds and project caps.
6. **Stripe billing:** add test-mode Checkout, Customer Portal, signed
   webhooks, billing page, and Team stub. Use Stripe CLI forwarding and verify
   each required event, including retries and invalid signatures.
7. **Final verification:** run targeted checks and document what works, what
   remains stubbed, and manual test steps at the end of each milestone.
