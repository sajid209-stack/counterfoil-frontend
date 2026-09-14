import { Armchair, Clock, LandPlot, Search, Users, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Crop, Floor, Glow, Hotspot, Laptop, Phone, SheetCard, Slide, Step, TextBlock, Ticket, Ticks, deckStyles as s } from "../_components/Parts";
import { GoLockup } from "../_components/GoLogo";
import logoOnPaper from "../_media/logo-counterfoil.png";
import tplEntertainment from "../_media/tpl-entertainment.jpg";
import tplSports from "../_media/tpl-sports.jpg";
import tplBusiness from "../_media/tpl-business.jpg";
import tplArts from "../_media/tpl-arts.jpg";
import tplTravel from "../_media/tpl-travel.jpg";
import tplNightlife from "../_media/tpl-nightlife.jpg";
import dashLight from "../_media/os-dashboard-light.jpg";
import calendar from "../_media/os-calendar-light.jpg";
import bookings from "../_media/os-bookings.jpg";
import holds from "../_media/os-holds.jpg";
import orders from "../_media/os-orders.jpg";
import order from "../_media/os-order.jpg";
import customers from "../_media/os-customers.jpg";
import customer from "../_media/os-customer.jpg";
import reportsDark from "../_media/os-reports-dark.jpg";
import eventOs from "../_media/os-event-dark.jpg";
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

/**
 * A chapter opens on ink, with the product's own marque printed on the ticket
 * and the chapter's number on its stub. The Counterfoil logotype is OS's own
 * mark — the app draws no OS tag beside it — and Go carries the Go artwork,
 * streaks and all.
 */
export function ChapterDivider({
  n,
  chapter,
  product,
  marque,
  title,
  lead,
  contents,
}: {
  n: number;
  chapter: string;
  product: string;
  marque: "os" | "go";
  title: string;
  lead: string;
  /** Each part of the chapter, with the page it starts on. */
  contents: [string, number][];
}) {
  const logo =
    marque === "go" ? <GoLockup /> : <Image src={logoOnPaper} alt="" sizes="360px" />;
  return (
    <Slide tone="ink" n={n} section={`${chapter} · ${product}`} label={title}>
      <Glow className="left-[840px] top-[-260px] h-[940px] w-[940px]" />
      <Floor />
      <p className={cn(s.eyebrow, "absolute left-[96px] top-[92px]")}>Chapter {chapter}</p>
      {/* A shorter contents list sits lower, so both openers keep the same weight on the page. */}
      <div className={s.text} style={{ left: 96, top: 206 + (5 - Math.ceil(contents.length / 2)) * 26, width: 700 }}>
        <h2 className={s.display}>{title}</h2>
        <p className={cn(s.lead, "mt-8 w-[620px]")}>{lead}</p>
        {/* The chapter's contents, set like a book's: each part with the page it starts on, read down then across. */}
        <ol className="mt-12 grid w-[660px] grid-flow-col grid-cols-2 gap-x-12" style={{ gridTemplateRows: `repeat(${Math.ceil(contents.length / 2)}, auto)` }}>
          {contents.map(([name, page]) => (
            <li key={name} className="flex items-baseline gap-3 border-t border-white/10 py-[11px] text-[19px]">
              <span className="font-medium">{name}</span>
              <span aria-hidden className="mb-[5px] flex-1 border-b border-dotted border-white/25" />
              <span className="font-mono text-[15px] tabular-nums text-[#ffa572]">{String(page).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
      </div>
      <Ticket
        variant="glass"
        width={400}
        tilt="perspective(1000px) rotateX(26deg) rotateY(-24deg) rotateZ(-16deg)"
        className="absolute left-[930px] top-[470px]"
      />
      <Ticket
        logo={logo}
        kicker={`Chapter ${chapter}`}
        stub={
          <>
            <small>No.</small>
            {chapter}
          </>
        }
        code={`CF-2026-CH${chapter}`}
        width={500}
        className="absolute left-[990px] top-[228px]"
      />
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
        <Hotspot n={1} x={18.4} y={16.4} />
        <Hotspot n={2} x={49} y={46.5} />
        <Hotspot n={3} x={88.1} y={42.8} />
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

      {/* The catalogue set straight on the page, its foot on the slide's bottom line. */}
      <Crop
        src={bookings}
        alt="The bookings catalogue, with bulk selection, prices, categories, channels and status"
        x={0.17}
        y={0.258}
        w={0.825}
        h={0.652}
        width={896}
        className="absolute left-[96px] top-[357px]"
      />

      {/* Three facts as a list between rules, level with the catalogue top and bottom. */}
      <ul className="absolute left-[1024px] top-[357px] flex h-[443px] w-[480px] flex-col border-b border-[#d9d3c7]">
        <li className="flex flex-1 items-center justify-between gap-6 border-t-2 border-[#141413]">
          <div>
            <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Not sellable</p>
            <p className={cn(s.body, "mt-2 w-[330px]")}>A booking missing a price, a schedule or somewhere to sell says so first.</p>
          </div>
          <span className="text-[104px] font-semibold leading-none tracking-[-0.06em] text-[#d93f00]">0</span>
        </li>
        {[
          { title: "On, off or archived — in bulk", body: "Tick the rows and act on them; duplicate one to start the next." },
          { title: "Sold where you choose", body: "Counter, online or both, with seat layouts for rooms with seats." },
        ].map(({ title, body }) => (
          <li key={title} className="flex flex-1 flex-col justify-center border-t border-[#d9d3c7]">
            <h3 className={s.heading}>{title}</h3>
            <p className={cn(s.body, "mt-1.5")}>{body}</p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}

/* The fourteen, grouped by what the guest is buying: a way in, a time or a place, or more than one visit. */
const WAYS: [string, [string, string][]][] = [
  [
    "A way in",
    [
      ["Open entry", "Walk in, any time"],
      ["Date passes", "A day, a week, a season"],
      ["Daily capacity", "200 a day, any time"],
      ["Quick passes", "Parking by the plate"],
    ],
  ],
  [
    "A time or a place",
    [
      ["Timed sessions", "A show every 45 minutes"],
      ["Seat maps", "The seat, on a plan"],
      ["Courts & fields", "Hourly, per court"],
      ["Flexible duration", "A lane by the hour"],
      ["Guided tours", "When a guide is free"],
      ["Appointments", "A therapist and a time"],
    ],
  ],
  [
    "More than one visit",
    [
      ["Courses", "Eight sessions, one sale"],
      ["Credit packs", "Ten classes, over time"],
      ["Bundles", "Three attractions, one price"],
      ["Waitlists", "Sold when a place frees"],
    ],
  ],
];

export function BookingTypesSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Fourteen ways to sell time">
      <TextBlock
        eyebrow="Booking types"
        title="Fourteen ways to sell time."
        lead="One engine behind all of them, so a court and a concert can’t sell the same hour twice."
        width={620}
      />
      {/* Two of the sheets the till opens for them, laid on the page like printouts. */}
      <SheetCard src={sheetSeats} alt="The seat map sheet for an evening film, three seats chosen" width={200} className="absolute left-[1086px] top-[92px] rotate-[-4deg]" />
      <SheetCard src={sheetSlots} alt="Hourly slots on a futsal field" width={200} className="absolute left-[1296px] top-[76px] rotate-[5deg]" />

      <div className="absolute left-[96px] top-[452px] grid w-[1408px] grid-cols-3 gap-x-12">
        {WAYS.map(([group, rows]) => (
          <div key={group}>
            <p className={cn(s.mono, "flex items-baseline justify-between uppercase text-[#aa3000]")}>
              {group}
              <span className="text-[#6b675f]">{String(rows.length).padStart(2, "0")}</span>
            </p>
            <ul className="mt-3.5 border-t-2 border-[#141413]">
              {rows.map(([name, hint]) => (
                <li key={name} className="flex h-[52px] items-center justify-between gap-4 border-b border-[#d9d3c7]">
                  <span className="text-[19px] font-semibold tracking-[-0.01em]">{name}</span>
                  <span className="text-[16px] text-[#6b675f]">{hint}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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
      </TextBlock>
      {/* On the slide's bottom line, level with the foot of the bento beside it. */}
      <div className={s.text} style={{ left: 96, bottom: 100, width: 548 }}>
        <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Where an order stands</p>
        <ul className="mt-3.5 flex gap-2">
          {STATUS_CHIPS.map((c) => (
            <li key={c.label} className={cn("rounded-[8px] px-3 py-1.5 font-mono text-[14px] font-medium uppercase tracking-[0.08em] ring-1 ring-inset", c.cls)}>
              {c.label}
            </li>
          ))}
        </ul>
      </div>

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
        <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Analytics · eight charts</p>
        <ul className="mt-3.5 grid grid-cols-2 gap-x-8 border-t border-white/12">
          {CHARTS.map((c) => (
            <li key={c} className="border-b border-white/12 py-3 text-[18px] text-[rgb(245_242_235/0.88)]">
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-9 font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Every view</p>
        <p className="mt-3 text-[21px] font-medium tracking-[-0.01em]">
          Export to CSV <span aria-hidden className="px-1.5 text-white/30">/</span> Save a view <span aria-hidden className="px-1.5 text-white/30">/</span> Share a link
        </p>
      </TextBlock>
      <Laptop src={reportsDark} width={820} tilt="left" alt="Sales analytics: revenue over time, sales by weekday and payment mix" className="absolute left-[676px] top-[184px]" />
    </Slide>
  );
}

/** The six templates, each shown by the top of a real event page built with it. */
const TEMPLATES = [
  { name: "Entertainment", src: tplEntertainment, event: "Mega concert" },
  { name: "Sports", src: tplSports, event: "Turf cup" },
  { name: "Business", src: tplBusiness, event: "Tech summit" },
  { name: "Arts", src: tplArts, event: "Exhibition" },
  { name: "Travel", src: tplTravel, event: "Sundarbans trip" },
  { name: "Nightlife", src: tplNightlife, event: "Underground night" },
];

export function EventsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={OS_SECTION} label="A page for every event">
      <Glow className="left-[820px] top-[-280px] h-[820px] w-[860px] opacity-80" />
      <TextBlock eyebrow="Events" title="A page for every event." lead="Six templates, one per kind of event, each built from the event’s own bill and tickets.">
        <div className="flex items-end gap-8 border-t border-white/12 pt-5">
          {[
            ["6", "events on sale"],
            ["4,867", "tickets sold"],
          ].map(([value, label]) => (
            <p key={label} className="flex items-baseline gap-2.5">
              <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</span>
              <span className="text-[17px] text-[rgb(245_242_235/0.66)]">{label}</span>
            </p>
          ))}
        </div>
        <ul className="mt-8 grid grid-cols-3 gap-x-[14px] gap-y-[18px]">
          {TEMPLATES.map(({ name, src, event }) => (
            <li key={name}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] ring-1 ring-white/12">
                <Image src={src} alt={`The ${name} template: the ${event.toLowerCase()} page`} fill sizes="200px" placeholder="blur" className="object-cover object-top" />
              </div>
              <p className="mt-2.5 text-[16px] font-semibold leading-none">{name}</p>
            </li>
          ))}
        </ul>
      </TextBlock>
      {/* Both in dark: OS in its dark theme, and the event's own floodlit page on the phone. */}
      <Laptop
        src={eventOs}
        width={800}
        tilt="left"
        alt="Chattogram Turf Cup in Counterfoil OS, dark theme: 622 of 1,216 tickets sold, with a live preview of its page"
        className="absolute left-[660px] top-[160px]"
      />
      <Phone src={turfPhone} bar="#09160f" ink="light" width={196} tilt="right" alt="The Chattogram Turf Cup page on a phone" className="absolute left-[1300px] top-[372px]" />
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
        {/* A table, because it is one: each setting beside the place it shows up. */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-[#141413]">
              <th className={cn(s.mono, "pb-3 text-left font-normal uppercase text-[#aa3000]")}>Setting</th>
              <th className={cn(s.mono, "pb-3 text-right font-normal uppercase text-[#aa3000]")}>Shows up in</th>
            </tr>
          </thead>
          <tbody>
            {REACHES.map(([name, where]) => (
              <tr key={name} className="border-b border-[#d9d3c7]">
                <td className="py-[20px] text-[18px] font-semibold">{name}</td>
                <td className="py-[20px] text-right text-[17px] text-[#57534c]">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TextBlock>

      <Crop src={settings} alt="Settings: each section with what it is set to, and search" x={0.17} y={0.128} w={0.825} h={0.617} width={896} className="absolute left-[608px] top-[92px]" />
      <div className={s.text} style={{ left: 608, top: 551, width: 896 }}>
        <p className={cn(s.mono, "flex items-center gap-2 uppercase text-[#aa3000]")}>
          <Search size={15} strokeWidth={2} aria-hidden /> Search by what you’d type
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-x-12 border-t-2 border-[#141413]">
          {SEARCHES.map(([q, a]) => (
            <li key={q} className="flex h-[60px] items-center gap-3 border-b border-[#d9d3c7]">
              <span className="font-mono text-[17px] text-[#57534c]">“{q}”</span>
              <span aria-hidden className="text-[#aa3000]">→</span>
              <span className="text-[19px] font-semibold">{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </Slide>
  );
}
