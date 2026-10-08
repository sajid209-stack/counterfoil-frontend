"use client";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * The one small choice between a few named views — Today / This week, 7 / 14 /
 * 30 days, Share / Over time.
 *
 * The calm pass: the selected segment is a white tile lifted off a quiet
 * track, in ink, with the same soft shadow a card has. It used to be a solid
 * ember fill, which is what the page's one primary action wears; three of those
 * on one screen read as three calls to action. Selection is carried by the
 * tile, not by colour alone.
 *
 * Buttons stay real buttons with `aria-pressed`, so a keyboard and a screen
 * reader get a group of toggles, not a tablist they would have to arrow through.
 * 44px high on a phone, 32px from md.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  fill = false,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  /** The group's accessible name. */
  label: string;
  /** Stretch to the full width, the segments sharing it equally. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("rounded-sm bg-muted-wash p-0.5", fill ? "flex w-full" : "inline-flex", className)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-xs px-comfortable text-[13px] font-medium transition-colors duration-quick md:min-h-8 md:px-tight",
              fill && "flex-1",
              on ? "bg-card text-fg shadow-[0_1px_2px_rgb(20_20_19/0.14)] dark:bg-line dark:shadow-none" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
