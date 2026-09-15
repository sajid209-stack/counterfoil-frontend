import type { CSSProperties } from "react";
import { Qr } from "./Qr";

export interface TicketField {
  label: string;
  value: string;
}

export interface TicketCardData {
  business: string;
  productName: string;
  /** The tier, only when it differs from the booking's own name ("Adult"). */
  tierName?: string;
  /** Date, time, where, guests — whichever this ticket has, in that order. */
  fields: TicketField[];
  /** localized "1 of 3", when the order issued more than one ticket. */
  indexLabel?: string;
  code: string;
  /** localized "Present at the gate · scan to check in" */
  gateHint: string;
  /** localized "Reservation reference" — names the code for assistive tech. */
  referenceLabel: string;
}

/** How deep each notch bites into the side of the ticket, where the stub tears off. */
const NOTCH = 12;

/** Two half-circle bites, one at each end of an edge, cut with a mask so they are real holes
 *  — the page shows through in any theme, and the card's drop shadow follows the shape. */
const bite = (edge: "top" | "bottom"): CSSProperties => {
  const y = edge === "top" ? "0" : "100%";
  const hole = (x: string) => `radial-gradient(circle ${NOTCH}px at ${x} ${y}, #0000 ${NOTCH - 0.5}px, #000 ${NOTCH}px)`;
  const mask = `${hole("0")}, ${hole("100%")}`;
  return { maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
};

/** On paper a notch is not a hole, only a gap in the printed border — so print draws one
 *  unbroken edge and leaves the dashed tear to mark the stub. `!` beats the inline mask. */
const PRINT_EDGE = "print:border print:border-neutral-300 print:[mask-image:none]! print:[-webkit-mask-image:none]!";

/**
 * The printable visitor ticket: black on white, like a boarding pass.
 *
 * The top says what it is for — the venue, the booking at display size, and a
 * small grid of the facts a guest checks (date, time, where, how many). A
 * dashed tear and two notches separate the stub, which carries the one thing
 * the gate needs: a large QR and the code under it.
 *
 * Mode-locked to literal white and near-black, so it reads under glare, looks
 * the same in either theme and prints exactly as it appears.
 */
export function TicketCard({ data, className }: { data: TicketCardData; className?: string }) {
  return (
    <article
      aria-label={`${data.productName} · ${data.code}`}
      className={`w-full max-w-sm break-inside-avoid text-neutral-950 [filter:drop-shadow(0_1px_1px_rgba(20,20,19,0.06))_drop-shadow(0_18px_36px_rgba(20,20,19,0.12))] print:[filter:none] ${className ?? ""}`}
    >
      {/* What it is for */}
      <div style={bite("bottom")} className={`@container rounded-t-[20px] bg-white px-6 pb-7 pt-6 ${PRINT_EDGE} print:border-b-0`}>
        <div className="flex items-baseline justify-between gap-4 text-[13px] font-medium text-neutral-600">
          <span className="min-w-0 break-words">{data.business}</span>
          {data.indexLabel && <span className="shrink-0">{data.indexLabel}</span>}
        </div>
        <h2 className="mt-5 break-words text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] [text-wrap:balance]">{data.productName}</h2>
        {data.tierName && <p className="mt-1 text-[15px] text-neutral-600">{data.tierName}</p>}
        {data.fields.length > 0 && (
          // Two columns once the card has room for a date beside a time; one on the narrowest phones,
          // so a place like "Championship Court 1" wraps at its spaces instead of mid-word.
          <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 @min-[17.5rem]:grid-cols-2">
            {data.fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-neutral-600">{field.label}</dt>
                <dd className="mt-1 break-words text-[16px] font-semibold leading-snug">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* The stub: what the gate scans */}
      <div style={bite("top")} className={`relative rounded-b-[20px] bg-white px-6 pb-6 pt-7 ${PRINT_EDGE} print:border-t-0`}>
        <span aria-hidden className="absolute top-0 border-t-[1.5px] border-dashed border-neutral-300" style={{ left: NOTCH + 8, right: NOTCH + 8 }} />
        <div className="flex flex-col items-center text-center">
          <Qr value={data.code} size={168} />
          <p className="mt-4 break-all font-mono text-[17px] font-medium tracking-[-0.01em]">
            <span className="sr-only">{data.referenceLabel}: </span>
            {data.code}
          </p>
          <p className="mt-1.5 text-[13px] text-neutral-600">{data.gateHint}</p>
        </div>
      </div>
    </article>
  );
}
