"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePage } from "../context";
import { Section } from "../Section";
import { externalHref } from "@/lib/externalLink";
import type { EventSponsor } from "@/lib/api/events";
import { clean, sponsorsOf } from "./helpers";

/** The narrowest a card may be from a tablet up, by rank: the first tier is the
 *  largest. Cards share the row evenly; on a phone they sit two across. */
const WIDTH = [220, 170, 140] as const;

const initial = (name: string) => Array.from(clean(name))[0]?.toUpperCase() ?? "";

/**
 * Sponsors, grouped by the operator's own word for the level (a small label per
 * group). Every card has the same anatomy: a fixed logo plate on top and the
 * name beneath it, ALWAYS printed. The plate is white — uploaded logos are
 * flattened on white, so it looks intended on a dark page too — with the logo
 * contained and generously inset; with no logo (or one that fails) it carries a
 * neat initial, so a row stays even. Cards in a group are one size, and wrap
 * left-aligned, so one sponsor or eight look right, two across on a phone. A
 * sponsor with a link makes the whole card that link.
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
          const width = flat ? WIDTH[1] : WIDTH[Math.min(gi, WIDTH.length - 1)];
          return (
            <div key={g.tier || "all"}>
              {g.tier && <h3 className="pg-meta mb-3 font-semibold">{g.tier}</h3>}
              <ul
                className="grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(var(--sponsor-w),1fr))]"
                style={{ "--sponsor-w": `${width}px` } as React.CSSProperties}
              >
                {g.items.map((s) => (
                  <li key={s.id} className="flex">
                    <SponsorCard sponsor={s} />
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

function SponsorCard({ sponsor: s }: { sponsor: EventSponsor }) {
  const t = useTranslations("storefront");
  const [broken, setBroken] = useState(false);
  const href = externalHref(s.href);
  const logo = s.logoUrl && !broken ? s.logoUrl : null;

  const inner = (
    <>
      {/* The plate: white on purpose (logos are flattened on white), a fixed
          3:2 so every card in a row is the same height. */}
      <div className="relative w-full" style={{ aspectRatio: "3 / 2", background: "#fff", borderBottom: "1px solid var(--pg-line)" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded data URL or bundled asset
          <img src={logo} alt="" onError={() => setBroken(true)} className="absolute inset-0 size-full object-contain p-5" />
        ) : (
          <span aria-hidden className="absolute inset-0 grid place-items-center">
            <span className="grid size-14 place-items-center rounded-full text-[24px] font-semibold" style={{ background: "#f1f1ee", color: "#3a3a40" }}>
              {initial(s.name)}
            </span>
          </span>
        )}
      </div>
      <div className="flex min-h-[3.5rem] flex-1 items-center justify-center gap-1.5 px-3 py-3 text-center">
        <span className="min-w-0 text-[14px] font-semibold leading-5" style={{ overflowWrap: "anywhere" }}>
          {s.name}
        </span>
        {href && <ArrowUpRight size={16} strokeWidth={2} aria-hidden className="shrink-0" style={{ color: "var(--pg-muted)" }} />}
      </div>
    </>
  );
  const base = "pg-card flex w-full min-w-0 flex-col overflow-hidden";

  if (!href) return <div className={base}>{inner}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`${base} outline-offset-2 transition-colors hover:border-[color:var(--pg-ink)] focus-visible:outline-2 focus-visible:outline-[var(--pg-accent)] motion-reduce:transition-none`}
    >
      {inner}
      <span className="sr-only">{t("pg.sec.opensNew")}</span>
    </a>
  );
}
