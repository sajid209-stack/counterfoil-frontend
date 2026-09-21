"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CategoryColor } from "@/lib/api";

/** The five the design system offers, in the order the picker lists them. */
export const CATEGORY_COLORS: CategoryColor[] = ["orange", "amber", "green", "blue", "rose"];

/** The solid swatch. Category colour is a TOKEN name on the record, so the two
 *  themes can take different steps of the same hue — see globals.css. */
export const COLOR_DOT: Record<CategoryColor, string> = {
  orange: "bg-cat-orange",
  amber: "bg-cat-amber",
  green: "bg-cat-green",
  blue: "bg-cat-blue",
  rose: "bg-cat-rose",
};

/**
 * What colour a category is painted on the calendar.
 *
 * One 44px swatch that opens onto the six choices, rather than six swatches on
 * every row: the row already carries two reorder buttons, an inline rename, a
 * count and a switch, and at 390 there is no width left for a colour strip.
 *
 * Each choice is NAMED as well as coloured. A picker whose options differ only
 * by colour is unusable to the people the colour coding is hardest for, and it
 * is the same rule the calendar's own key follows.
 */
export function ColorPicker({
  value,
  onChange,
  label,
  optionLabel,
  noneLabel,
}: {
  value: CategoryColor | null | undefined;
  onChange: (next: CategoryColor | null) => void;
  /** Names the control, including the current colour. */
  label: string;
  /** Names one option — the picker cannot know the operator's language. */
  optionLabel: (color: CategoryColor | null) => string;
  noneLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: CategoryColor | null) => {
    setOpen(false);
    trigger.current?.focus();
    if (next !== (value ?? null)) onChange(next);
  };

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-sm transition-colors duration-quick hover:bg-subtle/60 md:h-9 md:w-9"
      >
        <span
          aria-hidden
          className={cn(
            "h-4 w-4 rounded-full border",
            value ? `${COLOR_DOT[value]} border-transparent` : "border-dashed border-strong",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+4px)] z-40 w-48 rounded-md border border-line bg-card py-inline shadow-lg"
        >
          {[null, ...CATEGORY_COLORS].map((c) => (
            <button
              key={c ?? "none"}
              type="button"
              role="menuitemradio"
              aria-checked={(value ?? null) === c}
              onClick={() => pick(c)}
              className="flex min-h-11 w-full items-center gap-comfortable px-comfortable text-left text-sm text-fg transition-colors duration-quick hover:bg-subtle md:min-h-9"
            >
              <span
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full border",
                  c ? `${COLOR_DOT[c]} border-transparent` : "border-dashed border-strong",
                )}
              />
              <span className="min-w-0 flex-1 truncate">{c ? optionLabel(c) : noneLabel}</span>
              {(value ?? null) === c && <Check size={14} strokeWidth={2} className="shrink-0 text-brand-foreground" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
