# Hookdee

Hookdee is a Thai-first workspace for reviewing and improving short-form video
scripts. Phase 1 is being built milestone by milestone. The current foundation
includes the Next.js app shell, typed server configuration, and the Prisma data
model; the landing-page demo, authentication flow, AI coach, usage enforcement,
and Stripe checkout are not implemented yet.

## Requirements

- Node.js 20.9 or later and npm
- PostgreSQL 18 (or a compatible PostgreSQL release)
- Google OAuth credentials, Anthropic API key, and Stripe test-mode keys for
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
npm run prisma:migrate:dev -- --name foundation
```

The migration command creates and applies the initial schema. After schema
changes in later milestones, use the same script with a descriptive migration
name, for example `npm run prisma:migrate:dev -- --name add_reviews`.

### 4. Run checks and start Next.js

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
- `src/lib/` — shared server-side helpers and validated configuration
- `prisma/` — PostgreSQL schema and migrations
- `prompts/` — editable AI prompts, added with the Script Coach milestone
- `docs/superpowers/specs/` — approved product design
- `docs/superpowers/plans/` — milestone implementation plans

