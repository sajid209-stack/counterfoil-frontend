import { Heading, LinkButton, Section } from "../_components/ui";

export function Cta() {
  return (
    <Section label="Get started" tone="ink">
      <Heading align="center" title="Start with one counter." lead="Add the rest when you’re ready.">
        <LinkButton href="/sign-up" variant="primary">
          Start for free
        </LinkButton>
        {/* The secondary button is built for light surfaces; on ink it is a paper button. */}
        <LinkButton href="/" variant="secondary" className="!border-transparent !bg-[var(--cf-paper)] !text-[#141413] hover:!bg-white">
          See the live demo
        </LinkButton>
      </Heading>
    </Section>
  );
}
