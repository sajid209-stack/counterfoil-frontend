"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useMediaQuery } from "@/lib/useMedia";

/**
 * Which columns of the orders table are on show.
 *
 * Thirteen columns are what a report is made of and about nine are what fits a
 * laptop: measured, the table was 1,410px wide inside a 1,160px page, so the
 * last three columns — payment method, status, items — sat off the edge behind
 * a scrollbar. So the page does not pretend. Below a wide screen it starts with
 * Counter, VAT and Discount tucked away (the least asked-for, and all three are
 * one tick away in Columns), and a person who wants them keeps them: the choice
 * is remembered in this browser. The CSV always carries every column; this is
 * only about what is on screen.
 *
 * The order reference is never hidden — it is the row's identity, and the thing
 * every other page links back to.
 */
const KEY = "cf_orders_columns";
const EVENT = "cf-orders-columns";

/** Every column that can be switched off, in table order. */
export const TOGGLEABLE = ["createdAt", "customer", "channel", "counter", "staff", "total", "tax", "paid", "discount", "method", "status", "items"] as const;
/** Hidden to begin with where there is not room for all thirteen. */
const NARROW_DEFAULT = ["counter", "tax", "discount"];
/** The width at which all thirteen fit (Tailwind's 2xl). */
const ALL_FIT = "(min-width: 96rem)";

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function useHiddenColumns(): { hidden: string[]; set: (hidden: string[] | null) => void } {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const roomy = useMediaQuery(ALL_FIT);
  const hidden = useMemo(() => {
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === "string");
      } catch {
        // A corrupt value falls back to the default below.
      }
    }
    return roomy ? [] : NARROW_DEFAULT;
  }, [raw, roomy]);

  const set = (next: string[] | null) => {
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the choice still applies until the next load.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { hidden, set };
}
