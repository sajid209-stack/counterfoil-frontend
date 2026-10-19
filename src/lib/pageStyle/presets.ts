import type { PageStyle } from "@/lib/api/types";

/**
 * Named palettes and complete starting styles (docs/page-style.md §4).
 *
 * A palette is five colours that have been tried together. A preset is a whole
 * style — palette, type pair, shape and layout — so an operator starts from a
 * page somebody designed rather than from a blank one, then changes what they
 * like. Ids are stored on the record (`PageStyle.palette` / `.preset`) only so
 * the editor can show which one is in use; the colours themselves are copied.
 */
export interface Palette {
  id: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

export const PALETTES: Palette[] = [
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

export const paletteById = (id: string | undefined) => PALETTES.find((p) => p.id === id);

/** The colours of a palette as style fields. */
export const paletteStyle = (p: Palette): PageStyle => ({
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
