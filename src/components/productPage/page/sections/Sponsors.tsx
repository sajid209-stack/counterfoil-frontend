"use client";

import { useState } from "react";
import { usePage } from "../context";
import { Section } from "../Section";
import { externalHref } from "@/lib/externalLink";
import type { EventSponsor } from "@/lib/api/events";
import { clean, sponsorsOf } from "./helpers";

/** Plate sizes by rank: the first tier is the largest, each lower tier smaller. */
const SIZE = [
  { min: 220, h: 88, font: 18 },
  { min: 170, h: 72, font: 16 },
  { min: 140, h: 56, font: 14 },
] as const;

/**
 * Sponsors: grouped by the operator's own word for the level, in bordered
 * neutral tiles, smaller the lower the tier. A sponsor with a logo shows it on a
 * white plate (uploads are flattened on white, so it looks intended in a dark
 * theme too) and the name is not printed; without one, or if the image fails,
 * the name is the tile. A sponsor with a link makes the whole tile that link.
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
                  <li key={s.id} className="grid">
                    <SponsorCard sponsor={s} size={size} />
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

function SponsorCard({ sponsor: s, size }: { sponsor: EventSponsor; size: (typeof SIZE)[number] }) {
  const [broken, setBroken] = useState(false);
  const href = externalHref(s.href);
  const logo = s.logoUrl && !broken ? s.logoUrl : null;
  const body = logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploaded data URL or bundled asset
    <img
      src={logo}
      alt={s.name}
      onError={() => setBroken(true)}
      className="w-full object-contain"
      style={{ maxHeight: size.h - 24 }}
    />
  ) : (
    s.name
  );
  const style = {
    minHeight: size.h,
    fontSize: size.font,
    lineHeight: 1.25,
    border: "1px solid var(--pg-line)",
    background: logo ? "#fff" : "var(--pg-card)",
    color: logo ? "#111" : undefined,
    overflowWrap: "anywhere",
  } as const;
  const base = "grid place-items-center rounded-xl px-4 py-3 text-center font-semibold";

  if (!href) {
    return (
      <div className={base} style={style}>
        {body}
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      aria-label={s.name}
      className={`${base} outline-offset-2 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--pg-accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
      style={style}
    >
      {body}
    </a>
  );
}
