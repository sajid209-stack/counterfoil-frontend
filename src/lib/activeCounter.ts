"use client";

import { useSyncExternalStore } from "react";
import { peekCounters, type Counter } from "@/lib/api";
import { DEMO_COUNTER_ID } from "@/lib/session";

/**
 * Which counter this till is standing at.
 *
 * The till used to be paired to one counter in `session.ts`, so a tablet that
 * walked from the fort to the museum kept selling the fort's catalogue, took
 * stock off the fort's shelf and filed its sales under the fort. The counters
 * an operator sets up in OS (Settings, Counters) now drive it: each belongs to
 * a venue, and choosing one in the Go header moves the whole till — the wall,
 * the shelf, the Schedule, check-in and where a sale is recorded — to that
 * counter's venue.
 *
 * Held per device, like `activeLocation` and for the same reason: a tablet in
 * the museum office should open on the museum. It is a stored id that is only
 * ever read *through* the counters that exist, so a counter that has since been
 * closed or archived in OS falls back instead of leaving the till pointed at a
 * counter that is not selling. A closed counter cannot be chosen, and one that
 * is closed after being chosen is stepped over the same way.
 *
 * Fallback order: the stored counter if it is open, then the demo counter this
 * device was paired to if it is open, then the first open counter. If nothing
 * is open the demo id is still returned, with no counter, so the till can say
 * so rather than render nothing.
 */
const KEY = "cf_counter";
export const COUNTER_EVENT = "cf-counter";

function stored(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    // Storage can be blocked; the till then opens on the paired counter.
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(COUNTER_EVENT, onChange);
  // Another tab choosing a counter should not leave this one lying.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COUNTER_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The raw stored id — "" until somebody has chosen. */
export function useStoredCounter(): string {
  return useSyncExternalStore(subscribe, stored, () => "");
}

export function setActiveCounter(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // The choice still applies for this render pass.
  }
  window.dispatchEvent(new Event(COUNTER_EVENT));
}

/** Open means `active` in OS: Settings, Counters has no other state for it. */
export const counterIsOpen = (c: Counter) => c.status === "active";

/** Pure: the counter a stored id resolves to, against the counters that exist. */
export function resolveCounter(counters: Counter[], saved: string): Counter | undefined {
  const open = counters.filter(counterIsOpen);
  return open.find((c) => c.id === saved) ?? open.find((c) => c.id === DEMO_COUNTER_ID) ?? open[0];
}

export type ActiveCounter = {
  /** Always set: the demo counter's id when nothing is open. */
  id: string;
  counter: Counter | undefined;
  /** The venue the counter stands in; "" when there is no counter. */
  locationId: string;
};

/**
 * The counter every till screen should be reading, resolved against `counters`
 * (the list the caller already holds, so it re-renders with it).
 */
export function useActiveCounter(counters: Counter[]): ActiveCounter {
  const saved = useStoredCounter();
  const counter = resolveCounter(counters, saved);
  return { id: counter?.id ?? DEMO_COUNTER_ID, counter, locationId: counter?.locationId ?? "" };
}

/**
 * The same, for the screens that read counters synchronously from the store
 * (`peekCounters`) rather than through a query. The store is filled when the
 * mock backend boots, so this is never empty on a till route.
 */
export function useActiveCounterNow(): ActiveCounter {
  return useActiveCounter(peekCounters());
}
