# Hookdee

Hookdee is a Thai-first workspace for reviewing and improving short-form video
scripts. Phase 1 is being built milestone by milestone. The current foundation
includes the Next.js app shell, typed server configuration, Prisma data model,
Thai landing page, anonymous demo UI, and server-side Gemini review service.
Google sign-in is implemented with database-backed sessions. Saved projects,
account usage enforcement, and Stripe checkout remain later milestones. The
database migration must be applied before the demo can complete a review.

## Requirements

- Node.js 20.9 or later and npm
- PostgreSQL 18 (or a compatible PostgreSQL release)
- Google OAuth credentials, Google Gemini API key (from Google AI Studio), and
  Stripe test-mode keys for the features that use those services
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
development. Do not put live Stripe keys in this project or real credentials in
the README.

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

### 4. Configure Google sign-in

Google sign-in is implemented using Auth.js and the Google OAuth provider. In
the [Google Cloud Console](https://console.cloud.google.com/), create or select
a project, configure the OAuth consent screen, and create an OAuth client ID
with application type **Web application**. Add this exact local callback URL to
the client's **Authorized redirect URIs**:

```text
http://localhost:3000/api/auth/callback/google
```

Copy the client ID and client secret into the corresponding local `.env` values:

```text
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Also set `AUTH_SECRET` to a random secret of at least 32 characters (the command
in step 2 generates one), and set `APP_URL` to the app's origin, such as
`http://localhost:3000`. These are validated server settings. The Google
credentials must be set together: if both are absent, the login page explains
that Google sign-in is unavailable; if only one is set, server configuration
validation reports the missing variable. If Google rejects sign-in, verify the
client ID/secret pair, consent-screen publishing or test-user access, and that
the authorized redirect URI exactly matches the callback above. Provider
configuration errors appear on the login page without exposing credentials.

The Prisma adapter stores OAuth users and linked accounts in `User` and
`Account`; sessions use the database-backed `Session` model. Use the sign-in
link in the landing-page header and complete Google's consent flow. Once signed
in, the header shows the account name or email and offers **Sign out**. Signing
out clears the session and returns to `/`. Return paths are restricted to this
app's origin; a missing or foreign return URL resolves to `/`.

### 5. Configure and try the anonymous Script Coach demo

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
behind the sign-in page.

Estimated Gemini token prices and the model selection are centralized in
`src/lib/ai/model-config.ts`; revisit the estimate if Google changes its
published rates.

### 6. Run checks and start Next.js

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:3000`. The production server can be started with
`npm run start` after a successful build.

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


## Deploying to Supabase & Vercel (Production)

To apply Prisma migrations to a production Supabase PostgreSQL database safely and deploy to Vercel:

1. **Obtain Supabase Connection Strings**:
   - In Supabase Dashboard, go to **Project Settings** -> **Database** -> **Connection string**.
   - Use the **Direct Connection** (port 5432 or session mode port 5432) for running migrations, or Transaction Pooler (port 6543) with `?pgbouncer=true` if applicable.

2. **Apply Migrations**:
   Run the migration deploy command locally or from a CI pipeline targeting the production database:
   ```bash
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" npm run prisma:migrate:deploy
   ```
   *Note: Do NOT run `prisma migrate dev` against production databases.*

3. **Configure Environment Variables in Vercel**:
   In Vercel Project Settings -> Environment Variables, set:
   - `DATABASE_URL` (Supabase transaction pooler or direct URL)
   - `AUTH_SECRET`
   - `GEMINI_API_KEY`
   - `APP_URL`

4. **Deploy / Redeploy Vercel**:
   Trigger a redeploy in Vercel. The `postinstall` script (`prisma generate`) automatically generates the Prisma Client during build.
