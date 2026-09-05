"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

// Controlled tab bar. The caller renders the active panel — Tabs owns only the
// selection UI, no content knowledge.
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      // A tab strip cannot wrap — a tab on a second row reads as a different
      // control — so on a narrow screen it scrolls instead. Five tabs with
      // counts ("Became reservations 0", "Cancelled 1") ran 17–71px past the
      // edge at 390px and were being swallowed by main's overflow-x-hidden,
      // so the last tab was simply unreachable on a phone.
      className={cn(
        "flex gap-inline overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "-mb-px h-11 shrink-0 whitespace-nowrap border-b-2 px-comfortable text-sm transition-colors duration-quick md:h-10",
              active
                ? "border-inverse font-medium text-fg"
                : "border-transparent text-faint hover:text-fg",
            )}
          >
            {it.label}
            {it.count != null && (
              <span className="ml-inline font-mono text-[12px] text-faint">
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
