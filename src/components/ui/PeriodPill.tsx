"use client";

import { Select, type SelectOption } from "./Select";

/**
 * A period or scope menu drawn as a small rounded pill ("Last 30 days v").
 *
 * It is the kit's `Select` in its `bare` + `pill` form, named so a card header
 * or a page's date line can say what it means. 36px tall with a 44px touch
 * target, the chosen value in ink on a soft fill. The popover is the kit's own
 * (portalled, searchable above five options), so it cannot be clipped by the
 * card it sits in.
 */
/**
 * Classes that dress a DateRangePicker's trigger as the same pill, below `sm` only (it keeps its own look from
 * `sm` up). Put them on the picker's `className`: the 44px target is kept by a pseudo-element, as `Select pill` does.
 */
export const DATE_PILL_PHONE =
  "max-sm:w-fit max-sm:[&>button]:relative max-sm:[&>button]:h-9 max-sm:[&>button]:w-auto max-sm:[&>button]:rounded-full max-sm:[&>button]:border-transparent max-sm:[&>button]:bg-subtle max-sm:[&>button]:pl-comfortable max-sm:[&>button]:pr-tight max-sm:[&>button]:text-sm max-sm:[&>button]:before:absolute max-sm:[&>button]:before:inset-x-0 max-sm:[&>button]:before:-inset-y-1.5 max-sm:[&>button_.text-muted]:text-fg-secondary max-sm:[&>button]:before:content-['']";

export function PeriodPill({
  value,
  onChange,
  options,
  label,
  align = "end",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** What this menu chooses. Read aloud as the control's name. */
  label: string;
  align?: "start" | "end";
  className?: string;
}) {
  return <Select bare pill align={align} value={value} onChange={onChange} options={options} aria-label={label} className={className} />;
}
