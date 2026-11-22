import { stripMetrics, type ReceiptPaper } from "./types";

/**
 * The `@page` rule for the chosen paper, and the print overrides of the strip.
 *
 * A roll prints with no page margin and no forced height: the printer driver
 * knows the roll and cuts where the content ends. The strip itself shrinks to
 * the printable column (72 mm on an 80 mm roll), without its on-screen shadow
 * and side margin. A4 gets a 14 mm margin and the full 180 mm column.
 */
export function ReceiptPrintStyle({ paper }: { paper: ReceiptPaper }) {
  const { column } = stripMetrics(paper);
  const css =
    paper === "a4"
      ? `@page { size: A4 portrait; margin: 14mm } @media print { .rcpt-strip { width: ${column}mm !important; max-width: none !important; padding: 0 !important; box-shadow: none !important; } }`
      : `@page { margin: 0 } @media print { html, body { background: white !important; } .rcpt-strip { width: ${column}mm !important; max-width: none !important; padding: 3mm 0 !important; box-shadow: none !important; } }`;
  return <style>{css}</style>;
}
