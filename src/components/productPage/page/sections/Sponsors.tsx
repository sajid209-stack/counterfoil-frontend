"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { usePage } from "../context";
import { Section } from "../Section";
import { externalHref } from "@/lib/externalLink";
import type { EventSponsor } from "@/lib/api/events";
import { clean, sponsorsOf } from "./helpers";

/** The logo box's height, by tier: the first tier is a touch larger. */
const BOX_H = [72, 64] as const;
/** The widest a cell grows, so one sponsor is not stretched across the page. */
const CELL_W = 220;

/**
 * Sponsors: a logo wall on the page's own ground. No cards, no boxes, no
 * borders. Grouped by the operator's own word for the level, a small label
 * above each row. Every cell is the same: a fixed-height logo box and the name
 * beneath it at 13px, muted.
 *
 * Logos are uploaded flattened on white. On a light page `multiply` makes the
 * white disappear into the ground; on a dark page that would turn the logo to
 * mud, so it sits on a small white plate in the style's radius. A sponsor with
 * no logo (or one that fails to load) is its name as a wordmark in the same
 * box. A sponsor with a link is a link as a whole cell.
 */
export function SponsorsSection() {
  const ctx = usePage();
  const sponsors = sponsorsOf(ctx);
  if (sponsors.length === 0) return null;

  const groups: { tier: string; items: EventSponsor[] }[] = [];
  for (const s of sponsors) {
    const tier = clean(s.tier);
    const g = groups.find((x) => x.tier === tier);
    if (g) g.items.push(s);
    else groups.push({ tier, items: [s] });
  }
  const phone = ctx.layout === "phone";
  const dark = ctx.style.colours.mode === "dark";

  return (
    <Section id="sponsors" title={ctx.labels.sponsors}>
      <div className="flex flex-col gap-10">
        {groups.map((g, gi) => {
          const cols = Math.min(g.items.length, phone ? 2 : 4);
          return (
            <div key={g.tier || "all"}>
              {g.tier && <h3 className="pg-meta mb-4 font-semibold">{g.tier}</h3>}
              <ul
                className="grid gap-x-8 gap-y-8"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: cols * CELL_W + (cols - 1) * 32 }}
              >
                {g.items.map((s) => (
                  <li key={s.id} className="flex min-w-0">
                    <Cell sponsor={s} height={BOX_H[gi === 0 && groups.length > 1 ? 0 : 1]} dark={dark} />
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

function Cell({ sponsor: s, height, dark }: { sponsor: EventSponsor; height: number; dark: boolean }) {
  const t = useTranslations("storefront");
  const [broken, setBroken] = useState(false);
  const href = externalHref(s.href);
  const logo = s.logoUrl && !broken ? s.logoUrl : null;

  const boxStyle: CSSProperties = { height };
  if (logo && dark) {
    Object.assign(boxStyle, { background: "#fff", borderRadius: "var(--ps-radius-media, 12px)", padding: 10 });
  }

  const inner = (
    <>
      <span className="flex w-full items-center" style={boxStyle}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded data URL or bundled asset
          <img
            src={logo}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="max-h-full max-w-full object-contain object-left"
            style={dark ? undefined : { mixBlendMode: "multiply" }}
          />
        ) : (
          <span className="line-clamp-2 text-[18px] font-semibold leading-6" style={{ overflowWrap: "anywhere" }}>
            {s.name}
          </span>
        )}
      </span>
      {logo && (
        <span className="mt-3 text-[13px] leading-[18px]" style={{ color: "var(--pg-muted)", overflowWrap: "anywhere" }}>
          {s.name}
        </span>
      )}
    </>
  );
  const base = "flex w-full min-w-0 flex-col items-stretch";

  if (!href) return <div className={base}>{inner}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`${base} rounded-[var(--ps-radius-control,12px)] outline-offset-4 transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-[var(--pg-accent)] motion-reduce:transition-none`}
    >
      {inner}
      <span className="sr-only">{t("pg.sec.opensNew")}</span>
    </a>
  );
}
