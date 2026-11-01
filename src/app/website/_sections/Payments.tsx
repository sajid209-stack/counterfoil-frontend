import { Section, Heading } from "../_components/ui";
import { PaymentsStage } from "./PaymentsStage";

export function Payments() {
  return (
    <Section id="payments" flush>
      <div className="px-5 pb-12 pt-20 md:px-12 md:pb-16 md:pt-28">
        <Heading
          label="Made for the market"
          title={<>Built in <span className="cf-accent">Bangladesh.</span></>}
          dim="Ready anywhere."
          lead="Bangla and English, bKash and Bangla QR, VAT and taka — with Stripe for cards abroad."
        />
      </div>
      <div className="px-5 pb-20 md:px-12 md:pb-28">
        <PaymentsStage />
        <p data-reveal className="mt-8 text-center text-[15px] text-[var(--cf-fg-2)]">
          Operators already run it in Bangladesh, Malaysia, the US and Canada.
        </p>
      </div>
    </Section>
  );
}
