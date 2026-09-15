import type { CSSProperties } from "react";
import { Qr } from "./Qr";

export interface TicketField {
  label: string;
  value: string;
}

export interface TicketCardData {
  business: string;
  productName: string;
  /** The tier, only when the booking's own name does not already say it ("Adult"). */
  tierName?: string;
  /** Date, time, where, guests, holder — whichever this ticket has, in that order. */
  fields: TicketField[];
  /** localized "1 of 3", when the order issued more than one ticket. */
  indexLabel?: string;
  code: string;
  /** localized "Present at the gate · scan to check in" */
  gateHint: string;
  /** localized "Reservation reference" */
  referenceLabel: string;
}

/** How deep each notch bites into the side of the ticket, where the stub tears off. */
const NOTCH = 12;

/** Half-circle bites at both ends of an edge, cut with a mask so they are real holes: the page
 *  shows through in any theme and the card's drop shadow follows the shape. */
const bite = (edge: "top" | "bottom"): CSSProperties => {
  const y = edge === "top" ? "0" : "100%";
  const hole = (x: string) => `radial-gradient(circle ${NOTCH}px at ${x} ${y}, #0000 ${NOTCH - 0.5}px, #000 ${NOTCH}px)`;
  const mask = `${hole("0")}, ${hole("100%")}`;
  return { maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
};

/** On paper a notch is not a hole, only a gap in the printed border — so print draws one unbroken
 *  edge and leaves the dashed tear to mark the stub. `!` beats the inline mask. */
const PRINT_EDGE = "print:border print:border-neutral-300 print:[mask-image:none]! print:[-webkit-mask-image:none]!";

/**
 * The printable visitor ticket: white, black type, nothing decorative.
 *
 * The top says what it is for — the tier as a chip, the booking, the venue
 * under it, then a hairline and the facts a guest checks as quiet labels over
 * bold values. A dashed tear and two notches separate the stub, which carries
 * the one thing the gate needs: the QR, beside the code it encodes.
 *
 * Mode-locked to literal white and near-black, so it reads under glare, looks
 * the same in either theme and prints exactly as it appears.
 */
export function TicketCard({ data, className }: { data: TicketCardData; className?: string }) {
  return (
    <article
      aria-label={`${data.productName} · ${data.code}`}
      className={`w-full max-w-sm break-inside-avoid text-neutral-950 [filter:drop-shadow(0_1px_1px_rgba(20,20,19,0.06))_drop-shadow(0_16px_32px_rgba(20,20,19,0.10))] print:[filter:none] ${className ?? ""}`}
    >
      {/* What it is for */}
      <div style={bite("bottom")} className={`@container rounded-t-[24px] bg-white px-6 pb-6 pt-6 ${PRINT_EDGE} print:border-b-0`}>
        {(data.tierName || data.indexLabel) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {data.tierName ? <span className="rounded-full bg-neutral-100 px-3 py-1 text-[12px] font-medium">{data.tierName}</span> : <span />}
            {data.indexLabel && <span className="shrink-0 text-[12px] font-medium text-neutral-600">{data.indexLabel}</span>}
          </div>
        )}
        <h2 className="break-words text-[22px] font-semibold leading-tight tracking-[-0.015em] [text-wrap:balance]">{data.productName}</h2>
        <p className="mt-1 break-words text-[14px] text-neutral-600">{data.business}</p>
        {data.fields.length > 0 && (
          // Two columns once the card has room for a date beside a time; one on the narrowest
          // phones, so a place like "Championship Court 1" wraps at its spaces instead of mid-word.
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-neutral-200 pt-5 @min-[17.5rem]:grid-cols-2">
            {data.fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[13px] text-neutral-600">{field.label}</dt>
                <dd className="mt-0.5 break-words text-[15px] font-semibold leading-snug">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* The stub: what the gate scans */}
      <div style={bite("top")} className={`@container relative rounded-b-[24px] bg-white px-6 pb-6 pt-6 ${PRINT_EDGE} print:border-t-0`}>
        <span aria-hidden className="absolute top-0 border-t-[1.5px] border-dashed border-neutral-300" style={{ left: NOTCH + 8, right: NOTCH + 8 }} />
        <div className="flex flex-col items-center gap-4 text-center @min-[19rem]:flex-row @min-[19rem]:text-left">
          <span className="shrink-0">
            <Qr value={data.code} size={112} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-neutral-600">{data.referenceLabel}</p>
            <p className="mt-0.5 break-all font-mono text-[15px] font-medium">{data.code}</p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">{data.gateHint}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
