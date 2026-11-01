import { Section, Heading } from "../_components/ui";
import { TypesWizard } from "./TypesWizard";
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
      <div className="grid gap-3 px-3 pb-3 md:px-6 md:pb-6 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)]">
        <div className="cf-dots rounded-2xl px-4 py-8 md:px-8 md:py-10">
          <TypesWizard />
        </div>
        <TypesGrid />
      </div>
    </Section>
  );
}
