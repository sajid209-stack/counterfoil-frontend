import type { LucideIcon } from "lucide-react";

/**
 * The shapes a loading skeleton can take. A skeleton is only worth drawing if
 * it matches the page it stands in for — the same header, the same filter row,
 * the same rows or cards — so the page does not jump when the data lands.
 *
 * OS shapes sit inside the admin frame; the `pos-*` shapes are the till's
 * (Counterfoil GO) and sit inside its shell.
 */
export type SkeletonShape =
  | "dashboard"
  | "list"
  | "cards"
  | "detail"
  | "form"
  | "calendar"
  | "analytics"
  | "pos-wall"
  | "pos-board"
  | "pos-list"
  | "pos-form"
  | "pos-scan";

export type ScreenSurface = "os" | "go";

/**
 * What a page says when it has nothing to show.
 *
 * The words live in the `screens` messages under `empty.<id>.title`, `.body`,
 * `.action` and `.secondary` — never here — so every string has its Bangla.
 */
export interface EmptySpec {
  /** Message key stem: `screens.empty.<id>.*`. Unique per route. */
  id: string;
  icon: LucideIcon;
  /**
   * The ONE primary action's destination. `"self"` means "this page, live" —
   * for a form whose empty state is just "start filling it in" — and, in the
   * state preview, returns to the real page. Omit for no action.
   */
  action?: string;
  /** An optional second link (quiet). */
  secondary?: string;
}

export interface ScreenEntry {
  /** A route pattern: `/orders/[id]` — `[x]` is one dynamic segment. */
  pattern: string;
  surface: ScreenSurface;
  /** Which skeleton draws its loading state. */
  shape: SkeletonShape;
  empty: EmptySpec;
}
