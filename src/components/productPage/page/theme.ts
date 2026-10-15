import type { CSSProperties } from "react";
import type { PageLook } from "@/lib/api/types";
import { contrast, mix } from "@/lib/storefront/theme";

/**
 * The seven looks as ONE system (docs/product-page.md §3).
 *
 * A look no longer redraws the page. It picks a personality, light or dark, a
 * hero treatment and a display face for the title; everything else — the
 * container, the spacing, the type scale, the booking panel, the ticket cards,
 * every section — is shared. That is what makes a turf tournament and a gallery
 * opening two pages of the same product rather than two websites.
 *
 * CONTRACT: the shell (`BookingPage`) and every section read the look only
 * through `lookOf` and the CSS variables `pageVars` sets. No component branches
 * on a look id for colour; components may branch on `hero` and `personality`.
 */

export type Personality = "energetic" | "editorial" | "informational";
export type HeroStyle = "split" | "cover" | "editorial";

export interface LookDef {
  personality: Personality;
  mode: "light" | "dark";
  hero: HeroStyle;
  /** The face for the page title (and, in an editorial look, section headings). */
  display: string;
  /** Set the title in capitals (a poster); everything else stays sentence case. */
  titleCaps: boolean;
  /** Tracking for the title. */
  titleTracking: string;
  /** The look's own accent, used when the page has none. Classic has none: it
   *  takes the venue's storefront colour. */
  accent: string | null;
}

export const LOOKS: Record<PageLook, LookDef> = {
  standard: { personality: "informational", mode: "light", hero: "split", display: "var(--font-inter)", titleCaps: false, titleTracking: "-0.025em", accent: null },
  business: { personality: "informational", mode: "light", hero: "split", display: "var(--font-inter)", titleCaps: false, titleTracking: "-0.025em", accent: "#1D4ED8" },
  travel: { personality: "informational", mode: "light", hero: "cover", display: "var(--font-fraunces)", titleCaps: false, titleTracking: "-0.015em", accent: "#0F766E" },
  arts: { personality: "editorial", mode: "light", hero: "editorial", display: "var(--font-playfair)", titleCaps: false, titleTracking: "-0.01em", accent: "#2E4A3F" },
  entertainment: { personality: "energetic", mode: "dark", hero: "cover", display: "var(--font-bebas)", titleCaps: true, titleTracking: "0.01em", accent: "#FF3D71" },
  sports: { personality: "energetic", mode: "dark", hero: "cover", display: "var(--font-space-grotesk)", titleCaps: false, titleTracking: "-0.03em", accent: "#2BE07C" },
  nightlife: { personality: "energetic", mode: "dark", hero: "cover", display: "var(--font-syne)", titleCaps: false, titleTracking: "-0.02em", accent: "#B026FF" },
};

export const lookOf = (look: PageLook | undefined): LookDef => LOOKS[look ?? "standard"] ?? LOOKS.standard;

/** Neutral grounds. Dark looks are near-black and NEUTRAL — never a tinted or
 *  gradient page (the audit's "whole pages tinted"). */
const GROUND = {
  light: { bg: "#ffffff", surface: "#f6f6f4", card: "#ffffff", fg: "#161616", muted: "#5c5c63", line: "#e5e5e2" },
  dark: { bg: "#0d0d10", surface: "#141418", card: "#17171b", fg: "#f4f4f6", muted: "#a5a5ae", line: "#2a2a30" },
} as const;

export interface PageColours {
  /** The primary button. */
  fill: string;
  onFill: string;
  /** The accent as a letter (links, prices in a selected state) — ≥4.5:1 on bg and card. */
  ink: string;
  /** A quiet tint for a selected chip or card. */
  soft: string;
  accent: string;
}

/** The accent, made to work on the look's ground. */
export function pageColours(accent: string, mode: "light" | "dark"): PageColours {
  const g = GROUND[mode];
  const WHITE = "#ffffff";
  const INK = "#111114";
  let fill = accent;
  let onFill = WHITE;
  if (mode === "light") {
    // Darken until white text reads; a hue that cannot (amber) keeps ink text.
    let ok = false;
    for (let i = 0; i <= 8; i++) {
      const c = mix("#000000", accent, i * 0.05);
      if (contrast(c, WHITE) >= 4.5) { fill = c; ok = true; break; }
    }
    if (!ok) { fill = accent; onFill = contrast(accent, INK) >= 4.5 ? INK : WHITE; }
  } else {
    // On a dark ground the button must stand off the page (3:1) and carry its label (4.5:1).
    for (let i = 0; i <= 10; i++) {
      const c = mix(WHITE, accent, i * 0.06);
      if (contrast(c, g.bg) >= 3) { fill = c; break; }
      fill = c;
    }
    onFill = contrast(fill, WHITE) >= 4.5 ? WHITE : INK;
  }
  let ink = accent;
  const toward = mode === "light" ? INK : WHITE;
  for (let i = 0; i <= 20; i++) {
    const c = mix(toward, accent, i / 20);
    ink = c;
    if (contrast(c, g.bg) >= 4.5 && contrast(c, g.card) >= 4.5 && contrast(c, g.surface) >= 4.5) break;
  }
  const soft = mix(accent, g.card, mode === "light" ? 0.09 : 0.18);
  return { fill, onFill, ink, soft, accent };
}

/**
 * The page's custom properties. Put them on the page root (with the class
 * `pg`, and `dark pg-dark` for a dark look). They also set the storefront's
 * own `--sf-*` accent variables, so the shared booking picker, buttons and
 * chips inside follow the page's colour.
 *
 *   --pg-bg / --pg-surface / --pg-card / --pg-fg / --pg-muted / --pg-line
 *   --pg-fill / --pg-on-fill / --pg-ink / --pg-soft / --pg-accent
 *   --pg-display  the title face
 */
export function pageVars(look: LookDef, accent: string): CSSProperties {
  const g = GROUND[look.mode];
  const c = pageColours(accent, look.mode);
  return {
    "--pg-bg": g.bg,
    "--pg-surface": g.surface,
    "--pg-card": g.card,
    "--pg-fg": g.fg,
    "--pg-muted": g.muted,
    "--pg-line": g.line,
    "--pg-fill": c.fill,
    "--pg-on-fill": c.onFill,
    "--pg-ink": c.ink,
    "--pg-soft": c.soft,
    "--pg-accent": c.accent,
    "--pg-display": look.display,
    "--pg-title-tracking": look.titleTracking,
    "--sf-accent": c.accent,
    "--sf-fill": c.fill,
    "--sf-on-fill": c.onFill,
    "--sf-ink": c.ink,
    "--sf-soft": c.soft,
  } as CSSProperties;
}

/** The class names for the page root. */
export const pageRootClass = (look: LookDef) => (look.mode === "dark" ? "pg pg-dark dark" : "pg");
