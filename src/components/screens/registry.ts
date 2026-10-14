import { Inbox } from "lucide-react";
import { TILL_PATHS } from "@/lib/prefsBoot";
import { GO_ENTRIES } from "./registry.go";
import { OS_ENTRIES } from "./registry.os";
import type { ScreenEntry, ScreenSurface } from "./types";

export type { EmptySpec, ScreenEntry, ScreenSurface, SkeletonShape } from "./types";

/**
 * The screen registry — every route's loading shape and empty state, in one
 * place, so a loading screen, an empty page and the developer's page-state
 * preview all agree about what a page is.
 *
 *   registry.os.ts   the admin routes (every page.tsx under (os))
 *   registry.go.ts   the till's routes, merged in below
 *
 * Add a route and you add one entry plus four strings (en + bn). A route with
 * no entry is not an error: it falls back to a generic list skeleton and a
 * generic empty page, so a new screen is never blank while it waits.
 */
export const ENTRIES: readonly ScreenEntry[] = [...OS_ENTRIES, ...GO_ENTRIES];

const FALLBACK: Record<ScreenSurface, ScreenEntry> = {
  os: { pattern: "*", surface: "os", shape: "list", empty: { id: "generic", icon: Inbox, action: "/dashboard" } },
  go: { pattern: "*", surface: "go", shape: "pos-list", empty: { id: "generic", icon: Inbox, action: "/pos" } },
};

/** `/orders/[id]` → /^\/orders\/[^/]+$/ */
const toRegex = (pattern: string) =>
  new RegExp("^" + pattern.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\[[^\]/]+\]/g, "[^/]+") + "/?$");

/* Compiled once. A route that is fully static beats one with a dynamic segment
   (/settings/team/new over /settings/team/[id]), so fewer `[x]` sorts first. */
const COMPILED = ENTRIES.map((entry) => ({
  entry,
  re: toRegex(entry.pattern),
  dynamic: (entry.pattern.match(/\[[^\]]+\]/g) ?? []).length,
})).sort((a, b) => a.dynamic - b.dynamic);

const clean = (pathname: string) => pathname.split(/[?#]/)[0] || "/";

/** The entry for a route, or null when it has none. */
export function matchScreen(pathname: string): ScreenEntry | null {
  const p = clean(pathname);
  return COMPILED.find((c) => c.re.test(p))?.entry ?? null;
}

/** Which product a path belongs to. The entry wins; otherwise the till's own
 *  path list (the same one the shell uses to switch themes) decides. */
export function surfaceOf(pathname: string): ScreenSurface {
  const hit = matchScreen(pathname);
  if (hit) return hit.surface;
  const p = clean(pathname);
  return TILL_PATHS.some((t) => p === t || p.startsWith(`${t}/`)) ? "go" : "os";
}

/** The entry for a route, falling back to a generic one for its product. */
export function resolveScreen(pathname: string): ScreenEntry {
  return matchScreen(pathname) ?? FALLBACK[surfaceOf(pathname)];
}

/** Where "Go to dashboard" goes: the admin dashboard, or the till's sell screen. */
export const homeFor = (surface: ScreenSurface) => (surface === "go" ? "/pos" : "/dashboard");
