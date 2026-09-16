import { Banknote, CreditCard, QrCode, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Glow, Hotspot, Phone, PosStand, Slide, Step, TextBlock } from "../_components/Parts";
import cart from "../_media/go-cart.jpg";
import cash from "../_media/go-cash.jpg";
import bkash from "../_media/go-bkash.jpg";
import scan from "../_media/go-scan.jpg";
import gate from "../_media/go-gate.jpg";

/*
 * Counterfoil Go — the two moments a buyer needs to see: taking the money, and
 * letting people in.
 *
 * Ink is Go's ground. Go is shown on the two devices it runs on: a tablet on a
 * countertop stand, and a phone. Devices face the reader flat, because a
 * numbered point has to land on the control it names; each point's position is
 * measured from the screen it sits on. Every screen is from the till, captured
 * mid-sale.
 */

export const GO_SECTION = "Counterfoil Go";

/** Behind a sheet the page is dimmed, so the phone's status bar takes that grey rather than paper. */
const DIMMED = "#999894";

const METHODS: { icon: LucideIcon; label: string }[] = [
  { icon: Banknote, label: "Cash" },
  { icon: Send, label: "bKash" },
  { icon: QrCode, label: "Bangla QR" },
  { icon: CreditCard, label: "Card" },
];

export function PosPaySlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Take the money, however it comes">
      <Glow className="left-[760px] top-[360px] h-[640px] w-[860px] opacity-70" />
      <TextBlock
        eyebrow="Go · Pay"
        title={
          <>
            Take the money,
            <br />
            however it comes.
          </>
        }
        width={548}
      >
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Check the cart" body="Change a quantity, add a discount, park it for later." />
          <Step n={2} title="Cash" body="Tap Exact or a note; the change is worked out." />
          <Step n={3} title="bKash or Bangla QR" body="Confirmed with the transaction ID before the sale lands." />
        </ol>
      </TextBlock>
      {/* The payment picker as the cart draws it, cash chosen — its foot level with the foot of the first phone (y 754). */}
      <div role="list" aria-label="Payment methods" className="absolute left-[96px] top-[694px] inline-flex rounded-full bg-white/[0.06] p-1.5 ring-1 ring-inset ring-white/10">
        {METHODS.map(({ icon: Icon, label }, i) => (
          <span
            key={label}
            role="listitem"
            className={cn(
              "flex h-[48px] items-center gap-2 rounded-full px-5 text-[17px]",
              i === 0 ? "bg-[#f5f2eb] font-semibold text-[#141413] shadow-[0_8px_18px_-10px_rgb(0_0_0/0.8)]" : "font-medium text-[rgb(245_242_235/0.82)]",
            )}
          >
            <Icon size={18} strokeWidth={1.8} className={i === 0 ? "text-[#d93f00]" : undefined} aria-hidden /> {label}
          </span>
        ))}
      </div>
      {/* Stepped up to the right: the order the three screens come in. */}
      <Phone src={cart} width={262} alt="The cart: General Admission and a yoga session, paying by cash" className="absolute left-[668px] top-[206px]">
        <Hotspot n={1} x={50} y={24.7} small />
      </Phone>
      <Phone src={cash} bar={DIMMED} width={262} alt="Cash: ৳2,875.00 due, exact cash received, no change" className="absolute left-[955px] top-[150px]">
        <Hotspot n={2} x={1} y={48.9} small />
      </Phone>
      <Phone src={bkash} bar={DIMMED} width={262} alt="bKash: the guest’s transaction ID entered before the payment is received" className="absolute left-[1242px] top-[94px]">
        <Hotspot n={3} x={84} y={55.4} small />
      </Phone>
    </Slide>
  );
}

export function PosGateSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Checked in at the gate">
      <Glow className="left-[880px] top-[60px] h-[760px] w-[760px] opacity-60" />
      <TextBlock eyebrow="Go · Admit" title="Checked in at the gate." lead="Scan a ticket and the phone says who to let in — a family ticket lets the whole family in.">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Scan" body="A used ticket is refused, and says why." />
          <Step n={2} title="Check in by session" body="Each session keeps its own count: 3/3 in." />
          <Step n={3} title="Settle first" body="A balance still owed is taken before anyone goes in." />
        </ol>
      </TextBlock>
      <PosStand
        src={gate}
        orientation="portrait"
        width={380}
        alt="Check-in by session on a tablet at the gate: Sculpture Garden 3 of 3 in, and a balance of ৳1,437.50 to take"
        className="absolute left-[732px] top-[104px]"
      >
        <Hotspot n={2} x={77.5} y={18.9} small />
        <Hotspot n={3} x={35} y={35.6} small />
      </PosStand>
      <Phone src={scan} width={254} alt="A scanned ticket refused at the gate: already redeemed" className="absolute left-[1236px] top-[190px]">
        <Hotspot n={1} x={71} y={21} small />
      </Phone>
    </Slide>
  );
}
