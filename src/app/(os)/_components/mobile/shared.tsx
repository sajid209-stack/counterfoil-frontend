"use client";

import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

/*
 * The small pieces the phone's bar, menu and Settings sheet all draw, so the
 * three read as one piece of chrome (docs/mobile.md §7).
 */

/** Up to two letters for a tile or disc: "Nadia Islam" → "NI". */
export const initialsOf = (name: string | undefined): string => {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "C";
  const first = (w: string) => Array.from(w)[0] ?? "";
  return (words.length > 1 ? first(words[0]) + first(words[1]) : Array.from(words[0]).slice(0, 2).join("")).toUpperCase();
};

/**
 * A 32px soft tile with a glyph in it.
 *
 * Idle it is a quiet fill with a secondary-ink glyph; the page you are on is
 * solid ink with a knocked-out glyph — the language of the till's tab bar, and
 * Material 3's "filled indicator" for a drawer. `muted-wash` rather than
 * `subtle` for the fill: in dark the card and `subtle` are the same value, so a
 * `subtle` tile would vanish.
 */
export function IconTile({
  icon: Icon,
  current = false,
  danger = false,
}: {
  icon: LucideIcon;
  current?: boolean;
  /** Sign out: the glyph in the soft-danger ink (`cn` does not merge, so a tone is a prop). */
  danger?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-sm transition-colors duration-quick",
        current ? "bg-inverse text-inverse-fg" : cn("bg-muted-wash", danger ? "text-danger-soft-fg" : "text-fg-secondary"),
      )}
    >
      <Icon size={18} strokeWidth={1.5} />
    </span>
  );
}
