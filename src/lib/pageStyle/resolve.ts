import type { CSSProperties } from "react";
import type { PageStyle, Storefront } from "@/lib/api/types";
import { contrast, mix, storefrontTheme, type AccentInput } from "@/lib/storefront/theme";
import { fontById } from "./fontMeta";

/**
 * A page style, resolved (docs/page-style.md §5).
 *
 * CONTRACT — the ONE place a `PageStyle` is read. Renderers never look at the
 * stored fields; they take the CSS variables and data attributes from
 * `styleRootProps(resolved)` and style themselves against those.
 *
 *   productPageStyle({ look, page, brand })   an item's page
 *   storefrontStyle(storefront)               a venue's storefront
 *
 * Layering for an item's page: the look's own values, then the venue's brand
 * (its storefront's `style`), then the page's own `style` when `styleSource`
 * is "custom". A record with no style at all resolves to exactly what it drew
 * before this existed — the defaults below are the old values, not new ones.
 *
 * Readability is enforced here, not trusted to the editor: text is walked
 * toward black or white until it reads at 4.5:1 on the ground and on cards,
 * and a button's label is whichever of white or ink its fill can carry.
 * `checkStyle` reports what had to be changed, so the editor can say so.
 */

export type Mode = "light" | "dark";

export interface Ground {
  /** The page ground. */
  bg: string;
  /** A quiet panel (a facts strip, a muted card). */
  panel: string;
  /** Cards. */
  card: string;
  fg: string;
  muted: string;
  line: string;
}

/** The two grounds product pages had before styles: kept exactly. */
export const LOOK_GROUNDS: Record<Mode, Ground> = {
  light: { bg: "#ffffff", panel: "#f6f6f4", card: "#ffffff", fg: "#161616", muted: "#5c5c63", line: "#e5e5e2" },
  dark: { bg: "#0d0d10", panel: "#141418", card: "#17171b", fg: "#f4f4f6", muted: "#a5a5ae", line: "#2a2a30" },
};
/** The storefront's ground before styles: white page, white cards, ink text. */
export const STOREFRONT_GROUND: Ground = {
  bg: "#ffffff", panel: "#fafaf9", card: "#ffffff", fg: "#161616", muted: "#5c5c63", line: "#e5e5e2",
};

const WHITE = "#ffffff";
const INK = "#111114";
const BLACK = "#000000";
const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v: string | undefined, d: string) => (v && HEX.test(v) ? v : d);

const toRgb = (hex: string) => [0, 2, 4].map((o) => parseInt(hex.slice(1 + o, 3 + o), 16) / 255);
const relLum = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const modeOf = (bg: string): Mode => (relLum(bg) < 0.18 ? "dark" : "light");

/** Walk `c` toward `toward` until it reads at `min` on every one of `on`. */
function readable(c: string, on: string[], min: number, toward: string): string {
  for (let i = 0; i <= 20; i++) {
    const x = mix(toward, c, i / 20);
    if (on.every((b) => contrast(x, b) >= min)) return x;
  }
  return toward;
}

export interface Colours {
  mode: Mode;
  ground: Ground;
  /** Primary button. */
  fill: string;
  onFill: string;
  /** The primary as a letter (links, outline buttons, prices) — ≥4.5:1 on bg and card. */
  ink: string;
  /** A quiet tint of the primary (selected chips). */
  soft: string;
  accent: string;
  /** Secondary: tags, highlights, small marks. */
  secondary: string;
  secondarySoft: string;
  /** Secondary as a letter on its soft tint and on the ground. */
  secondaryInk: string;
}

/** Ground colours from the style's own, derived the way the defaults were. */
function groundFrom(style: PageStyle, base: Ground): { ground: Ground; changed: boolean } {
  if (!style.background && !style.surface && !style.text) return { ground: base, changed: false };
  const bg = hexOr(style.background, base.bg);
  const mode = modeOf(bg);
  const card = hexOr(style.surface, style.background ? (mode === "dark" ? mix(WHITE, bg, 0.06) : WHITE) : base.card);
  const panel = mode === "dark" ? mix(WHITE, bg, 0.035) : mix(BLACK, bg, 0.025);
  const toward = mode === "dark" ? WHITE : INK;
  const fg = readable(hexOr(style.text, base.fg), [bg, card, panel], 4.5, toward);
  let muted = fg;
  for (let i = 0; i <= 20; i++) {
    const x = mix(fg, bg, 0.55 + i * 0.0225);
    muted = x;
    if ([bg, card, panel].every((b) => contrast(x, b) >= 4.5)) break;
  }
  const line = mix(fg, bg, 0.14);
  return { ground: { bg, panel, card, fg, muted, line }, changed: true };
}

/** The primary on a ground — the product page's rule (`pageColours`),
 *  generalised to any ground. With a look's own ground it gives exactly what
 *  `pageColours` gave. */
function primaryOn(accent: string, mode: Mode, g: Ground) {
  let fill = accent;
  let onFill = WHITE;
  if (mode === "light") {
    let ok = false;
    for (let i = 0; i <= 8; i++) {
      const c = mix(BLACK, accent, i * 0.05);
      if (contrast(c, WHITE) >= 4.5) { fill = c; ok = true; break; }
    }
    if (!ok) { fill = accent; onFill = contrast(accent, INK) >= 4.5 ? INK : WHITE; }
  } else {
    for (let i = 0; i <= 10; i++) {
      const c = mix(WHITE, accent, i * 0.06);
      fill = c;
      if (contrast(c, g.bg) >= 3) break;
    }
    onFill = contrast(fill, WHITE) >= 4.5 ? WHITE : INK;
  }
  const toward = mode === "light" ? INK : WHITE;
  let ink = accent;
  for (let i = 0; i <= 20; i++) {
    const c = mix(toward, accent, i / 20);
    ink = c;
    if (contrast(c, g.bg) >= 4.5 && contrast(c, g.card) >= 4.5 && contrast(c, g.panel) >= 4.5) break;
  }
  const soft = mix(accent, g.card, mode === "light" ? 0.09 : 0.18);
  return { fill, onFill, ink, soft };
}

function secondaryOn(sec: string, mode: Mode, g: Ground) {
  const secondarySoft = mix(sec, g.card, mode === "light" ? 0.12 : 0.08);
  const secondaryInk = readable(sec, [secondarySoft, g.bg, g.card], 4.5, mode === "light" ? INK : WHITE);
  return { secondary: sec, secondarySoft, secondaryInk };
}

export interface ResolvedStyle {
  colours: Colours;
  headingFont: string;
  bodyFont: string;
  /** null: the renderer's own weight. */
  headingWeight: number | null;
  typeScale: NonNullable<PageStyle["typeScale"]>;
  headingCase: NonNullable<PageStyle["headingCase"]>;
  corners: NonNullable<PageStyle["corners"]>;
  buttonStyle: NonNullable<PageStyle["buttonStyle"]>;
  cardStyle: NonNullable<PageStyle["cardStyle"]>;
  hero: NonNullable<PageStyle["hero"]>;
  heroHeight: NonNullable<PageStyle["heroHeight"]>;
  overlay: number;
  width: NonNullable<PageStyle["width"]>;
  spacing: NonNullable<PageStyle["spacing"]>;
  dividers: NonNullable<PageStyle["dividers"]>;
  bookingPanel: NonNullable<PageStyle["bookingPanel"]>;
  gallery: NonNullable<PageStyle["gallery"]>;
  texture: NonNullable<PageStyle["texture"]>;
  imageTone: NonNullable<PageStyle["imageTone"]>;
  iconStroke: NonNullable<PageStyle["iconStroke"]>;
  /** Stroke width for lucide icons. */
  stroke: number;
  ctaLabel?: string;
  priceLabel?: string;
  badge?: string;
  /** Whether the style changed anything at all (a record with no style: false). */
  styled: boolean;
}

interface Defaults {
  ground: Ground;
  accent: string;
  headingFont: string;
  bodyFont: string;
  hero: ResolvedStyle["hero"];
  headingCase: ResolvedStyle["headingCase"];
}

/** Merge layers: later wins, an absent field leaves the earlier one. */
export const mergeStyles = (...layers: (PageStyle | undefined | null)[]): PageStyle => {
  const out: PageStyle = {};
  for (const l of layers) {
    if (!l) continue;
    for (const [k, v] of Object.entries(l)) if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
};

const STROKE = { thin: 1.25, regular: 1.75, bold: 2.25 } as const;

function resolve(style: PageStyle, d: Defaults, primaryRule: "page" | "storefront"): ResolvedStyle {
  const { ground, changed } = groundFrom(style, d.ground);
  const mode = modeOf(ground.bg);
  const accent = hexOr(style.primary, d.accent);
  let fill: string, onFill: string, ink: string, soft: string;
  if (primaryRule === "storefront" && !changed) {
    const t = storefrontTheme(accent);
    ({ fill, onFill, ink, soft } = t);
  } else {
    ({ fill, onFill, ink, soft } = primaryOn(accent, mode, ground));
  }
  const sec = secondaryOn(hexOr(style.secondary, accent), mode, ground);
  const hf = fontById(style.headingFont);
  const bf = fontById(style.bodyFont);
  const weight = style.headingWeight ?? null;
  const iconStroke = style.iconStroke ?? "regular";
  return {
    colours: { mode, ground, fill, onFill, ink, soft, accent, ...sec },
    headingFont: hf?.css ?? d.headingFont,
    bodyFont: bf && bf.body ? bf.css : d.bodyFont,
    headingWeight: weight === null ? null : hf ? Math.min(hf.maxWeight, Math.max(hf.minWeight, weight)) : weight,
    typeScale: style.typeScale ?? "standard",
    headingCase: style.headingCase ?? d.headingCase,
    corners: style.corners ?? "soft",
    buttonStyle: style.buttonStyle ?? "solid",
    cardStyle: style.cardStyle ?? "bordered",
    hero: style.hero ?? d.hero,
    heroHeight: style.heroHeight ?? "medium",
    overlay: Math.max(0, Math.min(80, style.overlay ?? 45)),
    width: style.width ?? "standard",
    spacing: style.spacing ?? "standard",
    dividers: style.dividers ?? "none",
    bookingPanel: style.bookingPanel ?? "sidebar",
    gallery: style.gallery ?? "mosaic",
    texture: style.texture ?? "none",
    imageTone: style.imageTone ?? "none",
    iconStroke,
    stroke: STROKE[iconStroke],
    ctaLabel: style.ctaLabel?.trim() || undefined,
    priceLabel: style.priceLabel?.trim() || undefined,
    badge: style.badge?.trim() || undefined,
    styled: Object.keys(style).length > 0,
  };
}

/** The look's values that a style can override. Mirrors `LookDef` without
 *  importing the renderer. */
export interface LookBase {
  mode: Mode;
  hero: "split" | "cover" | "editorial";
  display: string;
  titleCaps: boolean;
  accent: string | null;
}

export function productPageStyle({
  look,
  page,
  brand,
  venueAccent,
}: {
  look: LookBase;
  page: { styleSource?: "brand" | "custom"; style?: PageStyle; accent?: string; displayFont?: string };
  /** The venue storefront's brand style. */
  brand?: PageStyle | null;
  /** The storefront's legacy one-colour accent, as a hex. */
  venueAccent?: string | null;
}): ResolvedStyle {
  const own = page.styleSource === "custom" ? page.style : undefined;
  /* A page's old own accent and face still win over the brand: they were an
     explicit choice for this page. */
  const legacy: PageStyle = {};
  if (page.accent) legacy.primary = page.accent;
  const merged = mergeStyles(brand ?? undefined, legacy, own);
  const legacyFont = page.displayFont && !own?.headingFont && !brand?.headingFont ? page.displayFont : undefined;
  return resolve(
    merged,
    {
      ground: LOOK_GROUNDS[look.mode],
      accent: look.accent ?? venueAccent ?? "#161616",
      headingFont: legacyFont ?? look.display,
      bodyFont: "var(--font-sans)",
      hero: look.hero,
      headingCase: look.titleCaps ? "upper" : "normal",
    },
    "page",
  );
}

export function storefrontStyle(sf: Pick<Storefront, "accent" | "style"> | null | undefined, accentHex?: (a: AccentInput) => string): ResolvedStyle {
  const style = mergeStyles(sf?.style ?? undefined);
  const fallback = sf?.accent ? (accentHex ? accentHex(sf.accent) : storefrontTheme(sf.accent).accent) : "#161616";
  return resolve(
    style,
    { ground: STOREFRONT_GROUND, accent: fallback, headingFont: "var(--font-sans)", bodyFont: "var(--font-sans)", hero: "split", headingCase: "normal" },
    "storefront",
  );
}

const RADII = {
  sharp: { card: "4px", control: "4px", media: "4px" },
  soft: { card: "16px", control: "12px", media: "16px" },
  round: { card: "24px", control: "16px", media: "24px" },
} as const;
/* Section spacing. "airy" is deliberately modest: the owner's standing rule is
   that public pages must not drown in whitespace. */
const GAP = { tight: ["24px", "32px"], standard: ["40px", "56px"], airy: ["48px", "64px"] } as const;
const WIDTH = { narrow: "1040px", standard: "1264px", wide: "1440px" } as const;
const HERO_H = { short: ["300px", "380px"], medium: ["380px", "480px"], tall: ["440px", "560px"] } as const;
const SCALE = { compact: "0.92", standard: "1", large: "1.1" } as const;

/**
 * The root's props: CSS variables and data attributes. Spread onto the page or
 * storefront root (it carries `style`, so merge with any of your own).
 *
 * Variables (all set):
 *   --ps-bg --ps-panel --ps-card --ps-fg --ps-muted --ps-line
 *   --ps-fill --ps-on-fill --ps-ink --ps-soft --ps-accent
 *   --ps-secondary --ps-secondary-soft --ps-secondary-ink
 *   --ps-font-heading --ps-font-body --ps-scale
 *   --ps-radius-card --ps-radius-control --ps-radius-media
 *   --ps-gap --ps-gap-lg --ps-container --ps-hero-h --ps-hero-h-lg --ps-overlay --ps-stroke
 * Set only when chosen (so CSS can fall back to its own value):
 *   --ps-heading-weight --ps-heading-transform
 * Also the existing --pg-* and --sf-* names, so CSS written before styles follows.
 * Data attributes: data-ps-button, -card, -texture, -tone, -dividers, -gallery,
 *   -hero, -panel, -mode, -corners, -icons.
 */
export function styleRootProps(r: ResolvedStyle, extra?: CSSProperties): { style: CSSProperties } & Record<`data-ps-${string}`, string> {
  const c = r.colours;
  const g = c.ground;
  const rad = RADII[r.corners];
  const vars: Record<string, string> = {
    "--ps-bg": g.bg,
    "--ps-panel": g.panel,
    "--ps-card": g.card,
    "--ps-fg": g.fg,
    "--ps-muted": g.muted,
    "--ps-line": g.line,
    "--ps-fill": c.fill,
    "--ps-on-fill": c.onFill,
    "--ps-ink": c.ink,
    "--ps-soft": c.soft,
    "--ps-accent": c.accent,
    "--ps-secondary": c.secondary,
    "--ps-secondary-soft": c.secondarySoft,
    "--ps-secondary-ink": c.secondaryInk,
    "--ps-font-heading": r.headingFont,
    "--ps-font-body": r.bodyFont,
    "--ps-scale": SCALE[r.typeScale],
    "--ps-radius-card": rad.card,
    "--ps-radius-control": rad.control,
    "--ps-radius-media": rad.media,
    "--ps-gap": GAP[r.spacing][0],
    "--ps-gap-lg": GAP[r.spacing][1],
    "--ps-container": WIDTH[r.width],
    "--ps-hero-h": HERO_H[r.heroHeight][0],
    "--ps-hero-h-lg": HERO_H[r.heroHeight][1],
    "--ps-overlay": String(r.overlay / 100),
    "--ps-stroke": String(r.stroke),
    // the names the page and storefront CSS already read
    "--pg-bg": g.bg,
    "--pg-surface": g.panel,
    "--pg-card": g.card,
    "--pg-fg": g.fg,
    "--pg-muted": g.muted,
    "--pg-line": g.line,
    "--pg-fill": c.fill,
    "--pg-on-fill": c.onFill,
    "--pg-ink": c.ink,
    "--pg-soft": c.soft,
    "--pg-accent": c.accent,
    "--pg-display": r.headingFont,
    "--sf-accent": c.accent,
    "--sf-fill": c.fill,
    "--sf-on-fill": c.onFill,
    "--sf-ink": c.ink,
    "--sf-soft": c.soft,
  };
  if (r.headingWeight !== null) vars["--ps-heading-weight"] = String(r.headingWeight);
  if (r.headingCase === "upper") vars["--ps-heading-transform"] = "uppercase";
  return {
    style: { ...(vars as CSSProperties), ...extra },
    "data-ps-button": r.buttonStyle,
    "data-ps-card": r.cardStyle,
    "data-ps-texture": r.texture,
    "data-ps-tone": r.imageTone,
    "data-ps-dividers": r.dividers,
    "data-ps-gallery": r.gallery,
    "data-ps-hero": r.hero,
    "data-ps-panel": r.bookingPanel,
    "data-ps-mode": c.mode,
    "data-ps-corners": r.corners,
    "data-ps-icons": r.iconStroke,
  };
}

export interface StyleIssue {
  field: "text" | "background" | "surface" | "primary" | "secondary";
  /** error: refused (cannot be saved). notice: adjusted, saved, said. */
  severity: "error" | "notice";
  code: "textUnreadable" | "textOnCards" | "primaryAdjusted" | "secondaryAdjusted" | "buttonLowContrast";
  ratio: number;
}

/** What a style's own colours do before they are made readable. The editor
 *  refuses an `error` and states a `notice`. */
export function checkStyle(style: PageStyle, base: Ground = STOREFRONT_GROUND): StyleIssue[] {
  const out: StyleIssue[] = [];
  const bg = hexOr(style.background, base.bg);
  const card = hexOr(style.surface, base.card);
  const fg = hexOr(style.text, base.fg);
  const r1 = contrast(fg, bg);
  if (style.text || style.background) if (r1 < 4.5) out.push({ field: "text", severity: "error", code: "textUnreadable", ratio: r1 });
  const r2 = contrast(fg, card);
  if ((style.text || style.surface) && r1 >= 4.5 && r2 < 4.5) out.push({ field: "surface", severity: "error", code: "textOnCards", ratio: r2 });
  if (style.primary && HEX.test(style.primary)) {
    const best = Math.max(contrast(style.primary, WHITE), contrast(style.primary, INK));
    if (best < 4.5) out.push({ field: "primary", severity: "notice", code: "primaryAdjusted", ratio: best });
    const vs = contrast(style.primary, bg);
    if (vs < 3) out.push({ field: "primary", severity: "notice", code: "buttonLowContrast", ratio: vs });
  }
  if (style.secondary && HEX.test(style.secondary)) {
    const r = contrast(style.secondary, bg);
    if (r < 4.5) out.push({ field: "secondary", severity: "notice", code: "secondaryAdjusted", ratio: r });
  }
  return out;
}
