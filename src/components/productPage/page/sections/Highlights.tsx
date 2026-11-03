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
 * Highlights: a card each — icon, label, and what it means when there is a line
 * to say. One shape either way: a highlight with only its word is a card with a
 * word, never a bare chip, so the section reads as part of the same page.
 */
export function HighlightsSection() {
  const ctx = usePage();
  const items = highlightsOf(ctx);
  if (items.length === 0) return null;

  const cols = ctx.layout === "phone" ? 1 : ctx.layout === "tablet" ? 2 : 3;
  return (
    <Section id="highlights" title={ctx.labels.highlights}>
      <ul className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((h, i) => {
          const Icon = ICONS[i % ICONS.length];
          const text = clean(h.description);
          return (
            <li key={h.id} className="pg-card flex min-w-0 items-start gap-4 p-5">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--pg-soft)", color: "var(--pg-ink)" }}
                aria-hidden
              >
                <Icon size={20} strokeWidth={ctx.style.stroke} />
              </span>
              <div className="min-w-0 self-center">
                <h3 className="text-[16px] font-semibold leading-6" style={{ overflowWrap: "anywhere" }}>
                  {h.label}
                </h3>
                {text && <p className="pg-meta mt-1">{text}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
