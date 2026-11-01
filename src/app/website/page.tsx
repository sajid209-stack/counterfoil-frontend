import { RevealRoot } from "./_components/motion";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { Hero } from "./_sections/Hero";
import { Platform } from "./_sections/Platform";
import { Engine } from "./_sections/Engine";
import { Types } from "./_sections/Types";
import { Specials } from "./_sections/Specials";
import { Payments } from "./_sections/Payments";
import { Facts } from "./_sections/Facts";
import { Pricing } from "./_sections/Pricing";
import { Cta } from "./_sections/Cta";

/**
 * The Counterfoil website, in attio.com's manner — a white page inside
 * hairline rails, one story told section by section:
 *
 *   Hero        Counterfoil runs the places that sell time. + a live till demo
 *   Platform    1 Set up · 2 Sell · 3 Admit · 4 Reconcile · 5 Grow (auto-advancing tabs)
 *   Engine      Never sold twice — one capacity engine behind every counter
 *   Types       Fourteen ways to sell time, from one engine
 *   Specials    What a retail till can't do
 *   Payments    Built in Bangladesh. Ready anywhere.
 *   Facts       The product in four numbers
 *   Pricing     No cut of your tickets
 *   Cta         Start with one counter
 *
 * Everything it shows is real: the screens and figures are this product's own,
 * the prices are the real Bangladesh price list (the same figures as /deck),
 * and there are no invented customers, logos, quotes or usage statistics.
 */
export default function WebsitePage() {
  return (
    <div id="cf-root" className="cf-root">
      <RevealRoot rootId="cf-root" />
      <Nav />
      <div className="cf-rails">
        <main>
          <Hero />
          <Platform />
          <Engine />
          <Types />
          <Specials />
          <Payments />
          <Facts />
          <Pricing />
          <Cta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
