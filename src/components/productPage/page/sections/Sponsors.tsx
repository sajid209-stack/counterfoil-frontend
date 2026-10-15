"use client";

import { usePage } from "../context";
import { Section } from "../Section";
import { clean, sponsorsOf } from "./helpers";

/** Plate sizes by rank: the first tier is the largest, each lower tier smaller. */
const SIZE = [
  { min: 220, h: 88, font: 18 },
  { min: 170, h: 72, font: 16 },
  { min: 140, h: 56, font: 14 },
] as const;

/**
 * Sponsors: grouped by the operator's own word for the level, names in bordered
 * neutral tiles, smaller the lower the tier. Names only — sponsor artwork is an
 * upload this product does not have, and a wall of names says more than a wall
 * of broken images.
 */
export function SponsorsSection() {
  const ctx = usePage();
  const sponsors = sponsorsOf(ctx);
  if (sponsors.length === 0) return null;

  const groups: { tier: string; items: typeof sponsors }[] = [];
  for (const s of sponsors) {
    const tier = clean(s.tier);
    const g = groups.find((x) => x.tier === tier);
    if (g) g.items.push(s);
    else groups.push({ tier, items: [s] });
  }
  /* No tiers at all is one flat wall at the middle size. */
  const flat = groups.length === 1 && groups[0].tier === "";

  return (
    <Section id="sponsors" title={ctx.labels.sponsors}>
      <div className="flex flex-col gap-8">
        {groups.map((g, gi) => {
          const size = flat ? SIZE[1] : SIZE[Math.min(gi, SIZE.length - 1)];
          return (
            <div key={g.tier || "all"}>
              {g.tier && <h3 className="pg-meta mb-3 font-semibold">{g.tier}</h3>}
              <ul
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${size.min}px), 1fr))` }}
              >
                {g.items.map((s) => (
                  <li
                    key={s.id}
                    className="grid place-items-center rounded-xl px-4 text-center font-semibold"
                    style={{
                      minHeight: size.h,
                      fontSize: size.font,
                      lineHeight: 1.25,
                      border: "1px solid var(--pg-line)",
                      background: "var(--pg-card)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
