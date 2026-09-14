import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Armchair,
  Bookmark,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesColumn,
  Clock,
  Columns2,
  CornerDownLeft,
  Download,
  LandPlot,
  LayoutDashboard,
  Link2,
  ListFilter,
  Lock,
  Moon,
  Music,
  Palette,
  PartyPopper,
  Plane,
  Receipt,
  ReceiptText,
  Search,
  Settings,
  Shapes,
  Ticket as TicketIcon,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Crop,
  Floor,
  Glow,
  Hotspot,
  Laptop,
  Phone,
  Pill,
  SheetCard,
  Slide,
  Step,
  TextBlock,
  Ticket,
  Ticks,
  deckStyles as s,
  type ChapterPart,
} from "../_components/Parts";
import { GoLockup } from "../_components/GoLogo";
import logoOnPaper from "../_media/logo-counterfoil.png";
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
 * Paper is the OS chapter's ground and ink is Go's. Where a slide lists
 * things, each is shown as a piece of the product — a slot grid, a punch card,
 * a bulk bar, a search result — rather than an icon and a line of text.
 *
 * Every crop is cut on a row boundary of its screenshot, so no screen stops
 * halfway through a line of text.
 */

export const OS_SECTION = "01 · Counterfoil OS";

/** The parts of chapter 01, each with the icon the OS sidebar gives it. */
export const OS_CONTENTS: ChapterPart[] = [
  { name: "Dashboard", page: 6, icon: LayoutDashboard },
  { name: "Calendar", page: 7, icon: CalendarDays },
  { name: "Bookings", page: 8, icon: TicketIcon },
  { name: "Booking types", page: 9, icon: Shapes },
  { name: "Holds", page: 10, icon: Lock },
  { name: "Orders", page: 11, icon: ReceiptText },
  { name: "Customers", page: 12, icon: UsersRound },
  { name: "Reports", page: 13, icon: ChartNoAxesColumn },
  { name: "Events", page: 14, icon: PartyPopper },
  { name: "Settings", page: 15, icon: Settings },
];

/* A contents item is an icon tile over its name and page. */
const PART_W = 124;
const PART_H = 112;
const PART_GAP_Y = 28;

/**
 * A chapter opens on ink, with the product's own marque printed on the ticket
 * and the chapter's number on its stub. The Counterfoil logotype is OS's own
 * mark — the app draws no OS tag beside it — and Go carries the Go artwork,
 * streaks and all. What the chapter holds is set like an app's home screen:
 * each part's icon, its name, and the page it starts on.
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
  contents: ChapterPart[];
}) {
  const logo = marque === "go" ? <GoLockup /> : <Image src={logoOnPaper} alt="" sizes="360px" />;
  const cols = contents.length > 6 ? 5 : contents.length;
  return (
    <Slide tone="ink" n={n} section={`${chapter} · ${product}`} label={title}>
      <Glow className="left-[840px] top-[-260px] h-[940px] w-[940px]" />
      <Floor />
      <p className={cn(s.eyebrow, "absolute left-[96px] top-[92px]")}>Chapter {chapter}</p>
      {/* Anchored by its foot: title, lead and contents end on the same line (y 730) on both openers, however many parts they hold. */}
      <div className={s.text} style={{ left: 96, bottom: 170, width: 760 }}>
        <h2 className={s.display}>{title}</h2>
        <p className={cn(s.lead, "mt-8 w-[620px]")}>{lead}</p>
        <ol className="mt-11 grid" style={{ gridTemplateColumns: `repeat(${cols}, ${PART_W}px)`, rowGap: PART_GAP_Y }}>
          {contents.map(({ name, page, icon: Icon }) => (
            <li key={name} className="flex flex-col" style={{ height: PART_H }}>
              <span className="grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-white/[0.06] text-[#ffa572] ring-1 ring-inset ring-white/10">
                <Icon size={26} strokeWidth={1.5} aria-hidden />
              </span>
              <span className="mt-3 text-[16px] font-medium leading-tight text-[#f5f2eb]">{name}</span>
              <span className="mt-1 font-mono text-[13px] tabular-nums text-[rgb(245_242_235/0.62)]">{String(page).padStart(2, "0")}</span>
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

/** A switch as the settings pages draw it, on. */
function SwitchOn() {
  return (
    <span aria-hidden className="relative h-[24px] w-[42px] shrink-0 rounded-full bg-[#f94a00]">
      <span className="absolute right-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgb(20_20_19/0.3)]" />
    </span>
  );
}

export function BookingsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Everything you sell, in one catalogue">
      <TextBlock eyebrow="Bookings" title="Everything you sell, in one catalogue." width={860} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Admission, tours, courts and events — each with its price, its category and where it is sold.
      </p>

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

      {/* Three facts, each shown with the piece of the catalogue that does it. */}
      <div className="absolute left-[1024px] top-[357px] flex h-[443px] w-[480px] flex-col gap-4">
        <div className={cn(s.card, "relative flex h-[151px] shrink-0 items-center justify-between gap-6 bg-[#141413] px-8 text-[#f5f2eb]")}>
          <Glow className="left-[260px] top-[-60px] h-[260px] w-[260px] opacity-60" />
          <div className="relative">
            <p className="font-mono text-[14px] uppercase tracking-[0.12em] text-[#ffa572]">Not sellable</p>
            <p className="mt-2 w-[280px] text-[17px] leading-[1.45] text-[rgb(245_242_235/0.8)]">A booking missing a price, a schedule or somewhere to sell says so first.</p>
          </div>
          <span className="relative text-[96px] font-semibold leading-none tracking-[-0.06em] text-[#ff7a3d]">0</span>
        </div>
        <div className={cn(s.card, s.paperCard, "flex flex-1 flex-col justify-between px-6 py-5")}>
          <h3 className={s.heading}>On, off or archived — in bulk</h3>
          <div aria-hidden className="flex items-center gap-1.5 rounded-[14px] bg-[#141413] py-1.5 pl-4 pr-1.5 text-[15px] text-[#f5f2eb]">
            <span className="mr-auto font-medium">2 selected</span>
            {["Activate", "Deactivate", "Archive"].map((a) => (
              <span key={a} className="rounded-[10px] bg-white/10 px-3 py-1.5">
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className={cn(s.card, s.paperCard, "flex flex-1 flex-col justify-between px-6 py-5")}>
          <h3 className={s.heading}>Sold where you choose</h3>
          <div className="flex gap-3">
            {["Counter", "Online"].map((c) => (
              <span key={c} className="flex flex-1 items-center justify-between rounded-[14px] bg-[#f5f2eb] py-2.5 pl-4 pr-3 text-[16px] font-medium">
                {c}
                <SwitchOn />
              </span>
            ))}
          </div>
        </div>
      </div>
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

      <div className={cn(s.card, s.paperCard, "absolute left-[96px] top-[260px] h-[190px] w-[692px] px-7 py-6")}>
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

      <div className={cn(s.card, s.paperCard, "absolute left-[812px] top-[260px] h-[190px] w-[692px] px-7 py-6")}>
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
        className="absolute left-[96px] top-[474px]"
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
    <Slide tone="ink" n={n} section={OS_SECTION} label="A page for every event">
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

/** Settings that reach the counter, and where each one shows up. */
const REACHES = [
  ["Payment methods", "Till pay buttons"],
  ["Tax", "Every line of a sale"],
  ["Opening float", "Start of a shift"],
  ["Receipt message", "Every receipt"],
  ["Wrong PINs allowed", "PIN screen"],
];

const SEARCHES = [
  ["bkash", "Payments"],
  ["dark mode", "Preferences"],
  ["quiet hours", "Notifications"],
];

export function SettingsSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section={OS_SECTION} label="Set up once, and the till follows">
      <TextBlock eyebrow="Settings" title="Set up once." lead="Change a setting and the till follows — there is no second place to update it." width={464} />
      {/* Each setting joined to the place a cashier meets it — on the bottom line, level with the search block. */}
      <div className={s.text} style={{ left: 96, bottom: 100, width: 464 }}>
        <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Where each one shows up</p>
        <ul className="mt-4 flex flex-col gap-[18px]">
          {REACHES.map(([name, where]) => (
            <li key={name} className="flex h-[62px] items-center">
              <span className="flex h-full shrink-0 items-center rounded-[14px] bg-white px-4 text-[17px] font-semibold shadow-[0_1px_2px_rgb(20_20_19/0.06)] ring-1 ring-[#e7e2d8]">
                {name}
              </span>
              <span aria-hidden className="mx-2 flex min-w-[28px] flex-1 items-center">
                <span className="h-[2px] flex-1 bg-[repeating-linear-gradient(90deg,#e0a27f_0_6px,transparent_6px_11px)]" />
                <ArrowRight size={16} strokeWidth={2.2} className="-ml-1 text-[#d9814f]" />
              </span>
              <span className="flex h-[42px] shrink-0 items-center rounded-full bg-[#141413] px-4 text-[15px] font-medium text-[#f5f2eb]">{where}</span>
            </li>
          ))}
        </ul>
      </div>

      <Crop src={settings} alt="Settings: each section with what it is set to, and search" x={0.17} y={0.128} w={0.825} h={0.617} width={896} className="absolute left-[608px] top-[92px]" />
      <div className={s.text} style={{ left: 608, top: 551, width: 896 }}>
        <p className={cn(s.mono, "flex items-center gap-2 uppercase text-[#aa3000]")}>
          <Search size={15} strokeWidth={2} aria-hidden /> Search by what you’d type
        </p>
        <div className="mt-4 flex h-[215px] gap-5">
          {/* The settings search, with “vat” typed and the one section it finds. */}
          <div className={cn(s.card, s.paperCard, "flex w-[544px] flex-col")}>
            <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[#efe9df] px-5">
              <Search size={18} strokeWidth={1.8} className="text-[#57534c]" aria-hidden />
              <span className="text-[19px] font-medium">vat</span>
              <span aria-hidden className="-ml-2 h-[22px] w-[2px] rounded-full bg-[#f94a00]" />
            </div>
            <p className="px-5 pt-3.5 font-mono text-[12px] uppercase tracking-[0.1em] text-[#6b675f]">Settings</p>
            <div className="mx-2.5 mt-2 flex items-center gap-3.5 rounded-[14px] bg-[#fbeee6] px-3.5 py-3">
              <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-white text-[#aa3000] ring-1 ring-[#f1d6c6]">
                <Receipt size={20} strokeWidth={1.7} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold leading-tight">Tax</span>
                <span className="mt-0.5 block text-[15px] text-[#57534c]">VAT 15% · reduced 7.5%</span>
              </span>
              <CornerDownLeft size={18} strokeWidth={1.8} className="ml-auto text-[#aa3000]" aria-hidden />
            </div>
            <p className="mt-auto px-5 pb-3.5 text-[14px] text-[#6b675f]">One result · Enter to open</p>
          </div>
          <ul className="flex flex-1 flex-col gap-3">
            {SEARCHES.map(([q, a]) => (
              <li key={q} className="flex flex-1 items-center gap-3 rounded-[14px] bg-white px-4 shadow-[0_1px_2px_rgb(20_20_19/0.05)] ring-1 ring-[#e7e2d8]">
                <span className="font-mono text-[15px] text-[#57534c]">“{q}”</span>
                <ArrowRight size={16} strokeWidth={2} className="text-[#aa3000]" aria-hidden />
                <span className="text-[17px] font-semibold">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Slide>
  );
}
