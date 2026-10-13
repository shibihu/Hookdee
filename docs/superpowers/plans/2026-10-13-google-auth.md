# Google Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google account creation, sign-in, database-backed sessions, and sign-out to Hookdee.

**Architecture:** Configure Auth.js with its Prisma adapter and Google provider, using the existing Prisma auth models and server-only Prisma client. Add the Auth.js route handler, use server actions and server-rendered session state for the login page and landing header, and validate return targets as same-origin paths.

**Tech Stack:** Next.js 16 App Router, React 19, Auth.js, Prisma 6, PostgreSQL, TypeScript, Vitest.

## Global Constraints

- This is an authentication-only milestone for Hookdee; it does not add email/password credentials, a dashboard, saved projects, or authorization rules for future product features.
- The existing landing page and demo remain publicly accessible.
- Google OAuth uses database-backed sessions stored in the existing `Session` model.
- Authentication secrets and provider tokens remain server-side.
- No error may silently fall back to a mock or anonymous authenticated state.
- Preserve the existing Thai-first UI, formatting, and package-manager conventions.
- Before writing Next.js code, read the relevant guide from `node_modules/next/dist/docs/`, especially the current App Router route-handler, server/client-component, and authentication guides.

---

### Task 1: Configure Auth.js, Prisma sessions, and safe return targets

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/lib/env-schema.ts`
- Modify: `src/lib/env-schema.test.ts`
- Create: `src/lib/auth/return-to.ts`
- Create: `src/lib/auth/return-to.test.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/prisma.ts`; validated values from `getServerEnv()` in `src/lib/env.server.ts`; existing Prisma auth models in `prisma/schema.prisma`.
- Produces: `auth`, `signIn`, `signOut`, and `handlers` from `src/auth.ts`; `safeReturnTo(value, appUrl): string` for login actions and tests.

- [ ] **Step 1: Read the installed framework and authentication integration guides**

Read the Next.js 16 App Router guides listed in Global Constraints and the current Auth.js installation and Prisma-adapter instructions. Confirm the required package versions and peer dependencies against the installed Next.js 16.4 and React 19 versions before adding dependencies.

- [ ] **Step 2: Add focused tests for provider environment pairing and return-target validation**

In `src/lib/env-schema.test.ts`, verify Google credentials are valid when both are present or both are absent, and that a lone client ID or secret is rejected with a variable-specific error that does not print the secret value.

In `src/lib/auth/return-to.test.ts`, cover a local path with query/hash, a same-origin absolute URL, a foreign absolute URL, a protocol-relative foreign URL, an array value, and malformed input. The helper contract is:

```ts
safeReturnTo(
  value: string | string[] | undefined,
  appUrl: string,
): string
```

Return only a same-origin pathname plus query and hash. For missing, malformed, or cross-origin values, return `/`.

- [ ] **Step 3: Run the focused tests and confirm the new cases fail**

Run:

```powershell
npm test -- src/lib/env-schema.test.ts src/lib/auth/return-to.test.ts
```

Expected: the existing env tests pass and the newly added credential-pairing and return-target tests fail until implemented.

- [ ] **Step 4: Install Auth.js and its Prisma adapter**

Use npm to install the current Auth.js package and `@auth/prisma-adapter` versions that the official integration documentation confirms are compatible with the installed Next.js and React versions. Keep the generated `package-lock.json` in sync; do not hand-edit dependency versions.

- [ ] **Step 5: Implement validated auth environment and safe return-target handling**

Add a cross-field Zod validation requiring Google client ID and secret to be configured together while allowing both to be absent, so public pages can still render without Google setup. Implement `safeReturnTo` with `URL` parsing against `appUrl`; compare origins before returning only `pathname`, `search`, and `hash`.

- [ ] **Step 6: Configure the Auth.js Prisma adapter and route handler**

In `src/auth.ts`, configure `PrismaAdapter(prisma)`, the Google provider from validated server environment values, and `session.strategy = "database"`. Do not expose provider credentials or token values to client components. Keep the public app usable if both Google credentials are absent; the login UI will report that sign-in is not configured rather than creating a mock session.

In `src/app/api/auth/[...nextauth]/route.ts`, export the Auth.js `GET` and `POST` handlers using the installed Auth.js App Router pattern. Keep Prisma-backed handlers on the Node.js runtime if required by the installed framework/provider.

- [ ] **Step 7: Run the focused tests and type-check**

Run:

```powershell
npm test -- src/lib/env-schema.test.ts src/lib/auth/return-to.test.ts
npm run typecheck
```

Expected: all focused tests pass and TypeScript accepts the Auth.js, provider, adapter, and route-handler types.

- [ ] **Step 8: Commit the auth foundation**

```powershell
git add package.json package-lock.json src/auth.ts src/app/api/auth src/lib/env-schema.ts src/lib/env-schema.test.ts src/lib/auth
git commit -m "Add Google OAuth authentication foundation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Wire sign-in, account state, sign-out, and return flow into the UI

**Files:**
- Create: `src/app/login/actions.ts`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/landing/site-header.tsx`
- Modify: `src/lib/i18n/th.ts`
- Create: `src/lib/auth/error-message.ts`
- Create: `src/lib/auth/error-message.test.ts`
- Create: `src/app/login/page.test.tsx`
- Create: `src/components/landing/site-header.test.tsx`

**Interfaces:**
- Consumes: `auth`, `signIn`, and `signOut` from `src/auth.ts`; `safeReturnTo` from Task 1; `errorMessageForAuth` from `src/lib/auth/error-message.ts`.
- Produces: server actions for Google sign-in and sign-out; `/login` server-rendered unauthenticated and authenticated states; a session-aware landing header.

- [ ] **Step 1: Add tests for safe authentication error messages**

Test an allowlisted set of known provider/configuration errors and an unknown error value. Known failures must produce friendly Thai recovery text; unknown values must produce generic retry guidance. Never echo raw callback parameters, exception text, provider tokens, or environment values.

- [ ] **Step 2: Run the error-message tests and confirm they fail**

Run:

```powershell
npm test -- src/lib/auth/error-message.test.ts
```

Expected: the test fails because the error-message mapper has not been implemented.

- [ ] **Step 3: Implement the error-message mapper and sign-in/sign-out server actions**

Add `errorMessageForAuth(error: string | string[] | undefined): string | null` and cover only expected Auth.js error codes with localized copy. Implement server actions in `src/app/login/actions.ts`: sign in through Google with `safeReturnTo` applied to the supplied return target, and sign out to `/`. Report provider-unavailable and action failures as visible login errors; record operational details server-side without logging credentials or tokens.

- [ ] **Step 4: Replace the placeholder login page with session-aware UI**

Use the current Next.js route page API, including its current async `searchParams` shape, to read the return target and any Auth.js error code. When no user is signed in, render a Google sign-in form and a clear unavailable state if Google credentials are not configured. When signed in, show the available account name/email and a sign-out form. Keep the UI Thai-first and retain a route back to the home page.

- [ ] **Step 5: Make the landing header reflect session state**

Make `SiteHeader` read the server session through `auth()`. Keep the current sign-in link when unauthenticated; when authenticated, show the account identity where available and a sign-out form. Preserve the existing responsive navigation and anchors.

- [ ] **Step 6: Add focused tests for login and header states**

Using the repository's existing Vitest and `renderToStaticMarkup` conventions, mock the auth session and verify the unauthenticated login state, authenticated account/sign-out state, provider-unavailable message, allowlisted failure copy, and both header states. Include `safeReturnTo` cases from Task 1 to prove external callback targets resolve to `/`.

- [ ] **Step 7: Run the focused tests, lint, and type-check**

Run:

```powershell
npm test -- src/lib/auth src/app/login src/components/landing/site-header.test.tsx
npm run lint
npm run typecheck
```

Expected: focused auth/UI tests pass with no lint or type errors.

- [ ] **Step 8: Commit the sign-in UI**

```powershell
git add src/app/login src/components/landing/site-header.tsx src/components/landing/site-header.test.tsx src/lib/auth/error-message.ts src/lib/auth/error-message.test.ts src/lib/i18n/th.ts
git commit -m "Add Google sign-in and session-aware navigation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Document setup and verify the complete authentication milestone

**Files:**
- Modify: `README.md`
- Inspect: `.env.example`
- Inspect: `prisma/schema.prisma`
- Verify: `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`, and `src/components/landing/site-header.tsx`

**Interfaces:**
- Consumes: the completed authentication flow from Tasks 1 and 2.
- Produces: accurate Windows setup instructions and a passing project verification suite.

- [ ] **Step 1: Update the Google OAuth setup instructions**

Update `README.md` to mark Google sign-in as implemented. Document the existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `APP_URL` values; local callback URL `http://localhost:3000/api/auth/callback/google`; Google Cloud OAuth setup; database-backed sessions; sign-in/sign-out behavior; and how to diagnose missing or rejected provider configuration. Preserve Windows PowerShell examples and state that `.env.example` values are placeholders. Do not add real credentials.

- [ ] **Step 2: Confirm the existing Prisma schema needs no migration**

Check that the deployed schema has `User`, `Account`, `Session`, and `VerificationToken` models compatible with the installed Prisma adapter. If the adapter requires a schema change, add the minimal Prisma migration and include Prisma validation/generation and migration checks in this task; do not modify unrelated models. Stage any new schema or migration files by their exact paths in the final commit.

- [ ] **Step 3: Run the full automated verification**

Run:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all tests, lint, type-check, and production build pass. Verify the anonymous landing/demo still renders and the build does not require real Google credentials.

- [ ] **Step 4: Perform the configured-provider smoke test**

With a local PostgreSQL database migrated and valid local Google OAuth credentials configured, start the app with `npm run dev`. Sign in with Google, confirm one user/account and a persisted session are created, refresh and confirm the header remains signed in, then sign out and confirm the header returns to its signed-out state. Try a foreign return URL and confirm it resolves to `/`. Do not record credentials or token values in test output.

- [ ] **Step 5: Commit the documentation and verification-ready state**

```powershell
git add README.md
git commit -m "Document Google sign-in setup" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
