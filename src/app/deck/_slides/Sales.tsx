import { Banknote, CalendarClock, Check, Infinity as InfinityIcon, PartyPopper, ScanLine, Shapes, Wallet, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Glow, Slide, TextBlock, deckStyles as s } from "../_components/Parts";

/*
 * The case for buying: what gets better, what a marketplace costs, what
 * Counterfoil costs, and what that difference comes to.
 *
 * The prices here are the real Bangladesh price list. Nothing about another
 * company is named or quoted as its own figure — the comparison is with the
 * marketplace *model*, at the range those platforms charge as a group.
 */

const PAPER_MUTED = "#57534c";
const PAPER_QUIET = "#6b675f";
const INK_MUTED = "rgb(245 242 235 / 0.72)";
const INK_QUIET = "rgb(245 242 235 / 0.64)";

/* ── What gets better ──────────────────────────────────────────────────── */

const JOBS: { icon: LucideIcon; job: string; today: string; after: string }[] = [
  { icon: CalendarClock, job: "Availability", today: "“Is 18:00 free?” — asked in a chat group.", after: "Every counter reads the same live count." },
  { icon: Shapes, job: "Selling time", today: "A retail till that knows products, not sessions.", after: "Sessions, courts, seats and tours — 14 ways to book." },
  { icon: Wallet, job: "Payment", today: "A bKash screenshot, checked by eye.", after: "bKash confirmed by transaction ID before the sale lands." },
  { icon: ScanLine, job: "The gate", today: "A paper stub passed from hand to hand.", after: "One scan admits. A used ticket is refused." },
  { icon: PartyPopper, job: "Events", today: "A marketplace takes a cut of every ticket.", after: "Your own event page, and no cut of the ticket." },
  { icon: Banknote, job: "Cash-up", today: "A cash box that never quite adds up.", after: "Counted against expected, with the variance on record." },
];

/**
 * Each job is a ticket: the way it is done today is the stub, torn off along
 * the perforation, and what Counterfoil does is the part the venue keeps.
 */
function JobTicket({ icon: Icon, job, today, after }: (typeof JOBS)[number]) {
  return (
    <li className={cn(s.card, s.paperCard, "flex flex-col [--card-r:20px]")}>
      <div className="bg-[#f3eee6] px-6 pb-[18px] pt-5">
        <p className="flex items-center gap-2 font-mono text-[13px] uppercase leading-none tracking-[0.12em] text-[#aa3000]">
          <Icon size={16} strokeWidth={1.8} aria-hidden />
          {job}
          <span className="text-[#6b675f]">· Today</span>
        </p>
        <p className="mt-2.5 text-[17px] leading-[1.4]" style={{ color: PAPER_MUTED }}>
          {today}
        </p>
      </div>
      {/* The tear: a dashed rule between two notches cut into the card's edges. */}
      <div aria-hidden className="relative h-0 border-t-2 border-dashed border-[#d9d3c7]">
        <span className="absolute -left-[9px] -top-[9px] h-[16px] w-[16px] rounded-full bg-[#f5f2eb]" />
        <span className="absolute -right-[9px] -top-[9px] h-[16px] w-[16px] rounded-full bg-[#f5f2eb]" />
      </div>
      <div className="flex flex-1 items-center px-6 py-5">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="mt-[3px] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#141413] text-[#f5f2eb]">
            <Check size={16} strokeWidth={2.6} />
          </span>
          <p className="text-[24px] font-semibold leading-[1.25] tracking-[-0.018em]">{after}</p>
        </div>
      </div>
    </li>
  );
}

export function BetterSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Why Counterfoil" label="What gets better on day one">
      <TextBlock
        eyebrow="Why Counterfoil"
        title={
          <>
            What gets better
            <br />
            on day one.
          </>
        }
        width={760}
      />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        The jobs a venue already does — done in one system, instead of a spreadsheet, a chat group, a till and a marketplace.
      </p>
      <ul className="absolute left-[96px] top-[300px] grid h-[500px] w-[1408px] grid-cols-3 grid-rows-2 gap-6">
        {JOBS.map((j) => (
          <JobTicket key={j.job} {...j} />
        ))}
      </ul>
    </Slide>
  );
}

/* ── What a marketplace costs ──────────────────────────────────────────── */

/*
 * The marketplace share, as a band rather than a figure: commission plus
 * payment processing, at the rates ticketing sites in Bangladesh charge as a
 * group. No platform is named and no platform's own figure is quoted.
 */
const SHARE_LOW = 0.065;
const SHARE_HIGH = 0.12;
/** The month the deck works through: 1,000 tickets at ৳500. */
const TICKETS = 1000;
const TICKET_PRICE = 500;
const REVENUE = TICKETS * TICKET_PRICE;

const taka = (v: number) => `৳${Math.round(v).toLocaleString("en-US")}`;

const SIDES: { kind: "them" | "us"; title: string; lead: string; rows: [string, string][]; figure: string; figureNote: string }[] = [
  {
    kind: "them",
    title: "Sold through a marketplace",
    lead: "A share of every ticket, for as long as you sell.",
    rows: [
      ["What it costs", "5–10% commission, plus 1.5–2% payment processing"],
      ["Where the buyer is", "On the platform’s page, beside other people’s events"],
      ["What you learn", "Whatever the platform passes back"],
      ["At the door", "A separate app, or a list on paper"],
    ],
    figure: `${taka(REVENUE * SHARE_LOW)}–${taka(REVENUE * SHARE_HIGH)}`,
    figureNote: "that month, on 1,000 tickets at ৳500",
  },
  {
    kind: "us",
    title: "Sold on Counterfoil",
    lead: "Your page, your guest list, your counter.",
    rows: [
      ["What it costs", "A monthly plan with no cut of ticket sales — or 6% and nothing monthly"],
      ["Where the buyer is", "On your own event page, in your own name"],
      ["What you learn", "Every buyer is a record of yours, with consent on file"],
      ["At the door", "The same system sells at the counter and scans at the gate"],
    ],
    figure: "৳9,990",
    figureNote: "the Growth plan, whatever you sell",
  },
];

export function MarketplaceSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Events" label="What a marketplace costs">
      <Glow className="left-[880px] top-[-260px] h-[820px] w-[860px] opacity-70" />
      <TextBlock eyebrow="Events · The alternative" title="A cut of every ticket, for ever." width={820} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Ticketing sites in Bangladesh take between 5% and 10% of a ticket, plus processing. Most don’t publish the rate at all.
      </p>

      <div className="absolute left-[96px] top-[292px] grid h-[508px] w-[1408px] grid-cols-2 gap-6">
        {SIDES.map(({ kind, title, lead, rows, figure, figureNote }) => {
          const us = kind === "us";
          return (
            <section key={title} className={cn(s.card, "relative flex flex-col p-9", us ? "bg-[#f5f2eb] text-[#141413]" : s.inkCard)}>
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full",
                    us ? "bg-[#141413] text-[#f5f2eb]" : "bg-white/10 text-[rgb(245_242_235/0.7)]",
                  )}
                >
                  {us ? <Check size={19} strokeWidth={2.6} /> : <X size={19} strokeWidth={2.4} />}
                </span>
                <h3 className="text-[27px] font-semibold tracking-[-0.02em]">{title}</h3>
              </div>
              <p className={cn("mt-2.5 text-[19px]", us ? "text-[#57534c]" : "text-[rgb(245_242_235/0.72)]")}>{lead}</p>
              <dl className="mt-6 flex flex-col gap-4">
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt className={cn("font-mono text-[13px] uppercase tracking-[0.12em]", us ? "text-[#aa3000]" : "text-[#ffa572]")}>{label}</dt>
                    <dd className="mt-1 text-[18px] leading-[1.4]">{value}</dd>
                  </div>
                ))}
              </dl>
              {/* Each side ends on what that same month costs. */}
              <p className={cn("mt-auto flex items-baseline gap-3 border-t pt-5", us ? "border-[#e2ddd2]" : "border-white/10")}>
                <span className={cn("text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums", us && "text-[#aa3000]")}>{figure}</span>
                <span className={cn("text-[16px]", us ? "text-[#57534c]" : "text-[rgb(245_242_235/0.72)]")}>{figureNote}</span>
              </p>
            </section>
          );
        })}
      </div>

    </Slide>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────── */

const PLANS = [
  { name: "Lite", who: "One counter, getting started", monthly: 0, yearly: 0, seats: "1 seat · 1 location", meters: "500 SMS a month", extra: "Chat support", support: "chat" },
  { name: "Starter", who: "A venue with a few staff", monthly: 2990, yearly: 29900, seats: "3 seats · 1 location", meters: "1,000 SMS, emails and form replies", extra: "Memberships, retail, food & drink", support: "chat" },
  { name: "Growth", who: "Several counters, or two sites", monthly: 9990, yearly: 99900, seats: "10 seats · 2 locations", meters: "3,000 SMS, emails and form replies", extra: "Agents and kitchen display included", support: "priority" },
  { name: "Advanced", who: "Groups and busy operations", monthly: 14990, yearly: 149900, seats: "25 seats · 3 locations", meters: "5,000 SMS, emails and form replies", extra: "Phone support, full API", support: "phone" },
];

export function PricingSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Pricing" label="Four plans for venues, one for events">
      <Glow className="left-[560px] top-[300px] h-[660px] w-[700px] opacity-55" />
      <TextBlock eyebrow="Pricing · Bangladesh (BDT)" title="Four plans for venues. One for events." width={880} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Every plan is the whole system — the admin app and the till. Plans differ by seats, locations and what the meters include. Pay yearly and two months are free.
      </p>

      <ul className="absolute left-[96px] top-[292px] grid h-[344px] w-[1408px] grid-cols-4 gap-5">
        {PLANS.map((p) => {
          const featured = p.name === "Growth";
          return (
            <li
              key={p.name}
              className={cn(s.card, "relative flex flex-col p-7 [--card-r:20px]", featured ? "bg-[#f5f2eb] text-[#141413] shadow-[0_40px_80px_-40px_rgb(249_74_0/0.55)]" : s.inkCard)}
            >
              {featured && (
                <span className="absolute right-6 top-7 rounded-full bg-[#141413] px-2.5 py-1 font-mono text-[12px] uppercase leading-none tracking-[0.1em] text-[#f5f2eb]">
                  Recommended
                </span>
              )}
              <h3 className="text-[23px] font-semibold tracking-[-0.02em]">{p.name}</h3>
              <p className={cn("mt-1 text-[15px] leading-snug", featured ? "text-[#57534c]" : "text-[rgb(245_242_235/0.7)]")}>{p.who}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[46px] font-semibold leading-none tracking-[-0.04em]">{p.monthly === 0 ? "৳0" : taka(p.monthly)}</span>
                <span className={cn("text-[16px]", featured ? "text-[#57534c]" : "text-[rgb(245_242_235/0.7)]")}>a month</span>
              </p>
              <p className={cn("mt-2 text-[14px]", featured ? "text-[#6b675f]" : "text-[rgb(245_242_235/0.6)]")}>
                {p.yearly === 0 ? "Free, month to month" : `${taka(p.yearly)} a year — two months free`}
              </p>

              <ul className={cn("mt-6 flex flex-col gap-2.5 border-t pt-5 text-[15px] leading-snug", featured ? "border-[#e2ddd2]" : "border-white/10")}>
                {[p.seats, p.meters, p.extra].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check size={15} strokeWidth={2.4} className={cn("mt-[3px] shrink-0", featured ? "text-[#aa3000]" : "text-[#ffa572]")} aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {/* Events is a different model, so it is a different object on the slide. */}
      <div className="absolute left-[96px] top-[664px] flex h-[104px] w-[1408px] items-center gap-8 rounded-[20px] border border-[#ff7a3d]/35 bg-[#ff7a3d]/[0.09] px-9">
        <div className="shrink-0">
          <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-[#ffa572]">For event organisers</p>
          <p className="mt-1.5 text-[27px] font-semibold tracking-[-0.02em]">Events</p>
        </div>
        <p className="flex items-baseline gap-3">
          <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">6%</span>
          <span className="text-[18px]" style={{ color: INK_MUTED }}>
            of ticket revenue, nothing monthly
          </span>
        </p>
        <ul className="ml-auto flex gap-8 text-[17px]">
          {["Unlimited seats and locations", "Pay as you go on every meter", "Full API"].map((line) => (
            <li key={line} className="flex items-center gap-2.5">
              <InfinityIcon size={17} strokeWidth={1.8} className="shrink-0 text-[#ffa572]" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className={s.text} style={{ left: 96, top: 790, width: 1408, fontSize: 14, color: INK_QUIET }}>
        SMS, email, form replies and waivers come with an allowance in every plan; past it they are charged per unit, and the rate falls as the plan grows.
      </p>
    </Slide>
  );
}

/* ── What each plan includes ───────────────────────────────────────────── */

type Cell = string | boolean;
const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell, Cell] }[] = [
  { label: "Team seats", cells: ["1", "3", "10", "25", "Unlimited"] },
  { label: "Locations", cells: ["1", "1", "2", "3", "Unlimited"] },
  { label: "Forms", cells: [false, "1", "10", "25", false] },
  { label: "SMS, email and form replies, a month", cells: ["500 SMS", "1,000", "3,000", "5,000", "Pay as you go"] },
  { label: "Waivers, a month", cells: [false, "250", "1,000", "2,000", "Pay as you go"] },
  { label: "Agents and kitchen display", cells: [false, "Add ৳990", true, true, false] },
  { label: "Memberships, retail, food & drink", cells: [false, true, true, true, "Retail only"] },
  { label: "API", cells: [false, "Store", "Full", "Full", "Full"] },
  { label: "Support", cells: ["Chat", "Chat", "Priority chat", "Phone", "Phone"] },
];

const COLUMNS = ["Lite", "Starter", "Growth", "Advanced", "Events"];
const GRID = "grid grid-cols-[404px_repeat(5,minmax(0,1fr))] items-center gap-x-4";

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check size={19} strokeWidth={2.4} className="text-[#aa3000]" aria-label="Included" />;
  if (value === false)
    return (
      <span aria-label="Not included" className="h-[2px] w-[16px] rounded-full bg-[#cfc9bd]" />
    );
  return <span className="text-[17px] font-medium leading-snug">{value}</span>;
}

export function IncludedSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Pricing" label="What each plan includes">
      <TextBlock eyebrow="Pricing · What you get" title="The whole system in every plan." width={860} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        No feature is held back to sell the next plan up. What changes is how many people, places and messages a plan carries.
      </p>

      <div className="absolute left-[96px] top-[292px] w-[1408px]">
        <div className={cn(GRID, "px-6 pb-3 font-mono text-[13px] uppercase leading-none tracking-[0.12em]")} style={{ color: PAPER_QUIET }}>
          <span />
          {COLUMNS.map((c) => (
            <span key={c} className={c === "Growth" ? "text-[#aa3000]" : undefined}>
              {c}
            </span>
          ))}
        </div>
        <ul className={cn(s.card, s.paperCard, "flex flex-col [--card-r:20px]")}>
          {ROWS.map(({ label, cells }, i) => (
            <li key={label} className={cn(GRID, "h-[50px] px-6", i % 2 === 1 && "bg-[#faf8f4]")}>
              <span className="text-[17px] font-semibold leading-snug">{label}</span>
              {cells.map((value, j) => (
                <span key={j} className="flex items-center" style={{ color: PAPER_MUTED }}>
                  <CellValue value={value} />
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[15px]" style={{ color: PAPER_QUIET }}>
          Past the allowance: SMS from ৳0.75 down to ৳0.60 a message, waivers from ৳1.50 down to ৳1.00, as the plan grows. Lite can add SMS for ৳490 a month.
        </p>
      </div>
    </Slide>
  );
}

/* ── What it costs ─────────────────────────────────────────────────────── */

/*
 * One chart, one axis: monthly cost against tickets sold, for the Growth plan
 * and for the marketplace share. Counterfoil is ember and the share is
 * blue-600 — the pair passes the palette checks on white (lightness, chroma,
 * colour-blind and normal-vision separation, 3:1 against the card). Text is
 * never drawn in a series colour; the marks carry identity and are named twice,
 * in the legend and on the chart.
 */

const EMBER = "#f94a00";
const BLUE = "#2563eb";

const GROWTH = PLANS[2];
const X_MAX = 1500;
const Y_MAX = 90000;

const W = 828;
const H = 400;
const PLOT = { left: 72, right: W - 176, top: 16, bottom: H - 48 };

const sx = (tickets: number) => PLOT.left + (tickets / X_MAX) * (PLOT.right - PLOT.left);
const sy = (cost: number) => PLOT.bottom - (cost / Y_MAX) * (PLOT.bottom - PLOT.top);

const share = (tickets: number, rate: number) => tickets * TICKET_PRICE * rate;
/** Where the plan's flat fee meets each edge of the marketplace band. */
const evenAt = (rate: number) => GROWTH.monthly / (TICKET_PRICE * rate);

function CostChart() {
  const lowCross = evenAt(SHARE_HIGH);
  const highCross = evenAt(SHARE_LOW);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Monthly cost against tickets sold, at ৳${TICKET_PRICE} a ticket. The Growth plan is flat at ${taka(GROWTH.monthly)} however many tickets are sold. A marketplace share of 6.5% to 12% of ticket revenue rises with every ticket, reaching ${taka(share(TICKETS, SHARE_LOW))} to ${taka(share(TICKETS, SHARE_HIGH))} a month at ${TICKETS.toLocaleString("en-US")} tickets. The two meet between ${Math.round(lowCross)} and ${Math.round(highCross)} tickets a month.`}
      className="block"
    >
      {[0, 30000, 60000, 90000].map((v) => (
        <g key={v}>
          <line x1={PLOT.left} x2={PLOT.right} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "#cfc9bd" : "#ece7de"} strokeWidth={1} />
          <text x={PLOT.left - 12} y={sy(v) + 5} textAnchor="end" fontSize={15} fill={PAPER_QUIET}>
            {v === 0 ? "৳0" : `৳${v / 1000}k`}
          </text>
        </g>
      ))}
      {[0, 500, 1000, 1500].map((t) => (
        <text key={t} x={sx(t)} y={PLOT.bottom + 26} textAnchor="middle" fontSize={15} fill={PAPER_QUIET}>
          {t.toLocaleString("en-US")}
        </text>
      ))}
      <text x={(PLOT.left + PLOT.right) / 2} y={H - 2} textAnchor="middle" fontSize={15} fill={PAPER_MUTED}>
        Tickets sold a month, at ৳{TICKET_PRICE}
      </text>

      {/* The marketplace share is a range, so it is drawn as one: a band between its two rates. */}
      <polygon
        points={`${sx(0)},${sy(0)} ${sx(X_MAX)},${sy(share(X_MAX, SHARE_HIGH))} ${sx(X_MAX)},${sy(share(X_MAX, SHARE_LOW))}`}
        fill={BLUE}
        fillOpacity={0.12}
      />
      <line x1={sx(0)} y1={sy(0)} x2={sx(X_MAX)} y2={sy(share(X_MAX, SHARE_HIGH))} stroke={BLUE} strokeWidth={3} strokeLinecap="round" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(X_MAX)} y2={sy(share(X_MAX, SHARE_LOW))} stroke={BLUE} strokeWidth={3} strokeLinecap="round" />

      {/* The plan does not move. */}
      <line x1={sx(0)} y1={sy(GROWTH.monthly)} x2={sx(X_MAX)} y2={sy(GROWTH.monthly)} stroke={EMBER} strokeWidth={3} strokeLinecap="round" />

      {/* Where the band crosses the plan: the point on the axis worth naming. */}
      {[lowCross, highCross].map((t) => (
        <circle key={t} cx={sx(t)} cy={sy(GROWTH.monthly)} r={6} fill="#141413" stroke="#ffffff" strokeWidth={2} />
      ))}
      <text x={sx(highCross) + 16} y={sy(GROWTH.monthly) + 26} fontSize={15} fontWeight={600} fill="#141413">
        The plan costs less from {Math.round(lowCross)}–{Math.round(highCross)} tickets a month
      </text>

      <text x={sx(TICKETS)} y={sy(share(TICKETS, SHARE_HIGH)) - 14} textAnchor="middle" fontSize={16} fontWeight={600} fill="#141413">
        {taka(share(TICKETS, SHARE_LOW))}–{taka(share(TICKETS, SHARE_HIGH))}
      </text>
      <circle cx={sx(TICKETS)} cy={sy(share(TICKETS, SHARE_HIGH))} r={6} fill={BLUE} stroke="#ffffff" strokeWidth={2} />
      <circle cx={sx(TICKETS)} cy={sy(share(TICKETS, SHARE_LOW))} r={6} fill={BLUE} stroke="#ffffff" strokeWidth={2} />
      <circle cx={sx(TICKETS)} cy={sy(GROWTH.monthly)} r={6} fill={EMBER} stroke="#ffffff" strokeWidth={2} />

      <text x={PLOT.right + 14} y={sy(share(X_MAX, SHARE_HIGH)) + 6} fontSize={16} fontWeight={600} fill="#141413">
        12% of sales
      </text>
      <text x={PLOT.right + 14} y={sy(share(X_MAX, SHARE_LOW)) + 6} fontSize={16} fontWeight={600} fill="#141413">
        6.5% of sales
      </text>
      <text x={PLOT.right + 14} y={sy(GROWTH.monthly) + 6} fontSize={16} fontWeight={600} fill="#141413">
        Growth plan
      </text>
    </svg>
  );
}

function LegendKey({ color, label, band }: { color: string; label: string; band?: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-[16px]" style={{ color: PAPER_MUTED }}>
      <span
        aria-hidden
        className={cn("w-[26px] rounded-full", band ? "h-[12px]" : "h-[3px]")}
        style={band ? { background: color, opacity: 0.35 } : { background: color }}
      />
      {label}
    </li>
  );
}

export function CostSlide({ n }: { n: number }) {
  const low = share(TICKETS, SHARE_LOW);
  const high = share(TICKETS, SHARE_HIGH);
  return (
    <Slide tone="paper" n={n} section="Pricing" label="A plan that stops rising while your sales do not">
      <TextBlock
        eyebrow="What it costs"
        title={
          <>
            Sell more. Pay
            <br />
            the same.
          </>
        }
        width={760}
      />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        A share of sales grows with every ticket you sell. A plan does not — the Growth plan is ৳{GROWTH.monthly.toLocaleString("en-US")} whether you sell ten tickets or ten
        thousand.
      </p>

      <figure className={cn(s.card, s.paperCard, "absolute left-[96px] top-[300px] h-[500px] w-[900px] px-9 pt-7 [--card-r:20px]")}>
        <figcaption className="flex items-center justify-between">
          <span className="font-mono text-[13px] uppercase tracking-[0.12em]" style={{ color: PAPER_QUIET }}>
            Monthly cost
          </span>
          <ul className="flex gap-6">
            <LegendKey color={EMBER} label="Counterfoil · Growth plan" />
            <LegendKey color={BLUE} label="A marketplace share, 6.5–12%" band />
          </ul>
        </figcaption>
        <div className="mt-5">
          <CostChart />
        </div>
      </figure>

      <div className={s.text} style={{ left: 1024, top: 300, width: 480 }}>
        <div className={cn(s.card, s.paperCard, "p-8 [--card-r:20px]")}>
          <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-[#aa3000]">
            {TICKETS.toLocaleString("en-US")} tickets at ৳{TICKET_PRICE}
          </p>
          <dl className="mt-5 flex flex-col gap-3.5">
            {[
              { color: BLUE, label: "A marketplace share", note: "6.5–12% of ৳500,000", value: `${taka(low)}–${taka(high)}` },
              { color: EMBER, label: "Counterfoil Growth", note: "the plan, whatever you sell", value: taka(GROWTH.monthly) },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <dt>
                  <span className="flex items-center gap-2.5 text-[18px] font-semibold">
                    <span aria-hidden className="h-[3px] w-[20px] rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="mt-0.5 block pl-[30px] text-[15px]" style={{ color: PAPER_QUIET }}>
                    {row.note}
                  </span>
                </dt>
                <dd className="whitespace-nowrap text-[19px] font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 border-t border-[#ece7de] pt-5">
            <p className="text-[17px]" style={{ color: PAPER_MUTED }}>
              You keep
            </p>
            <p className="mt-1 text-[46px] font-semibold leading-none tracking-[-0.04em]">
              {taka(low - GROWTH.monthly)}–{(high - GROWTH.monthly).toLocaleString("en-US")}
            </p>
            <p className="mt-2 text-[17px]" style={{ color: PAPER_MUTED }}>
              that month, at the same sales
            </p>
          </div>
        </div>
        <p className="mt-6 text-[15px] leading-[1.45]" style={{ color: PAPER_QUIET }}>
          Plan fee only; SMS, email and waivers are metered with an allowance in every plan. Selling events instead on the Events plan is 6% of revenue with nothing monthly —
          still under the share a marketplace takes.
        </p>
      </div>
    </Slide>
  );
}
