# Hookdee

Hookdee is a Thai-first workspace for reviewing and improving short-form video
scripts. Phase 1 is being built milestone by milestone. The current foundation
includes the Next.js app shell, typed server configuration, and the Prisma data
model, Thai landing page, anonymous demo UI, and the server-side Claude review
service. Authentication, saved projects, account usage enforcement, and Stripe
checkout remain later milestones. The database migration must be applied before
the demo can complete a review.

## Requirements

- Node.js 20.9 or later and npm
- PostgreSQL 18 (or a compatible PostgreSQL release)
- Google OAuth credentials, Google Gemini API key (from Google AI Studio), and Stripe test-mode keys for
  the later milestones that use those services
- Stripe CLI for local webhook testing in the billing milestone

## Windows PowerShell setup

### 1. Install and start PostgreSQL

Install PostgreSQL using the Windows installer from
[postgresql.org](https://www.postgresql.org/download/windows/). In an
Administrator PowerShell, find and start the installed service:

```powershell
Get-Service -Name "postgresql*"
Start-Service -Name "<service-name-from-the-list>"
```

Create a development role and database. Connect as the PostgreSQL administrator
and run the SQL statements below at the `psql` prompt:

```sql
CREATE ROLE hookdee WITH LOGIN PASSWORD 'replace-with-a-local-password';
CREATE DATABASE hookdee OWNER hookdee;
```

Exit `psql` with `\q`. Use a simple local-only password or URL-encode special
characters in the password portion of `DATABASE_URL`.

### 2. Configure the app

From this project directory:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copy the generated value into `AUTH_SECRET` in `.env`. Set `DATABASE_URL` to
your local database, for example:

```text
postgresql://hookdee:your-local-password@localhost:5432/hookdee?schema=public
```

The values in `.env.example` are placeholders, not usable provider credentials.
Keep `.env` local and use only Stripe test-mode keys (`sk_test_...`) during
development. Do not put live Stripe keys in this project.

### 3. Validate and migrate the database

With PostgreSQL running and `.env` configured:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev -- --name init
```

The migration command creates and applies the initial schema. After schema
changes in later milestones, use the same script with a descriptive migration
name, for example `npm run prisma:migrate:dev -- --name add_reviews`.

### 4. Configure and try the anonymous Script Coach demo

Set `GEMINI_API_KEY` in `.env` to a server-side Google Gemini API key obtained from [Google AI Studio](https://aistudio.google.com/). The key is
never sent to the browser. Optionally set `GEMINI_MODEL` (defaults to `gemini-2.5-flash`). The demo uses Gemini Flash for anonymous reviews,
validates structured JSON output with Zod, and logs token usage and estimated cost
in PostgreSQL. It does not return mock review content when the database or
Gemini configuration is unavailable.

The demo allows two attempts per IP and signed browser-device cookie. Hashed
identifiers and attempt counts are stored in PostgreSQL, so the initial
migration must be applied first. For production, deploy behind a trusted
reverse proxy that overwrites `x-real-ip`; local development uses loopback
when the request host is localhost. Do not trust caller-supplied forwarding
headers.

Start the app and open `http://localhost:3000`. Paste a script, optionally
choose a niche and 15/30/60-second target, then submit it for review. The
response includes five explained scores, exact quoted weak spots, and a spoken
Thai rewrite. After the second allowed review, the page gates another review
behind the sign-in page; account sign-in will be enabled in a later milestone.

Estimated Gemini token prices and the model selection are centralized in
`src/lib/ai/model-config.ts`; revisit the estimate if Anthropic changes its
published rates.

### 5. Run checks and start Next.js

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:3000`. The production server can be started with
`npm run start` after a successful build.

## Google OAuth setup

Create OAuth client credentials in the Google Cloud Console for the later
authentication milestone. Its local callback URL will be
`http://localhost:3000/api/auth/callback/google`. Put the client ID and secret
in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`. Google sign-in is
not available until the authentication milestone is implemented.

## Stripe test-mode webhooks

Install the Stripe CLI on Windows and authenticate it:

```powershell
winget install Stripe.StripeCLI
stripe login
```

In another PowerShell window, after the billing webhook route is implemented,
forward Stripe test events to the local app:

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` signing secret printed by `stripe listen` into
`STRIPE_WEBHOOK_SECRET` in `.env`. Keep the Stripe Dashboard in test mode and
use test API keys only. Checkout, webhook processing, and the billing page are
not part of the current foundation milestone.

## Project structure

- `src/app/` — Next.js App Router pages and global styles
- `src/components/` — landing sections and the interactive review form
- `src/lib/` — shared AI, demo rate-limit, i18n, and validated configuration
- `prisma/` — PostgreSQL schema and migrations
- `prompts/` — editable AI prompts
- `docs/superpowers/specs/` — approved product design
- `docs/superpowers/plans/` — milestone implementation plans


## Deploying to Supabase (Production)

To apply Prisma migrations to a production Supabase PostgreSQL database:

1. Obtain your Supabase database connection string from your Supabase Project Settings -> Database -> Connection string (URI).
2. Set `DATABASE_URL` to your Supabase connection string (use the Direct connection port 5432 or Transaction pooler port 6543 with `?pgbouncer=true`).
3. Apply pending migrations safely using the deployment script:

```bash
npm run prisma:migrate:deploy
```

4. In Vercel or CI/CD pipelines, configure `DATABASE_URL` in environment variables. The `postinstall` script (`prisma generate`) runs automatically during build.
