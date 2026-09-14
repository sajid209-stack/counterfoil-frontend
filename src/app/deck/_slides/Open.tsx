import Image from "next/image";
import { CalendarX, Check, Compass, ScanLine, Store } from "lucide-react";
import { cn } from "@/lib/cn";
import { Callout, Floor, Glow, Laptop, Phone, PosStand, Slide, TextBlock, Ticket, deckStyles as s } from "../_components/Parts";
import logoOnInk from "../_media/logo-counterfoil-dark.png";
import dashDark from "../_media/os-dashboard-dark.jpg";
import dashLight from "../_media/os-dashboard-light.jpg";
import till from "../_media/go-till.jpg";
import phoneSellDark from "../_media/go-phone-sell-dark.jpg";
import phoneSeats from "../_media/go-sheet-cinema.jpg";

/* Slides 1–4: what Counterfoil is, the problem, the system and how it works. */

const PROOF = [
  ["~20", "operators"],
  ["4", "countries"],
  ["14", "ways to book"],
];

export function CoverSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="" label="Counterfoil runs the places that sell time">
      <Glow className="left-[820px] top-[-300px] h-[860px] w-[900px]" />
      <Floor />
      <div className="absolute left-[96px] top-[80px] flex items-center gap-6">
        <Image src={logoOnInk} alt="Counterfoil" sizes="240px" priority className="h-[40px] w-auto" />
        <span aria-hidden className="h-6 w-px bg-white/20" />
        <span className={s.eyebrow}>Company deck · 2026</span>
      </div>
      {/* Title, lead and the three facts are one block, so nothing can run into anything. */}
      <div className={s.text} style={{ left: 96, top: 218, width: 660 }}>
        <h2 className={s.display}>
          Counterfoil runs the places that sell <span className={s.accentInk}>time.</span>
        </h2>
        <p className={cn(s.lead, "mt-8 w-[540px]")}>
          Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close.
        </p>
        <dl className="mt-10 flex w-[540px] gap-10 border-t border-white/12 pt-6">
          {PROOF.map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="flex items-baseline gap-2.5">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">{value}</span>
                <span className="text-[17px] text-[rgb(245_242_235/0.66)]">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {/*
        One family, standing on one line: OS on the laptop at the back, Go in
        front of it on the counter and in the hand. Every device faces the
        reader, and the stand and the phone share a ground line in front of
        the laptop's, which is what puts them nearer.
      */}
      <Laptop
        src={dashDark}
        width={720}
        priority
        alt="Counterfoil OS dashboard with revenue, capacity and what needs attention"
        className="absolute left-[784px] top-[146px]"
      />
      <PosStand
        src={till}
        width={372}
        priority
        alt="Counterfoil Go on a countertop stand, with a sale in the cart"
        className="absolute left-[742px] top-[478px]"
      />
      <Phone
        src={phoneSellDark}
        bar="#141413"
        ink="light"
        width={168}
        priority
        alt="Counterfoil Go on a phone in dark mode: the sell wall"
        className="absolute left-[1318px] top-[418px]"
      />
    </Slide>
  );
}

const PAINS = [
  { icon: CalendarX, title: "A court sold twice for the same hour", body: "Two teams arrive. One goes home." },
  { icon: Compass, title: "A tour sold with no guide free", body: "The booking stands; the tour does not." },
  { icon: ScanLine, title: "A ticket nobody at the gate can check", body: "A paper stub passes from hand to hand." },
];

export function ProblemSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil" label="Venues sell time with tools built for shelves">
      <TextBlock eyebrow="The problem" title="Venues sell time with tools built for shelves." width={460}>
        <p className={s.heading}>A retail till knows a product. It doesn’t know 18:00.</p>
        <ul className="mt-7 flex flex-col">
          {PAINS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 border-t border-white/10 py-4">
              <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[13px] bg-white/[0.07] text-[#ffa572] ring-1 ring-inset ring-white/10">
                <Icon size={21} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[18px] font-semibold leading-snug">{title}</span>
                <span className={cn(s.body, "block text-[17px]")}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>

      <div className={cn(s.card, s.emberCard, "absolute left-[596px] top-[92px] flex h-[708px] w-[434px] flex-col justify-between p-10")}>
        <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-white/20">
          <Store size={28} strokeWidth={1.6} aria-hidden />
        </span>
        <div>
          <p className="text-[74px] font-semibold leading-[0.95] tracking-[-0.045em]">“Is 18:00 still free?”</p>
          <p className="mt-6 text-[19px] leading-[1.45] text-white">
            Asked at every counter, every day — and answered by a spreadsheet, a WhatsApp group and a guess.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-white px-5 py-2.5 font-mono text-[14px] font-medium uppercase tracking-[0.12em] text-[#6f2000]">
          At the counter
        </span>
      </div>

      <div className={cn(s.card, s.inkCard, "absolute left-[1070px] top-[92px] h-[708px] w-[434px] p-10")}>
        <Glow className="left-[40px] top-[320px] h-[420px] w-[380px] opacity-80" />
        <Floor />
        <p className={cn(s.heading, "relative z-10 w-[330px]")}>
          Paper stubs, a generic till, <span className="text-[rgb(245_242_235/0.62)]">and a cash box that never quite adds up.</span>
        </p>
        <Ticket
          variant="glass"
          width={290}
          tilt="perspective(1000px) rotateX(28deg) rotateY(-22deg) rotateZ(-18deg)"
          className="absolute left-[30px] top-[478px]"
        />
        <Ticket
          word="VOID"
          kicker="Refunded"
          width={290}
          tilt="perspective(1000px) rotateX(20deg) rotateY(-32deg) rotateZ(12deg)"
          className="absolute left-[116px] top-[334px]"
        />
      </div>
    </Slide>
  );
}

export function SystemSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil" label="One system, from the office to the gate">
      <TextBlock
        eyebrow="The product"
        title="One system, from the office to the gate."
        lead="OS runs the business on the web. Go sells and admits on a tablet or a phone."
      >
        <ul className="flex flex-col gap-5">
          {[
            ["Same catalogue", "What OS sets up is what Go sells."],
            ["Same capacity", "A place sold at one counter is gone at every other."],
            ["Same ledger", "Every sale lands in the reports as it happens."],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-4">
              <span aria-hidden className="mt-[3px] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#141413] text-[#f5f2eb]">
                <Check size={16} strokeWidth={2.6} />
              </span>
              <span>
                <span className={cn(s.heading, "block")}>{title}</span>
                <span className={cn(s.body, "mt-1 block")}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </TextBlock>

      {/* The same family as the cover, standing on one line, with a label under each surface. */}
      <Laptop src={dashLight} width={740} alt="Counterfoil OS dashboard on a laptop" className="absolute left-[764px] top-[132px]" />
      <PosStand src={till} width={372} alt="Counterfoil Go on a countertop stand" className="absolute left-[700px] top-[440px]" />
      <Phone src={phoneSeats} bar="#989793" width={160} alt="Choosing seats for an evening film on a phone" className="absolute left-[1328px] top-[386px]" />
      <Callout tone="paper" label="OS · on the web" value="Runs the business" className="absolute left-[1284px] top-[74px]" />
      <Callout tone="paper" label="Go · counter & phone" value="Sells and admits" className="absolute left-[1086px] top-[706px]" />
    </Slide>
  );
}

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
      <div className="grid w-[210px] grid-cols-4 gap-2.5">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "aspect-square rounded-[9px]",
              i === 5 ? "bg-[#f94a00] shadow-[0_8px_18px_-6px_rgb(249_74_0/0.6)]" : i % 3 === 0 ? "bg-[#ffd3b8]" : "bg-white shadow-[0_1px_2px_rgb(20_20_19/0.06)]",
            )}
          />
        ))}
      </div>
    );
  }
  if (art === "tags") {
    return (
      <div className="flex w-[236px] flex-col gap-3">
        {[
          { method: "bKash", price: "৳500" },
          { method: "QR", price: "৳1,500" },
          { method: "Cash", price: "৳800" },
        ].map(({ method, price }, i) => (
          <span
            key={method}
            className={cn(
              "flex items-center justify-between gap-6 rounded-full px-5 py-3 text-[17px] font-semibold tabular-nums shadow-[0_1px_2px_rgb(20_20_19/0.06)]",
              i === 0 ? "bg-[#141413] text-[#f5f2eb]" : "bg-white text-[#3f3b35]",
            )}
            style={{ marginLeft: i * 18, marginRight: -i * 18 }}
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
      <div className="relative h-[190px] w-[190px]">
        {[
          "left-0 top-0 border-l-[4px] border-t-[4px] rounded-tl-[20px]",
          "right-0 top-0 border-r-[4px] border-t-[4px] rounded-tr-[20px]",
          "bottom-0 left-0 border-b-[4px] border-l-[4px] rounded-bl-[20px]",
          "bottom-0 right-0 border-b-[4px] border-r-[4px] rounded-br-[20px]",
        ].map((c) => (
          <span key={c} className={cn("absolute h-[56px] w-[56px] border-[#141413]", c)} />
        ))}
        <span className="absolute inset-x-[22px] top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#f94a00] shadow-[0_0_18px_2px_rgb(249_74_0/0.6)]" />
        <span className="absolute left-1/2 top-1/2 grid h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_10px_24px_-10px_rgb(20_20_19/0.35)]">
          <Check size={36} className="text-[#1f9d55]" strokeWidth={2.5} aria-hidden />
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-[170px] w-[220px] items-end gap-3">
      {[38, 62, 46, 80, 56, 100].map((h, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-t-[9px]", i === 5 ? "bg-[#f94a00] shadow-[0_8px_18px_-6px_rgb(249_74_0/0.6)]" : "bg-white shadow-[0_1px_2px_rgb(20_20_19/0.06)]")}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export function HowItWorksSlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil" label="From first sale to cash-up">
      <TextBlock eyebrow="How it works" title="From first sale to cash-up." width={880} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Four steps every venue already takes — done in one place, by the people already doing them.
      </p>
      {/* The steps as the sequence they are: one line runs through all four, left to right. */}
      <div className="absolute left-[96px] top-[292px] w-[1408px]">
        <div aria-hidden className="absolute inset-x-0 top-[311px] h-[2px] bg-[#141413]" />
        <ol className="grid grid-cols-4 gap-x-8">
          {STEPS.map((step) => (
            <li key={step.n}>
              <div className="grid h-[280px] place-items-center rounded-[18px] bg-[#ebe5d9]">
                <StepArt art={step.art} />
              </div>
              <span aria-hidden className="relative z-10 mt-[24px] block h-[16px] w-[16px] rounded-full border-2 border-[#141413] bg-[#f94a00]" />
              <p className={cn(s.mono, "mt-6 text-[#aa3000]")}>{step.n}</p>
              <h3 className={cn(s.heading, "mt-2")}>{step.name}</h3>
              <p className={cn(s.body, "mt-2 w-[300px]")}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Slide>
  );
}
