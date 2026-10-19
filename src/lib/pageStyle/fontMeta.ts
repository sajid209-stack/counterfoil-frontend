import type { PageFontId } from "@/lib/api/types";

/**
 * The typefaces a public page can be set in, as plain data (docs/page-style.md
 * §3). The faces themselves are loaded by `fonts.ts` (next/font); this file has
 * no loaders so the resolver and tests can import it anywhere.
 */
export type FontKind = "sans" | "serif" | "display";
export interface PageFont {
  id: PageFontId;
  name: string;
  kind: FontKind;
  /** The CSS family stack, Bengali fallback included. */
  css: string;
  /** Usable for running text (a display-only face is not offered for body). */
  body: boolean;
  /** The heaviest weight the face actually has; a heading weight is clamped to it. */
  maxWeight: number;
  minWeight: number;
}

const stack = (v: string, kind: FontKind) =>
  `var(${v}), var(--font-hind-siliguri), ${kind === "serif" ? "Georgia, serif" : "system-ui, sans-serif"}`;

const f = (id: string, name: string, kind: FontKind, v: string, body: boolean, minWeight = 400, maxWeight = 800): PageFont => ({
  id,
  name,
  kind,
  css: stack(v, kind),
  body,
  minWeight,
  maxWeight,
});

export const FONTS: PageFont[] = [
  f("inter", "Inter", "sans", "--font-inter", true),
  f("dm-sans", "DM Sans", "sans", "--pf-dm-sans", true),
  f("manrope", "Manrope", "sans", "--pf-manrope", true),
  f("jakarta", "Plus Jakarta Sans", "sans", "--pf-jakarta", true),
  f("figtree", "Figtree", "sans", "--pf-figtree", true),
  f("work-sans", "Work Sans", "sans", "--pf-work-sans", true),
  f("plex", "IBM Plex Sans", "sans", "--pf-plex", true, 400, 700),
  f("outfit", "Outfit", "sans", "--font-outfit", true),
  f("sora", "Sora", "sans", "--pf-sora", true),
  f("space-grotesk", "Space Grotesk", "sans", "--font-space-grotesk", true, 400, 700),
  f("fraunces", "Fraunces", "serif", "--font-fraunces", true),
  f("lora", "Lora", "serif", "--pf-lora", true, 400, 700),
  f("baskerville", "Libre Baskerville", "serif", "--pf-baskerville", true, 400, 700),
  f("cormorant", "Cormorant Garamond", "serif", "--pf-cormorant", true, 400, 700),
  f("playfair", "Playfair Display", "serif", "--font-playfair", false),
  f("dm-serif", "DM Serif Display", "serif", "--pf-dm-serif", false, 400, 400),
  f("instrument", "Instrument Serif", "serif", "--pf-instrument", false, 400, 400),
  f("syne", "Syne", "display", "--font-syne", false),
  f("unbounded", "Unbounded", "display", "--pf-unbounded", false),
  f("bebas", "Bebas Neue", "display", "--font-bebas", false, 400, 400),
  f("archivo-black", "Archivo Black", "display", "--pf-archivo-black", false, 400, 400),
];

export const fontById = (id: PageFontId | undefined): PageFont | undefined => FONTS.find((x) => x.id === id);

/** A legacy page stored its display face as a CSS value ("var(--font-syne)");
 *  read that back to an id so old records keep their face. */
export function fontIdFromCss(css: string | undefined): PageFontId | undefined {
  if (!css) return undefined;
  const v = /var\((--[a-z0-9-]+)\)/.exec(css)?.[1];
  return v ? FONTS.find((x) => x.css.startsWith(`var(${v})`))?.id : fontById(css)?.id;
}

/** Pairings that have been looked at together: heading over body. */
export const PAIRINGS: { heading: PageFontId; body: PageFontId }[] = [
  { heading: "fraunces", body: "dm-sans" },
  { heading: "instrument", body: "inter" },
  { heading: "playfair", body: "work-sans" },
  { heading: "dm-serif", body: "manrope" },
  { heading: "cormorant", body: "lora" },
  { heading: "syne", body: "inter" },
  { heading: "unbounded", body: "space-grotesk" },
  { heading: "bebas", body: "figtree" },
  { heading: "archivo-black", body: "plex" },
  { heading: "jakarta", body: "jakarta" },
  { heading: "sora", body: "inter" },
];
