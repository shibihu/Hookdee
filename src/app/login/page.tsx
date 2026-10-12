import Link from "next/link";
import { th } from "@/lib/i18n/th";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-sm sm:p-10">
        <p className="text-sm font-bold tracking-wide text-emerald-800">Hookdee</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-950">
          {th.login.title}
        </h1>
        <p className="mt-4 leading-7 text-stone-600">{th.login.description}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900"
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
