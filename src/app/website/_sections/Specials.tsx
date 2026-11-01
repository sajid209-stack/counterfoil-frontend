import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Container, ChapterHead, Section } from "../_components/ui";
import { Bilingual, FamilyScan, HoldsDemo, NeverSoldTwice, Receipt, SeatDemo } from "./SpecialsDemos";

function Card({ title, body, className, delay, children }: { title: string; body: string; className?: string; delay: number; children: ReactNode }) {
  return (
    <li data-reveal style={{ "--w-delay": `${delay}ms` } as CSSProperties} className={cn("w-panel-ink flex flex-col p-6 md:p-7", className)}>
      <h3 className="w-h3">{title}</h3>
      <p className="mt-2 text-[15px] leading-[1.5] text-[var(--w-muted-ink)]">{body}</p>
      <div className="mt-6 flex-1 content-end">{children}</div>
    </li>
  );
}

export function Specials() {
  return (
    <Section id="specials" tone="ink">
      <Container>
        <ChapterHead n="05" eyebrow="Specialities" title={<span className="w-lit">What a retail till can&rsquo;t do.</span>} lead="Built in from the first sale." />
        <ul className="mt-14 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-2 md:gap-5 lg:grid-cols-6">
          <Card className="lg:col-span-4" delay={0} title="Never sold twice" body="Sold at one counter, gone at every other.">
            <NeverSoldTwice />
          </Card>
          <Card className="lg:col-span-2" delay={80} title="One scan, the whole family" body="A family ticket lets everyone in.">
            <FamilyScan />
          </Card>
          <Card className="lg:col-span-3" delay={0} title="Seat maps" body="Pick the exact seats; the price follows the section.">
            <SeatDemo />
          </Card>
          <Card className="lg:col-span-3" delay={80} title="Taka to the paisa" body="Prices, VAT and change to the paisa — 15% or 7.5%, worked per line.">
            <Receipt />
          </Card>
          <Card className="lg:col-span-2" delay={0} title="Bangla and English" body="Every screen, receipt and SMS.">
            <Bilingual />
          </Card>
          <Card className="lg:col-span-4" delay={80} title="Holds" body="Capacity taken off public sale — who it is for, and when it goes back.">
            <HoldsDemo />
          </Card>
        </ul>
      </Container>
    </Section>
  );
}
