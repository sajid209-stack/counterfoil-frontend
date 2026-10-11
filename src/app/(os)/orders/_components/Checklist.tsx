"use client";

import { Checkbox } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ChipOption } from "./chip";

/** What a list of ticks is set to, as its chip says it: "Paid", "Paid +1". */
export const checklistSummary = (options: ChipOption[], value: string[]): string | null => {
  if (value.length === 0) return null;
  const names = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
};

/**
 * A filter that takes several answers, drawn as a plain list of real
 * checkboxes — the control a `FilterBar` section holds.
 *
 * Real checkboxes, not styled divs, so a keyboard gets Tab and Space and a
 * screen reader gets "checked" for free. Each tick writes through at once: the
 * Filters panel has no Apply to forget. A short list is drawn in full; a long
 * one (a venue with a dozen staff) scrolls inside its own box rather than
 * stretching the panel.
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
  return (
    <div role="group" aria-label={label} className="-mx-comfortable max-h-52 overflow-y-auto overscroll-contain">
      {options.length === 0 && empty && <p className="px-comfortable py-tight text-sm text-muted">{empty}</p>}
      {options.map((o) => {
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
    </div>
  );
}
