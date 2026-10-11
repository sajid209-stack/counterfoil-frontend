"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

/**
 * Which configuration the previews are drawn in: product (OS | POS; the URL value for the till stays `go`) and mode
 * (light | dark). They drive the PREVIEW wrappers only; the docs chrome around
 * them keeps the site's own theme.
 *
 * The state is the URL — `?product=go&mode=dark` — so a link carries it. It is
 * read from `window.location.search` through an external store rather than
 * `useSearchParams`: that hook bails a statically generated page out to the
 * client up to the nearest Suspense boundary, and this is a documentation site
 * whose pages are worth shipping as HTML. The server snapshot is the default
 * (OS, follow the site), so the document is the same whoever asks, and the
 * query is picked up on hydration.
 *
 * Writing goes through `history.replaceState`, which Next integrates with its
 * router, then tells our own subscribers; back/forward arrive as `popstate`.
 */

export type DsProduct = "os" | "go";
export type DsMode = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}
const getSearch = () => window.location.search;
const getServerSearch = () => "";

function writeQuery(mutate: (q: URLSearchParams) => void) {
  const q = new URLSearchParams(window.location.search);
  mutate(q);
  const qs = q.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export interface DsConfig {
  product: DsProduct;
  /** The mode the previews draw in. `null` only until the client has taken
   *  over AND the URL does not pin one: the wrapper then carries no mode class
   *  and simply inherits the site's, which is what following it means. */
  mode: DsMode | null;
  /** True when the URL pins a mode (rather than following the site). */
  pinned: boolean;
  setProduct: (p: DsProduct) => void;
  setMode: (m: DsMode) => void;
  /** A path with the current configuration carried on it, for links. */
  href: (path: string) => string;
}

export function useDsConfig(): DsConfig {
  /* Re-render on a client navigation: `getSnapshot` is only consulted when
     something renders, and a <Link> push changes the query without rendering
     a component that reads nothing else. The pathname is that something. */
  usePathname();
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  const q = new URLSearchParams(search);
  const p = q.get("product");
  const m = q.get("mode");
  const product: DsProduct = p === "go" ? "go" : "os";
  const modeParam: DsMode | null = m === "light" || m === "dark" ? m : null;
  const siteMode: DsMode | null = mounted ? (resolvedTheme === "dark" ? "dark" : "light") : null;

  const setProduct = useCallback((next: DsProduct) => writeQuery((qq) => qq.set("product", next)), []);
  const setMode = useCallback((next: DsMode) => writeQuery((qq) => qq.set("mode", next)), []);
  const href = useCallback(
    (path: string) => {
      const out = new URLSearchParams();
      const pp = new URLSearchParams(search);
      if (pp.get("product")) out.set("product", pp.get("product")!);
      if (pp.get("mode")) out.set("mode", pp.get("mode")!);
      const qs = out.toString();
      return qs ? `${path}?${qs}` : path;
    },
    [search],
  );

  return { product, mode: modeParam ?? siteMode, pinned: modeParam !== null, setProduct, setMode, href };
}
