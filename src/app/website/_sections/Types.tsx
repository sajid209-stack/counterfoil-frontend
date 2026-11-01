import { Section, Heading } from "../_components/ui";
import { TypesGrid } from "./TypesGrid";

export function Types() {
  return (
    <Section id="types" flush>
      <div className="px-5 pt-20 pb-12 md:px-12 md:pt-28 md:pb-16">
        <Heading
          label="What you can sell"
          title={<>Fourteen ways to <span className="cf-accent">sell time.</span></>}
          dim="From one engine."
          lead="Answer a few plain questions and Counterfoil works out the rest — no booking-type codes, ever."
        />
      </div>
      {/* The hand-drawn setup wizard is gone: the site shows only the real
          product, and the real catalog editor plays in the OS showcase. */}
      <div className="px-3 pb-3 md:px-6 md:pb-6">
        <TypesGrid />
      </div>
    </Section>
  );
}
