"use client";

import { useState } from "react";
import type { EventHighlight } from "@/lib/api/events";
import { bentoPlan, cellStyle, evenPlan, gridStyle, type Cell } from "../bento";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, highlightsOf } from "./helpers";

/**
 * Highlights. Words alone are a text list under hairlines, all of equal rank,
 * laid out by count (`evenPlan`): a box with nothing to show but a short word
 * is an empty card, so there is no box. A photo earns its own space: it sits
 * above its words, on the page ground, in a bento by count (`bentoPlan`). No
 * words over the photo, no icons, no numbers. Photos come first; a photo that
 * fails to load moves its highlight into the words list so the layout stays whole.
 */
export function HighlightsSection() {
  const ctx = usePage();
  const items = highlightsOf(ctx);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  if (items.length === 0) return null;

  const withPhoto = items.filter((h) => clean(h.imageUrl) && !broken.has(h.id));
  const wordsOnly = items.filter((h) => !(clean(h.imageUrl) && !broken.has(h.id)));
  const phone = ctx.layout === "phone";
  const markBroken = (id: string) => setBroken((prev) => new Set(prev).add(id));

  const photoPlan = withPhoto.length > 0 ? bentoPlan(withPhoto.length, ctx.layout, { tallLead: false }) : null;
  const wordsPlan = wordsOnly.length > 0 ? evenPlan(wordsOnly.length, ctx.layout) : null;

  return (
    <Section id="highlights" title={ctx.labels.highlights}>
      <div className="flex flex-col" style={{ gap: 32 }}>
        {photoPlan && (
          <ul style={{ ...gridStyle(photoPlan), columnGap: "var(--pg-gap, 16px)", rowGap: 28 }}>
            {withPhoto.map((h, i) => (
              <PhotoItem key={h.id} item={h} cell={photoPlan.cells[i]} phone={phone} onBroken={markBroken} />
            ))}
          </ul>
        )}
        {wordsPlan && (
          <ul style={{ ...gridStyle(wordsPlan), columnGap: 24, rowGap: phone ? 20 : 28 }}>
            {wordsOnly.map((h, i) => (
              <li key={h.id} className="min-w-0" style={{ ...cellStyle(wordsPlan.cells[i]), borderTop: "1px solid var(--pg-line)", paddingTop: 16 }}>
                <Words item={h} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function Words({ item: h, spaced }: { item: EventHighlight; spaced?: boolean }) {
  const text = clean(h.description);
  return (
    <>
      <h3 className={spaced ? "mt-3 text-[17px] font-semibold leading-6" : "text-[17px] font-semibold leading-6"} style={{ overflowWrap: "anywhere" }}>
        {h.label}
      </h3>
      {text && <p className="pg-meta mt-1.5 max-w-[48ch]">{text}</p>}
    </>
  );
}

function PhotoItem({ item: h, cell, phone, onBroken }: { item: EventHighlight; cell: Cell; phone: boolean; onBroken: (id: string) => void }) {
  const height = phone ? (cell.col === 2 ? 200 : 140) : cell.col === 6 ? 320 : 220;
  return (
    <li className="min-w-0" style={cellStyle(cell)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local / remote photos; next/image loader config is avoided app-wide (see PROJECT_LOG) */}
      <img src={h.imageUrl} alt="" loading="lazy" decoding="async" onError={() => onBroken(h.id)} className="pg-media block w-full object-cover" style={{ height }} />
      <Words item={h} spaced />
    </li>
  );
}
