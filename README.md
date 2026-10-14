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


## Admin Panel & Unlimited Quota

Access the Admin Panel at `http://localhost:3000/admin` (or click **Admin Panel** in the site header/footer).

### How to Get / Set the Admin Secret Key:

1. **Setting your custom key:**
   Set `ADMIN_SECRET` in your `.env` file (for example: `ADMIN_SECRET=my-secret-admin-key-123`).

2. **Fallback and required configuration:**
   If `ADMIN_SECRET` is not explicitly defined in `.env`, the admin panel uses `AUTH_SECRET`. If neither secret is configured, admin login fails closed.

3. **Admin sign-in and sessions:**
   Enter the admin secret each time `/admin` is opened or refreshed. If authenticator 2FA is enrolled, complete its code/recovery-code step after entering the secret. A signed-in tab expires after 30 minutes; opening `/admin` again revokes the earlier browser session.

4. **Admin Features Available:**
   - **Global Unlimited Quota Master Switch:** Toggle unlimited script reviews across all demo requests and users.
   - **Quota & Rate Limit Management:** View active rate limit buckets and reset IP/device limits.
   - **Console & System Logs:** Inspect real-time logs filtered by `ERROR`, `WARN`, and `INFO` with JSON metadata inspection.
   - **AI Script Tester Sandbox:** Test script reviews directly without consuming quota.

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

The Vercel build remains the standard Next.js build:

```powershell
npm run build
npx vercel --prod
```

Use the Vercel dashboard or `npx vercel login` / `npx vercel link` to configure
the project first. Keep Vercel environment variables in Vercel; do not reuse
Cloudflare dashboard configuration as a deployment source.

## Deploying to Cloudflare Workers

Cloudflare uses the official OpenNext adapter; the standard `npm run build`
continues to run `next build` for Vercel. The adapter currently supports this
project's pinned Next.js 16.3.8 release. Use Node.js 22 or later for Cloudflare
builds (Wrangler 4 requires it); the Vercel build retains the existing Node.js
20.9+ requirement.

### Clean Cloudflare build and local preview (PowerShell)

From the repository root:

```powershell
Remove-Item -Recurse -Force .next, .open-next -ErrorAction SilentlyContinue
npm ci
npm run build:cloudflare
```

The clean removes stale Next.js and OpenNext output; `npm ci` runs Prisma
generation without connecting to the database. To preview the Worker locally,
copy `.dev.vars.example` to `.dev.vars` and replace its placeholders with local
or test credentials:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run preview:cloudflare
```

The preview script builds with OpenNext before starting Wrangler. Wrangler
serves the Worker locally (normally at `http://localhost:8787`). Test the
landing page, `/favicon.ico`, `/login`, and API routes against this local Worker.
The preview uses the Workers runtime, not `next start`. To build without
starting the preview server, run `npm run build:cloudflare`.

### Cloudflare deployment

Authenticate Wrangler to the intended Cloudflare account once:

```powershell
npx wrangler login
npm run deploy:cloudflare
```

The deployment command builds with OpenNext and deploys the Worker named
`hookdee` from `wrangler.jsonc`. For a build-only check, use
`npm run build:cloudflare`; for a local preview of that build, use
`npm run preview:cloudflare`.

In the Cloudflare dashboard, configure these under the `hookdee` Worker’s
Settings → Variables and Secrets. Add sensitive values as **Secrets** and
configure these independently from the Vercel project:

- Required: `DATABASE_URL` (a Supabase PostgreSQL connection URL reachable from
  Workers), `AUTH_SECRET` (at least 32 characters), and `APP_URL` (the public
  Worker URL).
- Admin access: `ADMIN_SECRET` (optional; falls back to `AUTH_SECRET`) and
  `ADMIN_2FA_ENCRYPTION_KEY` when using admin authenticator 2FA.
- Feature-specific, when enabled: `GEMINI_API_KEY`, `GEMINI_MODEL`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET`.

`DATABASE_URL` and all API/authentication keys are secrets; `APP_URL` is a
non-secret variable. The PostgreSQL client uses Prisma’s PostgreSQL driver
adapter, which uses Cloudflare Workers TCP sockets. If the Supabase project
restricts network access, ensure its connection policy permits the Worker, or
use a supported Supabase connection path such as its pooler. Do not place
production secrets in `.dev.vars.example` or commit `.dev.vars`.

The Cloudflare build does not run database migrations. Apply schema changes
through the existing controlled Prisma migration process, separately from
Worker deployment. Vercel continues to use its normal Next.js build and its
own independently configured environment variables.
