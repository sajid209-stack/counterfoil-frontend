import { Section, Heading } from "../_components/ui";
import { TypesWizard } from "./TypesWizard";
import { TypesGrid } from "./TypesGrid";

export function Types() {
  return (
    <Section id="types" flush>
      <div className="px-5 pt-20 pb-12 md:px-12 md:pt-28 md:pb-16">
        <Heading
          label="What you can sell"
          title="Fourteen ways to sell time."
          dim="From one engine."
          lead="Answer a few plain questions and Counterfoil works out the rest — no booking-type codes, ever."
        />
      </div>
      <div className="grid border-t border-[var(--cf-line)] lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)]">
        <div className="cf-dots px-5 py-8 md:px-10 md:py-12 lg:border-r lg:border-[var(--cf-line)]">
          <TypesWizard />
        </div>
        <TypesGrid className="border-t border-[var(--cf-line)] lg:border-t-0" />
      </div>
    </Section>
  );
}
