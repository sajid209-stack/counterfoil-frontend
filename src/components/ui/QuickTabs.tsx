"use client";

import { cn } from "@/lib/cn";

/**
 * The quick filters of a phone list: plain text tabs in one horizontal row, the
 * current one on a `nav-selected` pill (docs/mobile.md section 8, rule 6). Each
 * is a shortcut onto a filter the page already has, not a new filter. 36px
 * tall, with the hit area grown to 44px.
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
    <div role="radiogroup" aria-label={label} className={cn("no-scrollbar -mx-gutter flex gap-tight overflow-x-auto px-gutter", className)}>
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
              "relative h-9 shrink-0 whitespace-nowrap rounded-full px-section text-base font-medium transition-colors duration-quick before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
              on ? "bg-nav-selected text-fg" : "text-muted hover:bg-nav-hover active:bg-nav-hover",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
