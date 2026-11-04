"use client";

import { useSyncExternalStore } from "react";
import { regionCurrency, subscribeRegion } from "@/lib/region";

/** The active business's currency, for components that must re-render when it
 *  changes. The server always renders the default, so hydration never mismatches. */
export function useRegionCurrency(): string {
  return useSyncExternalStore(subscribeRegion, regionCurrency, () => "BDT");
}
