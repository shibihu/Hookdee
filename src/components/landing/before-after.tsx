import { th } from "@/lib/i18n/th";

export function BeforeAfter() {
  return (
    <section
      aria-labelledby="before-after-title"
      className="border-y border-stone-200 bg-white/70"
      id="before-after"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-800">
            {th.beforeAfter.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl"
            id="before-after-title"
          >
            {th.beforeAfter.title}
          </h2>
          <p className="mt-3 text-stone-600">{th.beforeAfter.description}</p>
        </div>
        <div className="mx-auto mt-9 grid max-w-5xl gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-stone-200 bg-[#f8f7f4] p-6 sm:p-8">
            <p className="text-sm font-bold text-stone-500">{th.beforeAfter.genericLabel}</p>
            <p className="mt-4 text-lg leading-8 text-stone-700">
              “{th.beforeAfter.generic}”
            </p>
          </article>
          <article className="rounded-3xl border border-emerald-800/20 bg-emerald-50/70 p-6 sm:p-8">
            <p className="text-sm font-bold text-emerald-900">{th.beforeAfter.coachedLabel}</p>
            <p className="mt-4 text-lg leading-8 text-stone-900">
              “{th.beforeAfter.coached}”
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
