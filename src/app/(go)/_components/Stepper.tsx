"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The till's one quantity stepper.
 *
 * There were eight copies of this across five files, each with its own count
 * weight, border, glyph and size. A cashier presses "+" a hundred times a shift;
 * it should look and feel the same wherever it turns up.
 *
 * - `pair` (default): two round buttons either side of the count, for a sheet or
 *   a card where the stepper has a row to itself.
 * - `pill`: one bordered pill holding both buttons, for a cart line where the
 *   stepper sits among other quiet controls.
 *
 * Targets are 44px in both. Radius follows the Go product token (`rounded-control`
 * is a full pill under data-product="go"), so no radius is hand-typed here.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  lessLabel,
  moreLabel,
  variant = "pair",
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  /** No upper limit when omitted. */
  max?: number;
  lessLabel: string;
  moreLabel: string;
  variant?: "pair" | "pill";
  className?: string;
}) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  const button = cn(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-fg transition-colors duration-quick",
    "active:bg-muted-wash disabled:text-faint disabled:active:bg-transparent",
    variant === "pair" && "border border-line",
  );
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        variant === "pill" ? "rounded-control border border-line" : "gap-tight",
        className,
      )}
    >
      <button type="button" aria-label={lessLabel} disabled={atMin} onClick={() => onChange(Math.max(min, value - 1))} className={button}>
        <Minus size={16} strokeWidth={2} aria-hidden />
      </button>
      <span className="min-w-6 text-center text-md font-semibold tabular-nums text-fg">{value}</span>
      <button type="button" aria-label={moreLabel} disabled={atMax} onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))} className={button}>
        <Plus size={16} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}
