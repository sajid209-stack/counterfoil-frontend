import type { CSSProperties } from "react";
import { CalendarCheck, Languages, Shapes, type LucideIcon } from "lucide-react";
import { Container, LinkButton } from "../_components/ui";
import { HeroComposite } from "./HeroComposite";
import { HeroMarquee } from "./HeroMarquee";
import { HeroScroll } from "./HeroScroll";

const SPECIALS: { icon: LucideIcon; label: string }[] = [
  { icon: Shapes, label: "14 ways to book" },
  { icon: CalendarCheck, label: "Never sold twice" },
  { icon: Languages, label: "বাংলা & English" },
];

const d = (ms: number) => ({ "--w-delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section data-tone="ink" className="w-ink w-grain relative overflow-hidden">
      <div aria-hidden className="w-grid-bg absolute inset-0" />
      <div aria-hidden className="w-glow left-1/2 top-[-260px] h-[620px] w-[920px] max-w-full -translate-x-1/2 opacity-70" />
      <HeroScroll className="relative min-h-[100svh] pb-16 pt-[calc(64px+3rem)] md:pb-24 md:pt-[calc(64px+3.5rem)]">
        <Container>
          <div className="mx-auto flex max-w-[900px] flex-col items-center text-center">
            <p
              data-reveal
              className="w-eyebrow rounded-full bg-white/[0.06] px-4 py-2 text-[12px] text-[var(--w-muted-ink)] ring-1 ring-inset ring-white/10"
            >
              Counterfoil OS · Counterfoil Go
            </p>
            <h1 data-reveal style={d(80)} className="w-display mt-7">
              <span className="w-lit">Counterfoil runs the places that sell </span>
              <span className="w-ember-lit">time.</span>
            </h1>
            <p data-reveal style={d(160)} className="w-lead mt-7 max-w-[600px] text-[var(--w-muted-ink)]">
              Tickets, sessions, courts and tours — sold at the counter, checked at the gate and reconciled by close.
            </p>
            <div data-reveal style={d(240)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/" arrow>
                Try the live demo
              </LinkButton>
              <LinkButton href="#pricing" variant="ghost">
                See pricing
              </LinkButton>
            </div>
            <ul data-reveal style={d(320)} className="mt-8 flex flex-wrap justify-center gap-2">
              {SPECIALS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex h-9 items-center gap-2 rounded-full bg-white/[0.05] px-4 text-[14px] text-[var(--w-fg-ink)] ring-1 ring-inset ring-white/10"
                >
                  <Icon size={15} strokeWidth={1.7} aria-hidden className="text-[var(--w-ember-soft)]" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal style={d(400)} className="mt-12 md:mt-16">
            <HeroComposite />
          </div>
          <HeroMarquee />
        </Container>
      </HeroScroll>
    </section>
  );
}
