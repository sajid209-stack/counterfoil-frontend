import type { ReactNode } from "react";
import { Section, Heading } from "../_components/ui";
import { FamilyDemo, HoldsDemo, LanguageDemo, RepeatDemo, SeatsDemo, TakaDemo } from "./SpecialsDemos";

const CELLS: { title: string; body: string; demo: ReactNode }[] = [
  { title: "Seat maps", body: "Pick the exact seat on a plan — stalls, balcony, whatever you draw. A seat sold at one counter is gone at every other.", demo: <SeatsDemo /> },
  { title: "One scan, the whole family", body: "A family ticket admits four on a single scan, and the gate counts every head in.", demo: <FamilyDemo /> },
  { title: "Taka to the paisa", body: "Every amount in taka to two places, with VAT 15% or 7.5% worked out on each line.", demo: <TakaDemo /> },
  { title: "Bangla and English", body: "Switch the till and the admin between English and বাংলা, no reload.", demo: <LanguageDemo /> },
  { title: "Holds", body: "Set places aside for a school group or a private event. Release them and they sell again.", demo: <HoldsDemo /> },
  { title: "Repeat weekly", body: "Book the next seven Wednesdays in one go. A date already taken is skipped, never double-booked.", demo: <RepeatDemo /> },
];

export function Specials() {
  return (
    <Section id="specials" flush>
      <div className="px-5 pt-20 pb-12 md:px-12 md:pt-28 md:pb-16">
        <Heading label="Specialities" title="What a retail till can't do." dim="Built in from the first sale." />
      </div>
      <div className="cf-cells grid-cols-1 border-t border-[var(--cf-line)] md:grid-cols-2 lg:grid-cols-3">
        {CELLS.map((c) => (
          <div key={c.title} className="min-w-0">
            {c.demo}
            <div className="p-5 md:p-6">
              <h3 className="cf-h3">{c.title}</h3>
              <p className="cf-body mt-2">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
