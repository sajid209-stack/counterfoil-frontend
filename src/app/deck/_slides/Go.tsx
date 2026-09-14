import { ArrowRight, Banknote, CreditCard, MessageSquare, Printer, QrCode, Send, Ticket as TicketIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Callout, Crop, Glow, Hotspot, Phone, Pill, Slide, Step, Tablet, Ticket, deckStyles as s } from "../_components/Parts";
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
import shiftClose from "../_media/go-shift-close.jpg";

/*
 * Chapter 02 — Counterfoil Go, walked through the way a cashier works it.
 *
 * Ink is Go's ground. Devices face the reader flat here — a walkthrough points
 * at things, and a numbered point has to land on the control it names. Every
 * step is a real screen from the till, captured mid-sale.
 */

const SCREENS = "relative mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none";

function Intro({ eyebrow, title, lead, className }: { eyebrow: string; title: string; lead?: string; className?: string }) {
  return (
    <div className={className}>
      <p className={s.eyebrow}>{eyebrow}</p>
      <h2 className={cn(s.title, "mt-[max(10px,1.4cqw)]")}>{title}</h2>
      {lead && <p className={cn(s.lead, "mt-[max(10px,1.6cqw)]")}>{lead}</p>}
    </div>
  );
}

export function PosFindSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil Go" label="Find it in a tap">
      <Glow className="right-[0%] top-[-40%] h-[90%] w-[60%] opacity-70" />
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-[2cqw]">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Go · 1 of 5 · Find" title="Find it in a tap." lead="The sell wall shows what is on sale — and how much of it is left." />
          <ol className="flex flex-col gap-[max(14px,1.4cqw)]">
            <Step n={1} title="Search or pick a category" body="Admission, guided tours, events." />
            <Step n={2} title="Read the tile" body="Price, and what is left: “Next 17:00 · 18 left”." />
            <Step n={3} title="The cart stays beside it" body="Every line, the payment method and Charge." />
          </ol>
        </div>
        <div className={cn(SCREENS, "flex items-center xl:col-span-8")}>
          <div className="relative w-full">
            <Tablet src={posTablet} alt="Counterfoil Go on a tablet: the sell wall with a sale in the cart" tilt="none" />
            <Hotspot n={1} className="left-[63%] top-[11%]" />
            <Hotspot n={2} className="left-[66%] top-[70%]" />
            <Hotspot n={3} className="left-[94%] top-[72%]" />
          </div>
        </div>
      </div>
    </Slide>
  );
}

const PANELS = [
  {
    title: "A show",
    body: "Pick the day and the session; each one says how many seats are left.",
    render: (
      <Crop src={sessions} alt="Planetarium Show: sessions for today with 40 seats each" x={0} y={0.47} w={1} h={0.38} className="w-full" />
    ),
  },
  {
    title: "A cinema",
    body: "Pick the seats on the map; stalls and balcony price themselves.",
    render: <Crop src={seats} alt="Evening Film: three seats chosen in the stalls" x={0} y={0.16} w={1} h={0.59} className="w-full" />,
  },
  {
    title: "A lane",
    body: "Say how long, which lane and when — or tap Start now.",
    render: (
      <Crop src={bowling} alt="Bowling Lane: start now, duration, lane and start time" x={0.075} y={0.14} w={0.55} h={0.727} className="w-full" />
    ),
  },
];

export function PosChooseSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil Go" label="One sheet asks only what the booking needs">
      <div className="flex h-full flex-col gap-[max(18px,2cqw)]">
        <div className="grid gap-6 xl:grid-cols-12 xl:items-end">
          <Intro eyebrow="Go · 2 of 5 · Choose" title="One sheet asks only what the booking needs." className="xl:col-span-8" />
          <p className={cn(s.lead, "xl:col-span-4")}>A show, a seat and a lane are different questions. Each gets its own.</p>
        </div>
        <ol className="grid flex-1 gap-[max(20px,2.2cqw)] sm:grid-cols-3">
          {PANELS.map((p, i) => (
            <li key={p.title} className="relative flex min-h-0 flex-col gap-[max(12px,1.2cqw)]">
              <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[max(14px,1.4cqw)] sm:max-w-none xl:min-h-0">{p.render}</div>
              <div className="flex gap-[max(10px,0.9cqw)]">
                <span aria-hidden className={s.stepNum}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className={s.heading}>{p.title}</h3>
                  <p className={cn(s.body, "mt-[max(4px,0.3cqw)]")}>{p.body}</p>
                </div>
              </div>
              {i < PANELS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute right-[calc(-1*max(20px,2.2cqw)/2)] top-[34%] z-10 hidden h-[max(28px,2.4cqw)] w-[max(28px,2.4cqw)] translate-x-1/2 place-items-center rounded-full bg-[#f94a00] text-white shadow-[0_8px_20px_-6px_rgb(249_74_0/0.7)] sm:grid"
                >
                  <ArrowRight className="h-[55%] w-[55%]" strokeWidth={2.2} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </Slide>
  );
}

export function PosPaySlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil Go" label="Take the money, however it comes">
      <Glow className="bottom-[-40%] right-[10%] h-[90%] w-[55%] opacity-70" />
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-[2cqw]">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Go · 3 of 5 · Pay" title="Take the money, however it comes." />
          <ol className="flex flex-col gap-[max(14px,1.4cqw)]">
            <Step n={1} title="Check the cart" body="Change a quantity, add a discount, park it for later." />
            <Step n={2} title="Cash" body="Tap Exact or a note; the change is worked out." />
            <Step n={3} title="bKash or Bangla QR" body="Confirmed with the transaction ID before the sale lands." />
          </ol>
          <div className="flex flex-wrap gap-[max(6px,0.6cqw)]">
            <Pill>
              <Banknote className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Cash
            </Pill>
            <Pill>
              <Send className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> bKash
            </Pill>
            <Pill>
              <QrCode className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Bangla QR
            </Pill>
            <Pill>
              <CreditCard className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Card
            </Pill>
          </div>
        </div>
        <div className={cn(SCREENS, "grid grid-cols-2 items-start gap-x-4 gap-y-6 sm:block sm:min-h-[640px] xl:col-span-8 xl:min-h-0")}>
          <div className="relative sm:absolute sm:left-[2%] sm:top-[10%] sm:w-[33%] xl:left-[4%] xl:top-[12%] xl:w-[30%]">
            <Phone src={cart} alt="The cart: General Admission and a yoga session, paying by cash" tilt="none" />
            <Hotspot n={1} className="left-[70%] top-[20%]" />
          </div>
          <div className="relative sm:absolute sm:left-[36%] sm:top-[0%] sm:w-[33%] xl:left-[34%] xl:top-[2%] xl:w-[30%]">
            <Phone src={cash} alt="Cash: ৳1,725.00 due, exact cash received, no change" tilt="none" />
            <Hotspot n={2} className="left-[-8%] top-[48%]" />
          </div>
          <div className="relative col-span-2 mx-auto w-[86%] sm:absolute sm:bottom-[0%] sm:right-[0%] sm:mx-0 sm:w-[40%] xl:bottom-[14%] xl:right-[1%] xl:w-[34%]">
            <Crop src={bkash} alt="bKash payment: enter the transaction ID from the guest’s SMS" x={0.04} y={0.33} w={0.92} h={0.34} />
            <Hotspot n={3} className="left-[-4%] top-[-10%]" />
          </div>
        </div>
      </div>
    </Slide>
  );
}

export function PosTicketSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil Go" label="The ticket, printed or sent">
      <Glow className="left-[30%] top-[-30%] h-[100%] w-[60%]" />
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Go · 4 of 5 · Ticket" title="The ticket, printed or sent." lead="Every sale issues a reference the gate can scan — on paper, by SMS, or both." />
          <div className="flex flex-wrap gap-[max(6px,0.6cqw)]">
            <Pill>
              <TicketIcon className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Print tickets
            </Pill>
            <Pill>
              <Printer className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Print receipt
            </Pill>
            <Pill>
              <MessageSquare className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Send SMS
            </Pill>
          </div>
        </div>
        <div className={cn(SCREENS, "min-h-[300px] sm:min-h-[560px] xl:col-span-8 xl:min-h-0")}>
          <div className="absolute left-[4%] top-[4%] w-[36%] xl:left-[8%] xl:top-[4%] xl:w-[30%]">
            <Phone src={complete} alt="Ticket issued: reservation reference CF-2026-213912-01" tilt="none" />
          </div>
          <Ticket
            word="ADMIT 1"
            kicker="General Admission"
            code="CF-2026-213912-01"
            className={cn(s.float, "absolute right-[-2%] top-[18%] w-[64%] xl:right-[2%] xl:top-[22%] xl:w-[56%]")}
          />
          <Callout tone="ink" label="SMS to the guest" value="Your ticket: CF-2026-213912-01" className="absolute bottom-[6%] right-[6%] hidden sm:flex" />
        </div>
      </div>
    </Slide>
  );
}

export function PosGateSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil Go" label="Checked in at the gate">
      <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-[2cqw]">
        <div className="flex flex-col justify-between gap-8 xl:col-span-4">
          <Intro eyebrow="Go · 5 of 5 · Admit" title="Checked in at the gate." lead="Scan a ticket and the phone says who to let in — a family ticket lets the whole family in." />
          <ol className="flex flex-col gap-[max(14px,1.4cqw)]">
            <Step n={1} title="Scan" body="A used ticket is refused, and says why." />
            <Step n={2} title="Check in by session" body="Each session keeps its own count: 3/3 in." />
            <Step n={3} title="Settle first" body="A balance still owed is taken before anyone goes in." />
          </ol>
        </div>
        <div className={cn(SCREENS, "min-h-[380px] sm:min-h-[520px] xl:col-span-8 xl:min-h-0")}>
          <div className="w-[86%] xl:absolute xl:left-[0%] xl:top-[8%] xl:w-[84%]">
            <Tablet src={checkin} alt="Check-in by session: Sculpture Garden 3 of 3 in" tilt="none" />
          </div>
          <div className="absolute bottom-[-2%] right-[0%] w-[30%] xl:bottom-[2%] xl:right-[0%] xl:w-[25%]">
            <Phone src={scanResult} alt="A scanned ticket and its result at the gate" tilt="none" />
            <Hotspot n={1} className="left-[-8%] top-[27%]" />
          </div>
        </div>
      </div>
    </Slide>
  );
}

export function PosShiftSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} size="half" section="Counterfoil Go" label="Open with a PIN, close with a count">
      <div className="relative grid h-full items-center gap-8 xl:grid-cols-12 xl:gap-[2.2cqw]">
        <Intro
          eyebrow="Every shift"
          title="Open with a PIN. Close with a count."
          lead="Each cashier signs in with their own PIN; the drawer is counted against what it should hold."
          className="xl:col-span-5"
        />
        <div className="xl:col-span-3">
          <Crop src={loginPin} alt="Signing in to the till as Nadia Islam with a PIN" x={0.39} y={0.25} w={0.29} h={0.47} tone="paper" className="mx-auto w-[60%] sm:w-[44%] xl:w-full" />
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-[max(10px,1cqw)] xl:col-span-4 xl:max-w-none">
          <Crop src={shiftClose} alt="Closing the drawer: expected ৳47,850.00, counted ৳47,820.00, variance −৳30.00" x={0.03} y={0.255} w={0.94} h={0.18} className="w-full" />
          <p className={s.body}>Inside the tolerance set in Payments, it closes as square. Further out, the cashier says why.</p>
        </div>
      </div>
    </Slide>
  );
}

