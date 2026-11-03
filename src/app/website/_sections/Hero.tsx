import { Browser, Clip } from "../_components/media";
import { Container, Heading, LinkButton, delay } from "../_components/ui";

const VENUES = ["Museums & heritage", "Turf & courts", "Bowling", "Spas", "Cinemas", "Guided tours", "Pools & classes"];

/** A plain promise, then one large product frame that nothing overlaps. */
export function Hero() {
  return (
    <section className="bg-gradient-to-b from-white from-60% to-[var(--cf-paper)] pb-16 pt-16 md:pb-24 md:pt-24">
      <Container>
        <Heading
          as="h1"
          align="center"
          title="The system for places that sell time."
          lead="Tickets, sessions, courts and tours, sold at the counter, checked at the gate and reconciled by close."
          className="max-w-[860px]"
        >
          <LinkButton href="/sign-up">Start for free</LinkButton>
          <LinkButton href="/" variant="secondary">
            See the live demo
          </LinkButton>
        </Heading>
        <p data-reveal style={delay(240)} className="cf-body mt-4 text-center text-sm">
          Free to start. No cut of your tickets on a monthly plan.
        </p>

        <div data-reveal style={delay(300)} className="mt-14 md:mt-16">
          <Browser>
            <Clip name="os-hero" label="The Counterfoil OS dashboard: sales, capacity and what needs attention, updating live" />
          </Browser>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
          <span className="cf-eyebrow">Built for</span>
          {VENUES.map((v) => (
            <span key={v} className="text-[15px] font-medium text-[var(--cf-muted)]">
              {v}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
