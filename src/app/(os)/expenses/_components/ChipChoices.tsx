"use client";

import { Chip } from "@/components/ui";

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
 * the kit's toggle chips — every choice on screen at once, one press each — and
 * a chosen chip is filled with a check, so a narrowed list never looks like the
 * whole one. Nothing chosen means everything.
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
      {options.map((o) => (
        <Chip key={o.value} selected={value.includes(o.value)} onClick={() => toggle(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
