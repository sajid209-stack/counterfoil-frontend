"use client";

import { Award, Compass, Gift, Heart, Smile, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, highlightsOf } from "./helpers";

/* A small, consistent set, chosen by position. Nothing in the record says what
   a highlight is ABOUT, so the icon is a motif down the page rather than an
   icon pretending to classify. Never initials in circles. */
const ICONS: LucideIcon[] = [Sparkles, Star, Heart, Zap, Award, Compass, Gift, Smile];

/**
 * Highlights: a card each — icon, label, what it means. A highlight with no
 * description is a teaser and needs only its word, so when none of them has one
 * the whole section is a single wrapping row of chips.
 */
export function HighlightsSection() {
  const ctx = usePage();
  const items = highlightsOf(ctx);
  if (items.length === 0) return null;
  const described = items.some((h) => clean(h.description));

  if (!described) {
    return (
      <Section id="highlights" title={ctx.labels.highlights}>
        <ul className="flex flex-wrap gap-2">
          {items.map((h) => (
            <li key={h.id} className="pg-chip" style={{ minHeight: 36, padding: "0 14px" }}>
              {h.label}
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  const cols = ctx.layout === "phone" ? 1 : ctx.layout === "tablet" ? 2 : 3;
  return (
    <Section id="highlights" title={ctx.labels.highlights}>
      <ul className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((h, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <li key={h.id} className="pg-card min-w-0 p-5">
              <span
                className="grid size-10 place-items-center rounded-xl"
                style={{ background: "var(--pg-soft)", color: "var(--pg-ink)" }}
                aria-hidden
              >
                <Icon size={20} strokeWidth={ctx.style.stroke} />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold leading-6">{h.label}</h3>
              {clean(h.description) && <p className="pg-meta mt-1">{h.description}</p>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
