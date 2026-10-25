"use client";

import { useSyncExternalStore } from "react";

/**
 * The desktop shell's two facts: when it exists, and whether its owner has
 * folded it.
 *
 * `RAIL_QUERY` is the `rail:` variant in globals.css (min-width 64rem AND
 * landscape), written as a media query so a component can branch on it. The
 * pickers (counter, page state) are rendered on one side of it only, never both
 * with one hidden: a hidden copy is still a real node, it comes first in
 * document order, and a screen reader or a script finds two of them.
 */
export const RAIL_QUERY = "(min-width: 64rem) and (orientation: landscape)";

/* ── The fold, remembered per browser ───────────────────────────────────────
   At xl the sidebar is 248px with words; folded it is the 72px icon rail it
   already is from 1024 to 1279. A store rather than state plus an effect: the
   server (and the first client render) draw it open, and useSyncExternalStore
   swaps in the saved choice after hydration without a mismatch. Storage can
   throw (private window, blocked site data), so the last choice is also held
   in memory and the toggle still works for the session. */
const KEY = "cf_go_rail";
const EVENT = "cf-go-rail";
let memory: boolean | null = null;

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return v === "1";
  } catch {
    /* fall through to the in-memory choice */
  }
  return memory ?? false;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Whether the person folded the sidebar to icons. Only matters from xl up. */
export function useRailCollapsed(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setRailCollapsed(next: boolean) {
  memory = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* kept in memory above */
  }
  window.dispatchEvent(new Event(EVENT));
}
