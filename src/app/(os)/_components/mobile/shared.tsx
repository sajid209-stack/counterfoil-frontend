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
 * A menu row's glyph: a plain 20px icon in a 24px box, as the desktop rail draws
 * it (docs/mobile.md section 8, v7) — no tile behind it. Ink on the page you are
 * on, muted otherwise; the row's own fill says "here".
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
      className={cn("grid h-6 w-6 shrink-0 place-items-center transition-colors duration-quick", danger ? "text-danger-soft-fg" : current ? "text-fg" : "text-muted")}
    >
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}
