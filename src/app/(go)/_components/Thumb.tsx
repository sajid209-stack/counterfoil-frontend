"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The 48px picture on a list card: the item's photograph, or — when it has none
 * or the file is broken — a soft panel with its glyph, the same shape either
 * way so a row never has a hole where the picture should be.
 */
export function Thumb({ image, glyph, className }: { image?: string; glyph: ReactNode; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span aria-hidden className={cn("relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-inner bg-subtle text-fg-secondary [&_svg]:size-6", className)}>
      {image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets, same as the wall
        <img src={image} alt="" decoding="async" ref={(el) => { if (el && el.complete && el.naturalWidth === 0) setBroken(true); }} onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
      ) : (
        glyph
      )}
    </span>
  );
}
