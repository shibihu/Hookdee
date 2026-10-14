# Secure Admin Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the admin key on every `/admin` page render, and authorize admin APIs only through a revocable server-side session.

**Architecture:** Store a SHA-256 hash of a random admin session token and its fixed 30-minute expiration in a new Prisma model. The server-rendered `/admin` entry point revokes the session from its incoming HttpOnly cookie before mounting the current client dashboard. Login and successful TOTP verification issue new cookies; all protected API routes validate the database-backed session and no longer accept the raw admin secret as an API credential.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6, PostgreSQL, Vitest.

## Global Constraints

- The admin secret is accepted only by the admin login endpoint.
- Store only a cryptographically random session token's hash and fixed expiration in a new `AdminSession` database model.
- The browser receives the token only in an HttpOnly, SameSite=Lax cookie; the session expires after 30 minutes.
- When `/admin` is rendered, revoke the session identified by the incoming cookie before rendering the existing client-side admin interface.
- Existing optional TOTP enrollment behavior remains unchanged; admins who have enrolled TOTP must complete it after providing the admin secret.
- Use `ADMIN_SECRET`, falling back to `AUTH_SECRET` only when the admin-specific secret is not set; if neither is configured, reject authentication instead of using a built-in development secret.
- All protected admin API routes validate the session cookie against the server-side session record and its expiration.
- Database errors must not grant access; authentication logs and response JSON must not expose session tokens.
- Preserve `Secure` in production and current admin features.

---

## File Structure

- `prisma/schema.prisma` — add the session model.
- `prisma/migrations/20261014120000_add_admin_sessions/migration.sql` — create the session table and expiry index.
- `src/lib/admin/auth.ts` — issue, hash, look up, and revoke sessions; make cookie the only API credential.
- `src/lib/admin/auth.test.ts` — test session hashing, expiration, revocation, and cookie-only authorization.
- `src/app/api/admin/auth/route.ts` — validate the admin key, issue sessions, report current auth state, and revoke on logout.
- `src/app/api/admin/auth/verify-2fa/route.ts` — issue the same session type after successful TOTP/recovery verification.
- `src/app/api/admin/admin-routes.test.ts` — test the complete key/2FA/session flow and protected API behavior.
- `src/app/admin/page.tsx` — become a server component that revokes the cookie's session before rendering.
- `src/app/admin/admin-client.tsx` — hold the existing interactive admin UI and start unauthenticated after the server revocation.
- `src/app/admin/page.test.tsx` — verify page rendering revokes the incoming session before returning the client UI.
- `README.md` — explain reauthentication on page entry and the 30-minute session lifetime.

Do not add environment variables: `.env.example` already documents `ADMIN_SECRET` and its `AUTH_SECRET` fallback, and the session lifetime is fixed by the approved design.

### Task 1: Add database-backed admin sessions

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261014120000_add_admin_sessions/migration.sql`
- Modify: `src/lib/admin/auth.ts`
- Modify: `src/lib/admin/auth.test.ts`

**Interfaces:**
- Produce `createAdminSession(): Promise<string>`; it stores only the SHA-256 token hash and `expiresAt`, and returns the raw random token once for the HttpOnly cookie.
- Produce `revokeAdminSession(token: string | null | undefined): Promise<void>`; it deletes the matching hashed token and is a no-op for an absent token.
- `isAdminAuthorized(request: Request): Promise<boolean>` reads only `hookdee_admin_session`, hashes it, and checks a matching row whose expiration is later than the current time. It never accepts `x-admin-key` or `Authorization`.
- Produce `verifyAdminSecret(provided: string): boolean`; compare equal-length SHA-256 digests with `crypto.timingSafeEqual`.
- `getExpectedAdminSecret(): string` reads `ADMIN_SECRET` then `AUTH_SECRET` and throws a configuration error when both are absent or empty; there is no hardcoded fallback.
- Session-store errors are logged without including a session token and then rethrown so requests fail with a server error rather than being mistaken for valid or invalid credentials.

- [ ] **Step 1: Write failing session helper tests**

In `src/lib/admin/auth.test.ts`, mock `../prisma` with an `adminSession` model and mock `../logger` with `info`, `warn`, and `error` spies. Replace the `getServerEnv` mock with `vi.stubEnv` setup for `ADMIN_SECRET` and `AUTH_SECRET`, then add `afterEach(() => vi.unstubAllEnvs())` and assert:

```ts
it("stores only a token hash with a 30-minute expiration", async () => {
  const token = await createAdminSession();
  const create = prisma.adminSession.create.mock.calls[0][0].data;

  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(create.tokenHash).not.toBe(token);
  expect(create.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(create.expiresAt.getTime() - Date.now()).toBe(30 * 60 * 1000);
});

it("authorizes only an unexpired session cookie", async () => {
  prisma.adminSession.findUnique.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
  });
  const request = new Request("http://localhost/api/admin/stats", {
    headers: { cookie: `${ADMIN_COOKIE_NAME}=opaque-session-token` },
  });

  await expect(isAdminAuthorized(request)).resolves.toBe(true);
});

it.each([
  { "x-admin-key": "test-admin-secret-9999" },
  { authorization: "Bearer test-admin-secret-9999" },
])("does not authorize a raw API credential", async (headers) => {
  await expect(
    isAdminAuthorized(new Request("http://localhost/api/admin/stats", { headers })),
  ).resolves.toBe(false);
});
```

Also assert expired/missing cookies deny access, valid-token revocation deletes by hash, session-store errors are logged and rethrown, and `verifyAdminSecret` accepts only the configured secret including a different-length wrong input. Use `vi.stubEnv("ADMIN_SECRET", "")` and `vi.stubEnv("AUTH_SECRET", "")` to assert `getExpectedAdminSecret()` throws instead of returning a development default; restore environment overrides after each test with `vi.unstubAllEnvs()`.

- [ ] **Step 2: Run the focused helper tests and confirm they fail**

Run: `npm test -- src/lib/admin/auth.test.ts`

Expected: FAIL because the database session model and helper functions do not exist yet.

- [ ] **Step 3: Add the Prisma model and migration**

Add this model to `prisma/schema.prisma`:

```prisma
model AdminSession {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
}
```

Create `prisma/migrations/20261014120000_add_admin_sessions/migration.sql`:

```sql
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
```

- [ ] **Step 4: Implement the session helpers**

In `src/lib/admin/auth.ts`, resolve the secret with `process.env.ADMIN_SECRET?.trim() || process.env.AUTH_SECRET?.trim()` and throw a clear configuration error if the result is empty. Remove the catch-all fallback to `default-admin-secret-dev` and the now-unneeded `getServerEnv` import. Generate 32 random bytes with `crypto.randomBytes(32).toString("hex")`, store `crypto.createHash("sha256").update(token).digest("hex")`, and set expiration to `new Date(Date.now() + 30 * 60 * 1000)`. Hash cookie tokens identically before lookup or deletion. Return `false` for a missing cookie or no unexpired row. Catch only database operations to log an operational error without token values, then rethrow so authorization fails closed. Implement the constant-time secret comparison using SHA-256 digests of both strings.

- [ ] **Step 5: Generate Prisma Client and run focused tests**

Run: `npm run prisma:generate`

Expected: Prisma Client includes `adminSession`.

Run: `npm test -- src/lib/admin/auth.test.ts`

Expected: PASS for issue, expiry, revocation, secret comparison, and cookie-only authorization cases.

- [ ] **Step 6: Commit the session foundation**

```powershell
git add -- prisma/schema.prisma prisma/migrations/20261014120000_add_admin_sessions/migration.sql src/lib/admin/auth.ts src/lib/admin/auth.test.ts
git commit -m "feat: add revocable admin sessions" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Integrate login, 2FA, and protected admin APIs

**Files:**
- Modify: `src/app/api/admin/auth/route.ts`
- Modify: `src/app/api/admin/auth/verify-2fa/route.ts`
- Modify: `src/app/api/admin/admin-routes.test.ts`
- Modify: `src/lib/admin/auth.test.ts`

**Interfaces:**
- `POST /api/admin/auth` verifies the key with `verifyAdminSecret`; without enrolled TOTP it creates a session and sets `ADMIN_COOKIE_NAME`, while enrolled TOTP only creates `PENDING_2FA_COOKIE_NAME`.
- `POST /api/admin/auth/verify-2fa` creates a session only after valid TOTP/recovery verification.
- `GET /api/admin/auth` returns `{ authorized, is2FAEnrolled }`; never return a session token.
- `DELETE /api/admin/auth` revokes the cookie session before deleting both admin cookies.
- All existing protected admin routes continue calling `isAdminAuthorized`; update tests to authenticate with the session cookie.

- [ ] **Step 1: Write failing route tests for response secrecy and session auth**

In `src/app/api/admin/admin-routes.test.ts`, replace the `@/lib/env.server` mock with a `beforeEach` that stubs `ADMIN_SECRET` and `AUTH_SECRET`, and add `afterEach(() => vi.unstubAllEnvs())`. Mock `prisma.adminSession.create`, `findUnique`, and `deleteMany` with deterministic behavior. Mock `@/lib/logger` with spies so tests can verify no session token is logged. Add assertions that:

```ts
const loginData = await loginResponse.json();
expect(loginData).not.toHaveProperty("token");
expect(loginResponse.headers.get("set-cookie")).toContain("hookdee_admin_session=");
const sessionToken = loginResponse.headers.get("set-cookie")!.match(/hookdee_admin_session=([^;]+)/)?.[1];
expect(JSON.stringify(logger.info.mock.calls)).not.toContain(sessionToken);

const statusData = await (await getAuth(requestWithSessionCookie)).json();
expect(statusData).not.toHaveProperty("token");

const rawSecretRequest = new Request("http://localhost/api/admin/stats", {
  headers: { "x-admin-key": "test-admin-secret-key" },
});
expect((await getStats(rawSecretRequest)).status).toBe(401);
```

Update authorized stats/logs/quota tests to use a valid session cookie. Assert logout deletes the stored hash and clears cookies. Assert invalid login and invalid TOTP issue no `ADMIN_COOKIE_NAME`. With both secret variables blank, assert login returns a server error, sets no admin session cookie, and records a configuration error without logging either secret.

- [ ] **Step 2: Run route tests and confirm they fail**

Run: `npm test -- src/app/api/admin/admin-routes.test.ts`

Expected: FAIL because auth handlers still return deterministic tokens and tests still rely on raw-key API access.

- [ ] **Step 3: Update admin key login and auth status**

In `src/app/api/admin/auth/route.ts`, use `verifyAdminSecret(providedSecret)` instead of string equality. For successful login without enrolled TOTP, call `createAdminSession()`, set its return value only in the existing HttpOnly cookie, and set cookie `maxAge: 60 * 30`. Remove token fields from JSON and remove all token values from log metadata. Make GET report authorization and 2FA enrollment only. In DELETE, await `revokeAdminSession()` before clearing the auth and pending-2FA cookies. An absent `ADMIN_SECRET` and `AUTH_SECRET` must be logged as a configuration failure and must never authenticate using a built-in default.

- [ ] **Step 4: Update TOTP success to issue the same session**

In `src/app/api/admin/auth/verify-2fa/route.ts`, replace deterministic token generation with `createAdminSession()`, set that value in the HttpOnly cookie with `maxAge: 60 * 30`, and omit it from the JSON response and logs. Keep the pending challenge verification and recovery-code consumption behavior unchanged.

- [ ] **Step 5: Update route tests and run the focused suite**

Use session cookies for every positive admin API request. Preserve the negative setup test without a cookie. Add rejection cases for raw `x-admin-key` and `Authorization: Bearer` credentials. Verify an enrolled TOTP login creates a pending challenge but no full session until valid TOTP succeeds.

Run: `npm test -- src/lib/admin/auth.test.ts src/app/api/admin/admin-routes.test.ts`

Expected: PASS, including status/login responses without a `token` property and all protected routes rejecting raw-secret headers.

- [ ] **Step 6: Commit the API integration**

```powershell
git add -- src/app/api/admin/auth/route.ts src/app/api/admin/auth/verify-2fa/route.ts src/app/api/admin/admin-routes.test.ts src/lib/admin/auth.test.ts
git commit -m "fix: require admin sessions for protected APIs" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Reauthenticate on page entry and document the policy

**Files:**
- Move: `src/app/admin/page.tsx` to `src/app/admin/admin-client.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/page.test.tsx`
- Modify: `README.md`

**Interfaces:**
- The existing client component becomes the default export from `admin-client.tsx` and retains the current dashboard/login UI.
- The server page reads `ADMIN_COOKIE_NAME` using `cookies()` from `next/headers`, calls `revokeAdminSession(cookieValue)` before rendering `<AdminClient />`, and does not pass the token to client props.
- The client component's existing `GET /api/admin/auth` check starts unauthenticated after page rendering; successful login writes the new cookie before data fetching.

- [ ] **Step 1: Add a failing server page test**

Create `src/app/admin/page.test.tsx`, mock `next/headers` so `cookies()` returns a store containing `hookdee_admin_session=old-session`, mock `revokeAdminSession`, and mock `AdminClient` with a recognizable element. Call the page component, then assert that it called `revokeAdminSession("old-session")` and returned the client element. Add a second test with no cookie and assert it called `revokeAdminSession(undefined)` and still returns the client element. The current client component calls React hooks and cannot be invoked as a server function, so the initial test run must fail before the page is converted.

- [ ] **Step 2: Run the page test and confirm it fails**

Run: `npm test -- src/app/admin/page.test.tsx`

Expected: FAIL because the current `/admin` page is a client component, causing direct server invocation to fail before session revocation.

- [ ] **Step 3: Split the server entry point from the existing client UI**

Move the current `src/app/admin/page.tsx` contents to `src/app/admin/admin-client.tsx`, preserving its `"use client"` directive and existing behavior. Replace `src/app/admin/page.tsx` with:

```tsx
import { cookies } from "next/headers";
import AdminClient from "./admin-client";
import { ADMIN_COOKIE_NAME, revokeAdminSession } from "@/lib/admin/auth";

export const runtime = "nodejs";

export default async function AdminPage() {
  const cookieStore = await cookies();
  await revokeAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  return <AdminClient />;
}
```

- [ ] **Step 4: Run the page test and review navigation behavior**

Run: `npm test -- src/app/admin/page.test.tsx`

Expected: PASS; the revocation call completes before the client component is returned.

The repository search found no current in-app links to `/admin`. Keep this check in the change to catch any route entry links added before implementation:

```powershell
rg -n 'href=.*/admin|/admin' src/components
```

If an in-app `Link` targets `/admin`, set `prefetch={false}` on that link so speculative route prefetch does not revoke an active session before the admin intentionally opens the page.

- [ ] **Step 5: Update the admin setup documentation**

In `README.md` under “Admin Panel & Unlimited Quota,” document that opening or refreshing `/admin` requires the admin key again, an enrolled TOTP challenge remains required, and an authenticated tab expires 30 minutes after login. Keep the existing `ADMIN_SECRET`/`AUTH_SECRET` configuration instructions; do not add secrets or values to documentation.

- [ ] **Step 6: Run targeted verification**

Run:

```powershell
npm test -- src/lib/admin/auth.test.ts src/app/api/admin/admin-routes.test.ts src/app/admin/page.test.tsx
npm run prisma:validate
npx eslint src/lib/admin/auth.ts src/lib/admin/auth.test.ts src/app/api/admin/auth/route.ts src/app/api/admin/auth/verify-2fa/route.ts src/app/api/admin/admin-routes.test.ts src/app/admin/page.tsx src/app/admin/admin-client.tsx src/app/admin/page.test.tsx
npm run typecheck
```

Expected: all targeted tests, Prisma validation, lint, and type-check pass. If a local database URL is required by Prisma validation, use the repository's configured `.env` without printing its contents.

- [ ] **Step 7: Run the production build**

Run: `npm run build`

Expected: the production build completes with the new Prisma model and server/client page boundary.

- [ ] **Step 8: Commit the page entry and documentation**

```powershell
git add -- README.md docs/superpowers/plans/2026-10-14-secure-admin-access.md src/app/admin/page.tsx src/app/admin/admin-client.tsx src/app/admin/page.test.tsx src/app/api/admin/admin-routes.test.ts src/lib/admin/auth.test.ts src/lib/admin/totp.test.ts
git commit -m "feat: require reauthentication on admin page entry" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Self-Review

- Session storage, fixed 30-minute expiration, reauthentication on every page render, cross-tab revocation, API-only session authorization, token secrecy, fail-closed secret configuration, optional TOTP compatibility, logout revocation, documentation, and tests are covered by the three tasks.
- The helper signatures used by route, page, and test steps are defined in Task 1.
- Prisma generation occurs before code imports the new model; each task runs its focused tests before committing.
- No new runtime dependency or environment variable is introduced.
