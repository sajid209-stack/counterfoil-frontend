"use client";

import { Check } from "lucide-react";
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
      {options.length === 0 && empty && <p className="px-comfortable py-tight text-[0.8125rem] text-muted">{empty}</p>}
      {options.map((o) => {
        const picked = value.includes(o.value);
        return (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-tight px-comfortable text-sm transition-colors duration-quick hover:bg-muted-wash md:min-h-9">
            <input
              type="checkbox"
              checked={picked}
              onChange={() => onChange(picked ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-xs border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-inverse",
                picked ? "border-inverse bg-inverse text-inverse-fg" : "border-strong bg-card",
              )}
            >
              {picked && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={cn("min-w-0 flex-1 truncate", picked && "font-medium")}>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
