import { RevealRoot } from "./_components/motion";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { Hero } from "./_sections/Hero";
import { Problem } from "./_sections/Problem";
import { GoSection } from "./_sections/GoSection";
import { OsSection } from "./_sections/OsSection";
import { Bento } from "./_sections/Bento";
import { Market } from "./_sections/Market";
import { Pricing } from "./_sections/Pricing";
import { Faq } from "./_sections/Faq";
import { Cta } from "./_sections/Cta";

/**
 * The Counterfoil website, composed the way world-class SaaS sites are (measured
 * from attio, linear, ramp, stripe, mercury, square, toast and shopify POS):
 *
 *   Hero      A plain promise, then ONE large product frame nothing overlaps
 *   Problem   Why a retail till is the wrong tool
 *   GoSection The till: a feature list that swaps the real phone recording
 *   OsSection The office: the same pattern with the real OS recording
 *   Bento     Real UI cropped large, a card per capability
 *   Market    Built in Bangladesh: the payment rails
 *   Pricing   The real plans and the marketplace comparison
 *   Faq       An accordion
 *   Cta       The one dark band
 *
 * The product is only ever real: recordings (public/website/*.webm) and captures
 * of the running app (_media). No drawn UI, floating bubbles or overlapping
 * devices, and no invented customers, logos, quotes or usage statistics.
 */
export default function WebsitePage() {
  return (
    <div id="cf-root" className="cf-root light">
      <RevealRoot rootId="cf-root" />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <GoSection />
        <OsSection />
        <Bento />
        <Market />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
