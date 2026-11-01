import { Section, Heading } from "../_components/ui";
import { PaymentsDemo } from "./PaymentsDemo";

export function Payments() {
  return (
    <Section id="payments" flush>
      <div className="px-5 pt-20 pb-12 md:px-12 md:pt-28 md:pb-16">
        <Heading
          label="Made for the market"
          title="Built in Bangladesh."
          dim="Ready anywhere."
          lead="Bangla and English, bKash and Bangla QR, VAT and taka — with Stripe for cards abroad."
        />
      </div>
      <PaymentsDemo />
    </Section>
  );
}
