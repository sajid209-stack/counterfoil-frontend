import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Armchair,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  Coins,
  Compass,
  DoorOpen,
  GraduationCap,
  Hourglass,
  LandPlot,
  ListOrdered,
  Lock,
  Package,
  Receipt,
  ShieldCheck,
  Store,
  Ticket as TicketIcon,
  Timer,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  BrowserCard,
  Callout,
  Floor,
  Glow,
  Laptop,
  Phone,
  Pill,
  SheetCard,
  Slide,
  Tablet,
  Ticket,
  deckStyles as s,
} from "./_components/Parts";
import logoOnPaper from "./_media/logo-counterfoil.png";
import logoOnInk from "./_media/logo-counterfoil-dark.png";
import dashDark from "./_media/os-dashboard-dark.jpg";
import dashLight from "./_media/os-dashboard-light.jpg";
import reportsDark from "./_media/os-reports-dark.jpg";
import calendarLight from "./_media/os-calendar-light.jpg";
import posTablet from "./_media/go-pos-tablet.jpg";
import posPhoneBn from "./_media/go-pos-phone-bn.jpg";
import phoneSeats from "./_media/go-sheet-seats.jpg";
import sheetSeats from "./_media/sheet-seats.jpg";
import sheetSlots from "./_media/sheet-slots.jpg";
import webConcert from "./_media/web-event.jpg";
import webSummit from "./_media/web-event-2.jpg";

export const metadata = { title: "Counterfoil Deck" };

const WAYS: { icon: LucideIcon; name: string; hint: string }[] = [
  { icon: DoorOpen, name: "Open entry", hint: "Walk in, any time" },
  { icon: CalendarRange, name: "Date passes", hint: "A day, a week, a season" },
  { icon: Clock, name: "Timed sessions", hint: "A show every 45 minutes" },
  { icon: LandPlot, name: "Courts & fields", hint: "Hourly slots per resource" },
  { icon: Timer, name: "Flexible duration", hint: "A lane by the hour" },
  { icon: Hourglass, name: "Daily capacity", hint: "200 a day, any time" },
  { icon: Compass, name: "Guided tours", hint: "Only when a guide is free" },
  { icon: UserRound, name: "Appointments", hint: "A therapist and a time" },
  { icon: GraduationCap, name: "Courses", hint: "Eight sessions, one sale" },
  { icon: Coins, name: "Credit packs", hint: "Ten classes, used over time" },
  { icon: Package, name: "Bundles", hint: "Three attractions, one price" },
  { icon: ListOrdered, name: "Waitlists", hint: "When a session is full" },
  { icon: TicketIcon, name: "Quick passes", hint: "Parking by the plate" },
];

const STEPS: { n: string; name: string; body: string; art: "grid" | "tags" | "scan" | "bars" }[] = [
  { n: "01", name: "Set up", body: "Locations, counters, what you sell, its prices and its tax.", art: "grid" },
  { n: "02", name: "Sell", body: "At the till or online — bKash, Bangla QR, card or cash.", art: "tags" },
  { n: "03", name: "Admit", body: "Scan at the gate. A family ticket lets the whole family in.", art: "scan" },
  { n: "04", name: "Reconcile", body: "Count the drawer, close the shift, read the day by the hour.", art: "bars" },
];

/** Each step drawn as the thing it produces — a grid set up, a price, a scan, a day's bars. */
function StepArt({ art }: { art: (typeof STEPS)[number]["art"] }) {
  if (art === "grid") {
    return (
      <div className="mx-auto grid h-full w-[74%] grid-cols-4 content-center gap-[max(6px,0.6cqw)]">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[0.5cqw]",
              i === 5 ? "bg-[#f94a00] shadow-[0_8px_18px_-6px_rgb(249_74_0/0.6)]" : i % 3 === 0 ? "bg-[#ffd3b8]" : "bg-white shadow-[0_1px_2px_rgb(20_20_19/0.06)]",
            )}
          />
        ))}
      </div>
    );
  }
  if (art === "tags") {
    return (
      <div className="flex h-full w-[84%] flex-col justify-center gap-[max(6px,0.7cqw)]">
        {[
          { method: "bKash", price: "৳500" },
          { method: "QR", price: "৳1,500" },
          { method: "Cash", price: "৳800" },
        ].map(({ method, price }, i) => (
          <span
            key={method}
            className={cn(
              "flex items-center justify-between gap-[max(8px,1.2cqw)] rounded-full px-[max(10px,1.1cqw)] py-[max(6px,0.6cqw)] text-[max(12px,0.95cqw)] font-semibold shadow-[0_1px_2px_rgb(20_20_19/0.06)]",
              i === 0 ? "bg-[#141413] text-[#f5f2eb]" : "bg-white text-[#3f3b35]",
            )}
            style={{ marginLeft: `${i * 1.4}cqw` }}
          >
            <span className="font-mono tracking-wide">{method}</span>
            {price}
          </span>
        ))}
      </div>
    );
  }
  if (art === "scan") {
    return (
      <div className="relative mx-auto aspect-square h-[82%]">
        {[
          "left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[1.2cqw]",
          "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[1.2cqw]",
          "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[1.2cqw]",
          "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-[1.2cqw]",
        ].map((c) => (
          <span key={c} className={cn("absolute h-[30%] w-[30%] border-[#141413]", c)} />
        ))}
        <span className="absolute inset-x-[12%] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#f94a00] shadow-[0_0_18px_2px_rgb(249_74_0/0.6)]" />
        <span className="absolute left-1/2 top-1/2 flex h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_10px_24px_-10px_rgb(20_20_19/0.35)]">
          <Check className="h-[55%] w-[55%] text-[#1f9d55]" strokeWidth={2.5} aria-hidden />
        </span>
      </div>
    );
  }
  return (
    <div className="mx-auto flex h-[78%] w-[80%] items-end gap-[max(6px,0.7cqw)] self-center">
      {[38, 62, 46, 80, 56, 100].map((h, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-t-[0.5cqw]", i === 5 ? "bg-[#f94a00] shadow-[0_8px_18px_-6px_rgb(249_74_0/0.6)]" : "bg-white shadow-[0_1px_2px_rgb(20_20_19/0.06)]")}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Counterfoil Deck — the company, in twelve slides.
 *
 * Not interactive: a deck to read top to bottom, or to screenshot a slide from.
 * Deliberately outside the OS shell, the same way `/pos` and `/tills` are, so
 * the sidebar's ↗ tells the truth about leaving the admin app.
 *
 * What it shows is real: the screens are this product's own, captured from the
 * app; the figures are the ones in the project record — around twenty
 * operators, four countries, fourteen booking types, two languages. A company
 * deck that invents a market statistic teaches its reader to doubt the rest.
 *
 * The rules it keeps, from how the decks worth copying are built: paper by
 * default with ink slides as breaks, one ember focal point a slide, one device
 * composition a slide at one angle, at most two pieces of UI lifted out of it,
 * and headlines short enough to read at a glance.
 */
export default function DeckPage() {
  return (
    <main className={s.stage}>
      <header className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Image src={logoOnPaper} alt="Counterfoil" className="h-7 w-auto" priority sizes="160px" />
          <span aria-hidden className="h-5 w-px bg-[#cfc9bd]" />
          <h1 className="truncate text-sm font-semibold tracking-tight text-[#22211f]">Counterfoil Deck</h1>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 font-mono text-[13px] text-[#57534c] transition-colors hover:text-[#aa3000]"
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden /> Dashboard
        </Link>
      </header>

      <div className="mx-auto flex max-w-[1320px] flex-col gap-[clamp(20px,2.8vw,44px)] px-4 pb-24 sm:px-8">
        {/* 01 — Cover ───────────────────────────────────────────────────── */}
        <Slide tone="ink" n={1} section="Counterfoil" label="Counterfoil runs the places that sell time">
          <Glow className="right-[-12%] top-[-35%] h-[95%] w-[70%]" />
          <Floor />
          <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
            <div className="flex flex-col justify-between gap-10 xl:col-span-5">
              <div className="flex items-center gap-[max(8px,1.2cqw)]">
                <Image src={logoOnInk} alt="Counterfoil" className="h-[max(24px,2.2cqw)] w-auto" sizes="220px" />
                <span className={cn(s.eyebrow, "hidden sm:inline")}>Company deck · 2026</span>
              </div>
              <div>
                <h2 className={s.display}>
                  Counterfoil runs the places that sell <span className={s.accentInk}>time.</span>
                </h2>
                <p className={cn(s.lead, "mt-[max(8px,1.8cqw)] max-w-[34ch]")}>
                  Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close.
                </p>
              </div>
              <div className="flex flex-wrap gap-[max(6px,0.6cqw)]">
                <Pill>Timed entry</Pill>
                <Pill>Courts & lanes</Pill>
                <Pill>Tours</Pill>
                <Pill>Seat maps</Pill>
              </div>
            </div>
            <div className="relative min-h-[260px] sm:min-h-[380px] mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none xl:col-span-7 xl:min-h-0">
              <div className="xl:absolute xl:right-[-9%] xl:top-[6%] xl:w-[104%]">
                <Laptop src={dashDark} alt="Counterfoil OS dashboard with revenue, capacity and what needs attention" priority />
              </div>
              <div className="relative -mt-[18%] ml-[-2%] w-[58%] xl:absolute xl:bottom-[-4%] xl:left-[-8%] xl:mt-0 xl:w-[50%]">
                <Tablet src={posTablet} alt="Counterfoil Go point of sale on a tablet with a sale in the cart" tilt="left" priority />
              </div>
              <Ticket className={cn(s.float, "absolute right-[-2%] top-[-6%] w-[28%] xl:right-[-3%] xl:top-[-2%] xl:w-[22%]")} />
            </div>
          </div>
        </Slide>

        {/* 02 — The problem ─────────────────────────────────────────────── */}
        <Slide tone="ink" n={2} section="The problem" label="Venues sell time with tools built for shelves">
          <div className="grid h-full gap-[max(8px,2cqw)] xl:grid-cols-12">
            <div className="flex flex-col justify-between gap-8 xl:col-span-4">
              <div>
                <p className={s.eyebrow}>The problem</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>Venues sell time with tools built for shelves.</h2>
              </div>
              <div className="flex flex-col gap-[max(8px,1cqw)]">
                <p className={s.heading}>A retail till knows a product. It doesn’t know 18:00.</p>
                <p className={s.body}>A court sold twice. A tour with no guide. A ticket nobody at the gate can check.</p>
              </div>
            </div>
            <div className={cn(s.card, s.emberCard, "flex min-h-[420px] flex-col justify-between p-[max(16px,2.6cqw)] xl:col-span-4 xl:min-h-0")}>
              <span className={cn(s.iconChip, "bg-white/20")}>
                <Store className="h-[46%] w-[46%]" strokeWidth={1.6} aria-hidden />
              </span>
              <div>
                <p className="text-[clamp(40px,4.6cqw,74px)] font-semibold leading-[0.95] tracking-[-0.045em]">“Is 18:00 still free?”</p>
                <p className="mt-[max(8px,1.4cqw)] text-[clamp(15px,1.25cqw,19px)] leading-snug text-white">
                  Asked at every counter, every day — and answered by a spreadsheet, a WhatsApp group and a guess.
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-white px-[max(10px,1.1cqw)] py-[max(6px,0.55cqw)] font-mono text-[max(12px,0.85cqw)] font-medium uppercase tracking-[0.12em] text-[#6f2000]">
                At the counter
              </span>
            </div>
            <div className={cn(s.card, s.inkCard, "relative flex min-h-[440px] flex-col p-[max(16px,2.6cqw)] xl:col-span-4 xl:min-h-0")}>
              <p className={cn(s.heading, "relative z-10 max-w-[19ch]")}>
                Paper stubs, a generic till, <span className="text-[rgb(245_242_235/0.6)]">and a cash box that never quite adds up.</span>
              </p>
              <Glow className="bottom-[-10%] left-[5%] h-[80%] w-[90%] opacity-80" />
              <Floor />
              <div className="relative mt-auto h-[66%]">
                <Ticket
                  variant="glass"
                  className="absolute left-[-4%] top-[30%] w-[74%] [transform:perspective(1000px)_rotateX(28deg)_rotateY(-22deg)_rotateZ(-18deg)]"
                />
                <Ticket
                  word="VOID"
                  kicker="Refunded"
                  className="absolute right-[-6%] top-[4%] w-[70%] [transform:perspective(1000px)_rotateX(20deg)_rotateY(-32deg)_rotateZ(12deg)]"
                />
              </div>
            </div>
          </div>
        </Slide>

        {/* 03 — One system ──────────────────────────────────────────────── */}
        <Slide tone="paper" n={3} section="The product" label="One system, from the office to the gate">
          <div className="grid h-full gap-8 xl:grid-cols-12 xl:gap-0">
            <div className="flex flex-col justify-between gap-8 xl:col-span-4">
              <div>
                <p className={s.eyebrow}>The product</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>One system, from the office to the gate.</h2>
                <p className={cn(s.lead, "mt-[max(8px,1.6cqw)] max-w-[32ch]")}>
                  OS runs the business on the web. Go sells and admits on a tablet or a phone.
                </p>
              </div>
              <div className="flex flex-col gap-[max(6px,0.9cqw)]">
                {["Same catalogue", "Same capacity", "Same ledger"].map((line) => (
                  <div key={line} className="flex items-center gap-[max(6px,0.8cqw)]">
                    <span className="flex h-[max(22px,1.8cqw)] w-[max(22px,1.8cqw)] items-center justify-center rounded-full bg-[#141413] text-[#f5f2eb]">
                      <Check className="h-[58%] w-[58%]" strokeWidth={2.4} aria-hidden />
                    </span>
                    <span className={cn(s.heading, "font-medium")}>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative min-h-[320px] sm:min-h-[420px] mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none xl:col-span-8 xl:min-h-0">
              <div className="xl:absolute xl:right-[-3%] xl:top-[2%] xl:w-[84%]">
                <Laptop src={dashLight} alt="Counterfoil OS dashboard on a laptop" tilt="left" />
              </div>
              <div className="relative -mt-[16%] w-[55%] xl:absolute xl:bottom-[4%] xl:left-[2%] xl:mt-0 xl:w-[45%]">
                <Tablet src={posTablet} alt="Counterfoil Go point of sale on a tablet" tilt="left" />
              </div>
              <div className="absolute bottom-[-2%] right-[4%] w-[22%] xl:bottom-[0%] xl:right-[3%] xl:w-[15.5%]">
                <Phone src={phoneSeats} alt="Choosing seats for an evening film on a phone" tilt="right" />
              </div>
              <Callout tone="paper" label="OS · on the web" value="Runs the business" className="absolute left-[2%] top-[10%] hidden xl:flex" />
              <Callout tone="paper" label="Go · tablet & phone" value="Sells and admits" className="absolute bottom-[47%] left-[4%] hidden xl:flex" />
            </div>
          </div>
        </Slide>

        {/* 04 — How it works ────────────────────────────────────────────── */}
        <Slide tone="paper" n={4} section="How it works" label="From first sale to cash-up">
          <div className="flex h-full flex-col gap-[max(8px,2.4cqw)]">
            <div className="grid gap-6 xl:grid-cols-12 xl:items-end">
              <div className="xl:col-span-7">
                <p className={s.eyebrow}>How it works</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>From first sale to cash-up.</h2>
              </div>
              <p className={cn(s.lead, "xl:col-span-5")}>Four steps every venue already takes — done in one place, by the people already doing them.</p>
            </div>
            <div className="grid flex-1 gap-[max(8px,1.4cqw)] sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.n} className={cn(s.card, s.paperCard, "flex flex-col")}>
                  <div className={cn(s.stepPanel, "flex aspect-[5/3] p-[max(16px,1.6cqw)] xl:aspect-auto xl:flex-1")}>
                    <div className="flex h-full w-full items-center justify-center">
                      <StepArt art={step.art} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-[max(6px,0.5cqw)] border-t border-[#efe9df] p-[max(16px,1.8cqw)]">
                    <span className={cn(s.mono, "text-[#aa3000]")}>{step.n}</span>
                    <h3 className={s.heading}>{step.name}</h3>
                    <p className={s.body}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* 05 — Go at the counter ───────────────────────────────────────── */}
        <Slide tone="paper" n={5} section="Counterfoil Go" label="Sell in three taps">
          <div className="grid h-full gap-8 xl:grid-cols-12 xl:gap-[max(8px,2cqw)]">
            <div className="flex flex-col justify-between gap-8 xl:col-span-4">
              <div>
                <p className={s.eyebrow}>Counterfoil Go</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>Sell in three taps.</h2>
                <p className={cn(s.lead, "mt-[max(8px,1.6cqw)]")}>Every tile shows what is left. Every sheet asks only what that booking needs.</p>
              </div>
              <ul className="flex flex-col gap-[max(8px,1cqw)]">
                {["Live availability on every tile", "Deposits, balances and group tickets", "bKash, Bangla QR, card or cash"].map((line) => (
                  <li key={line} className={cn(s.body, "flex items-center gap-[max(6px,0.8cqw)] text-[#22211f]")}>
                    <span aria-hidden className="h-[max(8px,0.6cqw)] w-[max(8px,0.6cqw)] shrink-0 rounded-full bg-[#f94a00]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn(s.card, s.washPanel, "relative min-h-[320px] overflow-hidden sm:min-h-[440px] xl:col-span-8 xl:min-h-0")}>
              <div className="absolute left-[7%] right-[-10%] top-[12%]">
                <Tablet src={posTablet} alt="Counterfoil Go selling General Admission and a yoga session" tilt="left" />
              </div>
              <Callout tone="paper" dot label="Grand Heritage Tour" value="Next 17:00 · 18 left" className="absolute left-[4%] top-[6%] hidden sm:flex" />
              <Callout
                tone="ink"
                label="Charge"
                value={<span className="text-[#ffa572]">৳2,875.00 — Cash</span>}
                className="absolute bottom-[8%] right-[5%] hidden sm:flex"
              />
            </div>
          </div>
        </Slide>

        {/* 06 — Every way to sell time ─────────────────────────────────── */}
        <Slide tone="paper" n={6} section="Booking types" label="Fourteen ways to sell time">
          <div className="grid h-full gap-[max(8px,1.6cqw)] xl:grid-cols-12">
            <div className={cn(s.card, s.paperCard, "relative flex min-h-[440px] flex-col overflow-hidden p-[max(16px,2.4cqw)] sm:min-h-[560px] xl:col-span-5 xl:min-h-0")}>
              <p className={cn(s.eyebrow, "relative z-10")}>Booking types</p>
              <h2 className={cn(s.title, "relative z-10 mt-[max(8px,1.2cqw)]")}>Fourteen ways to sell time.</h2>
              <p className={cn(s.body, "relative z-10 mt-[max(8px,1cqw)] max-w-[34ch]")}>
                One engine behind all of them, so a court and a concert can’t sell the same hour twice.
              </p>
              <div className={cn(s.washPanel, "absolute inset-x-0 bottom-0 h-[50%]")} />
              <SheetCard
                src={sheetSeats}
                alt="The seat map sheet for an evening film, three seats chosen"
                className="absolute bottom-[-12%] left-[6%] w-[50%] sm:w-[28%] xl:w-[50%] [transform:rotate(-5deg)]"
              />
              <SheetCard
                src={sheetSlots}
                alt="Hourly slots on a futsal field"
                className="absolute bottom-[-26%] right-[5%] w-[46%] sm:w-[26%] xl:w-[46%] [transform:rotate(6deg)]"
              />
              <span className="absolute bottom-[46%] right-[7%] z-10 hidden items-center gap-[max(6px,0.5cqw)] rounded-full bg-[#141413] px-[max(10px,1cqw)] py-[max(6px,0.5cqw)] text-[max(12px,0.9cqw)] font-medium text-[#f5f2eb] xl:inline-flex">
                <Armchair className="h-[1.1em] w-[1.1em]" strokeWidth={1.6} aria-hidden /> Seat maps · Slots
              </span>
            </div>
            <ul className="grid gap-[max(6px,0.8cqw)] sm:grid-cols-2 xl:col-span-7 xl:grid-cols-3 xl:grid-rows-5">
              {WAYS.map(({ icon: Icon, name, hint }) => (
                <li key={name} className={cn(s.card, s.paperCard, "flex items-center gap-[max(8px,1cqw)] px-[max(10px,1.3cqw)] py-[max(6px,1cqw)]")}>
                  <span className="flex h-[max(34px,2.8cqw)] w-[max(34px,2.8cqw)] shrink-0 items-center justify-center rounded-[0.8cqw] bg-[#fff1e8] text-[#aa3000]">
                    <Icon className="h-[52%] w-[52%]" strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[clamp(14px,1.1cqw,17px)] font-semibold leading-tight tracking-[-0.01em]">{name}</span>
                    <span className="mt-[max(4px,0.2cqw)] block text-[clamp(12px,0.9cqw,14px)] leading-snug text-[#6b675f]">{hint}</span>
                  </span>
                </li>
              ))}
              <li className={cn(s.card, "relative flex items-center justify-between overflow-hidden bg-[#141413] px-[max(16px,1.8cqw)] py-[max(6px,1cqw)] text-[#f5f2eb] sm:col-span-2")}>
                <span>
                  <span className="block font-mono text-[max(12px,0.85cqw)] uppercase tracking-[0.12em] text-[rgb(245_242_235/0.7)]">One engine</span>
                  <span className="mt-[max(4px,0.3cqw)] block text-[clamp(14px,1.1cqw,17px)] font-medium text-[rgb(245_242_235/0.85)]">Plus seat maps — fourteen in all.</span>
                </span>
                <span className="text-[clamp(34px,3.6cqw,58px)] font-semibold leading-none tracking-[-0.05em] text-[#ff7a3d]">14</span>
              </li>
            </ul>
          </div>
        </Slide>

        {/* 07 — Built in Bangladesh ─────────────────────────────────────── */}
        <Slide tone="ink" n={7} section="Made for the market" label="Built in Bangladesh, ready anywhere">
          <Glow className="bottom-[-40%] right-[4%] h-[110%] w-[55%]" />
          <Floor />
          <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
            <div className="flex flex-col justify-between gap-8 xl:col-span-6">
              <div>
                <p className={s.eyebrow}>Made for the market</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>
                  Built in Bangladesh. <span className={s.accentInk}>Ready anywhere.</span>
                </h2>
                <p className={cn(s.lead, "mt-[max(8px,1.6cqw)] max-w-[38ch]")}>
                  Bangla and English, bKash and Bangla QR, VAT and taka — with Stripe for cards abroad.
                </p>
              </div>
              <div className="flex flex-col gap-[max(8px,1.4cqw)]">
                <div className="grid grid-cols-2 gap-[max(6px,0.8cqw)] sm:grid-cols-3">
                  {["bKash", "SSLCOMMERZ", "Bangla QR", "Stripe", "Cash", "VAT & receipts"].map((name) => (
                    <span key={name} className={cn(s.card, s.inkCard, "px-[max(10px,1.2cqw)] py-[max(6px,1cqw)] text-[clamp(14px,1.1cqw,17px)] font-semibold")}>
                      {name}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-[max(6px,0.6cqw)]">
                  {["Bangladesh", "Malaysia", "United States", "Canada"].map((country) => (
                    <Pill key={country}>
                      <span aria-hidden className="h-[0.5em] w-[0.5em] rounded-full bg-[#ff7a3d]" />
                      {country}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative min-h-[460px] xl:col-span-6 xl:min-h-0">
              <div className="mx-auto w-[52%] sm:w-[34%] md:w-[28%] xl:absolute xl:left-[32%] xl:top-[0%] xl:mx-0 xl:w-[37%]">
                <Phone src={posPhoneBn} alt="Counterfoil Go in Bangla on a phone" tilt="right" />
              </div>
              <Ticket word="৳500" kicker="বিকাশ · bKash" className={cn(s.float, "absolute bottom-[6%] left-[-2%] w-[44%] sm:left-[10%] sm:w-[30%] xl:bottom-[12%] xl:left-[2%] xl:w-[38%]")} />
              <Callout tone="ink" label="ভাষা · Language" value="বাংলা · English" className="absolute right-[0%] top-[24%] hidden sm:flex" />
            </div>
          </div>
        </Slide>

        {/* 08 — Counterfoil OS ─────────────────────────────────────────── */}
        <Slide tone="paper" n={8} section="Counterfoil OS" label="See the day as it happens">
          <div className="grid h-full gap-8 xl:grid-cols-12 xl:gap-0">
            <div className="flex flex-col justify-between gap-8 xl:col-span-4">
              <div>
                <p className={s.eyebrow}>Counterfoil OS</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>See the day as it happens.</h2>
                <p className={cn(s.lead, "mt-[max(8px,1.6cqw)]")}>Revenue, capacity, arrivals and what needs a decision — for one venue or all of them.</p>
              </div>
              <ul className="flex flex-col gap-[max(8px,1.1cqw)]">
                {[
                  { icon: BarChart3, text: "Reports by hour, day, product and channel" },
                  { icon: CalendarDays, text: "Every session and lane on one calendar" },
                  { icon: ShieldCheck, text: "Roles, refund limits and sign-in rules" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className={cn(s.body, "flex items-center gap-[max(6px,0.9cqw)] text-[#22211f]")}>
                    <Icon className="h-[max(18px,1.4cqw)] w-[max(18px,1.4cqw)] shrink-0 text-[#aa3000]" strokeWidth={1.6} aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative sm:min-h-[420px] mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none xl:col-span-8 xl:min-h-0">
              <div className="xl:absolute xl:right-[-6%] xl:top-[6%] xl:w-[98%]">
                <Laptop src={reportsDark} alt="Counterfoil sales reports with revenue over time and payment mix" tilt="left" />
              </div>
              <Callout tone="paper" label="Payment mix" value="bKash · 26% of takings" className="absolute bottom-[6%] left-[2%] hidden sm:flex xl:bottom-[12%]" />
              <Callout tone="ink" label="Needs attention" value="Cash short at close" className="absolute right-[2%] top-[-2%] hidden sm:flex" />
            </div>
          </div>
        </Slide>

        {/* 09 — Everything behind the counter ─────────────────────────── */}
        <Slide tone="paper" n={9} section="The platform" label="Everything behind the counter">
          <div className="flex h-full flex-col gap-[max(8px,1.8cqw)]">
            <div className="grid gap-6 xl:grid-cols-12 xl:items-end">
              <div className="xl:col-span-7">
                <p className={s.eyebrow}>The platform</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>Everything behind the counter.</h2>
              </div>
              <p className={cn(s.lead, "xl:col-span-5")}>The work that happens around a sale, built into the same system that made it.</p>
            </div>
            <div className="grid flex-1 gap-[max(8px,1.2cqw)] xl:grid-cols-12 xl:grid-rows-2">
              <div className={cn(s.card, s.paperCard, "relative min-h-[320px] overflow-hidden xl:col-span-6 xl:row-span-2 xl:min-h-0")}>
                <div className="relative z-10 p-[max(16px,2cqw)]">
                  <CalendarDays className="h-[max(22px,1.8cqw)] w-[max(22px,1.8cqw)] text-[#aa3000]" strokeWidth={1.6} aria-hidden />
                  <h3 className={cn(s.heading, "mt-[max(8px,1cqw)]")}>A calendar that knows capacity</h3>
                  <p className={cn(s.body, "mt-[max(4px,0.5cqw)] max-w-[36ch]")}>Sessions, lanes and holds in one view, with every booking a click from its order.</p>
                </div>
                <div className="absolute bottom-0 left-[8%] right-[-18%] top-[42%] overflow-hidden rounded-tl-[1.4cqw] border border-[#e7e2d8] shadow-[0_20px_50px_-24px_rgb(20_20_19/0.35)]">
                  <Image src={calendarLight} alt="Counterfoil calendar week view" sizes="(min-width: 1280px) 640px, 92vw" className="h-auto w-[140%] max-w-none" placeholder="blur" />
                </div>
              </div>
              {[
                { icon: Users, title: "Customers", body: "One record per guest — found by phone, merged when they’re the same person." },
                { icon: Lock, title: "Holds & locks", body: "Keep 25 places for a school group. Close last month to edits." },
                { icon: Bell, title: "Messages", body: "Tickets by SMS, reminders the day before, quiet hours at night." },
                { icon: Receipt, title: "Tax & receipts", body: "VAT on every line, the registration number on every receipt." },
              ].map(({ icon: Icon, title, body }, i) => (
                <div key={title} className={cn(s.card, i === 0 ? s.emberCard : s.paperCard, "flex flex-col justify-between gap-6 p-[max(16px,1.8cqw)] xl:col-span-3")}>
                  <Icon className={cn("h-[max(22px,1.8cqw)] w-[max(22px,1.8cqw)]", i === 0 ? "text-white" : "text-[#aa3000]")} strokeWidth={1.6} aria-hidden />
                  <div>
                    <h3 className={s.heading}>{title}</h3>
                    <p className={cn("mt-[max(4px,0.5cqw)] text-[clamp(14px,1.05cqw,16px)] leading-snug", i === 0 ? "text-white" : "text-[#57534c]")}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* 10 — Sell online ────────────────────────────────────────────── */}
        <Slide tone="ink" n={10} section="Online" label="A page for every event">
          <Glow className="left-[36%] top-[-40%] h-[90%] w-[60%] opacity-80" />
          <div className="relative grid h-full gap-10 xl:grid-cols-12 xl:gap-0">
            <div className="flex flex-col justify-between gap-8 xl:col-span-4">
              <div>
                <p className={s.eyebrow}>Online</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>A page for every event.</h2>
                <p className={cn(s.lead, "mt-[max(8px,1.6cqw)]")}>
                  Six templates, one per kind of event — selling the same tickets the counter sells.
                </p>
              </div>
              <div className="flex flex-wrap gap-[max(6px,0.6cqw)]">
                {["Concerts", "Sports", "Conferences", "Galleries", "Tours", "Nightlife"].map((kind) => (
                  <Pill key={kind}>{kind}</Pill>
                ))}
              </div>
            </div>
            <div className="relative min-h-[320px] sm:min-h-[440px] mx-auto w-full max-w-[680px] xl:mx-0 xl:max-w-none xl:col-span-8 xl:min-h-0">
              <div className="xl:absolute xl:right-[-8%] xl:top-[2%] xl:w-[96%]">
                <Laptop src={webConcert} alt="A concert page built with Counterfoil — Nogor Baul: The Return" tilt="left" />
              </div>
              <BrowserCard
                src={webSummit}
                alt="A conference page built with Counterfoil — Sylhet Tech Summit 2026"
                className="absolute bottom-[4%] left-[0%] w-[52%] xl:bottom-[0%] xl:left-[4%] xl:w-[42%]"
              />
            </div>
          </div>
        </Slide>

        {/* 11 — Already at the counter ────────────────────────────────── */}
        <Slide tone="paper" n={11} section="Today" label="Already at the counter">
          <div className="flex h-full flex-col gap-[max(8px,1.8cqw)]">
            <div className="grid gap-6 xl:grid-cols-12 xl:items-end">
              <div className="xl:col-span-7">
                <p className={s.eyebrow}>Today</p>
                <h2 className={cn(s.title, "mt-[max(8px,1.4cqw)]")}>Already at the counter.</h2>
              </div>
              <p className={cn(s.lead, "xl:col-span-5")}>Venues, tours and attractions run their day on the current version.</p>
            </div>
            <div className="grid flex-1 gap-[max(8px,1.2cqw)] sm:grid-cols-2 xl:grid-cols-4">
              {[
                { value: "~20", label: "Operators", body: "running Counterfoil today", accent: true },
                { value: "4", label: "Countries", body: "Bangladesh, Malaysia, the US and Canada" },
                { value: "14", label: "Booking types", body: "sold from one engine" },
                { value: "2", label: "Languages", body: "Bangla and English, on every screen" },
              ].map(({ value, label, body, accent }) => (
                <div
                  key={label}
                  className={cn(
                    s.card,
                    accent ? "bg-[#141413] text-[#f5f2eb]" : s.paperCard,
                    "relative flex min-h-[150px] flex-col justify-between gap-6 overflow-hidden p-[max(16px,2cqw)] sm:min-h-[220px] xl:min-h-0",
                  )}
                >
                  {accent && <Glow className="bottom-[-60%] right-[-45%] h-[120%] w-[120%] opacity-70" />}
                  <span className={cn(s.mono, "relative uppercase", accent ? "text-[#ffa572]" : "text-[#aa3000]")}>{label}</span>
                  <div className="relative">
                    <p className={cn(s.numeral, accent && s.accentInk)}>{value}</p>
                    <div className={cn(s.perforation, "my-[max(8px,1cqw)]")} />
                    <p className={cn("text-[clamp(15px,1.2cqw,19px)] leading-snug", accent ? "text-[rgb(245_242_235/0.8)]" : "text-[#57534c]")}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className={cn(s.card, s.paperCard, "flex flex-wrap items-center gap-x-[max(8px,1.4cqw)] gap-y-2 px-[max(16px,2.2cqw)] py-[max(12px,1.4cqw)]")}>
              <span className={cn(s.mono, "w-full uppercase text-[#aa3000] sm:mr-[max(4px,0.6cqw)] sm:w-auto")}>Built for</span>
              {["Heritage sites", "Turfs & courts", "Bowling", "Spas", "Cinemas", "Tours"].map((kind, i) => (
                <span key={kind} className="flex items-center gap-[max(8px,1.4cqw)] text-[clamp(17px,1.8cqw,29px)] font-semibold tracking-[-0.03em]">
                  {i > 0 && <span aria-hidden className="h-[0.28em] w-[0.28em] rounded-full bg-[#f94a00]" />}
                  {kind}
                </span>
              ))}
            </div>
          </div>
        </Slide>

        {/* 12 — Close ──────────────────────────────────────────────────── */}
        <Slide tone="ink" n={12} section="Counterfoil" label="Every seat, slot and session, accounted for">
          <Glow className="left-[20%] top-[0%] h-[100%] w-[60%]" />
          <Floor />
          <div className="relative flex h-full flex-col items-center justify-center pt-8 text-center xl:pt-0">
            <div className="relative mb-[max(8px,2.6cqw)] h-[max(170px,15cqw)] w-[max(300px,32cqw)]">
              <Ticket
                variant="glass"
                className="absolute left-[2%] top-[6%] w-[58%] [transform:perspective(1000px)_rotateX(26deg)_rotateY(-26deg)_rotateZ(-16deg)]"
              />
              <Ticket className={cn(s.float, "absolute right-[2%] top-[-4%] w-[60%]")} />
            </div>
            <h2 className={cn(s.display, "max-w-[18ch]")}>
              Every seat, slot and session — <span className={s.accentInk}>accounted for.</span>
            </h2>
            <p className={cn(s.lead, "mt-[max(8px,1.8cqw)] max-w-[46ch]")}>Counterfoil is built by Ternary Solutions for the people who run venues, tours and attractions.</p>
            <Image src={logoOnInk} alt="Counterfoil" className="mt-[max(8px,2.4cqw)] h-[max(28px,2.6cqw)] w-auto" sizes="260px" />
          </div>
        </Slide>
      </div>
    </main>
  );
}
