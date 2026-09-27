import JsBarcode from "jsbarcode";

/**
 * A ticket code as a 1D barcode, for the scanner a venue already owns.
 *
 * The gate reads QR with a camera, which is right for a phone and wrong for
 * the hardware most counters in Bangladesh actually have: a cheap laser
 * handheld reads linear symbologies and cannot see a QR at all. So a ticket
 * can carry either, or both, and this is the half that was missing.
 *
 * **Code 39**, not Code 128: it needs no check digit, every scanner ever made
 * reads it, and its character set — digits, capitals and the hyphen — is
 * exactly what a Counterfoil reference is made of. The cost is width, which a
 * ticket stub has and a shelf label would not.
 *
 * The encoding comes from `jsbarcode` rather than a table written here. A
 * symbology table is the kind of thing that is wrong in one character and
 * silently unreadable for months; this is the same reason `Qr` leans on
 * `qrcode`. Its object renderer is synchronous and needs no DOM, so this runs
 * on the server and the bars are in the HTML rather than appearing after
 * hydration — which matters, because these pages print themselves on load.
 */

/** Code 39 carries these and nothing else. */
const CODE39 = /^[0-9A-Z\-. $/+%]*$/;

/** What a code has to become before Code 39 will take it. */
export function forBarcode(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "-");
}

/**
 * The bar pattern as runs of equal-width units: `1` is ink, `0` is paper.
 * Empty when the value cannot be drawn, so a caller draws nothing rather than
 * something that will not scan.
 */
export function barcodePattern(value: string): string {
  const text = forBarcode(value);
  if (!text || !CODE39.test(text)) return "";
  const out: { encodings?: { data: string }[] } = {};
  try {
    /* No mod-43 check digit: it is optional in Code 39, most scanners are
       not configured to verify it, and a reference that already carries its
       own year and sequence does not need a second one. */
    JsBarcode(out, text, { format: "CODE39" });
  } catch {
    return "";
  }
  return out.encodings?.[0]?.data ?? "";
}

/** The runs in a pattern, as widths — what an SVG needs to draw it. */
export function barcodeBars(pattern: string): { x: number; width: number }[] {
  const bars: { x: number; width: number }[] = [];
  let i = 0;
  while (i < pattern.length) {
    let j = i;
    while (j < pattern.length && pattern[j] === pattern[i]) j++;
    if (pattern[i] === "1") bars.push({ x: i, width: j - i });
    i = j;
  }
  return bars;
}
