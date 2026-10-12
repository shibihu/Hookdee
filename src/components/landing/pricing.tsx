import Link from "next/link";
import { th } from "@/lib/i18n/th";

function Features({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-7 space-y-3 text-sm leading-6 text-stone-700">
      {items.map((item) => (
        <li className="flex gap-3" key={item}>
          <span aria-hidden="true" className="font-bold text-emerald-800">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Pricing() {
  return (
    <section
      aria-labelledby="pricing-title"
      className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"
      id="pricing"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-800">
          {th.pricing.eyebrow}
        </p>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl"
          id="pricing-title"
        >
          {th.pricing.title}
        </h2>
        <p className="mt-3 text-stone-600">{th.pricing.description}</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-3">
        <article className="flex flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <h3 className="text-xl font-bold text-stone-900">{th.pricing.freeName}</h3>
            <p className="mt-5">
              <span className="text-4xl font-bold tracking-tight text-stone-950">
                {th.pricing.freePrice}
              </span>
              <span className="ml-2 text-sm text-stone-500">{th.pricing.freePeriod}</span>
            </p>
          </div>
          <Features items={th.pricing.freeFeatures} />
          <a
            className="mt-8 inline-flex justify-center rounded-full border border-stone-300 px-5 py-3 text-sm font-bold text-stone-800 transition hover:border-emerald-800 hover:text-emerald-800"
            href="#demo"
          >
            {th.pricing.freeAction}
          </a>
        </article>

        <article className="relative flex flex-col rounded-3xl border-2 border-emerald-800 bg-white p-6 shadow-[0_18px_55px_-30px_rgba(6,78,59,0.45)] sm:p-8">
          <span className="absolute right-6 top-6 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
            {th.pricing.popular}
          </span>
          <div className="pt-8 sm:pt-0">
            <h3 className="text-xl font-bold text-stone-900">{th.pricing.proName}</h3>
            <p className="mt-5">
              <span className="text-4xl font-bold tracking-tight text-stone-950">
                {th.pricing.proPrice}
              </span>
              <span className="ml-2 text-sm text-stone-500">{th.pricing.proPeriod}</span>
            </p>
            <p className="mt-2 text-sm text-stone-600">{th.pricing.yearlyPrice}</p>
          </div>
          <Features items={th.pricing.proFeatures} />
          <Link
            className="mt-8 inline-flex justify-center rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900"
            href="/login"
          >
            {th.pricing.proAction}
          </Link>
        </article>

        <article className="flex flex-col rounded-3xl border border-stone-200 bg-stone-100/80 p-6 sm:p-8">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold text-stone-900">{th.pricing.teamName}</h3>
              <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-600">
                {th.pricing.comingSoon}
              </span>
            </div>
            <p className="mt-5 text-2xl font-bold tracking-tight text-stone-950">
              {th.pricing.teamPrice}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {th.pricing.teamDescription}
            </p>
          </div>
          <div className="mt-7 flex-1 rounded-2xl border border-dashed border-stone-300 p-4 text-sm leading-6 text-stone-600">
            {th.pricing.teamTagline}
          </div>
          <button
            className="mt-8 cursor-not-allowed rounded-full border border-stone-300 px-5 py-3 text-sm font-bold text-stone-400"
            disabled
            type="button"
          >
            {th.pricing.teamAction}
          </button>
        </article>
      </div>
    </section>
  );
}
