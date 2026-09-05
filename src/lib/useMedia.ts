"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's md. Kept here so the components that branch on form factor and
 *  the CSS that does it agree on where the line is. */
export const MD = "(min-width: 48rem)";

/**
 * Subscribe to a media query.
 *
 * useSyncExternalStore rather than an effect that setStates on mount: a media
 * query IS an external store, and reading it that way avoids both the
 * cascading render and the react-hooks/set-state-in-effect lint. The server
 * snapshot is the caller's business — a component that must ship its markup in
 * the document assumes narrow, one that would rather not flash assumes wide.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
