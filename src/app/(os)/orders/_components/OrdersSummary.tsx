"use client";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

/**
 * What the filtered set is worth, above the rows that make it up.
 *
 * The page listed 151 orders and stated no money at all — the one question an
 * orders list exists to answer was the one it left you to work out by reading
 * a column. These four are computed over **everything the filters match**, not
 * over the twelve rows on screen, because "pending" is worth asking about
 * precisely when you want the total of all of it.
 *
 * Cancelled and refunded orders are excluded from every money figure. Refunds
 * post as negative payments so they mostly net out on their own, but a full
 * refund taken through `refundOrder` only flips the status — counting those
 * would report money the venue gave back as money it took.
 */
export function OrdersSummary({
  collected,
  orders,
  average,
  outstanding,
  labels,
  compact = false,
  loading = false,
}: {
  collected: number;
  orders: number;
  average: number;
  outstanding: number;
  labels: {
    collected: string;
    orders: string;
    average: string;
    outstanding: string;
    /** The caveat on the money, or null when nothing was excluded. */
    excluded: string | null;
  };
  compact?: boolean;
  loading?: boolean;
}) {
  const cards = [
    {
      key: "collected",
      label: labels.collected,
      value: formatMoney(collected),
      // The caveat belongs against the figure it qualifies, not as a sentence
      // under the whole row where it cost a line and pointed at nothing.
      note: labels.excluded,
    },
    { key: "orders", label: labels.orders, value: String(orders), note: null },
    { key: "average", label: labels.average, value: orders === 0 ? "—" : formatMoney(average), note: null },
    {
      key: "outstanding",
      label: labels.outstanding,
      value: formatMoney(outstanding),
      note: null,
      // The only one of the four that is a problem rather than a fact, and
      // only when it is not zero.
      alert: outstanding > 0,
    },
  ];

  return (
    <div
      className={cn(
        compact
          ? // Scrolls rather than wraps: two rows of cards on a phone push the
            // first order below the fold, which defeats the point of a summary.
            "-mx-comfortable flex gap-tight overflow-x-auto px-comfortable pb-inline [scrollbar-width:none]"
          : "grid grid-cols-2 gap-tight lg:grid-cols-4 lg:gap-comfortable",
      )}
    >
      {cards.map((c) => (
        <div
          key={c.key}
          className={cn(
            // Top-aligned, not centred: only one card carries a caveat line, and
            // centring made its figure sit 13px above the other three so the
            // four numbers no longer shared a baseline.
            "card-surface flex min-h-[4.75rem] flex-col justify-start gap-tight px-comfortable py-comfortable",
            compact && "min-w-[10rem] shrink-0",
          )}
        >
          <span className="type-label truncate text-[12px] text-muted">{c.label}</span>
          {loading ? (
            <span className="h-7 w-24 animate-pulse rounded-xs bg-line" />
          ) : (
            <span
              className={cn(
                "text-2xl font-semibold tracking-tight tabular-nums",
                c.alert && "text-warning",
              )}
            >
              {c.value}
            </span>
          )}
          {c.note && !loading && (
            <span className="truncate text-[12px] text-muted" title={c.note}>
              {c.note}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
