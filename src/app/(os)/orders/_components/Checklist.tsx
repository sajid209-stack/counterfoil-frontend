"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Checkbox, FilterSearch } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ChipOption } from "./chip";

/** What a list of ticks is set to, as its chip says it: "Paid", "Paid +1". */
export const checklistSummary = (options: ChipOption[], value: string[]): string | null => {
  if (value.length === 0) return null;
  const names = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
};

/** A list longer than this gets a search field above it. */
const SEARCHABLE = 8;

/**
 * A filter that takes several answers, drawn as a plain list of real
 * checkboxes — the control a `FilterBar` category holds.
 *
 * Real checkboxes, not styled divs, so a keyboard gets Tab and Space and a
 * screen reader gets "checked" for free. Each tick writes through at once: the
 * Filters panel has no Apply to forget.
 *
 * The list never folds and never scrolls in a box of its own: the Filters panel
 * gives each category the whole right-hand pane, and that pane is the one
 * scroller. A long list (a venue with a dozen staff) gets a search field above
 * it instead; whatever is ticked stays at the top while searching, so what is
 * set is never hidden by what was typed.
 */
export function Checklist({
  label,
  options,
  value,
  onChange,
  empty,
  find,
}: {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /** Said when there is nothing to choose from. */
  empty?: string;
  /** The search field's placeholder; "Find a {label}" when omitted. */
  find?: string;
}) {
  const t = useTranslations("common");
  const [q, setQ] = useState("");
  const searchable = options.length > SEARCHABLE;
  const needle = searchable ? q.trim().toLowerCase() : "";
  const shown = needle
    ? [...options.filter((o) => value.includes(o.value)), ...options.filter((o) => !value.includes(o.value) && o.label.toLowerCase().includes(needle))]
    : options;

  return (
    <div role="group" aria-label={label} className="-mx-comfortable">
      {searchable && (
        <div className="px-comfortable pb-tight">
          <FilterSearch value={q} onChange={setQ} placeholder={find ?? t("findA", { label: label.toLowerCase() })} className="md:[&_input]:w-full" />
        </div>
      )}
      {options.length === 0 && empty && <p className="px-comfortable py-tight text-sm text-muted">{empty}</p>}
      {searchable && needle && shown.length === 0 && <p className="px-comfortable py-tight text-sm text-muted">{t("noMatch")}</p>}
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
    </div>
  );
}
