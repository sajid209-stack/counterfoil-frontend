import { Heading, Section } from "../_components/ui";
import { EngineDiagram } from "./EngineDiagram";
import s from "./Engine.module.css";

const cellDelay = (i: number) => ({ "--d": `${i * 0.35}s` }) as React.CSSProperties;
const CHIP = "rounded-lg px-2.5 py-1.5 text-[12px] font-medium shadow-[var(--cf-shadow)]";

const CLAIMS = [
  {
    title: "One capacity, everywhere",
    body: "Tills, the online booking page and the gate scanner draw from the same count, so a place sold at one is gone at all of them.",
    glyph: (
      <div className="flex gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={s.cell} style={cellDelay(i)} />
        ))}
      </div>
    ),
  },
  {
    title: "Holds that name who they're for",
    body: "Set places aside for a school group or a private event. A hold always says who it is for, and lets go on its own when it expires.",
    glyph: <span className={`${s.hold} ${CHIP} text-[var(--cf-fg)]`}>School group · 25 places</span>,
  },
  {
    title: "Refusals that explain themselves",
    body: "When something can't be sold, the till says why (sold out, held for a group, closed) and what to do next, instead of a bare no.",
    glyph: (
      <span className="rounded-lg bg-[var(--cf-red-wash)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--cf-fg)]">
        <span className={s.type}>Taken — Field 2 is free</span>
        <span className="cf-caret" />
      </span>
    ),
  },
  {
    title: "Resources shared across bookings",
    body: "On the turf, Football and Cricket share Fields 1–2. Book one and the other sees the field taken.",
    glyph: (
      <div className="flex items-center gap-2 text-[12px] font-medium">
        <span className={`${s.turnA} ${CHIP}`}>Football</span>
        <span className={`${s.turnB} ${CHIP}`}>Cricket</span>
        <span className={`${s.field} rounded-lg px-2 py-1.5 text-[var(--cf-fg-2)]`}>Fields 1–2</span>
      </div>
    ),
  },
];

/** "Never sold twice": one capacity engine behind every counter. */
export function Engine() {
  return (
    <Section id="engine" flush className="px-5 py-20 md:px-12 md:py-28">
      <Heading
        label="Capacity"
        title={
          <>
            Never sold <span className="cf-accent">twice.</span>
          </>
        }
        dim="One engine holds every seat, slot and lane."
        lead="A place sold at one counter is gone at every other counter, and online — the moment it sells."
      />
      <p className="sr-only">
        A live diagram: tills, the online booking page and the gate scanner all feed one capacity engine. When one source sells Football Field 1 at 18:00, a second
        source is refused with the reason, and the sale appears in the calendar, reports and check-in roster.
      </p>
      <div data-reveal className="mt-12 md:mt-16">
        <EngineDiagram />
      </div>
      <div data-reveal className="cf-cells mt-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {CLAIMS.map((c) => (
          <div key={c.title} className="p-6">
            <div aria-hidden className={s.glyph}>
              {c.glyph}
            </div>
            <h3 className="cf-h3 mt-4">{c.title}</h3>
            <p className="cf-body mt-2">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
