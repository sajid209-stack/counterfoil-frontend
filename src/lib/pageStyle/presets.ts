import type { PageStyle } from "@/lib/api/types";
import type { ResolvedStyle } from "./resolve";
import { fontIdFromCss } from "./fontMeta";

/**
 * What the Design tab offers (docs/page-design.md). Everything an operator
 * picks is one of these; the style fields they write are the ones below.
 */

/** The three page layouts, as `style.hero`. */
export const LAYOUTS = ["cover", "split", "editorial"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

/** The three grounds. Surface and text are not stored with them: clearing both
 *  lets the resolver derive cards and readable text from the ground. */
export const BACKGROUNDS = [
  { id: "light", hex: "#ffffff" },
  { id: "warm", hex: "#faf6f0" },
  { id: "dark", hex: "#0d0d10" },
] as const;
export type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

/** Eight accents, chosen to read as a button on all three grounds. */
export const ACCENTS = [
  { id: "ink", hex: "#161616" },
  { id: "orange", hex: "#c2410c" },
  { id: "red", hex: "#b91c1c" },
  { id: "rose", hex: "#be185d" },
  { id: "purple", hex: "#7e22ce" },
  { id: "blue", hex: "#1d4ed8" },
  { id: "teal", hex: "#0f766e" },
  { id: "green", hex: "#15803d" },
] as const;

/** The six named type styles. The operator never sees a face name or pairing. */
export const FONT_STYLES = [
  { id: "modern", heading: "jakarta", body: "jakarta", headingCase: "normal" },
  { id: "clean", heading: "sora", body: "inter", headingCase: "normal" },
  { id: "classic", heading: "playfair", body: "work-sans", headingCase: "normal" },
  { id: "elegant", heading: "cormorant", body: "lora", headingCase: "normal" },
  { id: "bold", heading: "archivo-black", body: "plex", headingCase: "normal" },
  { id: "poster", heading: "bebas", body: "figtree", headingCase: "upper" },
] as const;
export type FontStyleId = (typeof FONT_STYLES)[number]["id"];

/** The fields a font style writes. `headingWeight` is cleared so the face's own weight is used. */
export const fontStylePatch = (id: FontStyleId): PageStyle => {
  const f = FONT_STYLES.find((x) => x.id === id)!;
  return { headingFont: f.heading, bodyFont: f.body, headingCase: f.headingCase, headingWeight: undefined };
};

/** The fields a background writes: surface and text are cleared so they are derived. */
export const backgroundPatch = (id: BackgroundId): PageStyle => ({
  background: BACKGROUNDS.find((x) => x.id === id)!.hex,
  surface: undefined,
  text: undefined,
});

/*
 * LEGACY, dev only: `?ps=<id>` in src/app/s/_components/sf.tsx still reads
 * PRESETS. Nothing in the editor offers these any more.
 */
interface Palette {
  id: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

const PALETTES: Palette[] = [
  { id: "paper", primary: "#161616", secondary: "#c2410c", background: "#ffffff", surface: "#f6f6f4", text: "#161616" },
  { id: "matcha", primary: "#3f6b35", secondary: "#b07a1f", background: "#f6f4ec", surface: "#ffffff", text: "#1f2a1c" },
  { id: "clay", primary: "#a8462a", secondary: "#2f5d62", background: "#faf5ef", surface: "#ffffff", text: "#2b1d16" },
  { id: "ocean", primary: "#0f5e9c", secondary: "#e07a2f", background: "#f3f8fb", surface: "#ffffff", text: "#0d2233" },
  { id: "forest", primary: "#2e5e4e", secondary: "#b5793f", background: "#f5f1e8", surface: "#fffdf8", text: "#1d2b24" },
  { id: "sand", primary: "#8a5a2b", secondary: "#3d6b5a", background: "#fbf6ee", surface: "#fffaf2", text: "#2d2116" },
  { id: "rose", primary: "#be185d", secondary: "#c2770e", background: "#fff7f9", surface: "#ffffff", text: "#2a1420" },
  { id: "slate", primary: "#1d4ed8", secondary: "#0e7490", background: "#f8fafc", surface: "#ffffff", text: "#0f172a" },
  { id: "night-market", primary: "#ff6b35", secondary: "#ffd166", background: "#121212", surface: "#1c1c1c", text: "#f5f5f5" },
  { id: "neon", primary: "#b026ff", secondary: "#25f4ee", background: "#0b0b10", surface: "#16161d", text: "#f4f4f6" },
  { id: "floodlit", primary: "#2be07c", secondary: "#f5c518", background: "#0a0f0c", surface: "#131a16", text: "#eef3ef" },
  { id: "ink", primary: "#f4f1ea", secondary: "#e2a03f", background: "#16140f", surface: "#211e17", text: "#f4f1ea" },
];

const paletteById = (id: string | undefined) => PALETTES.find((p) => p.id === id);

/** The colours of a palette as style fields. */
const paletteStyle = (p: Palette): PageStyle => ({
  palette: p.id,
  primary: p.primary,
  secondary: p.secondary,
  background: p.background,
  surface: p.surface,
  text: p.text,
});

export interface Preset {
  id: string;
  style: PageStyle;
}

const P = (id: string): PageStyle => paletteStyle(paletteById(id)!);

/** Six complete starting points. Each differs from the others in its type,
 *  its shape AND its layout, not just its colour — the point is a page that
 *  could not be mistaken for the next venue's. */
export const PRESETS: Preset[] = [
  {
    id: "studio",
    style: {
      ...P("matcha"),
      headingFont: "fraunces", bodyFont: "dm-sans", headingWeight: 500, typeScale: "standard", headingCase: "normal",
      corners: "soft", buttonStyle: "solid", cardStyle: "bordered",
      hero: "split", heroHeight: "medium", overlay: 40, width: "standard", spacing: "standard", dividers: "none",
      gallery: "mosaic", texture: "grain", imageTone: "warm", iconStroke: "regular",
    },
  },
  {
    id: "editorial",
    style: {
      ...P("paper"),
      headingFont: "instrument", bodyFont: "inter", headingWeight: 400, typeScale: "large", headingCase: "normal",
      corners: "sharp", buttonStyle: "underline", cardStyle: "flat",
      hero: "editorial", heroHeight: "medium", overlay: 30, width: "narrow", spacing: "standard", dividers: "line",
      gallery: "grid", texture: "none", imageTone: "mono", iconStroke: "thin",
    },
  },
  {
    id: "night",
    style: {
      ...P("night-market"),
      headingFont: "syne", bodyFont: "inter", headingWeight: 700, typeScale: "standard", headingCase: "normal",
      corners: "round", buttonStyle: "pill", cardStyle: "tinted",
      hero: "cover", heroHeight: "tall", overlay: 55, width: "standard", spacing: "standard", dividers: "none",
      gallery: "strip", texture: "none", imageTone: "none", iconStroke: "regular",
    },
  },
  {
    id: "bright",
    style: {
      ...P("ocean"),
      headingFont: "jakarta", bodyFont: "jakarta", headingWeight: 800, typeScale: "standard", headingCase: "normal",
      corners: "round", buttonStyle: "pill", cardStyle: "shadow",
      hero: "split", heroHeight: "medium", overlay: 40, width: "wide", spacing: "tight", dividers: "none",
      gallery: "mosaic", texture: "dots", imageTone: "none", iconStroke: "bold",
    },
  },
  {
    id: "journal",
    style: {
      ...P("sand"),
      headingFont: "cormorant", bodyFont: "lora", headingWeight: 600, typeScale: "large", headingCase: "normal",
      corners: "soft", buttonStyle: "outline", cardStyle: "bordered",
      hero: "collage", heroHeight: "medium", overlay: 30, width: "narrow", spacing: "standard", dividers: "line",
      gallery: "grid", texture: "lines", imageTone: "warm", iconStroke: "thin",
    },
  },
  {
    id: "bold",
    style: {
      ...P("floodlit"),
      headingFont: "unbounded", bodyFont: "space-grotesk", headingWeight: 700, typeScale: "compact", headingCase: "upper",
      corners: "sharp", buttonStyle: "solid", cardStyle: "flat",
      hero: "cover", heroHeight: "short", overlay: 60, width: "wide", spacing: "tight", dividers: "line",
      gallery: "strip", texture: "none", imageTone: "duotone", iconStroke: "bold",
    },
  },
];

export const presetById = (id: string | undefined) => PRESETS.find((p) => p.id === id);

/* ── reading the current choice back from a resolved style ───────────────── */

/** Which named type style a resolved style is showing, if any. Read from the
 *  resolved heading face so an old page's look (a Poster look draws Bebas in
 *  capitals) shows the matching card selected. */
export function fontStyleOf(r: Pick<ResolvedStyle, "headingFont" | "headingCase">): FontStyleId | null {
  const id = fontIdFromCss(r.headingFont);
  if (!id) return null;
  const hit = FONT_STYLES.find((f) => f.heading === id && f.headingCase === r.headingCase) ?? FONT_STYLES.find((f) => f.heading === id);
  return hit?.id ?? null;
}

export const backgroundOf = (r: Pick<ResolvedStyle, "colours">): BackgroundId | null =>
  BACKGROUNDS.find((b) => b.hex === r.colours.ground.bg.toLowerCase())?.id ?? null;

export const accentOf = (r: Pick<ResolvedStyle, "colours">): string | null =>
  ACCENTS.find((a) => a.hex === r.colours.accent.toLowerCase())?.id ?? null;
