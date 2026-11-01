import { LinkButton, Label, Section } from "../_components/ui";
import { Magnetic, SplitReveal, WordCycle } from "../_components/fx";
import { HeroStage } from "./HeroStage";
import { HeroVenues } from "./HeroVenues";

const CYCLE = ["time.", "tickets.", "courts.", "seats.", "tours."];

/** The first screen: a kinetic headline, two magnetic buttons, and the real product on a 3D stage. */
export function Hero() {
  return (
    <Section label="Counterfoil" flush className="overflow-x-clip px-5 pb-16 pt-16 md:px-12 md:pb-20 md:pt-24">
      <div className="mx-auto max-w-[1120px]">
        <Label>The system for places that sell time</Label>
        <h1 className="mt-6 text-[clamp(2.5rem,12vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.055em] text-[var(--cf-fg)] [text-wrap:balance]">
          <span className="block">
            <SplitReveal parts="Sell" />{" "}
            <WordCycle words={CYCLE} className="pb-[0.14em] pr-[0.06em] -mb-[0.14em] text-[var(--cf-accent)]" />
          </span>
          <span className="block">
            <SplitReveal parts="without the chaos." delay={380} />
          </span>
        </h1>
        <div className="mt-10 grid items-end gap-8 md:mt-14 md:grid-cols-[1fr_auto]">
          <Magnetic strength={0.15} className="self-start">
            <p className="cf-lead max-w-[540px]">
              Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close. In one place.
            </p>
          </Magnetic>
          <div className="flex flex-wrap items-center gap-2.5">
            <Magnetic>
              <LinkButton href="/sign-up" variant="primary">
                Start for free
              </LinkButton>
            </Magnetic>
            <Magnetic>
              <LinkButton href="/" variant="secondary">
                Try the live demo
              </LinkButton>
            </Magnetic>
          </div>
        </div>
      </div>
      <p className="sr-only">
        A recording of the real product: a cashier sells two Heritage Walking Tour tickets in Counterfoil Go, pays with bKash, and the sale appears in Counterfoil OS.
      </p>
      <div data-reveal className="mt-14 md:mt-16">
        <HeroStage />
      </div>
      <HeroVenues />
    </Section>
  );
}
