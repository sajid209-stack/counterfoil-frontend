/**
 * The storefront's own colour theme, computed from the one accent a venue picks.
 *
 * The storefront is a clean, light page: white ground, ink text. The accent is
 * used for buttons, links and small marks only, never as a wash behind
 * content. Because the accent is the operator's choice, the steps that sit
 * beside text cannot be fixed tokens. They are computed here, the same way the
 * event templates compute `accentInk`:
 *
 *   fill    the button colour. The accent itself, nudged toward black (at most
 *           30%) until white text on it reaches 4.5:1. A hue that needs more
 *           than that (amber) keeps its own colour and takes ink text instead.
 *   onFill  white or ink, whichever the fill can carry at 4.5:1.
 *   ink     the accent as a LETTER (links, prices, selected chips) on white,
 *           walked toward ink until it reaches 4.5:1.
 *   soft    a 10% tint for selected chips and today's row. Text on it is `ink`
 *           or the page's own ink, never the raw accent.
 *   tintA / tintB / deep   the art plate's gradient and the dark hero stop.
 *
 * Locked to light on purpose: a public page is read in daylight on a phone,
 * the venue's photos and the QR tickets are drawn for white, and a dark mode
 * would put a second set of contrast rules on every operator-chosen colour.
 */
import type { CSSProperties } from "react";
import type { AccentColor } from "@/lib/api/types";

export const ACCENT_HEX: Record<AccentColor, string> = {
  orange: "#f94a00",
  amber: "#f59e0b",
  green: "#16a34a",
  blue: "#2563eb",
  rose: "#be185d",
};

/** With no accent chosen the page is monochrome: ink buttons, like a
 *  newspaper. Plain beats an arbitrary brand colour the venue never picked. */
const NEUTRAL = "#161616";
const WHITE = "#ffffff";
const INK = "#161616";

type RGB = [number, number, number];

const toRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16)) as RGB;
};
const toHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");

const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a: string, b: string): number => {
  const A = lum(toRgb(a));
  const B = lum(toRgb(b));
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
};
/** `amount` of `a` over `b`. */
export const mix = (a: string, b: string, amount: number): string => {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex([0, 1, 2].map((k) => A[k] * amount + B[k] * (1 - amount)) as RGB);
};

export interface StorefrontTheme {
  fill: string;
  onFill: string;
  ink: string;
  soft: string;
  tintA: string;
  tintB: string;
  deep: string;
  accent: string;
}

export function storefrontTheme(accent: AccentColor | null | undefined): StorefrontTheme {
  const base = accent ? ACCENT_HEX[accent] : NEUTRAL;

  let fill = base;
  let onFill = INK;
  let found = false;
  for (let i = 0; i <= 6; i++) {
    const c = mix("#000000", base, i * 0.05);
    if (contrast(c, WHITE) >= 4.5) {
      fill = c;
      onFill = WHITE;
      found = true;
      break;
    }
  }
  if (!found) {
    fill = base;
    onFill = contrast(base, INK) >= 4.5 ? INK : WHITE;
  }

  // The letter colour has to read on white AND on the 10% tint that selected
  // chips sit on, so it is measured against the darker of the two.
  const soft = mix(base, WHITE, 0.1);
  let ink = base;
  for (let i = 0; i <= 20; i++) {
    const c = mix(INK, base, i / 20);
    if (contrast(c, soft) >= 4.5 && contrast(c, WHITE) >= 4.5) {
      ink = c;
      break;
    }
    ink = c;
  }

  return {
    fill,
    onFill,
    ink,
    soft,
    tintA: mix(base, WHITE, 0.16),
    tintB: mix(base, WHITE, 0.34),
    deep: mix(base, "#000000", 0.35),
    accent: base,
  };
}

/** The inline custom properties that scope a storefront's colours. Put on the
 *  `.sf` root; `globals.css` maps the app's own tokens onto them so shared
 *  components (the date picker, the ticket card) follow the venue. */
export function storefrontVars(accent: AccentColor | null | undefined): CSSProperties {
  const t = storefrontTheme(accent);
  return {
    "--sf-accent": t.accent,
    "--sf-fill": t.fill,
    "--sf-on-fill": t.onFill,
    "--sf-ink": t.ink,
    "--sf-soft": t.soft,
    "--sf-tint-a": t.tintA,
    "--sf-tint-b": t.tintB,
    "--sf-deep": t.deep,
  } as CSSProperties;
}
