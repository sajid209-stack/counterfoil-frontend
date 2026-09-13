import { Bebas_Neue, Fraunces, Outfit, Playfair_Display, Space_Grotesk, Syne } from "next/font/google";

/**
 * Typefaces for the published event templates — NOT for the dashboard.
 *
 * next/font scopes a face to the modules that import it, so these ship only in
 * the bundles for the event routes rather than on every OS screen. Inter and
 * DM Mono are already global and are offered in the customiser too, so the
 * seven choices cost five extra faces rather than seven.
 *
 * They exist because six themes that all set the same face are not six themes.
 * A club flyer and a gallery invitation differ in their letterforms before they
 * differ in anything else.
 */
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400", display: "swap" });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap" });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });
/* Fraunces is a SOFT, low-contrast serif with a deliberate wobble to it — the
   opposite animal to Playfair's high-contrast Didone, and the reason the travel
   template reads as an expedition journal rather than a landing page. */
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });

/** Put this on any element that contains a template preview. */
export const templateFontVars = [
  bebas.variable,
  syne.variable,
  spaceGrotesk.variable,
  playfair.variable,
  outfit.variable,
  fraunces.variable,
].join(" ");
