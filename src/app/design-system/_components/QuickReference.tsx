"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sectionPath } from "../_sections/registry";
import { useDsConfig } from "./DsConfig";

/** One card per thing people come looking for, by the word they would use. */
const WORDS: Array<{ word: string; slug: string; anchor?: string; what: string }> = [
  { word: "Buttons", slug: "buttons", what: "Variants, sizes, icon buttons, loading." },
  { word: "Hover & states", slug: "states", what: "Rest, hover, focus, pressed, selected, disabled." },
  { word: "Radius", slug: "radius", what: "The scale, and 12 in OS against 18 in POS." },
  { word: "Fonts", slug: "typography", anchor: "fonts", what: "Inter, DM Mono, Hind Siliguri and how they load." },
  { word: "Typography", slug: "typography", anchor: "scale", what: "The scale and the role recipes." },
  { word: "Colour", slug: "colour", what: "Scales, roles, states, status and live contrast." },
  { word: "Spacing", slug: "spacing", what: "The 4px grid, rhythm and breakpoints." },
  { word: "Strokes", slug: "borders", what: "1px lines, and where 2px is allowed." },
  { word: "Cards", slug: "cards", what: "Anatomy, surfaces, variants, nested corners." },
  { word: "Elevation", slug: "elevation", what: "Four levels, light and dark." },
  { word: "Motion", slug: "motion", what: "Durations, easing, reduced motion." },
  { word: "Icons", slug: "iconography", what: "Lucide, four sizes, a 1.5 stroke." },
  { word: "Inputs", slug: "inputs", what: "Fields, selects, dates, times, validation." },
  { word: "Selection", slug: "selection", what: "Checkbox, radio, switch, segmented, chip." },
  { word: "Navigation", slug: "navigation", what: "Tabs, menus, pagination, the rail." },
  { word: "Feedback", slug: "feedback", what: "Toast, notice, blocked, skeleton." },
  { word: "Overlays", slug: "overlays", what: "Modal, confirm, sheet." },
  { word: "Data display", slug: "data-display", what: "Tables, pills, stats, empty states." },
  { word: "Accessibility", slug: "accessibility", what: "WCAG 2.2 AA and the house exceptions." },
];

export function QuickReference() {
  const cfg = useDsConfig();
  return (
    <ul className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
      {WORDS.map((w) => (
        <li key={w.word}>
          <Link
            href={`${cfg.href(sectionPath(w.slug))}${w.anchor ? `#${w.anchor}` : ""}`}
            className="card-surface card-interactive flex h-full min-h-11 flex-col gap-inline p-comfortable"
          >
            <span className="flex items-center gap-tight text-base font-semibold text-fg">
              {w.word}
              <ArrowRight size={14} strokeWidth={1.5} aria-hidden className="ml-auto text-muted" />
            </span>
            <span className="text-sm text-muted">{w.what}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
