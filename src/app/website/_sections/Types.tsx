import { Section, Label } from "../_components/ui";
import { SplitReveal } from "../_components/fx";
import { TypesGrid } from "./TypesGrid";

export function Types() {
  return (
    <Section id="types" flush className="overflow-x-clip">
      <TypesGrid
        header={
        <div className="max-w-[720px]">
          <div data-reveal className="mb-5">
            <Label>What you can sell</Label>
          </div>
          <SplitReveal
            as="h2"
            className="cf-h2"
            parts={[{ text: "Fourteen ways to " }, { text: "sell time.", className: "cf-accent" }]}
          />
          <p data-reveal className="cf-lead mt-5">
            Answer a few plain questions and Counterfoil works out the rest — no booking-type codes, ever.
          </p>
        </div>
        }
      />
    </Section>
  );
}
