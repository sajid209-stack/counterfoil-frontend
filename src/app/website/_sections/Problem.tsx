import { CalendarX, Compass, ScanLine } from "lucide-react";
import { Heading, Section, delay } from "../_components/ui";

const PAINS = [
  { icon: CalendarX, title: "A court sold twice for the same hour", body: "Two teams arrive. One goes home." },
  { icon: Compass, title: "A tour sold with no guide free", body: "The booking stands; the tour does not." },
  { icon: ScanLine, title: "A ticket nobody at the gate can check", body: "A paper stub passes from hand to hand." },
];

export function Problem() {
  return (
    <Section className="!pb-4 md:!pb-8">
      <Heading title="A retail till knows a product. It doesn’t know 6 PM." />
      <ul className="mt-14 grid gap-10 md:grid-cols-3 md:gap-12">
        {PAINS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} data-reveal style={delay(i * 80)}>
            <Icon aria-hidden size={22} strokeWidth={1.6} className="text-[var(--cf-fg)]" />
            <h3 className="cf-h3 mt-4">{title}</h3>
            <p className="cf-body mt-2">{body}</p>
          </li>
        ))}
      </ul>
      <p data-reveal className="cf-lead mt-14 max-w-[760px] border-t border-[var(--cf-line)] pt-8">
        “Is 6 PM still free?” Asked at every counter, every day, and answered by a spreadsheet, a WhatsApp group and a guess.
      </p>
    </Section>
  );
}
