"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ChipOption } from "./chip";

/** What a list of ticks is set to, as its chip says it: "Paid", "Paid +1". */
export const checklistSummary = (options: ChipOption[], value: string[]): string | null => {
  if (value.length === 0) return null;
  const names = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
};

/** A list longer than this shows its first few and "Show all N". */
const SHORT = 6;
const FIRST = 5;

/**
 * A filter that takes several answers, drawn as a plain list of real
 * checkboxes — the control a `FilterBar` section holds.
 *
 * Real checkboxes, not styled divs, so a keyboard gets Tab and Space and a
 * screen reader gets "checked" for free. Each tick writes through at once: the
 * Filters panel has no Apply to forget.
 *
 * A long list (a venue with a dozen staff) does NOT scroll in a box of its own.
 * It did, inside the Filters panel that scrolls too: the wheel moved the inner
 * list, then the panel, the inner scrollbar sat as a dead strip at the edge, and
 * the list was cut mid-name with nothing saying there was more. The panel is the
 * one scroller; a long list shows its first few, plus whatever is ticked, and
 * "Show all 9" opens the rest in place (how Linear, Shopify and Stripe fold a
 * long facet).
 */
export function Checklist({
  label,
  options,
  value,
  onChange,
  empty,
}: {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Said when there is nothing to choose from. */
  empty?: string;
}) {
  const t = useTranslations("common");
  const [all, setAll] = useState(false);
  const long = options.length > SHORT;
  /* Folded: the first few, then any ticked option further down, so what is set
     is always visible. */
  const shown = !long || all ? options : options.filter((o, i) => i < FIRST || value.includes(o.value));
  const hidden = options.length - shown.length;

  return (
    <div role="group" aria-label={label} className="-mx-comfortable">
      {options.length === 0 && empty && <p className="px-comfortable py-tight text-sm text-muted">{empty}</p>}
      {shown.map((o) => {
        const picked = value.includes(o.value);
        return (
          <Checkbox
            key={o.value}
            checked={picked}
            onCheckedChange={() => onChange(picked ? value.filter((x) => x !== o.value) : [...value, o.value])}
            label={<span className={cn("block truncate", picked && "font-medium")}>{o.label}</span>}
            className="px-comfortable transition-colors duration-quick hover:bg-muted-wash"
          />
        );
      })}
      {long && (hidden > 0 || all) && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((x) => !x)}
          className="flex min-h-11 w-full items-center gap-inline px-comfortable text-left text-sm font-medium text-brand-foreground hover:bg-muted-wash md:min-h-9"
        >
          <ChevronDown size={14} strokeWidth={2} aria-hidden className={cn("shrink-0 transition-transform duration-quick", all && "rotate-180")} />
          {all ? t("showFewer") : t("showAllCount", { count: options.length })}
        </button>
      )}
    </div>
  );
}
