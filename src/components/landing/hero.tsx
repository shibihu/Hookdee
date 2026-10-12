import { DemoForm } from "@/components/demo/review-form";
import { th } from "@/lib/i18n/th";

export function Hero() {
  return (
    <section
      className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:py-24"
      id="how-it-works"
    >
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-900/5 px-3.5 py-1.5 text-sm font-semibold text-emerald-900">
          <span aria-hidden="true" className="size-2 rounded-full bg-orange-500" />
          {th.hero.eyebrow}
        </p>
        <h1 className="mt-6 text-4xl font-bold leading-[1.25] tracking-tight text-stone-950 sm:text-5xl lg:text-[3.5rem]">
          {th.hero.headline}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600 sm:text-xl">
          {th.hero.description}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            className="rounded-full bg-emerald-800 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-900"
            href="#demo"
          >
            {th.hero.primaryAction}
          </a>
          <a
            className="rounded-full border border-stone-300 bg-white/70 px-5 py-3 font-semibold text-stone-700 transition hover:border-stone-500"
            href="#before-after"
          >
            {th.hero.secondaryAction}
          </a>
        </div>
        <p className="mt-5 text-sm text-stone-500">{th.hero.platformNote}</p>
      </div>
      <div className="w-full" id="demo">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">{th.hero.demoTitle}</h2>
            <p className="mt-1 text-sm text-stone-600">{th.hero.demoDescription}</p>
          </div>
          <span aria-hidden="true" className="hidden rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-900 sm:inline-flex">
            {th.hero.freeBadge}
          </span>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}
