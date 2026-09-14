import Image from "next/image";
import {
  Armchair,
  Banknote,
  CalendarRange,
  Clapperboard,
  Clock,
  Coins,
  Compass,
  CreditCard,
  Disc3,
  DoorOpen,
  Flower2,
  GraduationCap,
  Hourglass,
  LandPlot,
  Landmark,
  ListOrdered,
  Package,
  Ticket as TicketIcon,
  Timer,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Floor, Glow, Phone, Slide, TextBlock, Ticket, deckStyles as s } from "../_components/Parts";
import { SEAT_LEGEND, SeatPlan, SeatSwatch } from "../_components/SeatPlan";
import logoOnInk from "../_media/logo-counterfoil-dark.png";
import posPhoneBn from "../_media/go-phone-sell-bn.jpg";

/* Slides 23–25: where Counterfoil is today, the market it is built for, and the close. */

const KINDS: { icon: LucideIcon; name: string }[] = [
  { icon: Landmark, name: "Heritage sites" },
  { icon: Trophy, name: "Turfs & courts" },
  { icon: Disc3, name: "Bowling" },
  { icon: Flower2, name: "Spas" },
  { icon: Clapperboard, name: "Cinemas" },
  { icon: Compass, name: "Tours" },
];

/** The fourteen booking types, by the glyph the product gives each. */
const TYPE_GLYPHS: LucideIcon[] = [DoorOpen, CalendarRange, Hourglass, TicketIcon, Clock, Armchair, LandPlot, Timer, Compass, UserRound, GraduationCap, Coins, Package, ListOrdered];

const COUNTRIES = [
  ["BD", "Bangladesh"],
  ["MY", "Malaysia"],
  ["US", "United States"],
  ["CA", "Canada"],
];

/* A figure set large: one size for every tile on the page. */
const FIGURE = { fontSize: 104 } as const;

/*
 * Today as a bento: one tall tile for the figure that matters most, and three
 * that each carry the thing they count — the countries by name, the booking
 * types by glyph, the two languages in their own scripts.
 */
export function TodaySlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil" label="Already at the counter">
      <TextBlock eyebrow="Today" title="Already at the counter." lead="Venues, tours and attractions run their day on the current version." width={720} />
      <div className={s.text} style={{ left: 1024, top: 92, width: 480 }}>
        <p className={s.eyebrow}>Built for</p>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {KINDS.map(({ icon: Icon, name }) => (
            <li key={name} className="inline-flex h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[16px] font-medium shadow-[0_1px_2px_rgb(20_20_19/0.05)] ring-1 ring-[#e2ded5]">
              <Icon size={17} strokeWidth={1.7} className="text-[#aa3000]" aria-hidden />
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute left-[96px] top-[284px] grid h-[516px] w-[1408px] grid-cols-3 grid-rows-2 gap-6">
        {/* Operators: the tall tile, a wall of venues above the figure. */}
        <div className={cn(s.card, "relative row-span-2 flex flex-col bg-[#141413] p-9 text-[#f5f2eb]")}>
          <Glow className="left-[120px] top-[230px] h-[380px] w-[380px] opacity-60" />
          <p className="relative font-mono text-[15px] uppercase tracking-[0.12em] text-[#ffa572]">Operators</p>
          <ul aria-hidden className="relative mt-7 grid w-fit grid-cols-5 gap-2">
            {Array.from({ length: 20 }, (_, i) => {
              const Icon = KINDS[i % KINDS.length].icon;
              const lit = i === 7 || i === 13;
              return (
                <li
                  key={i}
                  className={cn("grid h-[40px] w-[40px] place-items-center rounded-[11px]", lit ? "bg-[#f94a00] text-[#141413]" : "bg-white/[0.06] text-[#ffa572] ring-1 ring-inset ring-white/10")}
                >
                  <Icon size={18} strokeWidth={1.6} />
                </li>
              );
            })}
          </ul>
          <p className={cn(s.numeral, s.accentInk, "relative mt-auto")} style={{ fontSize: 136 }}>
            <span className="mr-[0.03em] inline-block align-[0.24em] text-[0.5em]">~</span>20
          </p>
          <p className="relative mt-4 w-[320px] text-[19px] leading-[1.4] text-[rgb(245_242_235/0.8)]">venues, tours and attractions running their day on Counterfoil</p>
        </div>

        <div className={cn(s.card, s.paperCard, "flex justify-between gap-6 p-8")}>
          <div className="flex flex-col">
            <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Countries</p>
            <p className={cn(s.numeral, "mt-auto")} style={FIGURE}>
              4
            </p>
            <p className="mt-2 text-[17px] text-[#57534c]">selling today</p>
          </div>
          <ul className="flex w-[196px] flex-col justify-center gap-2">
            {COUNTRIES.map(([code, name]) => (
              <li key={code} className="flex h-[38px] items-center gap-2.5 rounded-[11px] bg-[#f5f2eb] px-3">
                <span className="font-mono text-[13px] font-semibold text-[#aa3000]">{code}</span>
                <span className="text-[15px] font-medium">{name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn(s.card, s.paperCard, "flex justify-between gap-6 p-8")}>
          <div className="flex flex-col">
            <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Booking types</p>
            <p className={cn(s.numeral, "mt-auto")} style={FIGURE}>
              14
            </p>
            <p className="mt-2 whitespace-nowrap text-[17px] text-[#57534c]">sold from one engine</p>
          </div>
          {/* Narrow enough that the caption beside it stays on one line, leaving the figure room under its label. */}
          <ul aria-hidden className="grid h-fit shrink-0 grid-cols-5 gap-[6px] self-center">
            {TYPE_GLYPHS.map((Icon, i) => (
              <li key={i} className={cn("grid h-[32px] w-[32px] place-items-center rounded-[9px]", i === 5 ? "bg-[#141413] text-[#f5f2eb]" : "bg-[#f5f2eb] text-[#57534c]")}>
                <Icon size={15} strokeWidth={1.6} />
              </li>
            ))}
          </ul>
        </div>

        <div className={cn(s.card, s.paperCard, "col-span-2 flex gap-8 p-8")}>
          <div className="flex w-[250px] shrink-0 flex-col">
            <p className={cn(s.mono, "uppercase text-[#aa3000]")}>Languages</p>
            <p className={cn(s.numeral, "mt-auto")} style={FIGURE}>
              2
            </p>
            <p className="mt-2 whitespace-nowrap text-[17px] text-[#57534c]">on every screen and receipt</p>
          </div>
          {/* The same moment in both languages, as the till shows it. */}
          <div className="grid flex-1 grid-cols-2 gap-4">
            {[
              { script: "বাংলা", said: "টিকিট ইস্যু হয়েছে", lang: "bn" },
              { script: "English", said: "Ticket issued", lang: "en" },
            ].map(({ script, said, lang }) => (
              <div key={lang} lang={lang} className="flex flex-col justify-between rounded-[18px] bg-[#f5f2eb] px-6 py-5">
                <p className="text-[56px] font-semibold leading-none tracking-[-0.02em]">{script}</p>
                <p className="flex items-center gap-2.5 text-[18px] text-[#3f3b35]">
                  <span aria-hidden className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#1f9d55] text-[12px] font-bold text-white">✓</span>
                  {said}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Slide>
  );
}

/* The local rails first, then the ones that travel. */
const PAY: { name: string; note: string; mark?: string; color?: string; icon?: LucideIcon }[] = [
  { name: "bKash", note: "By transaction ID", mark: "b", color: "#d1115f" },
  { name: "Bangla QR", note: "Any bank app", mark: "QR", color: "#0b7a4b" },
  { name: "SSLCOMMERZ", note: "Cards, online", mark: "SSL", color: "#2458a8" },
  { name: "Stripe", note: "Cards abroad", mark: "S", color: "#5a4fe6" },
  { name: "Card terminal", note: "Tap or insert", icon: CreditCard },
  { name: "Cash", note: "Counted at close", icon: Banknote },
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
        {/* Names and marks, no boxes: the six rails read as a list, with room around it. */}
        <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Takes payment by</p>
        <ul className="mt-6 grid grid-cols-3 gap-x-4 gap-y-8">
          {PAY.map(({ name, note, mark, color, icon: Icon }) => (
            <li key={name} className="flex items-center gap-3">
              {mark ? (
                <span aria-hidden className="grid h-[36px] min-w-[36px] shrink-0 place-items-center rounded-[11px] px-1.5 text-[12px] font-bold text-white" style={{ background: color }}>
                  {mark}
                </span>
              ) : (
                Icon && (
                  <span aria-hidden className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px] bg-white/10 text-[#ffa572]">
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                )
              )}
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold leading-tight">{name}</span>
                <span className="mt-0.5 block text-[14px] text-[rgb(245_242_235/0.64)]">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>
      {/* On the slide's bottom line, level with the foot of the cards on the right. */}
      <div className={s.text} style={{ left: 96, bottom: 100, width: 548 }}>
        <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Selling in</p>
        <ul className="mt-4 flex gap-5">
          {COUNTRIES.map(([code, name]) => (
            <li key={code} className="flex items-baseline gap-2 text-[17px] font-medium">
              <span className="font-mono text-[13px] font-semibold text-[#ffa572]">{code}</span>
              {name}
            </li>
          ))}
        </ul>
      </div>

      <Phone src={posPhoneBn} width={290} tilt="right" alt="Counterfoil Go in Bangla on a phone" className="absolute left-[808px] top-[104px]" />
      <Ticket word="৳500" kicker="বিকাশ · bKash" width={320} className="absolute left-[680px] top-[580px]" />

      {/* Three facts, each shown the way the product shows it. */}
      <div className="absolute left-[1184px] top-[140px] flex h-[660px] w-[320px] flex-col gap-4">
        <div className={cn(s.card, s.inkCard, "flex flex-1 flex-col justify-between p-6")}>
          <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">ভাষা · Language</p>
          <div aria-hidden className="flex rounded-full bg-white/[0.06] p-1 ring-1 ring-inset ring-white/10">
            <span className="flex-1 rounded-full bg-[#f5f2eb] py-2 text-center text-[17px] font-semibold text-[#141413]">বাংলা</span>
            <span className="flex-1 py-2 text-center text-[17px] font-medium text-[rgb(245_242_235/0.8)]">English</span>
          </div>
          <p className="text-[16px] leading-[1.4] text-[rgb(245_242_235/0.76)]">Every screen, receipt and message in both.</p>
        </div>
        <div className={cn(s.card, s.inkCard, "flex flex-1 flex-col justify-between p-6")}>
          <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Currency</p>
          <p className="text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">৳1,437.50</p>
          <p className="text-[16px] leading-[1.4] text-[rgb(245_242_235/0.76)]">Taka to the paisa — prices, VAT and change.</p>
        </div>
        <div className={cn(s.card, s.inkCard, "flex flex-1 flex-col justify-between p-6")}>
          <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Tax</p>
          <dl className="rounded-[12px] bg-[#f5f2eb] px-4 py-2.5 font-mono text-[14px] text-[#141413]">
            {[
              ["Subtotal", "৳900.00"],
              ["VAT 15%", "৳135.00"],
              ["Total", "৳1,035.00"],
            ].map(([k, v]) => (
              <div key={k} className={cn("flex justify-between py-[3px]", k === "VAT 15%" && "font-semibold text-[#aa3000]")}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[16px] leading-[1.4] text-[rgb(245_242_235/0.76)]">15% or 7.5%, worked per line.</p>
        </div>
      </div>
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
