import Image from "next/image";
import { Languages, QrCode, Receipt } from "lucide-react";
import { cn } from "@/lib/cn";
import { Floor, Glow, Phone, Pill, Slide, TextBlock, Ticket, deckStyles as s } from "../_components/Parts";
import logoOnInk from "../_media/logo-counterfoil-dark.png";
import posPhoneBn from "../_media/go-pos-phone-bn.jpg";

/* Slides 23–25: where Counterfoil is today, the market it is built for, and the close. */

const STATS = [
  { value: "20", approx: true, label: "Operators", body: "running Counterfoil today", accent: true },
  { value: "4", label: "Countries", body: "Bangladesh, Malaysia, the US and Canada" },
  { value: "14", label: "Booking types", body: "sold from one engine" },
  { value: "2", label: "Languages", body: "Bangla and English, on every screen" },
];

export function TodaySlide({ n }: { n: number }) {
  return (
    <Slide tone="paper" n={n} section="Counterfoil" label="Already at the counter">
      <TextBlock eyebrow="Today" title="Already at the counter." width={880} />
      <p className={cn(s.lead, s.text)} style={{ left: 1024, top: 128, width: 480 }}>
        Venues, tours and attractions run their day on the current version.
      </p>
      <ul className="absolute left-[96px] top-[284px] grid h-[356px] w-[1408px] grid-cols-4 gap-6">
        {STATS.map(({ value, approx, label, body, accent }) => (
          <li key={label} className={cn(s.card, accent ? "relative bg-[#141413] text-[#f5f2eb]" : s.paperCard, "flex flex-col p-8")}>
            {accent && <Glow className="left-[80px] top-[160px] h-[380px] w-[380px] opacity-70" />}
            <span className={cn(s.mono, "relative uppercase", accent ? "text-[#ffa572]" : "text-[#aa3000]")}>{label}</span>
            {/* Pushed to the bottom with room for two lines of body, so every numeral and rule sits on one line across the row. */}
            <div className="relative mt-auto">
              <p className={cn(s.numeral, accent && s.accentInk)}>
                {approx && <span className="mr-[0.04em] inline-block align-[0.22em] text-[0.56em]">~</span>}
                {value}
              </p>
              <div className={cn(s.perforation, "my-5")} />
              <p className={cn("min-h-[54px] text-[19px] leading-[1.4]", accent ? "text-[rgb(245_242_235/0.8)]" : "text-[#57534c]")}>{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className={cn(s.card, s.paperCard, "absolute left-[96px] top-[664px] flex h-[136px] w-[1408px] items-center gap-8 px-10")}>
        <span className={cn(s.mono, "shrink-0 uppercase text-[#aa3000]")}>Built for</span>
        <ul className="flex flex-1 items-center justify-between">
          {["Heritage sites", "Turfs & courts", "Bowling", "Spas", "Cinemas", "Tours"].map((kind, i) => (
            <li key={kind} className="flex items-center gap-8 text-[30px] font-semibold tracking-[-0.03em]">
              {i > 0 && <span aria-hidden className="h-[8px] w-[8px] rounded-full bg-[#f94a00]" />}
              {kind}
            </li>
          ))}
        </ul>
      </div>
    </Slide>
  );
}

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
        <p className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Takes payment by</p>
        <ul className="mt-3.5 grid grid-cols-3 gap-3">
          {["bKash", "SSLCOMMERZ", "Bangla QR", "Stripe", "Cash", "Card terminal"].map((name) => (
            <li key={name} className={cn(s.card, s.inkCard, "flex h-[68px] items-center px-5 text-[18px] font-semibold [--card-r:16px]")}>
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-9 font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.64)]">Selling in</p>
        {/* One row, sized to fit the column: a country left alone on a second line reads as an afterthought. */}
        <ul className="mt-3.5 flex gap-2">
          {["Bangladesh", "Malaysia", "United States", "Canada"].map((country) => (
            <li key={country}>
              <Pill style={{ padding: "10px 15px", fontSize: 16, gap: 9 }}>
                <span aria-hidden className="h-[8px] w-[8px] rounded-full bg-[#ff7a3d]" />
                {country}
              </Pill>
            </li>
          ))}
        </ul>
      </TextBlock>

      <Phone src={posPhoneBn} width={300} tilt="right" alt="Counterfoil Go in Bangla on a phone" className="absolute left-[800px] top-[92px]" />
      <Ticket word="৳500" kicker="বিকাশ · bKash" width={320} className="absolute left-[680px] top-[572px]" />

      {[
        { icon: Languages, label: "ভাষা · Language", title: "বাংলা · English", body: "Every screen in both languages.", top: 152 },
        { icon: QrCode, label: "Payments", title: "Bangla QR", body: "One code for every bank and wallet app.", top: 356 },
        { icon: Receipt, label: "Tax", title: "VAT on every line", body: "15% standard, 7.5% reduced, the BIN on the receipt.", top: 560 },
      ].map(({ icon: Icon, label, title, body, top }) => (
        <div key={title} className={cn(s.card, s.inkCard, "absolute left-[1184px] flex h-[180px] w-[320px] flex-col justify-between p-6")} style={{ top }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[14px] uppercase tracking-[0.1em] text-[rgb(245_242_235/0.66)]">{label}</span>
            <Icon size={22} strokeWidth={1.6} className="text-[#ffa572]" aria-hidden />
          </div>
          <div>
            <p className="text-[27px] font-semibold tracking-[-0.02em]">{title}</p>
            <p className="mt-1.5 text-[16px] leading-[1.4] text-[rgb(245_242_235/0.72)]">{body}</p>
          </div>
        </div>
      ))}
    </Slide>
  );
}

export function CloseSlide({ n }: { n: number }) {
  return (
    <Slide tone="ink" n={n} section="Counterfoil" label="Every seat, slot and session, accounted for">
      <Glow className="left-[400px] top-[-120px] h-[900px] w-[800px]" />
      <Floor />
      <Ticket
        variant="glass"
        width={300}
        tilt="perspective(1000px) rotateX(26deg) rotateY(-26deg) rotateZ(-16deg)"
        className="absolute left-[588px] top-[168px]"
      />
      <Ticket width={320} className="absolute left-[764px] top-[92px]" />
      <div className={cn(s.text, "text-center")} style={{ left: 150, top: 392, width: 1300 }}>
        <h2 className={s.display}>
          Every seat, slot and session — <span className={s.accentInk}>accounted for.</span>
        </h2>
        <p className={cn(s.lead, "mx-auto mt-8 w-[720px]")}>Counterfoil is built by Ternary Solutions for the people who run venues, tours and attractions.</p>
      </div>
      <Image src={logoOnInk} alt="Counterfoil" sizes="280px" className="absolute left-1/2 top-[724px] h-[44px] w-auto -translate-x-1/2" />
    </Slide>
  );
}
