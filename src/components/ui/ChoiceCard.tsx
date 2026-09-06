"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** The selectable-card pattern — used everywhere a choice is made from cards
 *  (resources, providers, wizard options, demo businesses, date strips).
 *  Selected reads in grayscale, never by tint alone. Two ways of saying it:
 *  the default draws a check glyph in the corner; `hideCheck` swaps that for a
 *  doubled ember edge, for cards too small to give a corner away — a date pill
 *  is about 96px wide and the check lands on its own label. The ring is drawn
 *  inset rather than as a second border pixel so nothing shifts on selection. */
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
        "relative rounded-go border text-left transition-all duration-quick",
        disabled
          ? "border-line bg-subtle text-faint"
          : selected
            ? hideCheck
              ? "border-ember bg-ember/10 ring-1 ring-inset ring-ember"
              : "border-ember bg-ember/5"
            : raised
              ? "border-transparent bg-card shadow-go hover:border-ember/40 active:bg-ember/5 dark:border-line"
              : "border-line bg-card hover:border-ember/40 hover:shadow-sm active:bg-ember/5",
        className,
      )}
    >
      {selected && !hideCheck && (
        <span className="absolute right-tight top-tight flex h-4 w-4 items-center justify-center rounded-full bg-ember text-white" aria-hidden>
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

/** 40px initials avatar for providers, guides and staff. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-inverse font-semibold text-inverse-fg"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
