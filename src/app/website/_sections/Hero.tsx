import { Heading, LinkButton, Section } from "../_components/ui";
import { HeroStage } from "./HeroStage";
import { HeroVenues } from "./HeroVenues";

/** The first screen: one line, two buttons, and the real product on a soft stage. */
export function Hero() {
  return (
    <Section label="Counterfoil" flush className="px-5 pb-16 pt-20 md:px-12 md:pb-20 md:pt-28">
      <Heading
        as="h1"
        align="center"
        className="max-w-[820px]"
        title="The system for"
        dim={<>places that sell <span className="cf-accent">time.</span></>}
        lead="Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close. In one place."
      >
        <LinkButton href="/sign-up" variant="primary">
          Start for free
        </LinkButton>
        <LinkButton href="/" variant="secondary">
          Try the live demo
        </LinkButton>
      </Heading>
      <p className="sr-only">
        A recording of the real product: a cashier sells two Planetarium Show tickets in Counterfoil Go, pays with bKash, and the sale appears in Counterfoil OS.
      </p>
      <div data-reveal className="mt-14 md:mt-16">
        <HeroStage />
      </div>
      <HeroVenues />
    </Section>
  );
}
