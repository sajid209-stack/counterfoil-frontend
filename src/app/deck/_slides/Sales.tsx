import { Banknote, CalendarClock, Check, PartyPopper, ScanLine, Shapes, Store, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Glow, Slide, TextBlock, deckStyles as s } from "../_components/Parts";

/*
 * The case for buying: what gets better, how it compares with the ticket
 * marketplaces, what it costs, and what that saves.
 *
 * Two rules hold on every slide here. Every price is sample pricing and says
 * so where the price is. Every claim about another company is from a source
 * named on the slide, and where a company does not publish its fee the slide
 * says "not published" rather than guessing one.
 */

const PAPER_MUTED = "#57534c";
const PAPER_QUIET = "#6b675f";

/* ── What gets better ──────────────────────────────────────────────────── */

const JOBS: { icon: LucideIcon; job: string; today: string; after: string }[] = [
  { icon: CalendarClock, job: "Availability", today: "“Is 18:00 free?” — asked in a chat group.", after: "Every counter reads the same live count." },
  { icon: Shapes, job: "Selling time", today: "A retail till that knows products, not sessions.", after: "Sessions, courts, seats and tours — 14 ways to book." },
  { icon: Wallet, job: "Payment", today: "A bKash screenshot, checked by eye.", after: "bKash confirmed by transaction ID before the sale lands." },
  { icon: ScanLine, job: "The gate", today: "A paper stub passed from hand to hand.", after: "One scan admits. A used ticket is refused." },
  { icon: PartyPopper, job: "Events", today: "A marketplace takes a cut of every ticket.", after: "Your own event page, for a flat fee a ticket." },
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

/* ── Against the marketplaces ──────────────────────────────────────────── */

type Rival = {
  name: string;
  market: string;
  model: string;
  /** What the company publishes, and what it applies to. Absent when it publishes nothing. */
  fee?: { figure: string; on: string };
  /** The fee on one ticket, where a published fee lets it be worked out, and the ticket it is worked on. */
  onTicket?: { figure: string; on: string };
  /** Said in place of the fee when there is none to quote. */
  unpublished?: string;
};

const RIVALS: Rival[] = [
  { name: "Tickify", market: "Bangladesh", model: "Commission on ticket sales", unpublished: "Rate not published" },
  { name: "Shohoz", market: "Bangladesh", model: "Commission on ticket sales", unpublished: "Rate not published" },
  {
    name: "Eventbrite",
    market: "International",
    model: "A service fee a ticket, plus payment processing",
    fee: { figure: "3.7% + US$1.79 a ticket", on: "plus 2.9% payment processing, in the US" },
    onTicket: { figure: "About 11.3%", on: "of a US$40 ticket" },
  },
  {
    name: "Ticketmaster",
    market: "International",
    model: "Service, facility and processing fees, set per event",
    unpublished: "Not published — negotiated for each event",
  },
];

/* Column tracks shared by the header and every row, so the table reads as one object. */
const COLS = "grid grid-cols-[250px_340px_1fr_300px] items-center gap-6";

export function MarketplacesSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Events" label="Your event, your page, and a fee you can see">
      <TextBlock eyebrow="Events · Against the marketplaces" title="Your event, your page — and a fee you can see." width={860} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Marketplaces take a share of every ticket — in Bangladesh, usually 5–10% plus 1.5–2% for processing. Three of these four don’t publish theirs.
      </p>

      <div className="absolute left-[96px] top-[304px] w-[1408px]">
        <div className={cn(COLS, "px-6 font-mono text-[13px] uppercase leading-none tracking-[0.12em]")} style={{ color: PAPER_QUIET }}>
          <span>Platform</span>
          <span>How it charges</span>
          <span>Published fee</span>
          <span>On one ticket</span>
        </div>

        <ul className="mt-3.5 flex flex-col gap-2">
          {/* Counterfoil first, on ink: the row every other row is read against. */}
          <li className={cn(COLS, "relative h-[76px] overflow-hidden rounded-[16px] bg-[#141413] px-6 text-[#f5f2eb]")}>
            <Glow className="left-[980px] top-[-120px] h-[300px] w-[520px] opacity-50" />
            <span className="relative">
              <span className="block text-[21px] font-semibold leading-tight">Counterfoil</span>
              <span className="mt-0.5 block text-[14px] text-[rgb(245_242_235/0.66)]">Bangladesh and abroad</span>
            </span>
            <span className="relative text-[16px] leading-[1.35] text-[rgb(245_242_235/0.78)]">A monthly plan and a flat fee a ticket</span>
            <span className="relative">
              <span className="flex items-center gap-3">
                <span className="text-[20px] font-semibold leading-tight">৳6,500 a month + ৳6 a ticket</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[13px] uppercase leading-none tracking-[0.1em] text-[#ffa572] ring-1 ring-inset ring-white/15">Sample</span>
              </span>
              <span className="mt-0.5 block text-[14px] text-[rgb(245_242_235/0.66)]">The Growth plan</span>
            </span>
            <span className="relative">
              <span className="block text-[20px] font-semibold leading-tight">2.5% all in</span>
              <span className="mt-0.5 block text-[14px] text-[rgb(245_242_235/0.66)]">selling 1,000 ৳500 tickets a month</span>
            </span>
          </li>

          {RIVALS.map((r) => (
            <li key={r.name} className={cn(COLS, "h-[76px] rounded-[16px] border border-[#e7e2d8] bg-white px-6")}>
              <span>
                <span className="block text-[21px] font-semibold leading-tight">{r.name}</span>
                <span className="mt-0.5 block text-[14px]" style={{ color: PAPER_QUIET }}>
                  {r.market}
                </span>
              </span>
              <span className="text-[16px] leading-[1.35]" style={{ color: PAPER_MUTED }}>
                {r.model}
              </span>
              {r.unpublished ? (
                /* Nothing published means nothing to work out, so one cell says so across both columns. */
                <span className="col-span-2 flex items-center gap-2.5 text-[17px]" style={{ color: PAPER_MUTED }}>
                  <span aria-hidden className="h-[2px] w-[18px] rounded-full bg-[#cfc9bd]" />
                  {r.unpublished}
                </span>
              ) : (
                <>
                  <span>
                    <span className="block text-[20px] font-semibold leading-tight">{r.fee?.figure}</span>
                    <span className="mt-0.5 block text-[14px]" style={{ color: PAPER_QUIET }}>
                      {r.fee?.on}
                    </span>
                  </span>
                  <span>
                    <span className="block text-[20px] font-semibold leading-tight">{r.onTicket?.figure}</span>
                    <span className="mt-0.5 block text-[14px]" style={{ color: PAPER_QUIET }}>
                      {r.onTicket?.on}
                    </span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>

      </div>

      <p className={s.text} style={{ left: 96, top: 764, width: 1408, fontSize: 14, lineHeight: 1.4, color: PAPER_QUIET }}>
        Sources: launchlify.com (Tickify, Shohoz and the Bangladesh range) · checkoutpage.com, 28 Apr 2026 (Eventbrite) · help.ticketmaster.com and
        seatfun.com (Ticketmaster). Counterfoil’s figures are sample pricing.
      </p>
    </Slide>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────── */

/** The commission the pricing is compared with: 7% of a ৳500 ticket. */
const TICKET = 500;
const COMMISSION_PCT = 7;
/* Integer arithmetic on purpose: 500 * 0.07 is 35.00000000000001 in floating point, which moves a break-even by a whole ticket. */
const COMMISSION_PER_TICKET = (TICKET * COMMISSION_PCT) / 100;

const PLANS = [
  { name: "Starter", who: "One venue, one or two tills", monthly: 2500, perTicket: 10, limits: "1 location · 2 counters" },
  { name: "Growth", who: "Several counters, or a few sites", monthly: 6500, perTicket: 6, limits: "3 locations · 10 counters" },
  { name: "Pro", who: "Groups and chains", monthly: 14500, perTicket: 4, limits: "Unlimited locations and counters" },
];

const taka = (v: number) => `৳${v.toLocaleString("en-US")}`;

/** The first month's ticket count at which a plan costs less than the commission. */
const cheaperFrom = (monthly: number, perTicket: number) => Math.floor(monthly / (COMMISSION_PER_TICKET - perTicket)) + 1;

const INCLUDED = ["14 booking types", "OS and Go", "Event pages", "bKash, Bangla QR, card and cash", "বাংলা and English", "Reports"];

export function PricingSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Pricing" label="One plan a month, and a small fee a ticket">
      <Glow className="left-[520px] top-[240px] h-[700px] w-[640px] opacity-60" />
      <TextBlock
        eyebrow="Pricing · Sample figures"
        title={
          <>
            One plan a month.
            <br />A small fee a ticket.
          </>
        }
        width={820}
      />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Every plan has every booking type, both apps and event pages. Plans differ by how many locations and counters you run.
      </p>

      <ul className="absolute left-[96px] top-[300px] grid h-[420px] w-[1408px] grid-cols-3 gap-6">
        {PLANS.map((p) => {
          const featured = p.name === "Growth";
          return (
            <li
              key={p.name}
              className={cn(
                s.card,
                "relative flex flex-col p-9",
                featured ? "bg-[#f5f2eb] text-[#141413] shadow-[0_40px_80px_-40px_rgb(249_74_0/0.55)]" : s.inkCard,
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className={s.heading}>{p.name}</h3>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 font-mono text-[13px] uppercase leading-none tracking-[0.1em]",
                    featured ? "bg-[#141413] text-[#f5f2eb]" : "bg-white/10 text-[#ffa572] ring-1 ring-inset ring-white/15",
                  )}
                >
                  Sample
                </span>
              </div>
              <p className={cn("mt-1.5 text-[17px]", featured ? "text-[#57534c]" : "text-[rgb(245_242_235/0.72)]")}>{p.who}</p>

              <p className="mt-7 flex items-baseline gap-2">
                <span className="text-[64px] font-semibold leading-none tracking-[-0.045em]">{taka(p.monthly)}</span>
                <span className={cn("text-[19px]", featured ? "text-[#57534c]" : "text-[rgb(245_242_235/0.72)]")}>a month</span>
              </p>
              <p className="mt-3 text-[21px] font-semibold tracking-[-0.01em]">+ {taka(p.perTicket)} for each ticket sold</p>

              <p className="mt-7 flex items-center gap-3 text-[18px]">
                <Store size={19} strokeWidth={1.7} className={featured ? "text-[#aa3000]" : "text-[#ffa572]"} aria-hidden />
                {p.limits}
              </p>

              <p className={cn("mt-auto text-[16px] leading-snug", featured ? "text-[#57534c]" : "text-[rgb(245_242_235/0.72)]")}>
                Costs less than a 7% commission from{" "}
                <span className={cn("font-semibold", featured ? "text-[#141413]" : "text-[#f5f2eb]")}>
                  {cheaperFrom(p.monthly, p.perTicket).toLocaleString("en-US")} tickets
                </span>{" "}
                a month
              </p>
            </li>
          );
        })}
      </ul>

      <div className={s.text} style={{ left: 96, top: 738, width: 1408 }}>
        <p className="flex items-center gap-5 text-[17px]">
          <span className="shrink-0 font-mono text-[13px] uppercase tracking-[0.12em] text-[#ffa572]">Every plan</span>
          {INCLUDED.map((item) => (
            <span key={item} className="flex shrink-0 items-center gap-2">
              <Check size={15} strokeWidth={2.4} className="text-[#ffa572]" aria-hidden />
              {item}
            </span>
          ))}
        </p>
        <p className="mt-2.5 text-[14px] text-[rgb(245_242_235/0.64)]">
          Sample figures, to show how pricing works — not a quote. The 7% comparison assumes a ৳{TICKET} ticket.
        </p>
      </div>
    </Slide>
  );
}

/* ── What it costs ─────────────────────────────────────────────────────── */

/*
 * One chart, one axis: monthly cost against tickets sold, for the Growth plan
 * and for a 7% commission on a ৳500 ticket. Counterfoil is ember and the
 * commission is blue-600 — the pair passes the palette checks on white
 * (lightness, chroma, colour-blind and normal-vision separation, 3:1 against
 * the card). Text is never drawn in a series colour; the lines carry identity
 * and are named twice, in the legend and at their ends.
 */

const EMBER = "#f94a00";
const BLUE = "#2563eb";

const GROWTH = PLANS[1];
const X_MAX = 1500;
const Y_MAX = 60000;
const EXAMPLE = 1000;

/* Drawing box, in svg pixels. The right margin holds the end labels. */
const W = 828;
const H = 400;
const PLOT = { left: 64, right: W - 170, top: 16, bottom: H - 48 };

const sx = (tickets: number) => PLOT.left + (tickets / X_MAX) * (PLOT.right - PLOT.left);
const sy = (cost: number) => PLOT.bottom - (cost / Y_MAX) * (PLOT.bottom - PLOT.top);

const counterfoilCost = (t: number) => GROWTH.monthly + GROWTH.perTicket * t;
const commissionCost = (t: number) => COMMISSION_PER_TICKET * t;

/** Where the two lines cross: the ticket count at which both cost the same. */
const CROSS = GROWTH.monthly / (COMMISSION_PER_TICKET - GROWTH.perTicket);

function CostChart() {
  const kept = commissionCost(EXAMPLE) - counterfoilCost(EXAMPLE);
  const ex = sx(EXAMPLE);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`Monthly cost against tickets sold. The Growth plan costs ${taka(GROWTH.monthly)} plus ${taka(GROWTH.perTicket)} a ticket; a 7% commission on a ৳500 ticket costs ৳35 a ticket. They cost the same at about ${Math.round(CROSS)} tickets. At ${EXAMPLE.toLocaleString("en-US")} tickets the commission is ${taka(commissionCost(EXAMPLE))} and the plan is ${taka(counterfoilCost(EXAMPLE))}.`}
      className="block"
    >
      {/* Gridlines: solid hairlines, one step off the card. */}
      {[0, 20000, 40000, 60000].map((v) => (
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
        Tickets sold a month
      </text>

      {/* What the plan saves once it is cheaper: the space between the lines, as a wash. */}
      <polygon
        points={`${sx(CROSS)},${sy(commissionCost(CROSS))} ${sx(X_MAX)},${sy(commissionCost(X_MAX))} ${sx(X_MAX)},${sy(counterfoilCost(X_MAX))}`}
        fill={EMBER}
        fillOpacity={0.08}
      />

      {/* The example: a rule at 1,000 tickets. */}
      <line x1={ex} x2={ex} y1={sy(commissionCost(EXAMPLE))} y2={PLOT.bottom} stroke="#cfc9bd" strokeWidth={1} />

      <line x1={sx(0)} y1={sy(commissionCost(0))} x2={sx(X_MAX)} y2={sy(commissionCost(X_MAX))} stroke={BLUE} strokeWidth={3} strokeLinecap="round" />
      <line x1={sx(0)} y1={sy(counterfoilCost(0))} x2={sx(X_MAX)} y2={sy(counterfoilCost(X_MAX))} stroke={EMBER} strokeWidth={3} strokeLinecap="round" />

      {/* Markers carry a 2px ring in the card's colour, so they stay clear where they sit on a line. */}
      <circle cx={sx(CROSS)} cy={sy(commissionCost(CROSS))} r={6} fill="#141413" stroke="#ffffff" strokeWidth={2} />
      <circle cx={ex} cy={sy(commissionCost(EXAMPLE))} r={6} fill={BLUE} stroke="#ffffff" strokeWidth={2} />
      <circle cx={ex} cy={sy(counterfoilCost(EXAMPLE))} r={6} fill={EMBER} stroke="#ffffff" strokeWidth={2} />

      <text x={sx(CROSS) + 13} y={PLOT.bottom - 10} fontSize={15} fontWeight={600} fill="#141413">
        Cheaper from {Math.ceil(CROSS)} tickets
      </text>
      <text x={ex - 12} y={sy(commissionCost(EXAMPLE)) - 12} textAnchor="end" fontSize={16} fontWeight={600} fill="#141413">
        {taka(commissionCost(EXAMPLE))}
      </text>
      <text x={ex + 12} y={sy(counterfoilCost(EXAMPLE)) + 24} fontSize={16} fontWeight={600} fill="#141413">
        {taka(counterfoilCost(EXAMPLE))}
      </text>
      <text x={ex + 12} y={(sy(commissionCost(EXAMPLE)) + sy(counterfoilCost(EXAMPLE))) / 2 + 6} fontSize={16} fill={PAPER_MUTED}>
        Difference <tspan fontWeight={600} fill="#141413">{taka(kept)}</tspan>
      </text>

      {/* The lines named at their ends. */}
      <text x={PLOT.right + 12} y={sy(commissionCost(X_MAX)) + 6} fontSize={16} fontWeight={600} fill="#141413">
        7% commission
      </text>
      <text x={PLOT.right + 12} y={sy(counterfoilCost(X_MAX)) + 6} fontSize={16} fontWeight={600} fill="#141413">
        Growth plan
      </text>
    </svg>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[16px]" style={{ color: PAPER_MUTED }}>
      <span aria-hidden className="h-[3px] w-[26px] rounded-full" style={{ background: color }} />
      {label}
    </li>
  );
}

export function CostSlide({ n }: { n: number }) {
  const commission = commissionCost(EXAMPLE);
  const plan = counterfoilCost(EXAMPLE);
  const kept = commission - plan;
  return (
    <Slide tone="paper" n={n} section="Pricing" label="Sell 1,000 tickets, keep ৳22,500 a month">
      <TextBlock
        eyebrow="What it costs · Sample figures"
        title={
          <>
            Sell {EXAMPLE.toLocaleString("en-US")} tickets,
            <br />
            keep {taka(kept)} a month.
          </>
        }
        width={860}
      />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Monthly cost as sales grow: the Growth plan against a 7% commission on a ৳{TICKET} ticket.
      </p>

      <figure className={cn(s.card, s.paperCard, "absolute left-[96px] top-[300px] h-[500px] w-[900px] px-9 pt-7 [--card-r:20px]")}>
        <figcaption className="flex items-center justify-between">
          <span className="font-mono text-[13px] uppercase tracking-[0.12em]" style={{ color: PAPER_QUIET }}>
            Monthly cost
          </span>
          <ul className="flex gap-6">
            <LegendKey color={EMBER} label="Counterfoil · Growth plan" />
            <LegendKey color={BLUE} label="7% commission" />
          </ul>
        </figcaption>
        <div className="mt-5">
          <CostChart />
        </div>
      </figure>

      {/* The example the chart marks, worked through as sums — the chart's figures in words, for anyone who reads before they look. */}
      <div className={s.text} style={{ left: 1024, top: 300, width: 480 }}>
        <div className={cn(s.card, s.paperCard, "p-8 [--card-r:20px]")}>
          <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-[#aa3000]">At {EXAMPLE.toLocaleString("en-US")} tickets a month</p>
          <dl className="mt-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <dt>
                <span className="flex items-center gap-2.5 text-[18px] font-semibold">
                  <span aria-hidden className="h-[3px] w-[20px] rounded-full" style={{ background: BLUE }} />
                  7% commission
                </span>
                <span className="mt-0.5 block pl-[30px] text-[15px]" style={{ color: PAPER_QUIET }}>
                  {EXAMPLE.toLocaleString("en-US")} × ৳{COMMISSION_PER_TICKET}
                </span>
              </dt>
              <dd className="text-[20px] font-semibold tabular-nums">{taka(commission)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt>
                <span className="flex items-center gap-2.5 text-[18px] font-semibold">
                  <span aria-hidden className="h-[3px] w-[20px] rounded-full" style={{ background: EMBER }} />
                  Growth plan
                </span>
                <span className="mt-0.5 block pl-[30px] text-[15px]" style={{ color: PAPER_QUIET }}>
                  {taka(GROWTH.monthly)} + {EXAMPLE.toLocaleString("en-US")} × {taka(GROWTH.perTicket)}
                </span>
              </dt>
              <dd className="text-[20px] font-semibold tabular-nums">{taka(plan)}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-[#ece7de] pt-5">
            <p className="text-[17px]" style={{ color: PAPER_MUTED }}>
              You keep
            </p>
            <p className="mt-1 text-[64px] font-semibold leading-none tracking-[-0.04em]">{taka(kept)}</p>
            <p className="mt-2 text-[17px]" style={{ color: PAPER_MUTED }}>
              a month — {taka(kept * 12)} a year
            </p>
          </div>
        </div>
        <p className="mt-6 text-[15px] leading-[1.45]" style={{ color: PAPER_QUIET }}>
          Sample pricing, not a quote. 7% sits inside the 5–10% Bangladeshi ticketing sites usually charge (launchlify.com). Payment processing is left out of both.
        </p>
      </div>
    </Slide>
  );
}
