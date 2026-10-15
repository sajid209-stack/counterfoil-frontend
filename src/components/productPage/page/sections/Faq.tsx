"use client";

import { ChevronDown } from "lucide-react";
import { usePage } from "../context";
import { Section } from "../Section";
import { faqOf } from "./helpers";

/**
 * Questions: a native `<details>` accordion, 720px at most. It opens with no
 * JavaScript, is keyboard- and screen-reader-correct for free, and prints and
 * crawls. 48px rows; the chevron turns when a row opens.
 */
export function FaqSection() {
  const ctx = usePage();
  const items = faqOf(ctx);
  if (items.length === 0) return null;
  return (
    <Section id="faq" title={ctx.labels.faq}>
      <div className="max-w-[720px]" style={{ borderBottom: "1px solid var(--pg-line)" }}>
        {items.map((f) => (
          <details key={f.id} className="group" style={{ borderTop: "1px solid var(--pg-line)" }}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[16px] font-semibold leading-6 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>{f.q}</span>
              <ChevronDown
                size={20}
                strokeWidth={2}
                aria-hidden
                className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                style={{ color: "var(--pg-muted)" }}
              />
            </summary>
            <p className="pg-body whitespace-pre-line pb-4 pr-8 pg-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
