"use client";

import { sectionAnchor, usePage } from "../context";
import { usePrimaryLabel } from "../ticketRows";
import { ctaOf } from "./helpers";

/**
 * CTA — a compact band on --ps-secondary-soft or --ps-panel, title, a line
 * and a primary button that calls book() (docs/page-style.md §7). Not a
 * `Section` — it carries its own band, not a heading-first layout.
 */
export function CtaSection() {
  const ctx = usePage();
  const cta = ctaOf(ctx);
  const label = usePrimaryLabel(ctx);
  if (!cta) return null;
  return (
    <section id={sectionAnchor("cta")} className="pg-section">
      <div
        className="flex flex-col items-start gap-4 rounded-[var(--ps-radius-card)] p-8 md:flex-row md:items-center md:justify-between"
        style={{ background: ctx.style.colours.secondarySoft, color: ctx.style.colours.secondaryInk }}
      >
        <div className="min-w-0">
          <p className="text-[22px] font-semibold leading-7" style={{ fontFamily: "var(--ps-font-heading)" }}>
            {cta.title}
          </p>
          {cta.line && <p className="pg-body mt-1 opacity-90">{cta.line}</p>}
        </div>
        <button type="button" className="pg-btn shrink-0" onClick={() => ctx.book()}>
          {cta.button || label}
        </button>
      </div>
    </section>
  );
}
