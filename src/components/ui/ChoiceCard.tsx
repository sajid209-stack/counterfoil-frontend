"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** The selectable-card pattern — used everywhere a choice is made from cards
 *  (resources, providers, wizard options, demo businesses, date strips).
 *  Selected reads in grayscale: border weight + check glyph, not tint alone. */
export function ChoiceCard({
  selected = false,
  disabled = false,
  onClick,
  className,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
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
        "relative rounded-md border text-left transition-all duration-quick",
        disabled
          ? "border-line bg-subtle text-faint"
          : selected
            ? "border-ember bg-ember/5"
            : "border-line bg-card hover:border-ember/40 hover:shadow-sm active:bg-ember/5",
        className,
      )}
    >
      {selected && (
        <span className="absolute right-tight top-tight flex h-4 w-4 items-center justify-center rounded-full bg-ember text-fg" aria-hidden>
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
