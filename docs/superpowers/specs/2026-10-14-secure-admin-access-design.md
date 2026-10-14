# Secure Admin Access Design

## Goal

Require admins to re-enter the admin secret whenever `/admin` is opened or
refreshed, prevent a page visit from inheriting an earlier browser session, and
ensure the same protection applies to every admin API.

## Authentication and session approach

The admin secret is accepted only by the admin login endpoint. After the
existing login flow succeeds, the server creates a cryptographically random
session token and stores only its hash and fixed expiration in a new
`AdminSession` database model. The browser receives the token only in an
HttpOnly, SameSite cookie; the session expires after 30 minutes and logout
revokes it server-side.

When `/admin` is rendered, its server-side entry point revokes the session
identified by the incoming cookie before rendering the existing client-side
admin interface. The cookie is therefore no longer valid for subsequent API
requests, and the page starts in its unauthenticated state. A successful new
login issues a new session. Opening or refreshing `/admin` in another tab
revokes the shared browser session as well.

The existing optional TOTP enrollment behavior remains unchanged: admins who
have enrolled TOTP must complete it after providing the admin secret. This
design does not force TOTP enrollment.

## API and secret handling

All protected admin API routes validate the session cookie against the
server-side session record and its expiration. Raw admin secrets and bearer
credentials are not accepted as substitutes by protected APIs, so direct API
requests cannot bypass the login flow or enrolled TOTP. Login/status responses
do not return session tokens, and authentication logs do not include them.
Invalid or expired sessions fail closed; logout revokes the current session.

The admin page and its API continue to use the current key-entry UI, and
existing admin features remain available after successful authentication.

## Admin secret configuration

Use the configured `ADMIN_SECRET`, falling back to `AUTH_SECRET` only when the
admin-specific secret is not set. If neither is configured, reject
authentication instead of using a built-in development secret.

## Persistence and failure behavior

Add an `AdminSession` Prisma model and migration with a unique token hash and
expiration timestamp. Session creation, lookup, and revocation use the existing
database. Database errors must not grant access; an unavailable session store
leaves protected admin APIs inaccessible and reports an operational error
without exposing credentials.

Use constant-time comparison for the submitted admin secret. Preserve the
existing secure cookie attributes (`HttpOnly`, `SameSite=Lax`, and `Secure` in
production). Do not log session tokens or include them in JSON responses.

## Acceptance criteria

- A first visit to `/admin` displays the admin key form.
- After successful login, protected admin APIs work with the HttpOnly session
  cookie; the session token is absent from response JSON and logs.
- A new `/admin` page render or refresh revokes the prior session before the
  page checks authorization, requiring the admin key again.
- An earlier tab's session is rejected by every protected admin API after a
  later `/admin` page render revokes the shared session.
- Sessions expire 30 minutes after creation even if the browser cookie remains.
- Logout revokes the server-side session, and expired/revoked sessions cannot
  access admin APIs.
- Protected admin APIs reject requests that provide only the admin secret or a
  bearer credential.
- Admin authentication fails closed when neither `ADMIN_SECRET` nor
  `AUTH_SECRET` is configured; no hardcoded default secret is accepted.
- Existing TOTP enrollment continues to require a valid TOTP/recovery code
  before issuing a session.
- Admin page/API tests cover the new session behavior, login, logout, 2FA, and
  unauthenticated access; relevant lint, type-check, and build checks pass.
