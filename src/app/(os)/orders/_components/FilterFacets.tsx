"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChipOption } from "./FilterChip";

export interface Facet {
  key: string;
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Said when the facet has nothing to offer. */
  empty?: string;
}

/** What a facet is set to, as its chip and its row say it: "Paid", "Paid +1". */
export const facetSummary = (f: Facet): string => {
  const names = f.value.map((v) => f.options.find((o) => o.value === v)?.label ?? v);
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] ?? "");
};

/**
 * Every filter behind the Filters button, as one list of rows.
 *
 * Each row is a heading that says what it is and, when set, what it is set to;
 * opening one shows its checklist in place. It is an accordion rather than a
 * stack of popovers because this sits inside a popover (or a phone sheet), and
 * a popover inside a popover is two things to dismiss. Several values can be
 * ticked, and each tick writes through to the address at once: there is no
 * Apply to forget.
 */
export function FilterFacets({ facets, open, onOpen }: { facets: Facet[]; open: string | null; onOpen: (key: string | null) => void }) {
  return (
    <div className="flex flex-col">
      {facets.map((f) => {
        const isOpen = open === f.key;
        const summary = facetSummary(f);
        const body = `facet-${f.key}`;
        return (
          <div key={f.key} className="border-b border-hairline last:border-0">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={body}
              onClick={() => onOpen(isOpen ? null : f.key)}
              className="flex min-h-11 w-full items-center gap-tight px-comfortable text-left text-sm transition-colors duration-quick hover:bg-muted-wash md:min-h-10"
            >
              <span className="shrink-0 font-medium text-fg">{f.label}</span>
              <span className={cn("ml-auto min-w-0 truncate text-[0.8125rem]", summary ? "font-medium text-fg" : "text-muted")}>{summary}</span>
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div id={body} role="group" aria-label={f.label} className="max-h-60 overflow-y-auto overscroll-contain pb-inline">
                {f.options.length === 0 && f.empty && <p className="px-comfortable py-tight text-[0.8125rem] text-muted">{f.empty}</p>}
                {f.options.map((o) => {
                  const picked = f.value.includes(o.value);
                  return (
                    <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-tight px-comfortable text-sm hover:bg-muted-wash md:min-h-9">
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() => f.onChange(picked ? f.value.filter((x) => x !== o.value) : [...f.value, o.value])}
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
            )}
          </div>
        );
      })}
    </div>
  );
}
