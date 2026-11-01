import { RevealRoot } from "./_components/motion";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { Hero } from "./_sections/Hero";
import { Problem } from "./_sections/Problem";
import { System } from "./_sections/System";
import { Day } from "./_sections/Day";
import { Types } from "./_sections/Types";
import { Specials } from "./_sections/Specials";
import { Bangladesh } from "./_sections/Bangladesh";
import { Pricing } from "./_sections/Pricing";
import { Close } from "./_sections/Close";

/**
 * The Counterfoil website, told as one story:
 *
 *   Hero        Counterfoil runs the places that sell time.             ink
 *   Problem     Venues sell time with tools built for shelves.          paper
 *   System      One system, from the office to the gate.                ink
 *   Day         A day at the venue, 08:00 → 22:00 (sticky scroll).      paper
 *   Types       Fourteen ways to sell time, from one engine.            white
 *   Specials    What a retail till can't do.                            ink
 *   Bangladesh  Built in Bangladesh. Ready anywhere.                    paper
 *   Pricing     No cut of your tickets.                                 ink
 *   Close       Sell time. Keep all of it.                              ember
 *
 * Everything it shows is real: the screens are this product's own, the prices
 * are the real Bangladesh price list (the same figures as /deck), and there
 * are no invented customers, logos or quotes. A site that invents one
 * statistic teaches its reader to doubt the rest.
 */
export default function WebsitePage() {
  return (
    <div id="w-root" className="w-root">
      <RevealRoot rootId="w-root" />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <System />
        <Day />
        <Types />
        <Specials />
        <Bangladesh />
        <Pricing />
        <Close />
      </main>
      <Footer />
    </div>
  );
}
