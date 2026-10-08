"use client";

import { cn } from "@/lib/cn";

export interface ChipOption<V extends string> {
  value: V;
  label: string;
}

/**
 * A filter that takes several answers, drawn as the answers themselves.
 *
 * It lives inside the Filters panel, so it cannot be a dropdown: a list that
 * opens from inside a panel that scrolls is clipped by it, and two layers of
 * popover is one layer too many. The nine categories fit as a wrapped row of
 * toggle chips — every choice on screen at once, one press each — and a chosen
 * chip is filled, so a narrowed list never looks like the whole one.
 *
 * Real buttons with `aria-pressed`, so a keyboard gets Tab and Space and a
 * screen reader hears "pressed". Nothing chosen means everything. 44px high on
 * a phone, 32px from md.
 */
export function ChipChoices<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<V>[];
  value: V[];
  onChange: (next: V[]) => void;
}) {
  const toggle = (v: V) => onChange(value.includes(v) ? value.filter((x) => x !== v) : options.map((o) => o.value).filter((x) => x === v || value.includes(x)));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-tight">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              "min-h-11 rounded-full px-comfortable text-[13px] font-medium transition-colors duration-quick md:min-h-8",
              on ? "bg-inverse text-inverse-fg" : "bg-muted-wash text-fg hover:bg-line",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
