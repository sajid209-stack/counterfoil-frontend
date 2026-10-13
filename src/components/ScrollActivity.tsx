"use client";

import { useEffect } from "react";

/**
 * Marks whichever element is being scrolled with `data-scrolling`, and clears
 * it a moment after the scrolling stops. globals.css draws the scrollbar thumb
 * only on a marked element, so a scrollbar shows while you scroll and fades
 * back out of the way afterwards — the overlay behaviour Shopify admin and
 * macOS have.
 *
 * One capturing listener for the whole document rather than one per scroller:
 * a scroll event does not bubble, but it does pass the capture phase, so every
 * scroller in the app (the page frame, a table, a sheet, a dropdown) is covered
 * without any of them having to know about this. Passive, so it can never slow
 * a scroll down; the only work per event is one attribute and one timer.
 */
const HIDE_AFTER_MS = 900;

export function ScrollActivity() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const onScroll = (e: Event) => {
      const t = e.target;
      const el = t === document ? document.documentElement : t instanceof Element ? t : null;
      if (!el) return;
      if (!el.hasAttribute("data-scrolling")) el.setAttribute("data-scrolling", "");
      const prev = timers.get(el);
      if (prev) window.clearTimeout(prev);
      timers.set(el, window.setTimeout(() => el.removeAttribute("data-scrolling"), HIDE_AFTER_MS));
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
  return null;
}
