import { ReceiptInvoice, ReceiptRoll } from "@/components/ReceiptParts";
import { ReceiptPrintStyle } from "@/components/receipt/PrintStyle";
import { stripMetrics, type ReceiptData } from "@/components/receipt/types";
import { cn } from "@/lib/cn";

/**
 * An order's receipt as a sheet of paper: a roll strip (80 mm or 58 mm) or an
 * A4 invoice page, sized in millimetres so the screen shows what will print.
 *
 * On screen the strip is white paper with a soft shadow, centred on the page
 * surface; the `paper` class pins dark-on-white in either theme. Printing
 * drops the shadow and the side margin and writes the `@page` rule for the
 * paper (see ReceiptPrintStyle).
 */
export function ReceiptSheet({ data, className, printStyle = true }: { data: ReceiptData; className?: string; printStyle?: boolean }) {
  const { paper } = data.settings;
  const { column, pad } = stripMetrics(paper);
  return (
    <>
      {printStyle && <ReceiptPrintStyle paper={paper} />}
      <article
        aria-label={data.order.reference}
        className={cn("paper rcpt-strip mx-auto bg-white text-fg shadow-float", paper === "a4" ? "rounded-sm" : "rounded-inner", className)}
        style={{ width: `${column + pad * 2}mm`, maxWidth: "100%", padding: `${paper === "a4" ? 15 : 6}mm ${pad}mm` }}
      >
        {paper === "a4" ? <ReceiptInvoice data={data} /> : <ReceiptRoll data={data} />}
      </article>
    </>
  );
}
