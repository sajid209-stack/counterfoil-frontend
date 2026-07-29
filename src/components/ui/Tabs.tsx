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
      className={cn("flex gap-inline border-b border-neutral-200", className)}
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
              "-mb-px h-10 border-b-2 px-comfortable text-sm transition-colors duration-quick",
              active
                ? "border-ink font-medium text-ink"
                : "border-transparent text-neutral-400 hover:text-ink",
            )}
          >
            {it.label}
            {it.count != null && (
              <span className="ml-inline font-mono text-[11px] text-neutral-400">
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
