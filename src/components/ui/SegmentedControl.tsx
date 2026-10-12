"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  /** A glyph before the label. With no label it needs `ariaLabel`. */
  icon?: React.ReactNode;
  /** Accessible name when the visible label is an icon or abbreviated. */
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Mutually exclusive views or modes — Today / This week, Grid / List.
 *
 * Use it for 2–5 short options that change what you are LOOKING AT and apply
 * at once. It is not navigation between pages (Tabs) and not a form answer that
 * needs explaining (Radio), and it never holds more than one value (Chip /
 * Checkbox do that).
 *
 * The ARIA radio-group pattern: `role="radiogroup"` of `role="radio"` buttons,
 * roving tabindex (one tab stop; Tab leaves), and the arrow keys move AND
 * select, wrapping, with Home/End. The track is the sunken `subtle` fill and
 * the selected tile lifts to `card` with a shadow, so selection reads by
 * surface and weight rather than by colour alone.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  /** `sm` is 44px on touch and 36px from md; `md` is 44px everywhere. */
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
  /** A radio group needs a name: pass one of these. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const auto = useId();

  const move = (from: number, dir: 1 | -1 | "first" | "last") => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (enabled.length === 0) return;
    let target: number;
    if (dir === "first") target = enabled[0];
    else if (dir === "last") target = enabled[enabled.length - 1];
    else {
      const at = enabled.indexOf(from);
      target = enabled[(at + dir + enabled.length) % enabled.length];
    }
    onChange(options[target].value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[target]?.focus();
  };

  const selectedIndex = options.findIndex((o) => o.value === value);
  // One tab stop: the selected radio, or the first enabled one when none is.
  const tabStop = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : options.findIndex((o) => !o.disabled);

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "inline-flex items-stretch gap-0.5 rounded-control bg-subtle p-0.5 ring-1 ring-inset ring-line",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            id={`${auto}-${i}`}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            disabled={o.disabled}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
              else if (e.key === "Home") { e.preventDefault(); move(i, "first"); }
              else if (e.key === "End") { e.preventDefault(); move(i, "last"); }
            }}
            className={cn(
              "inline-flex min-w-11 items-center justify-center gap-inline whitespace-nowrap rounded-xs px-comfortable font-medium [[data-product=go]_&]:rounded-full transition-[colors,box-shadow] duration-quick ease-counterfoil",
              // The option is the target, not the track: 44px on touch, denser from md.
              size === "sm" ? "h-11 text-sm md:h-8" : "h-11 text-base md:h-10",
              fullWidth && "flex-1",
              on ? "bg-card text-fg shadow-sm ring-1 ring-inset ring-strong" : "text-muted hover:bg-secondary-hover hover:text-fg",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
