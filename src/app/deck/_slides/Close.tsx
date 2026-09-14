import Image from "next/image";
import { cn } from "@/lib/cn";
import { Floor, Glow, Phone, Slide, TextBlock, Ticket, deckStyles as s } from "../_components/Parts";
import { SEAT_LEGEND, SeatPlan, SeatSwatch } from "../_components/SeatPlan";
import logoOnInk from "../_media/logo-counterfoil-dark.png";
import posPhoneBn from "../_media/go-phone-sell-bn.jpg";

/* Slides 23–25: where Counterfoil is today, the market it is built for, and the close. */

const STATS = [
  { value: "20", approx: true, label: "Operators", body: "running their day on Counterfoil" },
  { value: "4", label: "Countries", body: "Bangladesh, Malaysia, the US and Canada" },
  { value: "14", label: "Booking types", body: "sold from one engine" },
  { value: "2", label: "Languages", body: "Bangla and English, on every screen" },
];

const KINDS = ["Heritage sites", "Turfs & courts", "Bowling", "Spas", "Cinemas", "Tours"];

/*
 * Figures set like a report's summary rather than four tiles: one rule above,
 * columns divided by hairlines, the numbers doing the work.
 */
export function TodaySlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil" label="Already at the counter">
      <TextBlock eyebrow="Today" title="Already at the counter." width={880} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Venues, tours and attractions run their day on the current version.
      </p>
      <dl className="absolute left-[96px] top-[300px] grid w-[1408px] grid-cols-4 border-t-2 border-[#141413]">
        {STATS.map(({ value, approx, label, body }, i) => (
          <div key={label} className={cn("flex flex-col pt-7", i > 0 ? "border-l border-[#d9d3c7] pl-8" : "pr-8")}>
            <dt className={cn(s.mono, "uppercase text-[#aa3000]")}>{label}</dt>
            <dd className="mt-10">
              <span className={cn(s.numeral, "block", i === 0 && "text-[#e04400]")}>
                {approx && <span className="mr-[0.04em] inline-block align-[0.22em] text-[0.56em]">~</span>}
                {value}
              </span>
              <span className="mt-6 block w-[260px] text-[19px] leading-[1.4] text-[#57534c]">{body}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="absolute left-[96px] top-[668px] w-[1408px] border-t border-[#d9d3c7] pt-7">
        <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Built for</p>
        <p className="mt-4 text-[38px] font-semibold leading-none tracking-[-0.03em]">
          {KINDS.map((kind, i) => (
            <span key={kind}>
              {i > 0 && (
                <span aria-hidden className="px-[0.42em] font-normal text-[#c9c1b2]">
                  /
                </span>
              )}
              {kind}
            </span>
          ))}
        </p>
      </div>
    </Slide>
  );
}

/* Local rails and the ones that travel, each with what it is actually for. */
const RAILS: [string, [string, string][]][] = [
  [
    "In Bangladesh",
    [
      ["bKash", "Wallet, confirmed by its ID"],
      ["Bangla QR", "One code for every bank app"],
      ["SSLCOMMERZ", "Cards and banking, online"],
    ],
  ],
  [
    "Anywhere",
    [
      ["Stripe", "Cards, for sales abroad"],
      ["Card terminal", "Tap or insert at the till"],
      ["Cash", "Counted when the shift closes"],
    ],
  ],
];

const LOCAL = [
  { label: "ভাষা · Language", title: "বাংলা · English", body: "Every screen, receipt and message in both." },
  { label: "Currency", title: "Taka, to the paisa", body: "Prices, VAT and change worked in whole paisa." },
  { label: "Tax", title: "VAT on every line", body: "15% standard, 7.5% reduced, the BIN on the receipt." },
];

export function BangladeshSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil" label="Built in Bangladesh, ready anywhere">
      <Glow className="left-[640px] top-[180px] h-[760px] w-[720px]" />
      <Floor />
      <TextBlock
        eyebrow="Made for the market"
        title={
          <>
            Built in Bangladesh. <span className={s.accentInk}>Ready anywhere.</span>
          </>
        }
        lead="Bangla and English, bKash and Bangla QR, VAT and taka — with Stripe for cards abroad."
        width={548}
      >
        <div className="grid grid-cols-2 gap-x-7">
          {RAILS.map(([head, rows]) => (
            <div key={head}>
              <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">{head}</p>
              <ul className="mt-3 border-b border-white/12">
                {rows.map(([name, note]) => (
                  <li key={name} className="border-t border-white/12 py-3">
                    <p className="text-[19px] font-semibold leading-tight tracking-[-0.01em]">{name}</p>
                    <p className="mt-1 text-[15px] leading-snug text-[rgb(245_242_235/0.66)]">{note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-9 font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Selling in</p>
        <p className="mt-3 text-[21px] font-medium tracking-[-0.01em]">
          Bangladesh <span aria-hidden className="px-1.5 text-white/30">/</span> Malaysia <span aria-hidden className="px-1.5 text-white/30">/</span> United States{" "}
          <span aria-hidden className="px-1.5 text-white/30">/</span> Canada
        </p>
      </TextBlock>

      <Phone src={posPhoneBn} width={290} tilt="right" alt="Counterfoil Go in Bangla on a phone" className="absolute left-[808px] top-[104px]" />
      <Ticket word="৳500" kicker="বিকাশ · bKash" width={320} className="absolute left-[680px] top-[580px]" />

      {/* A list, not three boxes: hairlines between, the way the ledger on the left is set. */}
      <ul className="absolute left-[1184px] top-[140px] flex h-[660px] w-[320px] flex-col border-b border-white/12">
        {LOCAL.map(({ label, title, body }) => (
          <li key={title} className="flex flex-1 flex-col justify-center border-t border-white/12">
            <span className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">{label}</span>
            <p className="mt-3 text-[27px] font-semibold leading-tight tracking-[-0.02em]">{title}</p>
            <p className="mt-2 text-[16px] leading-[1.45] text-[rgb(245_242_235/0.72)]">{body}</p>
          </li>
        ))}
      </ul>
    </Slide>
  );
}

export function CloseSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="" label="Every seat, slot and session, accounted for">
      <Glow className="left-[420px] top-[-180px] h-[620px] w-[760px] opacity-60" />
      {/* The promise, drawn at a size that leaves it room: a house where every seat is in a state the system knows. */}
      <SeatPlan scale={0.7} className="absolute left-[240px] top-[66px]" />
      <ul aria-hidden className="absolute inset-x-0 top-[362px] flex justify-center gap-9">
        {SEAT_LEGEND.map(({ state, label }) => (
          <li key={state} className="flex items-center gap-2.5 font-mono text-[14px] uppercase tracking-[0.12em] text-[rgb(245_242_235/0.66)]">
            <SeatSwatch state={state} size={16} />
            {label}
          </li>
        ))}
      </ul>
      <div className={cn(s.text, "text-center")} style={{ left: 150, top: 430, width: 1300 }}>
        <h2 className={s.display}>
          Every seat, slot and session — <span className={s.accentInk}>accounted for.</span>
        </h2>
        <p className={cn(s.lead, "mx-auto mt-7 w-[1160px]")}>Counterfoil is built by Ternary Solutions for the people who run venues, tours and attractions.</p>
      </div>
      <Image src={logoOnInk} alt="Counterfoil" sizes="280px" className="absolute left-1/2 top-[736px] h-[36px] w-auto -translate-x-1/2" />
    </Slide>
  );
}
