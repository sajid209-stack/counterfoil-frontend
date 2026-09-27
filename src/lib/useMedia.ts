"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's md. Kept here so the components that branch on form factor and
 *  the CSS that does it agree on where the line is. */
export const MD = "(min-width: 48rem)";

/** Wide enough that a seven-column week still leaves each day room for a
 *  second line. Below it the subtitle truncates instead of informing, which
 *  is worse than not drawing it: (1280 − sidebar − padding − gutter) / 7 is
 *  about 134px, and "1 guest · Outdoor Field" is about 126px of 12px text. */
export const XL = "(min-width: 80rem)";

/**
 * Tailwind's lg — and, for the week grid, the width where seven columns stop
 * being a lie.
 *
 * Measured: the full grid needs its hour gutter plus seven columns wide
 * enough to read, and below 1024 the card is under 620px, which is 82px a day
 * before the gutter. It used to carry a 52rem min-width instead, so from 768
 * to 1279 the week simply scrolled sideways inside its card with no
 * affordance — at 768 you saw Monday to Thursday and nothing said the other
 * three days were there.
 */
export const LG = "(min-width: 64rem)";

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
