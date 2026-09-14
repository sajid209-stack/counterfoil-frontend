import { ArrowRight, Banknote, CreditCard, MessageSquare, Printer, QrCode, Send, Ticket as TicketIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Glow, Hotspot, Phone, PosStand, Slide, Step, TextBlock, Ticket, deckStyles as s, type ChapterPart } from "../_components/Parts";
import till from "../_media/go-till.jpg";
import phoneSell from "../_media/go-phone-sell.jpg";
import sheetShow from "../_media/go-sheet-show.jpg";
import sheetCinema from "../_media/go-sheet-cinema.jpg";
import sheetLane from "../_media/go-sheet-lane.jpg";
import cart from "../_media/go-cart.jpg";
import cash from "../_media/go-cash.jpg";
import bkash from "../_media/go-bkash.jpg";
import complete from "../_media/go-complete.jpg";
import scan from "../_media/go-scan.jpg";
import gate from "../_media/go-gate.jpg";
import pin from "../_media/go-pin.jpg";

/*
 * Chapter 02 — Counterfoil Go, walked through the way a cashier works it.
 *
 * Ink is Go's ground. Go is shown on the two devices it runs on: a tablet on a
 * countertop stand, and a phone. Devices face the reader flat, because a
 * numbered point has to land on the control it names; each point's position is
 * measured from the screen it sits on. Every screen is from the till, captured
 * mid-sale.
 */

export const GO_SECTION = "02 · Counterfoil Go";

/** The parts of chapter 02, each with the phone screen it opens on. */
export const GO_CONTENTS: ChapterPart[] = [
  { name: "Find", page: 17, src: phoneSell, x: 0, y: 0.05, w: 1 },
  { name: "Choose", page: 18, src: sheetShow, x: 0, y: 0.26, w: 1 },
  { name: "Pay", page: 19, src: cash, x: 0, y: 0.26, w: 1 },
  { name: "Ticket", page: 20, src: complete, x: 0, y: 0.04, w: 1 },
  { name: "Admit", page: 21, src: scan, x: 0, y: 0.08, w: 1 },
  { name: "Shift", page: 22, src: pin, x: 0, y: 0.14, w: 1 },
];

/** Behind a sheet the page is dimmed, so the phone's status bar takes that grey rather than paper. */
const DIMMED = "#999894";

/** The reference the sale on these slides issued, as the till printed it. */
const REFERENCE = "CF-2026-236111-01";

/** Three tiles from the sell wall, each saying what is left in the till's own words. */
const TILES: { name: string; price: string; status: string; tone: "open" | "limited" | "later" }[] = [
  { name: "Grand Heritage Tour", price: "৳1,800", status: "Next 17:00 · 18 left", tone: "open" },
  { name: "Yoga Session", price: "৳500", status: "3 of 20 left today", tone: "limited" },
  { name: "Heritage Walking Tour", price: "৳800", status: "Next Fri 31 Jul", tone: "later" },
];

export function PosFindSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Find it in a tap">
      <Glow className="left-[900px] top-[-300px] h-[760px] w-[860px] opacity-70" />
      <TextBlock eyebrow="Go · 1 of 6 · Find" title="Find it in a tap." lead="The sell wall shows what is on sale — and how much of it is left.">
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Search or pick a category" body="Admission, guided tours, events." />
          <Step n={2} title="Read the tile" body="Its price, and what is left right now." />
          <Step n={3} title="The cart stays beside it" body="Every line, the payment method and Charge." />
        </ol>
        <ul aria-label="Tiles on the sell wall" className="mt-9 grid grid-cols-3 gap-3">
          {TILES.map(({ name, price, status, tone }) => (
            <li key={name} className="flex h-[150px] flex-col rounded-[16px] bg-[#f5f2eb] p-3.5 text-[#141413] shadow-[0_18px_30px_-20px_rgb(0_0_0/0.8)]">
              <div className="flex items-start justify-between">
                <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-white text-[#57534c] ring-1 ring-[#e2ded5]">
                  <TicketIcon size={15} strokeWidth={1.7} aria-hidden />
                </span>
                {tone === "limited" && <span className="rounded-full bg-[#141413] px-2 py-[3px] text-[12px] font-semibold leading-none text-[#f5f2eb]">Limited</span>}
              </div>
              <p className="mt-auto text-[15px] font-semibold leading-tight">{name}</p>
              <p className="mt-1 text-[17px] font-bold tabular-nums text-[#b83600]">{price}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#57534c]">
                <span aria-hidden className={cn("h-[7px] w-[7px] shrink-0 rounded-full", tone === "open" ? "bg-[#1f9d55]" : tone === "limited" ? "bg-[#f94a00]" : "bg-[#a39e94]")} />
                {status}
              </p>
            </li>
          ))}
        </ul>
      </TextBlock>
      <PosStand src={till} width={724} alt="Counterfoil Go on a countertop stand: the sell wall with a sale in the cart" className="absolute left-[780px] top-[150px]">
        <Hotspot n={1} x={60} y={12.8} />
        <Hotspot n={2} x={34} y={61} />
        <Hotspot n={3} x={74.6} y={13.8} />
      </PosStand>
      {/* The same wall on a phone, for a counter that is a person with a phone. */}
      <Phone src={phoneSell} width={190} alt="The sell wall on a phone, with one item in the cart" className="absolute left-[640px] top-[372px]" />
    </Slide>
  );
}

const PANELS = [
  { title: "A show", body: "The day, then a session with its seats left.", src: sheetShow, alt: "Planetarium Show: the day and the sessions, 40 seats each" },
  { title: "A cinema", body: "Seats on the map; each section prices itself.", src: sheetCinema, alt: "Evening Film: three seats chosen in the stalls" },
  { title: "A lane", body: "How long, which lane and when — or Start now.", src: sheetLane, alt: "Bowling Lane: start now, the duration and the lane" },
];

/* Three columns across the content width, a phone centred in each. */
const COLUMN = 1408 / 3;
const PHONE_W = 226;
const PHONE_TOP = 238;
const PHONE_H = 473;

export function PosChooseSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="One sheet asks only what the booking needs">
      <Glow className="left-[520px] top-[260px] h-[640px] w-[860px] opacity-50" />
      <TextBlock eyebrow="Go · 2 of 6 · Choose" title="One sheet asks only what the booking needs." width={1408} />
      {PANELS.map((p, i) => {
        const centre = 96 + COLUMN * i + COLUMN / 2;
        return (
          <div key={p.title}>
            <div className="absolute" style={{ left: centre - PHONE_W / 2, top: PHONE_TOP }}>
              <Phone src={p.src} alt={p.alt} bar={DIMMED} width={PHONE_W} />
            </div>
            <div className={cn(s.text, "text-center")} style={{ left: centre - 200, top: PHONE_TOP + PHONE_H + 22, width: 400 }}>
              <div className="flex items-center justify-center gap-3">
                <span aria-hidden className={s.stepNum}>
                  {i + 1}
                </span>
                <h3 className={s.heading}>{p.title}</h3>
              </div>
              <p className={cn(s.body, "mt-1.5")}>{p.body}</p>
            </div>
            {i < PANELS.length - 1 && (
              <div aria-hidden className="absolute flex items-center" style={{ left: centre + PHONE_W / 2 + 28, top: PHONE_TOP + PHONE_H / 2 - 20, width: COLUMN - PHONE_W - 56, height: 40 }}>
                <span className="h-px flex-1 border-t-2 border-dashed border-white/20" />
                <span className="mx-3 grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-[#f94a00] text-white shadow-[0_8px_20px_-6px_rgb(249_74_0/0.7)]">
                  <ArrowRight size={22} strokeWidth={2.2} />
                </span>
                <span className="h-px flex-1 border-t-2 border-dashed border-white/20" />
              </div>
            )}
          </div>
        );
      })}
    </Slide>
  );
}

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
        eyebrow="Go · 3 of 6 · Pay"
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
        {/* The payment picker as the cart draws it, cash chosen. */}
        <div role="list" aria-label="Payment methods" className="mt-10 inline-flex rounded-full bg-white/[0.06] p-1.5 ring-1 ring-inset ring-white/10">
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
      </TextBlock>
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

const OUTPUTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: TicketIcon, title: "Print tickets", body: "A stub per guest, with the code the gate scans." },
  { icon: Printer, title: "Print receipt", body: "Every line, the VAT and how it was paid." },
  { icon: MessageSquare, title: "Send SMS", body: "The reference, straight to the guest’s phone." },
];

/** The guest's side of the sale: the SMS arriving in their messages. */
function GuestMessages() {
  return (
    <div aria-hidden className="absolute inset-0 flex flex-col bg-white text-[#141413]">
      <div className="flex flex-col items-center border-b border-[#ececec] bg-[#f7f7f7] pb-2.5 pt-1.5">
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-gradient-to-b from-[#a6a6ab] to-[#8a8a8f] text-[12px] font-semibold text-white">LH</span>
        <span className="mt-1 text-[10px] font-medium">LALBAGH</span>
      </div>
      <p className="mt-3 text-center text-[9px] text-[#8a8a8e]">
        <span className="font-semibold">Text message</span> · Today 12:04
      </p>
      <div className="mx-2.5 mt-2 w-[84%] rounded-[16px] rounded-bl-[5px] bg-[#e9e9eb] px-3 py-2 text-[11.5px] leading-[1.38]">
        Your Lalbagh Heritage Attractions ticket <span className="font-semibold">{REFERENCE}</span> is confirmed for Wed 29 Jul. Show this SMS or the code at the gate. Thank you!
      </div>
      <div className="mt-auto flex items-center gap-2 px-2.5 pb-5 pt-2">
        <span className="grid h-[24px] w-[24px] place-items-center rounded-full bg-[#ececec] text-[15px] leading-none text-[#8a8a8e]">+</span>
        <span className="flex h-[26px] flex-1 items-center rounded-full border border-[#dcdcdc] px-2.5 text-[10px] text-[#b0b0b3]">Text Message</span>
      </div>
    </div>
  );
}

export function PosTicketSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="The ticket, printed or sent">
      <Glow className="left-[640px] top-[-240px] h-[860px] w-[900px]" />
      <TextBlock eyebrow="Go · 4 of 6 · Ticket" title="The ticket, printed or sent." lead="Every sale issues a reference the gate can scan — on paper, by SMS, or both.">
        <ul className="flex flex-col gap-6">
          {OUTPUTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-center gap-4">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[15px] bg-white/[0.07] text-[#ffa572] ring-1 ring-inset ring-white/10">
                <Icon size={23} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={cn(s.heading, "block text-[22px]")}>{title}</span>
                <span className={cn(s.body, "block")}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>
      {/* The till that issued it, the guest's phone that received it, and the stub printed between them. */}
      <Phone src={complete} width={262} alt={`Ticket issued: reservation reference ${REFERENCE}`} className="absolute left-[700px] top-[150px]" />
      <Phone bar="#f7f7f7" width={262} alt="" screen={<GuestMessages />} className="absolute left-[1196px] top-[92px]" />
      <Ticket
        word="ADMIT 1"
        kicker="General Admission"
        code={REFERENCE}
        width={430}
        tilt="perspective(1100px) rotateX(16deg) rotateY(-22deg) rotateZ(-9deg)"
        className="absolute left-[888px] top-[500px]"
      />
    </Slide>
  );
}

export function PosGateSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Checked in at the gate">
      <Glow className="left-[880px] top-[60px] h-[760px] w-[760px] opacity-60" />
      <TextBlock eyebrow="Go · 5 of 6 · Admit" title="Checked in at the gate." lead="Scan a ticket and the phone says who to let in — a family ticket lets the whole family in.">
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

const RECEIPT_LINES = [
  ["Opening float", "৳2,000.00"],
  ["Cash sales", "৳45,850.00"],
  ["Expected in drawer", "৳47,850.00"],
  ["Counted", "৳47,820.00"],
];

export function PosShiftSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Open with a PIN, close with a count">
      <Glow className="left-[980px] top-[300px] h-[700px] w-[700px] opacity-60" />
      <TextBlock eyebrow="Go · 6 of 6 · Shift" title="Open with a PIN. Close with a count." lead="Each cashier signs in as themselves, and the drawer is counted against what it should hold.">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Sign in with a PIN" body="Every sale is kept against the person who made it." />
          <Step n={2} title="Count at close" body="Expected against counted, in the drawer’s own currency." />
          <Step n={3} title="Square, or say why" body="Inside the tolerance it closes; further out, the cashier records a reason." />
        </ol>
      </TextBlock>

      <Phone src={pin} width={262} alt="Signing in to the till as Nadia Islam with a PIN, two digits entered" className="absolute left-[740px] top-[150px]">
        <Hotspot n={1} x={74} y={36.9} small />
      </Phone>

      <div className={cn(s.receipt, "absolute left-[1112px] top-[196px] w-[392px] rotate-[3deg]")}>
        <div className={s.receiptPaper}>
          <p className="text-[15px] font-medium uppercase tracking-[0.16em]">Shift close</p>
          <p className="mt-2 text-[15px] text-[#57534c]">Fort Main Gate · Fort iPad 1</p>
          <p className="text-[15px] text-[#57534c]">Nadia Islam · since 09:14</p>
          <div aria-hidden className={cn(s.perforation, "my-6 text-[#141413]")} />
          <dl className="flex flex-col gap-3.5">
            {RECEIPT_LINES.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-[16px]">
                <dt className="text-[#57534c]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div aria-hidden className={cn(s.perforation, "my-6 text-[#141413]")} />
          <div className="flex justify-between text-[21px] font-medium text-[#1d6b3a]">
            <span>Variance</span>
            <span>−৳30.00</span>
          </div>
          <p className="mt-3 text-[15px] text-[#57534c]">Within ৳100 — closed square</p>
        </div>
        {/* 2 on the count, 3 on the variance it produces — both on the receipt's edge, clear of its figures. */}
        <span className="absolute left-0 top-[46%]">
          <Hotspot n={2} x={0} y={0} />
        </span>
        <span className="absolute left-0 top-[77%]">
          <Hotspot n={3} x={0} y={0} />
        </span>
      </div>
    </Slide>
  );
}
