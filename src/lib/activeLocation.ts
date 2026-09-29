"use client";

import { useSyncExternalStore } from "react";
import type { Location } from "@/lib/api";

/**
 * Which venue the admin console is looking at.
 *
 * It used to be a select on the dashboard alone, with **All locations** as its
 * default — and every other page showed every venue's data with nothing saying
 * so. Two problems with that, and the owner named both:
 *
 * 1. A figure summed across venues is a figure nobody can act on. An operator
 *    running three attractions does not manage "all of them"; they are standing
 *    in one, and the day's takings, the roster and the shelf all belong to it.
 * 2. It was on one page. Every other screen had either its own venue filter
 *    (inventory), a column instead of a filter (orders), or nothing at all.
 *
 * So the choice moved into the bar, where it governs the whole console, and
 * **there is no "all"**: one venue is always selected. A page's own filters then
 * narrow within it, which is what "different filters per location" means — the
 * status, the date range and the search are the page's, the venue is the
 * console's.
 *
 * Held per browser, like the other device-scoped choices: a tablet in the
 * museum office should open on the museum.
 *
 * Settings is the one surface it does not govern. There a venue is a *record*
 * being edited, not a lens being looked through, and scoping the list of venues
 * to one venue is a circle.
 */
const KEY = "cf_location";
export const LOCATION_EVENT = "cf-location";

function stored(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    // Storage can be blocked; the console then opens on the first venue.
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(LOCATION_EVENT, onChange);
  // Another tab switching venue should not leave this one lying.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LOCATION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The raw stored id — "" until somebody has chosen. */
export function useStoredLocation(): string {
  return useSyncExternalStore(subscribe, stored, () => "");
}

export function setActiveLocation(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // The choice still applies for this render pass.
  }
  window.dispatchEvent(new Event(LOCATION_EVENT));
}

/**
 * The venue every page should be reading, resolved against what exists.
 *
 * Resolution is derived rather than written back, which matters twice: the
 * server has no storage, so it must render *something* without a mismatch; and
 * a stored id whose venue has since been archived must fall back rather than
 * leave the console pointed at nothing. Writing a correction during render
 * would be a setState in a render pass, which this repo forbids and which would
 * loop.
 */
export function useActiveLocation(locations: Location[]): {
  id: string;
  location: Location | undefined;
  /** True while the locations have not arrived, so a page can hold its query. */
  pending: boolean;
} {
  const saved = useStoredLocation();
  if (locations.length === 0) return { id: "", location: undefined, pending: true };
  const hit = locations.find((l) => l.id === saved);
  const location = hit ?? locations[0];
  return { id: location.id, location, pending: false };
}
