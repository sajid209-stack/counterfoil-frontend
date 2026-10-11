"use client";

import { Button } from "@/components/ui";
import { CalendarDays, Check, Plus, Search, Settings, Store, Ticket, Users, Wallet, X } from "lucide-react";
import { Code, DoDont, DocSection, ImportLine, P, SectionHeader, Small } from "../_components/Doc";
import { Preview } from "../_components/Preview";

const SIZES = [16, 18, 20, 24] as const;
const USES: Record<(typeof SIZES)[number], string> = {
  16: "Inside a control: beside a button label, in a field, on a chip.",
  18: "Beside body text; a menu item; the rail's rows.",
  20: "Standalone in a toolbar; an empty state's disc.",
  24: "POS tab bar and More grid, where a thumb reads it.",
};

const GLYPHS = [
  { Icon: Ticket, name: "Ticket" },
  { Icon: CalendarDays, name: "CalendarDays" },
  { Icon: Wallet, name: "Wallet" },
  { Icon: Users, name: "Users" },
  { Icon: Store, name: "Store" },
  { Icon: Settings, name: "Settings" },
  { Icon: Search, name: "Search" },
  { Icon: Plus, name: "Plus" },
  { Icon: Check, name: "Check" },
  { Icon: X, name: "X" },
];

function Sizes() {
  return (
    <ul className="grid grid-cols-2 gap-section sm:grid-cols-4">
      {SIZES.map((s) => (
        <li key={s} className="flex flex-col gap-tight">
          <span className="flex h-12 items-center text-fg">
            <Ticket size={s} strokeWidth={1.5} aria-hidden />
          </span>
          <span className="text-sm font-medium text-fg">{s}px</span>
          <span className="text-xs text-muted">{USES[s]}</span>
        </li>
      ))}
    </ul>
  );
}

function Pairing() {
  return (
    <div className="flex flex-wrap items-center gap-tight">
      <Button icon={<Plus size={16} strokeWidth={1.5} aria-hidden />}>
        New booking
      </Button>
      <Button variant="secondary" icon={<Search size={16} strokeWidth={1.5} aria-hidden />}>
        Search
      </Button>
      <Button variant="tertiary" size="icon" aria-label="Close">
        <X size={16} strokeWidth={1.5} aria-hidden />
      </Button>
    </div>
  );
}

export function IconographySection() {
  return (
    <>
      <SectionHeader slug="iconography" />

      <DocSection id="library" title="Lucide, one stroke">
        <P>
          One library: <Code>lucide-react</Code>. Icons are drawn on a 24 grid at a <strong className="font-semibold">1.5 stroke</strong> — pass <Code>strokeWidth={"{1.5}"}</Code> every time, because the library&rsquo;s own default is 2. They take <Code>currentColor</Code>, so they follow the text they sit beside.
        </P>
        <ImportLine code={'import { Ticket } from "lucide-react";'} />
        <Preview label="A few in use">
          <ul className="grid grid-cols-2 gap-section sm:grid-cols-5">
            {GLYPHS.map(({ Icon, name }) => (
              <li key={name} className="flex items-center gap-tight text-sm text-fg">
                <Icon size={20} strokeWidth={1.5} aria-hidden className="text-muted" />
                <span className="font-mono text-xs">{name}</span>
              </li>
            ))}
          </ul>
        </Preview>
      </DocSection>

      <DocSection id="sizes" title="Four sizes">
        <Preview label="16 · 18 · 20 · 24">
          <Sizes />
        </Preview>
        <Small>Pick the size by where the icon sits, not by how loud you want it.</Small>
      </DocSection>

      <DocSection id="words" title="Always paired with a word">
        <P>
          An icon is a hint, not a label. Beside a word it can be decorative (<Code>aria-hidden</Code>). On its own — a close button, a row menu — the control carries an accessible name, and anywhere a person has to <em>learn</em> the glyph, the word is shown. The till is worked by people who remember a pattern rather than read, which is why its buttons put a picture and a word together.
        </P>
        <Preview label="Icon with a word; icon alone, named">
          <Pairing />
        </Preview>
        <DoDont
          dos={["Mark an icon next to a word aria-hidden.", "Give an icon-only button an aria-label that says what it does.", "Keep to the 1.5 stroke and one of the four sizes."]}
          donts={["Use an icon alone for something a person must learn (a tab, a filter).", "Colour an icon to carry meaning on its own — it needs the word or a shape too.", "Mix in a second icon set or a hand-drawn glyph."]}
        />
      </DocSection>
    </>
  );
}
