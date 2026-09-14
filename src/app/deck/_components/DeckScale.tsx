"use client";

import { useLayoutEffect } from "react";

/**
 * Sets the exact scale every slide is drawn at: the column's width over the
 * 1600px canvas. The stylesheet carries a close first guess for each band of
 * screen widths, so the page is laid out before this runs; this makes it exact
 * and keeps it exact as the window changes.
 */
export function DeckScale({ target }: { target: string }) {
  useLayoutEffect(() => {
    const column = document.getElementById(target);
    if (!column) return;
    const update = () => {
      const style = getComputedStyle(column);
      const width = column.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      column.style.setProperty("--deck-scale", String(width / 1600));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(column);
    return () => observer.disconnect();
  }, [target]);
  return null;
}
