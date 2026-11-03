"use client";

import { useState } from "react";
import type { EventHighlight } from "@/lib/api/events";
import { bentoPlan, cellStyle, gridStyle, type Cell } from "../bento";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, highlightsOf } from "./helpers";

/**
 * Highlights: plain tiles, flat on the surface ground, laid out as a bento that
 * follows the count (`bentoPlan`). Words only, or a photo with the words over a
 * scrim. No icons, no tinted circles, no border: the tile's size and type do
 * the work. The lead tile states its label in the page's heading face; the
 * rest in the body face, semibold.
 */
export function HighlightsSection() {
  const ctx = usePage();
  const items = highlightsOf(ctx);
  if (items.length === 0) return null;

  const plan = bentoPlan(items.length, ctx.layout, { tallLead: !!clean(items[0].imageUrl) });
  /* Words alone need less height than a picture does. */
  const anyPhoto = items.some((h) => clean(h.imageUrl));
  const phone = ctx.layout === "phone";
  return (
    <Section id="highlights" title={ctx.labels.highlights}>
      <ul style={{ ...gridStyle(plan), gap: "var(--pg-gap, 16px)", gridAutoRows: anyPhoto ? (phone ? "minmax(160px, auto)" : "minmax(200px, auto)") : "minmax(112px, auto)" }}>
        {items.map((h, i) => (
          <Tile key={h.id} item={h} cell={plan.cells[i]} lead={i === 0 && items.length > 1} phone={phone} />
        ))}
      </ul>
    </Section>
  );
}

function Tile({ item: h, cell, lead, phone }: { item: EventHighlight; cell: Cell; lead: boolean; phone: boolean }) {
  const [broken, setBroken] = useState(false);
  const text = clean(h.description);
  const photo = clean(h.imageUrl) && !broken ? h.imageUrl : null;
  const big = lead && cell.col >= 3;
  /* A lead on two rows needs room for its photo or its words. */
  const tall = cell.row > 1;

  return (
    <li
      className="pg-media relative isolate flex min-w-0 flex-col justify-end overflow-hidden"
      style={{
        ...cellStyle(cell),
        background: "var(--pg-surface)",
        padding: phone ? 20 : 28,
        minHeight: tall && !phone ? 416 : undefined,
        color: photo ? "#fff" : "var(--pg-fg)",
      }}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local / remote photos; next/image loader config is avoided app-wide (see PROJECT_LOG) */}
          <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="absolute inset-0 -z-20 size-full object-cover" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.82) 0%, rgb(0 0 0 / 0.5) 50%, rgb(0 0 0 / 0.1) 100%)" }}
          />
        </>
      )}
      <h3
        className={big ? undefined : "text-[18px] font-semibold leading-6"}
        style={
          big
            ? {
                fontFamily: "var(--pg-display)",
                fontSize: phone ? 22 : 26,
                lineHeight: phone ? "28px" : "32px",
                fontWeight: "var(--ps-heading-weight, 700)",
                letterSpacing: "-0.01em",
                overflowWrap: "anywhere",
              }
            : { overflowWrap: "anywhere" }
        }
      >
        {h.label}
      </h3>
      {text && (
        <p className="pg-meta mt-2 max-w-[48ch]" style={photo ? { color: "rgb(255 255 255 / 0.86)" } : undefined}>
          {text}
        </p>
      )}
    </li>
  );
}
