import Link from "next/link";
import { th } from "@/lib/i18n/th";

export function SiteFooter() {
  return (
    <footer className="bg-stone-950 text-stone-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-9 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Link className="text-lg font-bold tracking-tight text-white" href="/">
            Hookdee
          </Link>
          <p className="mt-1 text-sm text-stone-400">{th.footer.tagline}</p>
        </div>
        <div className="text-sm text-stone-400 md:text-right">
          <p className="mt-1">{th.footer.note}</p>
          <p className="mt-2">{th.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
