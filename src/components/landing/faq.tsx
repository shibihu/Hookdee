import { th } from "@/lib/i18n/th";

export function Faq() {
  return (
    <section
      aria-labelledby="faq-title"
      className="border-t border-stone-200 bg-white/70"
      id="faq"
    >
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-800">
            {th.faq.eyebrow}
          </p>
          <h2
            className="mt-3 text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl"
            id="faq-title"
          >
            {th.faq.title}
          </h2>
        </div>
        <div className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
          {th.faq.items.map((item) => (
            <details className="group py-5" key={item.question}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-stone-900 marker:hidden">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="text-xl text-emerald-800 transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pt-3 leading-7 text-stone-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
