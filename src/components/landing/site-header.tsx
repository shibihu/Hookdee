import Link from "next/link";
import { auth } from "@/auth";
import { th } from "@/lib/i18n/th";
import { signOutOfAccount } from "@/app/login/actions";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const identity = user?.name || user?.email || th.login.accountName;

  return (
    <header className="border-b border-stone-200/80 bg-[#fbfaf7]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
        <Link
          aria-label={th.brand.homeLabel}
          className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-stone-900"
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-800 text-lg text-white">
            h
          </span>
          <span className="text-xl">Hookdee</span>
        </Link>
        <nav
          aria-label={th.brand.navigationLabel}
          className="hidden items-center gap-7 text-sm text-stone-600 md:flex"
        >
          <a className="transition hover:text-emerald-800" href="#how-it-works">
            {th.nav.howItWorks}
          </a>
          <a className="transition hover:text-emerald-800" href="#pricing">
            {th.nav.pricing}
          </a>
          <a className="transition hover:text-emerald-800" href="#faq">
            {th.nav.faq}
          </a>
        </nav>
        {user ? (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="max-w-40 truncate text-sm font-semibold text-stone-700 sm:max-w-56"
              title={identity}
            >
              {identity}
            </span>
            <form action={signOutOfAccount}>
              <button
                className="shrink-0 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-emerald-800 hover:text-emerald-800"
                type="submit"
              >
                {th.nav.signOut}
              </button>
            </form>
          </div>
        ) : (
          <Link
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-emerald-800 hover:text-emerald-800"
            href="/login"
          >
            {th.nav.signIn}
          </Link>
        )}
      </div>
      <nav
        aria-label={th.brand.navigationLabel}
        className="flex gap-6 overflow-x-auto border-t border-stone-200 px-5 py-2.5 text-sm text-stone-600 md:hidden"
      >
        <a className="shrink-0" href="#how-it-works">
          {th.nav.howItWorks}
        </a>
        <a className="shrink-0" href="#pricing">
          {th.nav.pricing}
        </a>
        <a className="shrink-0" href="#faq">
          {th.nav.faq}
        </a>
      </nav>
    </header>
  );
}
