"use client";

import { cn } from "@/lib/cn";

/**
 * The quick filters of a phone list (docs/mobile.md section 8, v6): Counterfoil's
 * own tab look — the one the admin's tab strips and Refunds already use — text
 * tabs on a hairline, the current one in ink and semibold over a 2px ember
 * underline. Each is a shortcut onto a filter the page already has, not a new
 * filter. 44px tall; the row scrolls sideways when a language runs long.
 */
export function QuickTabs<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** The group's accessible name. */
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("no-scrollbar -mx-gutter flex gap-section overflow-x-auto border-b border-hairline px-gutter", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-11 shrink-0 whitespace-nowrap text-base transition-colors duration-quick after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:content-['']",
              on ? "font-semibold text-fg after:bg-ember-solid" : "font-medium text-muted after:bg-transparent active:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
