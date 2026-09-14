import { ArrowRight, Banknote, CreditCard, MessageSquare, Printer, QrCode, Send, Ticket as TicketIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Crop, Glow, Hotspot, Phone, Pill, Slide, Step, Tablet, TextBlock, Ticket, deckStyles as s } from "../_components/Parts";
import posTablet from "../_media/go-pos-tablet.jpg";
import sessions from "../_media/go-sheet-sessions.jpg";
import seats from "../_media/sheet-seats.jpg";
import bowling from "../_media/go-sheet-bowling.jpg";
import cart from "../_media/go-cart.jpg";
import cash from "../_media/go-cash.jpg";
import bkash from "../_media/go-bkash.jpg";
import complete from "../_media/go-complete.jpg";
import scanResult from "../_media/go-scan-result.jpg";
import checkin from "../_media/go-checkin.jpg";
import loginPin from "../_media/go-login-pin.jpg";

/*
 * Chapter 02 — Counterfoil Go, walked through the way a cashier works it.
 *
 * Ink is Go's ground. Devices face the reader flat, because a numbered point
 * has to land on the control it names. Every screen is from the till, captured
 * mid-sale.
 */

export const GO_SECTION = "02 · Counterfoil Go";

/** What a tile on the sell wall says, in the till's own words. */
const TILE_STATES = [
  { text: "Next 17:00 · 18 left", tone: "text-[rgb(245_242_235/0.86)]" },
  { text: "Limited · 3 of 20 left today", tone: "text-[#ffa572]" },
  { text: "Next Fri 31 Jul 10:00", tone: "text-[rgb(245_242_235/0.86)]" },
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
        <div className={cn(s.card, s.inkCard, "mt-8 px-6 py-5 [--card-r:20px]")}>
          <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">What a tile says</p>
          <ul className="mt-3 flex flex-col gap-2">
            {TILE_STATES.map(({ text, tone }) => (
              <li key={text} className={cn("flex items-center gap-3 text-[18px] font-medium", tone)}>
                <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-current" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </TextBlock>
      <Tablet src={posTablet} width={864} alt="Counterfoil Go on a tablet: the sell wall with a sale in the cart" className="absolute left-[640px] top-[170px]">
        <Hotspot n={1} x={63} y={11} />
        <Hotspot n={2} x={66} y={70} />
        <Hotspot n={3} x={94} y={72} />
      </Tablet>
    </Slide>
  );
}

/* Three sheets at one aspect (4 : 3), each cut on a row boundary. */
const PANELS = [
  {
    title: "A show",
    body: "Pick the day and the session; each one says how many seats are left.",
    crop: { src: sessions, alt: "Planetarium Show: today’s sessions, 40 seats each", x: 0, y: 0.466, w: 1, h: 0.3466 },
  },
  {
    title: "A cinema",
    body: "Pick the seats on the map; stalls and balcony price themselves.",
    crop: { src: seats, alt: "Evening Film: three seats chosen in the stalls", x: 0.02, y: 0.168, w: 0.96, h: 0.5315 },
  },
  {
    title: "A lane",
    body: "Say how long, which lane and when — or tap Start now.",
    crop: { src: bowling, alt: "Bowling Lane: the day, start now, duration and lane", x: 0.08, y: 0.124, w: 0.54, h: 0.6496 },
  },
];

export function PosChooseSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="One sheet asks only what the booking needs">
      <TextBlock eyebrow="Go · 2 of 6 · Choose" title="One sheet asks only what the booking needs." width={880} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        A show, a seat and a lane are different questions. Each gets its own.
      </p>
      <ol className="absolute left-[96px] top-[302px] grid w-[1408px] grid-cols-3 gap-11">
        {PANELS.map((p, i) => (
          <li key={p.title} className="relative">
            <Crop {...p.crop} width={440} />
            <div className="mt-6 flex gap-4">
              <span aria-hidden className={s.stepNum}>
                {i + 1}
              </span>
              <div className="min-w-0 pt-[3px]">
                <h3 className={s.heading}>{p.title}</h3>
                <p className={cn(s.body, "mt-1.5")}>{p.body}</p>
              </div>
            </div>
            {i < PANELS.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[462px] top-[145px] z-10 grid h-[40px] w-[40px] -translate-x-1/2 place-items-center rounded-full bg-[#f94a00] text-white shadow-[0_8px_20px_-6px_rgb(249_74_0/0.7)]"
              >
                <ArrowRight size={22} strokeWidth={2.2} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </Slide>
  );
}

export function PosPaySlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Take the money, however it comes">
      <Glow className="left-[760px] top-[420px] h-[640px] w-[860px] opacity-70" />
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
        <ul className="mt-8 flex gap-2.5">
          {[
            { icon: Banknote, label: "Cash" },
            { icon: Send, label: "bKash" },
            { icon: QrCode, label: "Bangla QR" },
            { icon: CreditCard, label: "Card" },
          ].map(({ icon: Icon, label }) => (
            <li key={label}>
              <Pill>
                <Icon size={17} strokeWidth={1.6} aria-hidden /> {label}
              </Pill>
            </li>
          ))}
        </ul>
      </TextBlock>
      <Phone src={cart} width={262} alt="The cart: General Admission and a yoga session, paying by cash" className="absolute left-[668px] top-[160px]">
        <Hotspot n={1} x={72} y={19} />
      </Phone>
      <Phone src={cash} width={262} alt="Cash: ৳1,725.00 due, exact cash received, no change" className="absolute left-[955px] top-[160px]">
        <Hotspot n={2} x={2} y={45} />
      </Phone>
      <Phone src={bkash} width={262} alt="bKash: the guest’s transaction ID entered before the payment is received" className="absolute left-[1242px] top-[160px]">
        <Hotspot n={3} x={2} y={53} />
      </Phone>
    </Slide>
  );
}

export function PosTicketSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="The ticket, printed or sent">
      <Glow className="left-[640px] top-[-240px] h-[860px] w-[900px]" />
      <TextBlock eyebrow="Go · 4 of 6 · Ticket" title="The ticket, printed or sent." lead="Every sale issues a reference the gate can scan — on paper, by SMS, or both.">
        <ul className="flex flex-wrap gap-2.5">
          {[
            { icon: TicketIcon, label: "Print tickets" },
            { icon: Printer, label: "Print receipt" },
            { icon: MessageSquare, label: "Send SMS" },
          ].map(({ icon: Icon, label }) => (
            <li key={label}>
              <Pill>
                <Icon size={17} strokeWidth={1.6} aria-hidden /> {label}
              </Pill>
            </li>
          ))}
        </ul>
        <div className="mt-9 w-[460px] rounded-[22px] rounded-bl-[6px] bg-white/[0.08] px-6 py-5 ring-1 ring-inset ring-white/12">
          <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">SMS to the guest</p>
          <p className="mt-2 text-[18px] leading-[1.45] text-[#f5f2eb]">
            Your Lalbagh Heritage Attractions ticket <span className="whitespace-nowrap">CF-2026-213912-01</span> is confirmed for Wed 29 Jul. Show this SMS or the code at the gate. Thank you!
          </p>
        </div>
      </TextBlock>
      <Phone src={complete} width={300} alt="Ticket issued: reservation reference CF-2026-213912-01" className="absolute left-[704px] top-[100px]" />
      {/* The printed ticket comes out over the empty half of the screen that issued it. */}
      <Ticket word="ADMIT 1" kicker="General Admission" code="CF-2026-213912-01" width={520} className="absolute left-[930px] top-[392px]" />
    </Slide>
  );
}

export function PosGateSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Checked in at the gate">
      <Glow className="left-[980px] top-[80px] h-[720px] w-[700px] opacity-60" />
      <TextBlock eyebrow="Go · 5 of 6 · Admit" title="Checked in at the gate." lead="Scan a ticket and the phone says who to let in — a family ticket lets the whole family in.">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Scan" body="A used ticket is refused, and says why." />
          <Step n={2} title="Check in by session" body="Each session keeps its own count: 3/3 in." />
          <Step n={3} title="Settle first" body="A balance still owed is taken before anyone goes in." />
        </ol>
      </TextBlock>

      <div className="absolute left-[664px] top-[176px]">
        <Crop src={checkin} alt="Check-in by session: Sculpture Garden 3 of 3 in, then cricket, bowling and futsal" x={0.27} y={0.085} w={0.53} h={0.605} width={556} />
        {/* On the row, just short of its count, so it never crowds the phone's own point. */}
        <Hotspot n={2} x={81} y={31.5} />
      </div>

      <div className={cn(s.card, s.paperCard, "absolute left-[664px] top-[597px] flex h-[203px] w-[556px] flex-col justify-between px-7 py-6 text-[#141413]")}>
        <div>
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-[#aa3000]">Settle first</p>
          <p className="mt-2 text-[22px] font-semibold tracking-[-0.015em]">Balance due on arrival</p>
          <p className="mt-1 text-[17px] text-[#57534c]">One arrival today still owes ৳1,437.50.</p>
        </div>
        <div className="flex items-center gap-16">
          {/* 19px bold is large text, so white on ember clears its 3 : 1 floor. */}
          <span className="rounded-full bg-[#f94a00] px-5 py-2 text-[19px] font-bold text-white">Take balance</span>
          <span className="text-[16px] text-[#57534c]">then check in</span>
        </div>
        {/* In the gap after the button, level with it — clear of its label and the sentence above. */}
        <Hotspot n={3} x={36} y={68} />
      </div>

      <Phone src={scanResult} width={264} alt="A scanned ticket refused at the gate: already redeemed" className="absolute left-[1240px] top-[196px]">
        <Hotspot n={1} x={19} y={26} />
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

      <div className="absolute left-[664px] top-[176px] w-[400px]">
        <Crop src={loginPin} alt="Signing in to the till as Nadia Islam with a PIN" x={0.38} y={0.18} w={0.31} h={0.65} width={400} />
        <span className="absolute left-[-14px] top-[-14px]">
          <Hotspot n={1} x={0} y={0} />
        </span>
      </div>

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
        <span className="absolute left-[-18px] top-[46%]">
          <Hotspot n={2} x={0} y={0} />
        </span>
      </div>
    </Slide>
  );
}
