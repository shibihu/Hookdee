# Google Authentication Design

## Goal and scope

Enable account creation, sign-in, session persistence, and sign-out through
Google OAuth. This is an authentication-only milestone for Hookdee; it does not
add email/password credentials, a dashboard, saved projects, or authorization
rules for future product features.

The existing landing page and demo remain publicly accessible. The existing
`/login` route becomes the sign-in and signed-in account entry point.

## Approach

Use Auth.js with its Prisma adapter. The repository already contains the
adapter-compatible `User`, `Account`, `Session`, and `VerificationToken` models,
the Prisma client, and Google OAuth environment placeholders. This reuses the
current PostgreSQL schema and delegates OAuth state validation, CSRF protection,
and session-cookie handling to the authentication library.

Hand-rolled OAuth would require Hookdee to implement and maintain protocol,
state, and session protections. A hosted identity provider would add a separate
service and diverge from the existing Prisma account schema. Auth.js is the
smallest fit for this milestone.

Google OAuth uses database-backed sessions stored in the existing `Session`
model. A successful first sign-in creates the local user and provider account;
later sign-ins resolve that same provider account. Authentication secrets and
provider tokens remain server-side.

## User flows

1. A visitor selects the Google sign-in action on `/login`.
2. Auth.js redirects the browser through Google's OAuth consent/sign-in flow.
3. On a valid callback, Auth.js persists or resolves the user and account,
   creates a database session, and sets its protected session cookie.
4. The visitor returns to the original safe local URL when supplied, or `/` by
   default. Return targets must not permit external redirects.
5. The `/login` page presents the signed-in account and a sign-out action when
   a session exists. The landing header reflects whether the visitor is signed
   in and offers sign-out in that state.
6. Sign-out invalidates the session through Auth.js and returns the visitor to
   `/`.

The authentication-only scope does not promise access to features that have
not yet been built, nor does it protect existing public pages.

## Configuration and failure behavior

Use the existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and
`APP_URL` configuration. Google provider credentials must not be included in
client bundles or user-facing errors.

If provider configuration is missing or invalid, the sign-in attempt must fail
with a clear, actionable message and server-side operational detail; it must
not report a successful login or expose secrets. OAuth denial, callback
failure, session persistence failure, and sign-out failure must likewise remain
visible as an error state with an appropriate recovery action. No error may
silently fall back to a mock or anonymous authenticated state.

Update the README's authentication setup instructions to describe the callback
URL, required OAuth environment values, and the implemented Google sign-in
flow. Keep `.env.example` limited to placeholders.

## Acceptance checks

- A valid Google OAuth callback creates or resolves one local user and provider
  account and stores a persistent database session.
- Repeated sign-in with the same Google account resolves the existing account.
- `/login` shows the sign-in action when unauthenticated and the account/sign-out
  state when authenticated.
- Sign-out invalidates the session, and the landing header updates accordingly.
- A safe local return URL is honored; an external return URL is rejected in
  favor of `/`.
- Missing provider configuration, provider denial, callback failure, and
  database session errors are surfaced without exposing secrets or creating a
  success-shaped state.
- Anonymous landing/demo behavior remains unchanged.
- Targeted auth tests and the existing unit tests, lint, type-check, and
  production build pass.

## Deferred

- Email/password registration and recovery
- Dashboard, project management, and saved review history
- Authorization gates for account-only features
- Billing, plan enforcement, and account settings
