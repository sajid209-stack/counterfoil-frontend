import { Qr } from "./Qr";

export interface TicketCardData {
  business: string;
  productName: string;
  tierName?: string;
  dateLabel?: string; // "25 Aug 2026" or "25 Aug · 14:00"
  seatOrResource?: string; // "Seat A5" / "Lane 3" / "Rahim"
  admitsLabel?: string; // localized "Admits 4"
  code: string;
  /** localized "Present at the gate · scan to check in" */
  gateHint: string;
  /** localized "Booking reference" label */
  referenceLabel: string;
}

/** The printable visitor ticket — perforated ink/paper Counterfoil look with a
 *  real scannable QR. Mode-locked (literal ink/paper) so it reads under glare
 *  and prints identically in light or dark mode. */
export function TicketCard({ data, className }: { data: TicketCardData; className?: string }) {
  // On screen: branded ink/paper. In print: dark-on-white (printers often omit
  // background colours, which would hide white text) with a border for shape.
  return (
    <div className={`relative w-full max-w-sm break-inside-avoid print:border print:border-neutral-300 print:rounded-md ${className ?? ""}`}>
      {/* Top: identity + QR */}
      <div className="rounded-t-md bg-ink px-section pt-major pb-section text-paper print:bg-white print:text-black">
        <div className="flex items-start justify-between gap-section">
          <div className="min-w-0">
            <p className="type-label text-[12px] text-paper/60 print:text-neutral-500">{data.business}</p>
            <p className="mt-tight break-words text-lg font-semibold leading-tight">{data.productName}</p>
            {(data.tierName || data.admitsLabel) && (
              <p className="mt-inline font-mono text-[12px] text-paper/80 print:text-neutral-700">
                {[data.tierName, data.admitsLabel].filter(Boolean).join(" · ")}
              </p>
            )}
            {(data.dateLabel || data.seatOrResource) && (
              <p className="mt-inline font-mono text-[12px] text-paper/80 print:text-neutral-700">
                {[data.dateLabel, data.seatOrResource].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {/* QR must be dark-on-white to scan */}
          <div className="shrink-0 rounded-xs bg-white p-tight">
            <Qr value={data.code} size={92} />
          </div>
        </div>
      </div>

      {/* Perforation */}
      <div className="relative flex items-center bg-ink print:bg-white">
        <span className="absolute -left-2 h-4 w-4 rounded-full bg-surface print:bg-white" aria-hidden />
        <span className="absolute -right-2 h-4 w-4 rounded-full bg-surface print:bg-white" aria-hidden />
        <span className="mx-section flex-1 border-t-2 border-dashed border-paper/40 print:border-neutral-400" aria-hidden />
      </div>

      {/* Bottom: the code + gate hint */}
      <div className="rounded-b-md bg-ink px-section pt-section pb-major text-paper print:bg-white print:text-black">
        <p className="type-label text-[12px] text-paper/60 print:text-neutral-500">{data.referenceLabel}</p>
        <p className="mt-inline break-all font-mono text-xl tracking-tight">{data.code}</p>
        <p className="mt-tight font-mono text-[12px] text-paper/60 print:text-neutral-500">{data.gateHint}</p>
      </div>
    </div>
  );
}
