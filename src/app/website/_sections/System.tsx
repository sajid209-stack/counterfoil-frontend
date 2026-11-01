import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { BrowserFrame, ChapterHead, Container, Section, TabletFrame } from "../_components/ui";
import { SystemSync } from "./SystemSync";
import dashLight from "@/app/deck/_media/os-dashboard-light.jpg";
import till from "@/app/deck/_media/go-till.jpg";

const GUARANTEES = [
  ["Same catalogue", "What OS sets up is what Go sells."],
  ["Same capacity", "A place sold at one counter is gone at every other."],
  ["Same ledger", "Every sale lands in the reports as it happens."],
] as const;

const d = (ms: number) => ({ "--w-delay": `${ms}ms` }) as CSSProperties;

export function System() {
  return (
    <Section id="system" tone="ink" className="overflow-hidden">
      <div aria-hidden className="w-glow bottom-[-320px] right-[-200px] h-[640px] w-[760px] max-w-full opacity-40" />
      <Container className="relative">
        <ChapterHead
          n="02"
          eyebrow="The system"
          title={<span className="w-lit">One system, from the office to the gate.</span>}
          lead="OS runs the business on the web. Go sells and admits on a tablet or a phone."
        />

        <ul className="mt-14 grid gap-px overflow-hidden rounded-[20px] bg-[var(--w-line-ink)] md:mt-20 md:grid-cols-3">
          {GUARANTEES.map(([title, body], i) => (
            <li key={title} data-reveal style={d(i * 90)} className="flex gap-4 bg-[var(--w-ink)] p-6 md:p-7">
              <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--w-ember)] text-[var(--w-ink)]">
                <Check size={14} strokeWidth={2.6} />
              </span>
              <span>
                <span className="block text-[17px] font-semibold tracking-[-0.02em]">{title}</span>
                <span className="mt-1 block text-[15px] text-[var(--w-muted-ink)]">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div data-reveal className="mt-16 md:mt-24">
          <p className="sr-only">
            A live demo: a ticket sale at either till lowers the seats left on the OS dashboard and on both tills at the same moment, and adds to the revenue.
          </p>
          <SystemSync />
          <p className="w-eyebrow mt-8 text-center text-[12px] text-[var(--w-muted-ink)]">One sale · three screens · same instant</p>
        </div>

        <div className="mt-20 grid items-end gap-12 md:mt-28 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          <figure data-reveal>
            <BrowserFrame src={dashLight} alt="Counterfoil OS dashboard in light mode: revenue today, capacity sold, arrivals and booked ahead" sizes="(min-width: 1200px) 700px, 100vw" />
            <figcaption className="mt-5 text-[15px] text-[var(--w-muted-ink)]">
              <span className="font-medium text-[var(--w-fg-ink)]">OS · on the web</span> — runs the business
            </figcaption>
          </figure>
          <figure data-reveal style={d(120)}>
            <TabletFrame src={till} alt="Counterfoil Go on a tablet: the sell wall with bookings, and a cart with a sale ready to charge" sizes="(min-width: 1024px) 480px, 100vw" />
            <figcaption className="mt-5 text-[15px] text-[var(--w-muted-ink)]">
              <span className="font-medium text-[var(--w-fg-ink)]">Go · at the counter</span> — sells and admits
            </figcaption>
          </figure>
        </div>
      </Container>
    </Section>
  );
}
