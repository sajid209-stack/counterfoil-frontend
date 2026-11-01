import { RevealRoot } from "./_components/motion";
import { CursorRing, ScrollBar } from "./_components/fx";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { Spark } from "./_sections/Spark";
import { Hero } from "./_sections/Hero";
import { Orbit } from "./_sections/Orbit";
import { Wormhole } from "./_sections/Wormhole";
import { Interface } from "./_sections/Interface";
import { PhoneStory } from "./_sections/PhoneStory";
import { Constellation } from "./_sections/Constellation";
import { Payments } from "./_sections/Payments";
import { Galaxy } from "./_sections/Galaxy";
import { Pricing } from "./_sections/Pricing";
import { Faq } from "./_sections/Faq";
import { Cta } from "./_sections/Cta";

/**
 * The Counterfoil website — dark and cinematic, after jimo.ai/product/ai (studied
 * rendered, 2026-11-01: black space, a starfield, a planet rim, one travelling
 * light that guides the eye, orbital rings, a warping grid, the product floating
 * as lit glass, particle constellations, a galaxy, pricing as one big number,
 * the FAQ as a chat).
 *
 * Counterfoil's version: an EMBER SPARK — a moment of time — travels the page.
 *
 *   Hero           A black sky, an ember sunrise rim: Counterfoil runs the places that sell time.
 *   Orbit          The spark falls into a clock of rings: every seat, slot and lane, one clock.
 *   Wormhole       A grid warps into a tunnel around a typed question: "Is 6 PM still free?"
 *   Interface      The real OS (recorded, dark) floating as 3D glass, lit, labelled.
 *   PhoneStory     The real Go till (recorded, dark) on a phone, chapter by chapter.
 *   Constellation  A particle floor: the counter's questions collapse into stars; facts form.
 *   Payments       Built in Bangladesh — bKash, Bangla QR, cash — the real cash payment.
 *   Galaxy         "Is 6 PM still free?" asked at every counter, every day.
 *   Pricing        One big number in a glow; a slider across the plans.
 *   Faq            Short answers, as a chat.
 *   Cta            The ember rises: start with one counter.
 *
 * The product is only ever shown as recordings of the running app
 * (public/website/*.webm), never as drawn mockups, and there are no invented
 * customers, logos, quotes or usage statistics.
 */
export default function WebsitePage() {
  return (
    <div id="cf-root" className="cf-root dark">
      <RevealRoot rootId="cf-root" />
      <ScrollBar />
      <CursorRing />
      <Spark />
      <Nav />
      <main className="relative">
        <Hero />
        <Orbit />
        <Wormhole />
        <Interface />
        <PhoneStory />
        <Constellation />
        <Payments />
        <Galaxy />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
