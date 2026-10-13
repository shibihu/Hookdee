import Link from "next/link";
import { auth } from "@/auth";
import { errorMessageForAuth } from "@/lib/auth/error-message";
import { safeReturnTo } from "@/lib/auth/return-to";
import { getServerEnv } from "@/lib/env.server";
import { th } from "@/lib/i18n/th";
import { signInWithGoogle, signOutOfAccount } from "./actions";

type LoginSearchParams = {
  error?: string | string[];
  returnTo?: string | string[];
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const [session, query] = await Promise.all([auth(), searchParams]);
  const env = getServerEnv();
  const returnTo = safeReturnTo(query.returnTo, env.APP_URL);
  const errorMessage = errorMessageForAuth(query.error);
  const googleConfigured = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-sm sm:p-10">
        <p className="text-sm font-bold tracking-wide text-emerald-800">
          Hookdee
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-950">
          {th.login.title}
        </h1>
        <p className="mt-4 leading-7 text-stone-600">{th.login.description}</p>
        {errorMessage ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        {session?.user ? (
          <div className="mt-7 space-y-4">
            <p className="font-semibold text-stone-900">
              {session.user.name || session.user.email || th.login.accountName}
            </p>
            {session.user.email ? (
              <p className="text-sm text-stone-600">
                {th.login.accountEmail}: {session.user.email}
              </p>
            ) : null}
            <form action={signOutOfAccount}>
              <button
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-bold text-stone-800 transition hover:border-emerald-800 hover:text-emerald-800"
                type="submit"
              >
                {th.login.signOut}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-7 flex flex-col justify-center gap-3">
            {googleConfigured ? (
              <form action={signInWithGoogle}>
                <input name="returnTo" type="hidden" value={returnTo} />
                <button
                  className="w-full rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900"
                  type="submit"
                >
                  {th.login.googleSignIn}
                </button>
              </form>
            ) : (
              <p
                aria-live="polite"
                className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                role="status"
              >
                {th.login.googleUnavailable}
              </p>
            )}
          </div>
        )}

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-bold text-stone-800 transition hover:border-emerald-800 hover:text-emerald-800"
            href="/"
          >
            {th.login.homeAction}
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-bold text-stone-800 transition hover:border-emerald-800 hover:text-emerald-800"
            href="/#pricing"
          >
            {th.login.pricingAction}
          </Link>
        </div>
      </section>
    </main>
  );
}
