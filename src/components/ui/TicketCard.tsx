import type { CSSProperties, ReactNode } from "react";
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

/** How deep each notch bites into the side of the ticket. */
const NOTCH = 12;

/** Half-circle bites at both ends of the given edges, cut with a mask so they are real holes:
 *  the page shows through in any theme and the card's drop shadow follows the shape. */
const bite = (...edges: ("top" | "bottom")[]): CSSProperties => {
  const hole = (x: string, y: string) => `radial-gradient(circle ${NOTCH}px at ${x} ${y}, #0000 ${NOTCH - 0.5}px, #000 ${NOTCH}px)`;
  const mask = edges.flatMap((edge) => [hole("0", edge === "top" ? "0" : "100%"), hole("100%", edge === "top" ? "0" : "100%")]).join(", ");
  return { maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
};

/** On paper a notch is not a hole, only a gap in the printed border — so print draws one unbroken
 *  edge and leaves the dashed tear to mark the stub. `!` beats the inline mask. */
const PRINT_EDGE = "print:border print:border-neutral-300 print:[mask-image:none]! print:[-webkit-mask-image:none]!";

/** FNV-1a, then xorshift: a small, stable stream of numbers from a string. */
function stream(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let x = h >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/**
 * The ticket's art: a field of quarter discs, half discs, dots and rings, drawn from the ticket's
 * own code. It is the one thing on the ticket that is not information — but it is not arbitrary
 * either: the same code always draws the same art, and no two tickets in an order look alike,
 * so a guest can tell their ticket from their friend's at a glance.
 */
function TicketArt({ seed }: { seed: string }) {
  const next = stream(seed);
  const S = 40;
  const COLS = 9;
  const ROWS = 4;
  const id = `ticket-art-${seed.replace(/[^A-Za-z0-9]/g, "")}`;
  const shapes: ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * S;
      const y = row * S;
      const k = `${col}-${row}`;
      switch (Math.floor(next() * 8)) {
        case 0: shapes.push(<path key={k} d={`M${x} ${y}H${x + S}A${S} ${S} 0 0 1 ${x} ${y + S}Z`} />); break;
        case 1: shapes.push(<path key={k} d={`M${x + S} ${y}V${y + S}A${S} ${S} 0 0 1 ${x} ${y}Z`} />); break;
        case 2: shapes.push(<path key={k} d={`M${x + S} ${y + S}H${x}A${S} ${S} 0 0 1 ${x + S} ${y}Z`} />); break;
        case 3: shapes.push(<path key={k} d={`M${x} ${y + S}V${y}A${S} ${S} 0 0 1 ${x + S} ${y + S}Z`} />); break;
        case 4: shapes.push(<circle key={k} cx={x + S / 2} cy={y + S / 2} r={S * 0.26} />); break;
        case 5: shapes.push(<path key={k} d={`M${x} ${y + S}A${S / 2} ${S / 2} 0 0 1 ${x + S} ${y + S}Z`} />); break;
        case 6: shapes.push(<circle key={k} cx={x + S / 2} cy={y + S / 2} r={S * 0.3} fill="none" stroke="#fff" strokeWidth={3} />); break;
        default: break;
      }
    }
  }
  return (
    <svg aria-hidden viewBox={`0 0 ${COLS * S} ${ROWS * S}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-x-0 top-0 h-[136px] w-full">
      <defs>
        {/* Fully gone well before the bottom edge, so the art dissolves into the black instead of stopping on a line. */}
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.2" stopColor="#fff" />
          <stop offset="0.82" stopColor="#000" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width={COLS * S} height={ROWS * S} fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      {/* A hairline stroke lets neighbouring tiles overlap, so no seam shows where two shapes meet. */}
      <g fill="#fff" stroke="#fff" strokeWidth={0.8} mask={`url(#${id}-mask)`}>
        {shapes}
      </g>
    </svg>
  );
}

/**
 * The printable visitor ticket, in black and white.
 *
 * Three parts, the way a paper ticket is built: a black top with the ticket's
 * art and the booking at display size; a white body with the facts a guest
 * checks; and a stub, torn off at the dashed line, with the QR the gate scans.
 *
 * Mode-locked to literal black and white, so it looks the same in either theme
 * and prints as it appears (the black top asks the printer to keep its fill).
 */
export function TicketCard({ data, className }: { data: TicketCardData; className?: string }) {
  return (
    <article
      aria-label={`${data.productName} · ${data.code}`}
      className={`w-full max-w-sm break-inside-avoid text-neutral-950 [filter:drop-shadow(0_1px_1px_rgba(20,20,19,0.06))_drop-shadow(0_18px_36px_rgba(20,20,19,0.14))] print:[filter:none] ${className ?? ""}`}
    >
      {/* Top: the art and what the ticket is for */}
      <div
        style={bite("bottom")}
        className={`relative overflow-hidden rounded-t-[24px] bg-black text-white dark:ring-1 dark:ring-inset dark:ring-white/10 [print-color-adjust:exact] [-webkit-print-color-adjust:exact] ${PRINT_EDGE} print:border-b-0`}
      >
        <TicketArt seed={data.code} />
        <div className="relative px-6 pb-7 pt-5">
          <span className="inline-flex max-w-full items-center rounded-full bg-black px-3 py-1 text-[12px] font-medium text-white ring-1 ring-white/25">
            <span className="min-w-0 break-words">{data.business}</span>
          </span>
          <h2 className="mt-[88px] break-words text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] [text-wrap:balance]">{data.productName}</h2>
        </div>
      </div>

      {/* Body: the facts a guest checks */}
      <div style={bite("top", "bottom")} className={`@container bg-white px-6 pb-6 pt-5 ${PRINT_EDGE} print:border-y-0`}>
        {(data.tierName || data.indexLabel) && (
          <div className="mb-5 flex items-center justify-between gap-3">
            {data.tierName ? <span className="rounded-full bg-neutral-100 px-3 py-1 text-[12px] font-medium">{data.tierName}</span> : <span />}
            {data.indexLabel && <span className="shrink-0 text-[12px] font-medium text-neutral-600">{data.indexLabel}</span>}
          </div>
        )}
        {data.fields.length > 0 && (
          // Two columns once the card has room for a date beside a time; one on the narrowest
          // phones, so a place like "Championship Court 1" wraps at its spaces instead of mid-word.
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 @min-[17.5rem]:grid-cols-2">
            {data.fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[12px] font-medium uppercase tracking-[0.06em] text-neutral-600">{field.label}</dt>
                <dd className="mt-1 break-words text-[15px] font-semibold leading-snug">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Stub: what the gate scans, torn off at the dashed line */}
      <div style={bite("top")} className={`@container relative rounded-b-[24px] bg-white px-6 pb-6 pt-6 ${PRINT_EDGE} print:border-t-0`}>
        <span aria-hidden className="absolute top-0 border-t-[1.5px] border-dashed border-neutral-300" style={{ left: NOTCH + 8, right: NOTCH + 8 }} />
        <div className="flex flex-col items-center gap-4 text-center @min-[19rem]:flex-row @min-[19rem]:text-left">
          <span className="shrink-0">
            <Qr value={data.code} size={116} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-neutral-600">{data.referenceLabel}</p>
            <p className="mt-1 break-all font-mono text-[15px] font-medium">{data.code}</p>
            <p className="mt-2 text-[13px] leading-snug text-neutral-600">{data.gateHint}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
