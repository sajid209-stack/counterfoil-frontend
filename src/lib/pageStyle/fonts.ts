import {
  Archivo_Black,
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Figtree,
  IBM_Plex_Sans,
  Instrument_Serif,
  Libre_Baskerville,
  Lora,
  Manrope,
  Plus_Jakarta_Sans,
  Sora,
  Unbounded,
  Work_Sans,
} from "next/font/google";
import { templateFontVars } from "@/lib/events/fonts";

/**
 * The typefaces an operator can set a public page in (docs/page-style.md §3).
 *
 * A short, curated list rather than all of Google Fonts: every face here has
 * been chosen to read well at body and heading sizes, and each has a reason to
 * exist beside the others. `preload: false` — a face is fetched only when a
 * page actually uses it, so offering twenty costs nothing on a page that uses
 * two. Bengali text falls back to Hind Siliguri in every stack.
 *
 * Load the faces by putting `pageFontVars` (a className) on any element that
 * contains a styled page or a font picker.
 */
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-dm-sans" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-manrope" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-jakarta" });
const sora = Sora({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-sora" });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-work-sans" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--pf-plex" });
const figtree = Figtree({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-figtree" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--pf-dm-serif" });
const instrument = Instrument_Serif({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--pf-instrument" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--pf-cormorant" });
const baskerville = Libre_Baskerville({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--pf-baskerville" });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-lora" });
const unbounded = Unbounded({ subsets: ["latin"], display: "swap", preload: false, variable: "--pf-unbounded" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--pf-archivo-black" });

export const pageFontVars = [
  templateFontVars,
  dmSans.variable,
  manrope.variable,
  jakarta.variable,
  sora.variable,
  workSans.variable,
  plex.variable,
  figtree.variable,
  dmSerif.variable,
  instrument.variable,
  cormorant.variable,
  baskerville.variable,
  lora.variable,
  unbounded.variable,
  archivoBlack.variable,
].join(" ");

export { FONTS, PAIRINGS, fontById, fontIdFromCss, type PageFont, type FontKind } from "./fontMeta";
