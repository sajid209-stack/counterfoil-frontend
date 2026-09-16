import type { ReactNode } from "react";
import {
  Bookmark,
  Briefcase,
  CalendarCheck,
  Columns2,
  Download,
  Link2,
  ListFilter,
  Moon,
  Music,
  Palette,
  Plane,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Crop, Glow, Hotspot, Laptop, Phone, Pill, SheetCard, Slide, Step, TextBlock, deckStyles as s } from "../_components/Parts";
import dashLight from "../_media/os-dashboard-light.jpg";
import calendar from "../_media/os-calendar-light.jpg";
import reportsDark from "../_media/os-reports-dark.jpg";
import eventOs from "../_media/os-event-dark.jpg";
import turfPhone from "../_media/web-turfcup-phone.jpg";
import sheetSeats from "../_media/sheet-seats.jpg";
import sheetSlots from "../_media/sheet-slots.jpg";

/*
 * Counterfoil OS — the parts a buyer asks about: the day at a glance, the
 * booking types, the calendar, the reports and event pages.
 *
 * Paper is OS's ground. Where a slide lists things, each is shown as a piece
 * of the product — a slot grid, a punch card, a chart — rather than an icon
 * and a line of text.
 *
 * Every crop is cut on a row boundary of its screenshot, so no screen stops
 * halfway through a line of text.
 */

export const OS_SECTION = "Counterfoil OS";

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
      <Laptop src={dashLight} width={840} alt="The Counterfoil OS dashboard for Lalbagh Heritage Attractions" className="absolute left-[664px] top-[180px]">
        {/* 1 sits on the corner of the first figure, not over its label. */}
        <Hotspot n={1} x={18.4} y={16.4} />
        <Hotspot n={2} x={49} y={46.5} />
        <Hotspot n={3} x={88.1} y={42.8} />
      </Laptop>
    </Slide>
  );
}

const CALENDAR_KEY: { icon: LucideIcon; label: string; body: string }[] = [
  { icon: CalendarCheck, label: "Today", body: "Marked, with a line at the current time." },
  { icon: Columns2, label: "Side by side", body: "Two bookings at one time never hide each other." },
  { icon: ListFilter, label: "The key", body: "Each state is also a filter, with its count." },
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
      <div className="absolute bottom-[100px] left-[96px] w-[464px]">
        {/* Clipped, with a short shadow: a long one darkened the caption under it below its reading floor. */}
        <div className="overflow-hidden rounded-[22px] bg-[#f94a00] p-[4px] shadow-[0_16px_30px_-20px_rgb(20_20_19/0.45)]">
          <Crop src={calendar} alt="" x={0.645} y={0.548} w={0.13} h={0.1} width={456} />
        </div>
        <p className={cn(s.mono, "mt-8 uppercase text-[#aa3000]")}>Held back · Fri 31 Jul, 14:00</p>
        <p className={cn(s.body, "mt-2")}>Off sale, and hatched so it never reads as booked.</p>
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
      <ul className="absolute bottom-[100px] left-[608px] grid w-[896px] grid-cols-3 gap-6">
        {CALENDAR_KEY.map(({ icon: Icon, label, body }) => (
          <li key={label} className="flex gap-3.5">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] bg-white text-[#aa3000] shadow-[0_1px_2px_rgb(20_20_19/0.06)] ring-1 ring-[#e7e2d8]">
              <Icon size={20} strokeWidth={1.7} aria-hidden />
            </span>
            <span>
              <span className="block text-[18px] font-semibold leading-tight">{label}</span>
              <span className={cn(s.body, "mt-1 block text-[16px]")}>{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </Slide>
  );
}

/** Daily capacity, as a tile on the sell wall reads it. */
function CapacityMeter() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold">Yoga Session</span>
        <span className="rounded-full bg-[#141413] px-2.5 py-1 text-[13px] font-medium leading-none text-[#f5f2eb]">Limited</span>
      </div>
      <div aria-hidden className="mt-4 h-[12px] overflow-hidden rounded-full bg-[#e2ddd2]">
        <div className="h-full w-[85%] rounded-full bg-[#f94a00]" />
      </div>
      <p className="mt-2.5 text-[15px] text-[#57534c]">
        <span className="font-semibold text-[#141413]">3 of 20</span> left today
      </p>
    </div>
  );
}

const SLOT_TIMES = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

/** Hourly slots on a field: one taken, one chosen. */
function SlotGrid() {
  return (
    <div className="w-full">
      <p className="text-[15px]">
        <span className="font-semibold">Futsal · Outdoor Field</span> <span className="text-[#57534c]">· Sat 1 Aug</span>
      </p>
      <div aria-hidden className="mt-3 grid grid-cols-4 gap-2">
        {SLOT_TIMES.map((t) => (
          <span
            key={t}
            className={cn(
              "grid h-[36px] place-items-center rounded-[10px] text-[15px] font-medium tabular-nums",
              t === "17:00" ? "text-[#6b675f] line-through" : t === "19:00" ? "bg-[#141413] text-[#f5f2eb]" : "bg-white ring-1 ring-inset ring-[#e2ddd2]",
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A credit pack: ten classes, three used. */
function PunchCard() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold">10-Class Yoga Pack</span>
        <span className="text-[15px] text-[#57534c]">7 left</span>
      </div>
      <div aria-hidden className="mt-4 grid grid-cols-10 gap-[7px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("aspect-square rounded-full", i < 3 ? "bg-[#141413]" : "bg-white ring-1 ring-inset ring-[#d9d3c7]")} />
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[13px] text-[#57534c]">CF-2026-PASS01 · 3 used</p>
    </div>
  );
}

/* The fourteen, grouped by what the guest is buying: a way in, a time or a place, or more than one visit. */
const WAYS: { group: string; cols: number; width: number; visual: ReactNode; items: [string, string][] }[] = [
  {
    group: "A way in",
    cols: 2,
    width: 392,
    visual: <CapacityMeter />,
    items: [
      ["Open entry", "Walk in, any time"],
      ["Date passes", "A day, a week, a season"],
      ["Daily capacity", "200 a day, any time"],
      ["Quick passes", "Parking by the plate"],
    ],
  },
  {
    group: "A time or a place",
    cols: 3,
    width: 576,
    visual: <SlotGrid />,
    items: [
      ["Timed sessions", "Every 45 minutes"],
      ["Seat maps", "The seat, on a plan"],
      ["Courts & fields", "Hourly, per court"],
      ["Flexible duration", "A lane by the hour"],
      ["Guided tours", "When a guide is free"],
      ["Appointments", "A therapist and a time"],
    ],
  },
  {
    group: "More than one visit",
    cols: 2,
    width: 392,
    visual: <PunchCard />,
    items: [
      ["Courses", "Eight sessions, one sale"],
      ["Credit packs", "Ten classes, over time"],
      ["Bundles", "Three sights, one price"],
      ["Waitlists", "When a place frees up"],
    ],
  },
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
      <SheetCard src={sheetSeats} alt="The seat map sheet for an evening film, three seats chosen" width={184} className="absolute left-[1098px] top-[104px] rotate-[-4deg]" />
      <SheetCard src={sheetSlots} alt="Hourly slots on a futsal field" width={184} className="absolute left-[1300px] top-[96px] rotate-[5deg]" />

      <div className="absolute left-[96px] top-[424px] flex h-[376px] gap-6">
        {WAYS.map(({ group, cols, width, visual, items }) => (
          <section key={group} className={cn(s.card, s.paperCard, "flex flex-col p-6")} style={{ width }}>
            <p className={cn(s.mono, "flex items-center justify-between uppercase text-[#aa3000]")}>
              {group}
              <span className="rounded-full bg-[#f5f2eb] px-2.5 py-1 text-[13px] leading-none text-[#57534c]">{items.length}</span>
            </p>
            <div className="mt-4 flex h-[138px] items-center rounded-[16px] bg-[#f5f2eb] px-5">{visual}</div>
            <ul className="mt-5 grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {items.map(([name, hint]) => (
                <li key={name}>
                  <p className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">{name}</p>
                  <p className="mt-1 text-[14px] leading-snug text-[#6b675f]">{hint}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Slide>
  );
}

const EMBER = "#ff7a3d";
const FAINT = "rgb(245 242 235 / 0.26)";

/** The eight analytics charts, each drawn as the shape it takes in Reports. */
const CHARTS: { name: string; art: ReactNode }[] = [
  {
    name: "Revenue trend",
    art: (
      <>
        <polyline points="2,40 16,36 30,37 44,30 58,32 72,24 86,26 98,20" fill="none" stroke={FAINT} strokeWidth={2} strokeDasharray="3 3" />
        <polyline points="2,38 16,28 30,32 44,16 58,22 72,10 86,15 98,6" fill="none" stroke={EMBER} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: "By hour",
    art: [6, 10, 16, 24, 20, 30, 40, 28, 18, 24, 14, 8].map((h, i) => <rect key={i} x={3 + i * 8} y={44 - h} width={5} height={h} rx={1.5} fill={i === 6 ? EMBER : FAINT} />),
  },
  {
    name: "By weekday",
    art: [22, 26, 20, 28, 34, 42, 36].map((h, i) => <rect key={i} x={4 + i * 13.5} y={44 - h} width={9} height={h} rx={2} fill={i === 5 ? EMBER : FAINT} />),
  },
  {
    name: "Payment mix",
    art: (
      <g transform="translate(50 24) rotate(-90)">
        <circle r={16} fill="none" stroke={FAINT} strokeWidth={8} />
        <circle r={16} fill="none" stroke={EMBER} strokeWidth={8} strokeDasharray="31 70" />
        <circle r={16} fill="none" stroke="rgb(245 242 235 / 0.72)" strokeWidth={8} strokeDasharray="25 76" strokeDashoffset={-33} />
      </g>
    ),
  },
  {
    name: "Capacity",
    art: (
      <>
        <rect x={4} y={10} width={92} height={10} rx={5} fill={FAINT} />
        <rect x={4} y={10} width={64} height={10} rx={5} fill={EMBER} />
        <rect x={4} y={28} width={92} height={10} rx={5} fill={FAINT} />
        <rect x={4} y={28} width={38} height={10} rx={5} fill="rgb(245 242 235 / 0.72)" />
      </>
    ),
  },
  {
    name: "No-shows",
    art: Array.from({ length: 20 }, (_, i) => (
      <circle key={i} cx={9 + (i % 10) * 9.2} cy={i < 10 ? 15 : 33} r={3.4} fill={i === 13 ? "none" : FAINT} stroke={i === 13 ? EMBER : "none"} strokeWidth={1.8} />
    )),
  },
  {
    name: "Lead time",
    art: [40, 32, 25, 19, 14, 10, 7, 4].map((h, i) => <rect key={i} x={4 + i * 11.8} y={44 - h} width={8} height={h} rx={2} fill={i === 0 ? EMBER : FAINT} />),
  },
  {
    name: "Top bookings",
    art: [92, 70, 54, 38].map((w, i) => <rect key={i} x={4} y={4 + i * 11} width={w} height={7} rx={3.5} fill={i === 0 ? EMBER : FAINT} />),
  },
];

export function ReportsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section={OS_SECTION} label="Read the business by the hour">
      <Glow className="left-[760px] top-[380px] h-[700px] w-[800px] opacity-70" />
      <TextBlock eyebrow="Reports" title="Read the business by the hour." lead="Transactions, a summary, what is outstanding and analytics — all from one ledger.">
        <ul className="grid grid-cols-4 gap-x-3.5 gap-y-5">
          {CHARTS.map(({ name, art }) => (
            <li key={name}>
              <div className="rounded-[14px] bg-white/[0.05] px-3 py-3 ring-1 ring-inset ring-white/10">
                <svg aria-hidden viewBox="0 0 100 48" className="block h-[48px] w-full">
                  {art}
                </svg>
              </div>
              <p className="mt-2 text-[15px] font-medium text-[rgb(245_242_235/0.86)]">{name}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-8 flex gap-2.5">
          {[
            { icon: Download, label: "Export CSV" },
            { icon: Bookmark, label: "Save a view" },
            { icon: Link2, label: "Share a link" },
          ].map(({ icon: Icon, label }) => (
            <li key={label}>
              <Pill>
                <Icon size={17} strokeWidth={1.6} aria-hidden /> {label}
              </Pill>
            </li>
          ))}
        </ul>
      </TextBlock>
      <Laptop src={reportsDark} width={760} tilt="left" alt="Sales analytics: revenue over time, sales by weekday and payment mix" className="absolute left-[744px] top-[236px]" />
    </Slide>
  );
}

/** The six templates, one per kind of event. */
const TEMPLATES: { name: string; hint: string; icon: LucideIcon }[] = [
  { name: "Entertainment", hint: "Concerts, shows", icon: Music },
  { name: "Sports", hint: "Tournaments", icon: Trophy },
  { name: "Business", hint: "Conferences", icon: Briefcase },
  { name: "Arts", hint: "Exhibitions", icon: Palette },
  { name: "Travel", hint: "Tours, trips", icon: Plane },
  { name: "Nightlife", hint: "Club nights", icon: Moon },
];

export function EventsSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Events" label="A page for every event">
      <Glow className="left-[820px] top-[-280px] h-[820px] w-[860px] opacity-80" />
      <TextBlock eyebrow="Events" title="A page for every event." lead="One template per kind of event, each built from the event’s own bill and tickets." width={500}>
        <div className="flex gap-2.5">
          {[
            ["6", "events on sale"],
            ["4,867", "tickets sold"],
          ].map(([value, label]) => (
            <p key={label} className="flex items-baseline gap-2 rounded-full bg-white/[0.06] px-5 py-3 ring-1 ring-inset ring-white/10">
              <span className="text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</span>
              <span className="text-[16px] text-[rgb(245_242_235/0.72)]">{label}</span>
            </p>
          ))}
        </div>
        <p className="mt-11 font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Six templates</p>
        <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-6">
          {TEMPLATES.map(({ name, hint, icon: Icon }) => (
            <li key={name} className="flex items-center gap-4">
              <span className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-[14px] bg-white/[0.06] text-[#ffa572] ring-1 ring-inset ring-white/10">
                <Icon size={22} strokeWidth={1.6} aria-hidden />
              </span>
              <span>
                <span className="block text-[18px] font-semibold leading-tight">{name}</span>
                <span className="mt-0.5 block text-[15px] text-[rgb(245_242_235/0.66)]">{hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>
      {/* Both in dark: OS in its dark theme, and the event's own floodlit page on the phone. Set well clear of the words. */}
      <Laptop
        src={eventOs}
        width={760}
        tilt="left"
        alt="Chattogram Turf Cup in Counterfoil OS, dark theme: 622 of 1,216 tickets sold, with a live preview of its page"
        className="absolute left-[740px] top-[176px]"
      />
      <Phone src={turfPhone} bar="#09160f" ink="light" width={188} tilt="right" alt="The Chattogram Turf Cup page on a phone" className="absolute left-[1316px] top-[388px]" />
    </Slide>
  );
}
