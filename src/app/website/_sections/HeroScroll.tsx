"use client";

import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "../_components/motion";

/** Writes --w-p (0 at the top of the page, 1 once the hero has scrolled away) for the composite to read. */
export function HeroScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(ref, { from: "top" });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
