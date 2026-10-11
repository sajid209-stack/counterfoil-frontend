"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** The selectable-card pattern — use it wherever ONE (or a few) of several
 *  rich options is chosen from cards: resources, providers, wizard options,
 *  demo businesses. For a plain mutually exclusive mode switch use
 *  SegmentedControl; for a form answer, Radio.
 *
 *  Selected is a 2px ember ring plus a check glyph, so it reads without colour.
 *  `hideCheck` drops the glyph for cards too small to give a corner away — a
 *  date pill is about 96px wide and the check lands on its own label — and the
 *  ring alone carries it. The radius is `rounded-card`, so the same card is
 *  12px in OS and the soft 18px in Go with no per-call prop. The ring is drawn
 *  INSET (a 1px border + a 1px inset ring = 2px) so a clipping scroller never
 *  eats it and nothing shifts on selection. */
export function ChoiceCard({
  selected = false,
  disabled = false,
  hideCheck = false,
  raised = false,
  onClick,
  className,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  /** Carry selection on the edge instead of a corner glyph. */
  hideCheck?: boolean;
  /** For cards on a coloured ground (the Go sheets sit on paper), where a
   *  white card separated only by a hairline barely reads. Deliberately not
   *  applied when disabled: a thing you cannot pick should not look liftable. */
  raised?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative rounded-card border text-left transition-[colors,box-shadow] duration-quick ease-counterfoil",
        disabled
          ? "border-line bg-subtle text-muted"
          : selected
            ? "border-ember bg-ember-wash/60 ring-1 ring-inset ring-ember"
            : raised
              ? "border-transparent bg-card shadow-card hover:border-ember/40 active:bg-ember-wash dark:border-line"
              : "border-line bg-card hover:border-ember/40 hover:shadow-sm active:bg-ember-wash",
        className,
      )}
    >
      {selected && !hideCheck && (
        <span className="absolute right-tight top-tight flex h-4 w-4 items-center justify-center rounded-full bg-ember-solid text-on-solid" aria-hidden>
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

/** 40px initials avatar for providers, guides and staff. */
export function Avatar({
  name,
  size = 40,
  soft = false,
}: {
  name: string;
  size?: number;
  /** A quiet tile for long lists, where a column of solid ink circles becomes
   *  the loudest thing on the page. */
  soft?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        soft ? "bg-subtle text-fg ring-1 ring-inset ring-line" : "bg-inverse text-inverse-fg",
      )}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
