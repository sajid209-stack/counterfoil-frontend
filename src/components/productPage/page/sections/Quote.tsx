"use client";

import { useTranslations } from "next-intl";
import { usePage } from "../context";
import { Section } from "../Section";
import { quotesOf } from "./helpers";

/**
 * Quote — 1-3 testimonials as cards, the quote large in the heading face
 * (docs/page-style.md §7). Renders nothing with no quotes written.
 */
export function QuoteSection() {
  const ctx = usePage();
  const t = useTranslations("eventPage");
  const quotes = quotesOf(ctx);
  if (quotes.length === 0) return null;
  const cols = quotes.length === 1 ? 1 : ctx.layout === "phone" ? 1 : 2;
  return (
    <Section id="quote" title={t("sections.quote")}>
      <ul className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {quotes.map((q) => (
          <li key={q.id} className="pg-card min-w-0 p-6">
            <p
              className="text-[20px] leading-7"
              style={{ fontFamily: "var(--ps-font-heading)", fontWeight: "var(--ps-heading-weight, 500)" }}
            >
              &ldquo;{q.text}&rdquo;
            </p>
            <p className="pg-meta mt-4 font-semibold" style={{ color: "var(--ps-fg)" }}>
              {q.who}
            </p>
            {q.detail && <p className="pg-meta pg-muted">{q.detail}</p>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
