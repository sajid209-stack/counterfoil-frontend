import { Section, Heading } from "../_components/ui";
import { StarBg } from "./Glass";
import { PaymentsStage } from "./PaymentsStage";

export function Payments() {
  return (
    <Section id="payments" flush className="overflow-hidden bg-black">
      <StarBg />
      <div className="relative px-5 pb-12 pt-20 md:px-12 md:pb-16 md:pt-28">
        <Heading
          align="center"
          label="Made for the market"
          title="Built in Bangladesh."
          dim="Ready anywhere."
          lead="Bangla and English, bKash and Bangla QR, VAT and taka — with Stripe for cards abroad."
        />
      </div>
      <div className="relative px-5 pb-20 md:px-12 md:pb-28">
        <PaymentsStage />
        <p data-reveal className="mt-10 text-center text-[15px] text-[var(--cf-muted)]">
          Operators already run it in Bangladesh, Malaysia, the US and Canada.
        </p>
      </div>
    </Section>
  );
}
