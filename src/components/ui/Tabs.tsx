"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

// Controlled tab bar. The caller renders the active panel — Tabs owns only the
// selection UI, no content knowledge.
//
// A quiet underline, on purpose. Shopify-style pill tabs were the other
// candidate, but the settings lists continue this strip's rule under their
// create button (`PageToolbar underline`), and a pill row has no rule to
// continue. The calm pass keeps the shape and quietens it: the rail is the
// softest line token, the current tab is told by weight and a 2px ink bar, and
// the others are plain muted words.
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
        "flex gap-inline overflow-x-auto border-b border-hairline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
            // The strip scrolls, which clips an outline drawn outside the
            // button; drawn inside, the ring is never eaten.
            data-focus-inset=""
            className={cn(
              "-mb-px h-11 shrink-0 whitespace-nowrap border-b-2 px-comfortable text-[0.8125rem] transition-colors duration-quick md:h-10",
              active
                ? "border-inverse font-medium text-fg"
                // An unselected tab is a control you are meant to read and
                // click, not a disabled one. `faint` is the disabled
                // foreground and measured 1.87:1 here.
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {it.label}
            {it.count != null && (
              <span className="ml-inline text-[0.75rem] tabular-nums text-muted">
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
