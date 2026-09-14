import {
  Archive,
  Armchair,
  CalendarRange,
  Clock,
  Coins,
  Compass,
  DoorOpen,
  GraduationCap,
  Hourglass,
  LandPlot,
  ListOrdered,
  MonitorSmartphone,
  Package,
  Search,
  Ticket as TicketIcon,
  Timer,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Crop, Floor, Glow, Hotspot, Laptop, Phone, Pill, SheetCard, Slide, Step, TextBlock, Ticket, Ticks, deckStyles as s } from "../_components/Parts";
import dashLight from "../_media/os-dashboard-light.jpg";
import calendar from "../_media/os-calendar-light.jpg";
import bookings from "../_media/os-bookings.jpg";
import holds from "../_media/os-holds.jpg";
import orders from "../_media/os-orders.jpg";
import order from "../_media/os-order.jpg";
import customers from "../_media/os-customers.jpg";
import customer from "../_media/os-customer.jpg";
import reportsDark from "../_media/os-reports-dark.jpg";
import eventOs from "../_media/os-event.jpg";
import turfPhone from "../_media/web-turfcup-phone.jpg";
import settings from "../_media/os-settings.jpg";
import sheetSeats from "../_media/sheet-seats.jpg";
import sheetSlots from "../_media/sheet-slots.jpg";

/*
 * Chapter 01 — Counterfoil OS, one slide per part of the admin app.
 *
 * Paper is the OS chapter's ground and ink is Go's. No two neighbours share a
 * composition: a laptop with numbered points, a crop with a close-up, a bento,
 * a list above its record, a device on ink.
 *
 * Every crop is cut on a row boundary of its screenshot, so no screen stops
 * halfway through a line of text.
 */

export const OS_SECTION = "01 · Counterfoil OS";

/** A chapter opens on ink, with its number printed on the stub. */
export function ChapterDivider({
  n,
  chapter,
  product,
  word,
  title,
  lead,
  contents,
}: {
  n: number;
  chapter: string;
  product: string;
  word: string;
  title: string;
  lead: string;
  contents: string[];
}) {
  return (
    <Slide tone="ink" n={n} section={`${chapter} · ${product}`} label={title}>
      <Glow className="left-[840px] top-[-260px] h-[940px] w-[940px]" />
      <Floor />
      <p className={cn(s.eyebrow, "absolute left-[96px] top-[92px]")}>Chapter {chapter}</p>
      <div className={s.text} style={{ left: 96, top: 246, width: 700 }}>
        <h2 className={s.display}>{title}</h2>
        <p className={cn(s.lead, "mt-8 w-[620px]")}>{lead}</p>
        <ul className="mt-11 flex w-[660px] flex-wrap gap-3">
          {contents.map((c) => (
            <li key={c}>
              <Pill>{c}</Pill>
            </li>
          ))}
        </ul>
      </div>
      <Ticket
        variant="glass"
        width={400}
        tilt="perspective(1000px) rotateX(26deg) rotateY(-24deg) rotateZ(-16deg)"
        className="absolute left-[930px] top-[470px]"
      />
      <Ticket word={word} kicker={`Chapter ${chapter}`} code={`CF-2026-CH${chapter}`} width={500} className="absolute left-[990px] top-[228px]" />
    </Slide>
  );
}

export function DashboardSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="The day, at a glance">
      <TextBlock
        eyebrow="Dashboard"
        title={
          <>
            The day,
            <br />
            at a glance.
          </>
        }
        lead="What came in, what is filling up, and what needs a decision before it costs money."
      >
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Four numbers" body="Revenue, capacity sold, arrivals and what is booked ahead." />
          <Step n={2} title="Revenue trend" body="The last 30 days against the 30 before them." />
          <Step n={3} title="Needs attention" body="A short cash count, a booking about to stop, a tablet gone quiet." />
        </ol>
      </TextBlock>
      <Laptop src={dashLight} width={864} alt="The Counterfoil OS dashboard for Lalbagh Heritage Attractions" className="absolute left-[640px] top-[170px]">
        {/* 1 sits on the corner of the first figure, not over its label. */}
        <Hotspot n={1} x={17.2} y={14.1} />
        <Hotspot n={2} x={47} y={42} />
        <Hotspot n={3} x={85} y={38.5} />
      </Laptop>
    </Slide>
  );
}

const CALENDAR_KEY = [
  { label: "Today", body: "Marked, with a line at the current time." },
  { label: "Side by side", body: "Two bookings at one time never hide each other." },
  { label: "The key", body: "Each state is also a filter, with its count." },
];

export function CalendarSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Every session, lane and hold on one grid">
      <TextBlock
        eyebrow="Calendar"
        title="Every session, lane and hold on one grid."
        lead="By day, week or month — held capacity shown beside what is sold."
        width={464}
      />

      {/* The close-up belongs to the words, so it sits in their column. */}
      <div className="absolute left-[96px] top-[468px] w-[464px]">
        {/* Clipped, with a short shadow: a long one darkened the caption under it below its reading floor. */}
        <div className="overflow-hidden rounded-[22px] bg-[#f94a00] p-[4px] shadow-[0_16px_30px_-20px_rgb(20_20_19/0.45)]">
          <Crop src={calendar} alt="" x={0.645} y={0.548} w={0.13} h={0.1} width={456} />
        </div>
        <p className={cn(s.mono, "mt-8 uppercase text-[#aa3000]")}>Held back · Fri 31 Jul, 14:00</p>
        <p className={cn(s.body, "mt-2")}>A private event, off sale — hatched, so it never reads as booked.</p>
      </div>

      <Crop
        src={calendar}
        alt="The calendar week view: bookings, attendance and held capacity above a grid with a held private event"
        x={0.17}
        y={0.128}
        w={0.825}
        h={0.822}
        width={896}
        className="absolute left-[608px] top-[92px]"
      >
        {/* Where the close-up comes from. */}
        <span aria-hidden className="absolute rounded-[10px] ring-[3px] ring-[#f94a00]" style={{ left: "57.6%", top: "51.1%", width: "15.8%", height: "12.2%" }} />
      </Crop>
      <ul className="absolute left-[608px] top-[686px] grid w-[896px] grid-cols-3 gap-6">
        {CALENDAR_KEY.map(({ label, body }) => (
          <li key={label} className="border-t border-[#dcd6cb] pt-4">
            <p className={cn(s.mono, "uppercase text-[#aa3000]")}>{label}</p>
            <p className={cn(s.body, "mt-2")}>{body}</p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}

export function BookingsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Everything you sell, in one catalogue">
      <TextBlock eyebrow="Bookings" title="Everything you sell, in one catalogue." width={860} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Admission, tours, courts and events — each with its price, its category and where it is sold.
      </p>

      <div className={cn(s.card, s.washPanel, "absolute left-[96px] top-[325px] grid h-[475px] w-[896px] place-items-center")}>
        <Crop src={bookings} alt="The bookings catalogue, with bulk selection, prices, categories, channels and status" x={0.17} y={0.258} w={0.825} h={0.652} width={832} />
      </div>

      <div className={cn(s.card, "absolute left-[1024px] top-[325px] flex h-[141px] w-[480px] items-center justify-between gap-6 bg-[#141413] px-8 text-[#f5f2eb]")}>
        <div>
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-[#ffa572]">Not sellable</p>
          <p className="mt-2 w-[300px] text-[17px] leading-[1.45] text-[rgb(245_242_235/0.82)]">A booking missing a price, a schedule or somewhere to sell says so first.</p>
        </div>
        <span className="text-[88px] font-semibold leading-none tracking-[-0.06em] text-[#ff7a3d]">0</span>
      </div>
      {[
        { icon: Archive, title: "On, off or archived — in bulk", body: "Tick the rows and act on them; duplicate one to start the next.", top: 492 },
        { icon: MonitorSmartphone, title: "Sold where you choose", body: "Counter, online or both, with seat layouts for rooms with seats.", top: 659 },
      ].map(({ icon: Icon, title, body, top }) => (
        <div key={title} className={cn(s.card, s.paperCard, "absolute left-[1024px] flex h-[141px] w-[480px] items-center gap-5 px-8")} style={{ top }}>
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-[#fff1e8] text-[#aa3000]">
            <Icon size={24} strokeWidth={1.6} aria-hidden />
          </span>
          <div>
            <h3 className={s.heading}>{title}</h3>
            <p className={cn(s.body, "mt-1.5")}>{body}</p>
          </div>
        </div>
      ))}
    </Slide>
  );
}

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

export function BookingTypesSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Fourteen ways to sell time">
      <TextBlock
        eyebrow="Booking types"
        title="Fourteen ways to sell time."
        lead="One engine behind all of them, so a court and a concert can’t sell the same hour twice."
        width={500}
      />
      {/* The label has its own row, and both sheets fit inside the panel whole. */}
      <div className={cn(s.card, s.washPanel, "absolute left-[96px] top-[420px] h-[380px] w-[520px]")}>
        <span className="absolute left-[24px] top-[20px] z-10 inline-flex items-center gap-2 rounded-full bg-[#141413] px-4 py-2 text-[15px] font-medium text-[#f5f2eb]">
          <Armchair size={16} strokeWidth={1.6} aria-hidden /> Seat maps · Slots
        </span>
        <SheetCard src={sheetSeats} alt="The seat map sheet for an evening film, three seats chosen" width={196} className="absolute left-[56px] top-[78px] rotate-[-5deg]" />
        <SheetCard src={sheetSlots} alt="Hourly slots on a futsal field" width={196} className="absolute left-[276px] top-[70px] rotate-[5deg]" />
      </div>
      <ul className="absolute left-[680px] top-[92px] grid h-[708px] w-[824px] grid-cols-3 grid-rows-5 gap-4">
        {WAYS.map(({ icon: Icon, name, hint }) => (
          <li key={name} className={cn(s.card, s.paperCard, "flex items-center gap-4 px-5")}>
            <span className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-[13px] bg-[#fff1e8] text-[#aa3000]">
              <Icon size={23} strokeWidth={1.6} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[18px] font-semibold leading-tight tracking-[-0.01em]">{name}</span>
              <span className="mt-1 block text-[15px] leading-snug text-[#6b675f]">{hint}</span>
            </span>
          </li>
        ))}
        <li className={cn(s.card, "col-span-2 flex items-center justify-between bg-[#141413] px-8 text-[#f5f2eb]")}>
          <span>
            <span className="block font-mono text-[14px] uppercase tracking-[0.12em] text-[rgb(245_242_235/0.7)]">One engine</span>
            <span className="mt-1.5 block text-[18px] font-medium text-[rgb(245_242_235/0.88)]">Plus seat maps — fourteen in all.</span>
          </span>
          <span className="text-[72px] font-semibold leading-none tracking-[-0.05em] text-[#ff7a3d]">14</span>
        </li>
      </ul>
    </Slide>
  );
}

const HOLD_KINDS: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: "A number of places" },
  { icon: Clock, label: "A whole session" },
  { icon: LandPlot, label: "A lane or court" },
  { icon: Armchair, label: "Named seats" },
];

export function HoldsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Hold places, on the record">
      <TextBlock eyebrow="Holds" title="Hold places, on the record." width={900} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Every hold says who it is for and who placed it — and goes back on sale by hand, or when its time is up.
      </p>

      <div className={cn(s.card, s.paperCard, "absolute left-[96px] top-[256px] h-[190px] w-[692px] px-7 py-6")}>
        <div className="flex items-baseline justify-between">
          <h3 className={s.heading}>Planetarium Show · 1 Aug, 11:00</h3>
          <span className={cn(s.mono, "text-[#6b675f]")}>40 places</span>
        </div>
        <div aria-hidden className="mt-4 grid grid-cols-[repeat(20,26px)] gap-1">
          {Array.from({ length: 40 }, (_, i) => (
            <span
              key={i}
              className={cn("h-[22px] rounded-[5px]", i < 25 ? "ring-1 ring-inset ring-[#dcc08c]" : "bg-[#f5f2eb] ring-1 ring-inset ring-[#e2ded5]")}
              style={i < 25 ? { background: "repeating-linear-gradient(135deg, #e9c79b 0 5px, #f4e4c6 5px 10px)" } : undefined}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          <p className={s.body}>
            <span className="font-semibold text-[#22211f]">25 held</span> for Sunbeams School — Class 6
          </p>
          <p className={s.body}>15 still on sale</p>
        </div>
      </div>

      {/* Four kinds as a 2 × 2 list — as pills they wrapped and cut the card's last line. */}
      <div className={cn(s.card, s.paperCard, "absolute left-[812px] top-[256px] h-[190px] w-[692px] px-7 py-6")}>
        <p className={cn(s.mono, "uppercase text-[#aa3000]")}>What can be held</p>
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
          {HOLD_KINDS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3.5">
              <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px] bg-[#fff1e8] text-[#aa3000]">
                <Icon size={21} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="text-[18px] font-semibold tracking-[-0.01em]">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <Crop
        src={holds}
        alt="Holds for maintenance on lane 3, a private event and a school group, each with who placed it"
        x={0.17}
        y={0.415}
        w={0.825}
        h={0.585}
        width={1408}
        className="absolute left-[96px] top-[470px]"
      />
    </Slide>
  );
}

const STATUS_CHIPS = [
  { label: "Paid", cls: "bg-[#e4f3e8] text-[#1f6f3d] ring-[#b9dfc5]" },
  { label: "Partial", cls: "bg-[#fbe7cf] text-[#8a4a0b] ring-[#eec08a]" },
  { label: "Pending", cls: "bg-[#e6eefb] text-[#2c55a0] ring-[#bfd0f0]" },
  { label: "Refunded", cls: "bg-[#fbe4e2] text-[#a1302a] ring-[#f0bdb8]" },
  { label: "Cancelled", cls: "bg-[#efebe4] text-[#57534c] ring-[#dcd6cb]" },
];

export function OrdersSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Every sale, and the money behind it">
      <TextBlock eyebrow="Orders" title="Every sale, and the money behind it." lead="Counter and online in one list — what was collected, and what is still owed.">
        <Ticks tone="paper" items={["Each line kept as it was sold — add-ons, discounts and VAT", "Refund a line with a reason, resend a ticket, move a date", "Internal notes a guest never sees"]} />
        <p className={cn(s.mono, "mt-9 uppercase text-[#aa3000]")}>Where an order stands</p>
        <ul className="mt-3.5 flex gap-2">
          {STATUS_CHIPS.map((c) => (
            <li key={c.label} className={cn("rounded-[8px] px-3 py-1.5 font-mono text-[14px] font-medium uppercase tracking-[0.08em] ring-1 ring-inset", c.cls)}>
              {c.label}
            </li>
          ))}
        </ul>
      </TextBlock>

      {/* A bento, not a pile: the list, the money it adds up to, and one order opened. */}
      <Crop src={orders} alt="The orders list: every sale with its customer, location, items, total and status" x={0.17} y={0.245} w={0.825} h={0.4646} width={840} className="absolute left-[664px] top-[92px]" />
      <div className={cn(s.card, "absolute left-[664px] top-[412px] flex h-[388px] w-[356px] flex-col justify-between bg-[#141413] p-8 text-[#f5f2eb]")}>
        <div>
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-[#ffa572]">Outstanding</p>
          <p className="mt-3 text-[46px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#ff7a3d]">৳47,011.37</p>
          <p className="mt-4 text-[17px] leading-[1.45] text-[rgb(245_242_235/0.78)]">Still owed — and shown on the order as a balance due.</p>
        </div>
        <dl className="flex flex-col gap-3 border-t border-white/12 pt-5">
          {[
            ["Collected", "৳605,564.78"],
            ["Orders", "151"],
            ["Average order", "৳5,138.39"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between text-[17px]">
              <dt className="text-[rgb(245_242_235/0.66)]">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Crop
        src={order}
        alt="Order CF-2026-999001: paid in full, with its items, add-ons, discounts, VAT and total"
        x={0.17}
        y={0.172}
        w={0.555}
        h={0.6738}
        width={460}
        className="absolute left-[1044px] top-[412px]"
      />
    </Slide>
  );
}

export function CustomersSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Know the guest in front of you">
      <Crop src={customers} alt="The customers list, ranked by spend, with marketing consent" x={0.17} y={0.15} w={0.825} h={0.498} width={840} className="absolute left-[96px] top-[92px]">
        {/* The row the record below opens. */}
        <span aria-hidden className="absolute rounded-[8px] ring-[3px] ring-[#f94a00]" style={{ left: "1.2%", top: "43.2%", width: "97.6%", height: "12.4%" }} />
      </Crop>
      <Crop
        src={customer}
        alt="Sabbir Alam’s record: flagged for staff attention, with spend, orders and activity"
        x={0.17}
        y={0.135}
        w={0.825}
        h={0.505}
        width={840}
        className="absolute left-[96px] top-[433px]"
      />

      <TextBlock eyebrow="Customers" title="Know the guest in front of you." lead="One record per person — what they have bought, agreed to and still owe." left={984}>
        <Ticks tone="paper" items={["Matched by phone, however the number is typed", "Email and SMS consent, kept as a record", "Merge duplicates; erase personal data on request"]} />
        <div className={cn(s.card, "mt-9 bg-[#141413] px-7 py-6 text-[#f5f2eb]")}>
          <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-[#ffa572]">Flagged for staff</p>
          <p className="mt-3 text-[21px] font-semibold leading-[1.3] tracking-[-0.015em]">“Repeated no-shows on booked tours. Take payment in full at booking.”</p>
          <p className="mt-3 text-[16px] leading-[1.45] text-[rgb(245_242_235/0.72)]">Attach Sabbir to a sale and the till shows why.</p>
        </div>
      </TextBlock>
    </Slide>
  );
}

const CHARTS = ["Revenue vs. last period", "Sales by hour", "Sales by weekday", "Payment mix", "Capacity used", "No-show rate", "Lead time", "Top bookings"];

export function ReportsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={OS_SECTION} label="Read the business by the hour">
      <Glow className="left-[760px] top-[380px] h-[700px] w-[800px] opacity-70" />
      <TextBlock eyebrow="Reports" title="Read the business by the hour." lead="Transactions, a summary, what is outstanding and analytics — all from one ledger.">
        <div className={cn(s.card, s.inkCard, "px-7 py-6")}>
          <div className="flex items-end gap-4">
            <span className="text-[72px] font-semibold leading-[0.8] tracking-[-0.06em] text-[#ff7a3d]">8</span>
            <span className={cn(s.heading, "pb-[2px]")}>charts in Analytics</span>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2.5">
            {CHARTS.map((c) => (
              <li key={c} className="flex items-center gap-2.5 text-[17px] text-[rgb(245_242_235/0.8)]">
                <span aria-hidden className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#ff7a3d]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <ul className="mt-7 flex gap-3">
          {["CSV export", "Saved views", "Shareable links"].map((p) => (
            <li key={p}>
              <Pill>{p}</Pill>
            </li>
          ))}
        </ul>
      </TextBlock>
      <Laptop src={reportsDark} width={820} tilt="left" alt="Sales analytics: revenue over time, sales by weekday and payment mix" className="absolute left-[676px] top-[184px]" />
    </Slide>
  );
}

/** Each template's own accent, from the event catalogue. */
const TEMPLATES = [
  { name: "Entertainment", accent: "#FF3D71" },
  { name: "Sports", accent: "#2BE07C" },
  { name: "Business", accent: "#1D4ED8" },
  { name: "Arts", accent: "#2E4A3F" },
  { name: "Travel", accent: "#B0004E" },
  { name: "Nightlife", accent: "#B026FF" },
];

export function EventsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={OS_SECTION} label="A page for every event">
      <Glow className="left-[820px] top-[-280px] h-[820px] w-[860px] opacity-80" />
      <TextBlock eyebrow="Events" title="A page for every event." lead="Six templates, one per kind of event — each page built from the event’s own bill, tickets and venue.">
        <div className="grid grid-cols-2 gap-4">
          {[
            { value: "6", label: "Events on sale" },
            { value: "4,867", label: "Tickets sold" },
          ].map(({ value, label }) => (
            <div key={label} className={cn(s.card, s.inkCard, "px-6 py-5")}>
              <p className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{value}</p>
              <p className="mt-3 font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.68)]">{label}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-3">
          {TEMPLATES.map(({ name, accent }) => (
            <li key={name} className={cn(s.card, s.inkCard, "flex h-[56px] items-center gap-3 px-4 [--card-r:16px]")}>
              <span aria-hidden className="h-[18px] w-[18px] shrink-0 rounded-full ring-2 ring-white/20" style={{ background: accent }} />
              <span className="text-[16px] font-semibold">{name}</span>
            </li>
          ))}
        </ul>
      </TextBlock>
      <Laptop
        src={eventOs}
        width={800}
        tilt="left"
        alt="Chattogram Turf Cup in Counterfoil OS: 622 of 1,216 tickets sold, with a live preview of its page"
        className="absolute left-[660px] top-[160px]"
      />
      <Phone src={turfPhone} width={196} tilt="right" alt="The Chattogram Turf Cup page on a phone" className="absolute left-[1300px] top-[382px]" />
    </Slide>
  );
}

/** Settings that reach the counter, and where each one shows up. */
const REACHES = [
  ["Payment methods", "the till’s pay buttons"],
  ["Tax", "every line of a sale"],
  ["Opening float", "the start of a shift"],
  ["Receipt message", "the foot of every receipt"],
  ["Wrong PINs allowed", "the PIN screen"],
];

const SEARCHES = [
  ["vat", "Tax"],
  ["bkash", "Payments"],
  ["dark mode", "Preferences"],
  ["quiet hours", "Notifications"],
];

export function SettingsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Set up once, and the till follows">
      <TextBlock eyebrow="Settings" title="Set up once." lead="Change a setting and the till follows — there is no second place to update it." width={464}>
        <ul className="flex flex-col gap-3">
          {REACHES.map(([name, where]) => (
            <li key={name} className={cn(s.card, s.paperCard, "flex h-[72px] items-center justify-between gap-4 px-5 [--card-r:16px]")}>
              <span className="text-[17px] font-semibold">{name}</span>
              <span className="flex items-center gap-2 text-[16px] text-[#57534c]">
                <span aria-hidden className="text-[#aa3000]">→</span>
                {where}
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>

      <Crop src={settings} alt="Settings: each section with what it is set to, and search" x={0.17} y={0.128} w={0.825} h={0.617} width={896} className="absolute left-[608px] top-[92px]" />
      <div className={s.text} style={{ left: 608, top: 551, width: 896 }}>
        <p className={cn(s.mono, "flex items-center gap-2 uppercase text-[#aa3000]")}>
          <Search size={15} strokeWidth={2} aria-hidden /> Search by what you’d type
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {SEARCHES.map(([q, a]) => (
            <li key={q} className={cn(s.card, s.paperCard, "flex h-[68px] items-center gap-3 px-5 [--card-r:16px]")}>
              <span className="font-mono text-[16px] text-[#6b675f]">“{q}”</span>
              <span aria-hidden className="text-[#aa3000]">→</span>
              <span className="text-[17px] font-semibold">{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </Slide>
  );
}
