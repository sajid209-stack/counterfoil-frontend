"use client";

import { usePage } from "./context";

/**
 * Two to four figures directly under the hero, inside the container: the
 * figure 24/600 over a 13px muted label, separated by 1px rules
 * (docs/product-page.md §3.3). Not a band — no ground, no full-bleed edge —
 * so it reads as part of the page rather than a divider across it. On a phone
 * it wraps to two by two.
 *
 * Draws nothing when the operator switched "At a glance" off, or has fewer
 * than two figures worth stating.
 */
export function FactsStrip() {
  const { ev, sections, layout, labels } = usePage();
  if (!sections.includes("stats")) return null;
  const stats = ev.stats.filter((s) => s.value.trim() && s.label.trim()).slice(0, 4);
  if (stats.length < 2) return null;
  const cols = layout === "phone" ? 2 : stats.length;
  return (
    <section aria-label={labels.stats} className="pg-container pb-2 pt-0">
      <dl className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {stats.map((s, i) => {
          const startOfRow = i % cols === 0;
          const firstRow = i < cols;
          return (
            <div
              key={s.id}
              className="flex min-w-0 flex-col-reverse justify-end py-3"
              style={{
                paddingLeft: startOfRow ? 0 : layout === "phone" ? 16 : 24,
                paddingRight: 8,
                borderLeft: startOfRow ? undefined : "1px solid var(--pg-line)",
                borderTop: firstRow ? undefined : "1px solid var(--pg-line)",
              }}
            >
              <dt className="text-[13px] leading-[18px]" style={{ color: "var(--pg-muted)" }}>
                {s.label}
              </dt>
              <dd className="tnum text-[24px] font-semibold leading-8" style={{ color: "var(--pg-fg)" }}>
                {s.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
