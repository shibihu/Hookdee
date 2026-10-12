import { BeforeAfter } from "@/components/landing/before-after";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <BeforeAfter />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
