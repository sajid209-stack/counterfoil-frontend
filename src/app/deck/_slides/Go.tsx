import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight, Banknote, Check, CreditCard, KeyRound, MousePointerClick, Printer, QrCode, ScanLine, Search, Send, Ticket as TicketIcon, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Glow, Hotspot, Phone, PosStand, Slide, Step, TextBlock, deckStyles as s, type ChapterPart } from "../_components/Parts";
import till from "../_media/go-till.jpg";
import phoneSell from "../_media/go-phone-sell.jpg";
import sheetShow from "../_media/go-sheet-show.jpg";
import sheetCinema from "../_media/go-sheet-cinema.jpg";
import sheetLane from "../_media/go-sheet-lane.jpg";
import cart from "../_media/go-cart.jpg";
import cash from "../_media/go-cash.jpg";
import bkash from "../_media/go-bkash.jpg";
import complete from "../_media/go-complete.jpg";
import send from "../_media/go-send.jpg";
import ticketReceipt from "../_media/go-ticket-receipt.jpg";
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

export const GO_SECTION = "Counterfoil Go";

/** The parts of chapter 02, each with the icon of what the cashier does. */
export const GO_CONTENTS: ChapterPart[] = [
  { name: "Find", icon: Search },
  { name: "Choose", icon: MousePointerClick },
  { name: "Pay", icon: Banknote },
  { name: "Ticket", icon: TicketIcon },
  { name: "Admit", icon: ScanLine },
  { name: "Shift", icon: KeyRound },
];

/** Behind a sheet the page is dimmed, so the phone's status bar takes that grey rather than paper. */
const DIMMED = "#999894";


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
      <TextBlock eyebrow="Go · Find" title="Find it in a tap." lead="The sell wall shows what is on sale — and how much of it is left.">
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
      <PosStand src={till} width={676} alt="Counterfoil Go on a countertop stand: the sell wall with a sale in the cart" className="absolute left-[828px] top-[172px]">
        <Hotspot n={1} x={60} y={12.8} />
        <Hotspot n={2} x={34} y={61} />
        <Hotspot n={3} x={74.6} y={13.8} />
      </PosStand>
      {/* The same wall on a phone, for a counter that is a person with a phone — clear of the tiles, over the stand's edge rather than its screen. */}
      <Phone src={phoneSell} width={186} alt="The sell wall on a phone, with one item in the cart" className="absolute left-[676px] top-[400px]" />
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
const PHONE_W = 222;
const PHONE_TOP = 236;
const PHONE_H = 465;

export function PosChooseSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="One sheet asks only what the booking needs">
      <Glow className="left-[520px] top-[260px] h-[640px] w-[860px] opacity-50" />
      <TextBlock eyebrow="Go · Choose" title="One sheet asks only what the booking needs." width={1408} />
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

const OUTPUTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Printer, title: "Print", body: "The receipt and every ticket on one strip, with a QR per guest." },
  { icon: Send, title: "Send", body: "SMS, email or both — the cashier sees the exact message first." },
  { icon: QrCode, title: "Show", body: "Tap a ticket for a code big enough for the guest to photograph." },
];

export function PosTicketSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="The ticket, the moment the money lands">
      <Glow className="left-[640px] top-[-240px] h-[860px] w-[900px]" />
      <TextBlock
        eyebrow="Go · Ticket"
        title={
          <>
            The ticket, the moment
            <br />
            the money lands.
          </>
        }
        lead="One sale issues a code the gate can scan — and three ways to put it in the guest’s hand."
        width={540}
      >
        <ul className="flex flex-col gap-6">
          {OUTPUTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[15px] bg-white/[0.07] text-[#ffa572] ring-1 ring-inset ring-white/10">
                <Icon size={23} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className={cn(s.heading, "block text-[22px]")}>{title}</span>
                <span className={cn(s.body, "mt-1 block")}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>

      {/* The screen that issues it, the message the guest gets, and the paper it prints on. */}
      <Phone src={complete} width={262} alt="Sale complete: one ticket issued, with print and send groups and the ticket's QR code" className="absolute left-[684px] top-[188px]" />
      <Phone src={send} bar={DIMMED} width={262} alt="The send dialog: the SMS and the email the guest will receive, before it is sent" className="absolute left-[972px] top-[132px]" />
      <div aria-hidden className="absolute left-[1250px] top-[236px] w-[240px] rotate-[4deg] overflow-hidden rounded-[20px] shadow-[0_40px_70px_-30px_rgb(0_0_0/0.85)]">
        <Image src={ticketReceipt} alt="" sizes="240px" placeholder="blur" className="block w-full" />
      </div>
      <p className={cn(s.mono, "absolute left-[1250px] top-[726px] w-[240px] text-center uppercase text-[rgb(245_242_235/0.64)]")}>Printed in one strip</p>
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
      <TextBlock eyebrow="Go · Shift" title="Open with a PIN. Close with a count." lead="Each cashier signs in as themselves, and the drawer is counted against what it should hold.">
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Sign in with a PIN" body="Every sale is kept against the person who made it." />
          <Step n={2} title="Count at close" body="Expected against counted, in the drawer’s own currency." />
          <Step n={3} title="Square, or say why" body="Inside the tolerance it closes; further out, the cashier records a reason." />
        </ol>
      </TextBlock>

      <Phone src={pin} width={262} alt="Signing in to the till as Nadia Islam with a PIN, two digits entered" className="absolute left-[740px] top-[150px]">
        <Hotspot n={1} x={74} y={36.9} small />
      </Phone>

      <div className={cn(s.receipt, "absolute left-[1100px] top-[196px] w-[392px] rotate-[3deg]")}>
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

/*
 * Why the till is shaped the way it is. The measurements are the product's own
 * floors, and the two facts in the lead are what POS research reports about the
 * people who use one: a cashier taps about twice as fast as an everyday user,
 * from roughly 80cm away, all day, for years.
 */
const CRAFT: { title: string; body: string; note: string; art: ReactNode }[] = [
  {
    title: "Two taps to a sale",
    body: "Tap the tile, tap Add. Nothing stands between a cashier and the money.",
    note: "Two taps, no dialogs",
    art: (
      <div className="flex items-center gap-2">
        {["Tile", "Sheet", "Charge"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "grid h-[52px] place-items-center rounded-[12px]",
                /* White on ember is the house rule; at 19px bold it is large text, where the floor is 3:1. */
                i === 2 ? "w-[92px] bg-[#f94a00] text-[19px] font-bold text-white" : "w-[62px] bg-white text-[14px] font-semibold text-[#141413]",
              )}
            >
              {step}
            </span>
            {i < 2 && <ArrowRight size={16} strokeWidth={2.4} className="text-[rgb(245_242_235/0.5)]" aria-hidden />}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "48px, never smaller",
    body: "Every control a thumb has to hit is at least 48px, on a phone and on the counter tablet.",
    note: "44px is the floor app-wide",
    art: (
      <div className="flex items-center gap-4">
        <span className="flex h-[48px] items-center rounded-full bg-[#f94a00] px-6 text-[19px] font-bold text-white">Charge</span>
        {/* The measurement, drawn as a dimension line. */}
        <span aria-hidden className="relative flex h-[48px] w-[34px] items-center justify-center">
          <span className="absolute inset-y-0 left-[6px] w-px bg-[rgb(245_242_235/0.45)]" />
          <span className="absolute left-[2px] top-0 h-px w-[9px] bg-[rgb(245_242_235/0.45)]" />
          <span className="absolute bottom-0 left-[2px] h-px w-[9px] bg-[rgb(245_242_235/0.45)]" />
          <span className="ml-3 font-mono text-[13px] text-[rgb(245_242_235/0.7)]">48</span>
        </span>
      </div>
    ),
  },
  {
    title: "Read at arm’s length",
    body: "The price is the biggest thing on a tile, and nothing in a sheet goes under 13px.",
    note: "About 80cm from the eye",
    art: (
      <div className="w-[196px] rounded-[14px] bg-white p-3.5 text-[#141413]">
        <p className="text-[15px] font-semibold leading-tight">Yoga Session</p>
        <p className="mt-1 text-[20px] font-bold leading-none tabular-nums text-[#b83600]">৳500</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#57534c]">
          <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#f94a00]" />3 of 20 left today
        </p>
      </div>
    ),
  },
  {
    title: "Never colour alone",
    body: "A refusal is a shape, a texture and a sentence — legible across a gate in daylight.",
    note: "Shape, texture, words",
    art: (
      <div className="w-[214px] overflow-hidden rounded-[14px] bg-white text-[#141413]">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: "repeating-linear-gradient(135deg,#f6d3ce 0 7px,#fbe9e6 7px 14px)" }}>
          <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full bg-[#a1302a] text-white">
            <X size={14} strokeWidth={3} aria-hidden />
          </span>
          <span className="text-[15px] font-bold uppercase tracking-[0.06em] text-[#a1302a]">Refused</span>
        </div>
        <p className="px-3.5 py-2.5 text-[13px] leading-snug text-[#57534c]">Already admitted at 11:04</p>
      </div>
    ),
  },
];

export function CounterCraftSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={GO_SECTION} label="Built for the hand that is in a hurry">
      <Glow className="left-[420px] top-[300px] h-[700px] w-[900px] opacity-45" />
      <TextBlock eyebrow="Go · Designed for the counter" title="Built for the hand that’s in a hurry." width={860} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        A cashier taps about twice as fast as anyone else, from an arm’s length away, in front of a queue. Every rule in the till follows from that.
      </p>
      <ul className="absolute left-[96px] top-[300px] grid h-[452px] w-[1408px] grid-cols-4 gap-6">
        {CRAFT.map(({ title, body, note, art }) => (
          <li key={title} className={cn(s.card, s.inkCard, "flex flex-col p-7 [--card-r:20px]")}>
            <div className="grid h-[164px] shrink-0 place-items-center rounded-[16px] bg-black/25 ring-1 ring-inset ring-white/[0.07]">{art}</div>
            <h3 className={cn(s.heading, "mt-6")}>{title}</h3>
            <p className={cn(s.body, "mt-2")}>{body}</p>
            <p className="mt-auto flex items-center gap-2 pt-5 font-mono text-[13px] uppercase leading-tight tracking-[0.1em] text-[#ffa572]">
              <Check size={14} strokeWidth={2.6} className="shrink-0" aria-hidden />
              {note}
            </p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}
