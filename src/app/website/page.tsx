import { RevealRoot } from "./_components/motion";
import { CursorRing, ScrollBar } from "./_components/fx";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { Hero } from "./_sections/Hero";
import { Manifesto } from "./_sections/Manifesto";
import { FilmWall } from "./_sections/FilmWall";
import { PhoneStory } from "./_sections/PhoneStory";
import { Band } from "./_sections/Band";
import { Stack } from "./_sections/Stack";
import { OsShowcase } from "./_sections/OsShowcase";
import { Engine } from "./_sections/Engine";
import { Types } from "./_sections/Types";
import { Payments } from "./_sections/Payments";
import { Facts } from "./_sections/Facts";
import { Pricing } from "./_sections/Pricing";
import { Cta } from "./_sections/Cta";

/**
 * The Counterfoil website, in attio.com's manner — a white page inside
 * hairline rails, one story told section by section:
 *
 *   Hero        The real till selling, the real dashboard behind it
 *   PhoneStory  Counterfoil Go on a phone, chapter by chapter (sticky, scroll-driven)
 *   OsShowcase  Counterfoil OS: dashboard, calendar, customers, catalog, analytics
 *   Engine      Never sold twice — one capacity engine behind every counter
 *   Types       Fourteen ways to sell time, from one engine
 *   Payments    Built in Bangladesh. Ready anywhere.
 *   Facts       The product in four numbers
 *   Pricing     No cut of your tickets
 *   Cta         Start with one counter
 *
 * The product is shown as RECORDINGS of the running app (public/website/*.webm,
 * filmed with a scratchpad recorder), never as drawn mockups.
 *
 * Everything it shows is real: the screens and figures are this product's own,
 * the prices are the real Bangladesh price list (the same figures as /deck),
 * and there are no invented customers, logos, quotes or usage statistics.
 */
export default function WebsitePage() {
  return (
    <div id="cf-root" className="cf-root light">
      <RevealRoot rootId="cf-root" />
      <ScrollBar />
      <CursorRing />
      <Nav />
      <div className="cf-rails">
        <main>
          <Hero />
          <Manifesto />
          <FilmWall />
          <PhoneStory />
          <Band words={["Sell", "Scan", "Admit", "Reconcile"]} />
          <OsShowcase />
          <Engine />
          <Types />
          <Stack />
          <Payments />
          <Facts />
          <Band words={["Tickets", "Courts", "Seats", "Tours", "Sessions"]} reverse />
          <Pricing />
          <Cta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
