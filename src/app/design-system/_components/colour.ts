/**
 * Colour maths for the contrast readouts.
 *
 * A computed custom property comes back as whatever syntax the stylesheet used
 * (`#f5f2eb`, `rgb(…)`, `color-mix(…)`), so a regex is not a colour parser —
 * the one place that knows every syntax is the browser's canvas, which
 * normalises any CSS colour to RGBA when it is painted. Client-only.
 */

export type Rgba = [number, number, number, number];

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, Rgba | null>();

export function parseColour(css: string): Rgba | null {
  const key = css.trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  if (ctx === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    ctx = c.getContext("2d", { willReadFrequently: true });
  }
  let out: Rgba | null = null;
  if (ctx) {
    ctx.clearRect(0, 0, 1, 1);
    // An invalid colour is ignored by the setter, which would leave the
    // previous one in place — so seed a sentinel that cannot be a real answer.
    // ds-exception: a sentinel for the colour parser, never painted on screen
    ctx.fillStyle = "rgb(1, 2, 3)";
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const unchanged = d[0] === 1 && d[1] === 2 && d[2] === 3 && d[3] === 255;
    out = unchanged ? null : [d[0], d[1], d[2], d[3] / 255];
  }
  cache.set(key, out);
  return out;
}

/** `fg` laid over an opaque `bg`. */
const over = (fg: Rgba, bg: Rgba): [number, number, number] => [
  fg[0] * fg[3] + bg[0] * (1 - fg[3]),
  fg[1] * fg[3] + bg[1] * (1 - fg[3]),
  fg[2] * fg[3] + bg[2] * (1 - fg[3]),
];

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of `fg` on `bg` (a translucent `fg` is composited over `bg`). */
export function contrast(fgCss: string, bgCss: string): number | null {
  const fg = parseColour(fgCss);
  const bg = parseColour(bgCss);
  if (!fg || !bg) return null;
  const l1 = luminance(over(fg, [bg[0], bg[1], bg[2], 1]));
  const l2 = luminance([bg[0], bg[1], bg[2]]);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** "4.58:1" */
export const ratioLabel = (r: number | null) => (r == null ? "—" : `${r.toFixed(2)}:1`);

/** "#f5f2eb" for any CSS colour, so a swatch can print what it is. */
export function hexOf(css: string): string | null {
  const c = parseColour(css);
  if (!c) return null;
  const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}${c[3] < 0.995 ? h(c[3] * 255) : ""}`;
}
