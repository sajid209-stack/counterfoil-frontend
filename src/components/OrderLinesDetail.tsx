"use client";

import { formatMoney } from "@/lib/format";
import type { Order, OrderLine } from "@/lib/api";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", card_terminal: "Card", bkash: "bKash", bangla_qr: "QR", voucher: "Voucher", credit: "Credit",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** F11 §8 — the transaction detail: parent lines with their booking meta,
 *  add-ons indented underneath, per-line discounts on their own line, the
 *  footer math, and every payment. Money and times in DM Mono, right-aligned.
 *  Renders in full on the order page and inside expandable transaction rows. */
export function OrderLinesDetail({ order, compact = false }: { order: Pick<Order, "lines" | "subtotal" | "lineDiscountTotal" | "orderDiscount" | "discountTotal" | "taxTotal" | "total" | "payments">; compact?: boolean }) {
  const parents = order.lines.filter((l) => !l.parentLineId);
  const childrenOf = (id: string) => order.lines.filter((l) => l.parentLineId === id);
  const money = "shrink-0 whitespace-nowrap text-right font-mono tabular-nums";

  const lineMeta = (l: OrderLine) => {
    const parts: string[] = [];
    if (l.booking) {
      const when = [prettyDate(l.booking.date), l.booking.startTime && l.booking.endTime ? `${l.booking.startTime}–${l.booking.endTime}` : l.booking.startTime].filter(Boolean).join(" · ");
      if (when) parts.push(when);
    }
    parts.push(`${l.quantity} × ${formatMoney(l.unitPrice)}`);
    if (l.booking?.providerName) parts.push(l.booking.providerName);
    return parts.join(" · ");
  };

  const refunded = (l: OrderLine) => l.refundedQuantity > 0;

  return (
    <div className={compact ? "text-[13px]" : "text-sm"}>
      {parents.map((l) => (
        <div key={l.id} className="border-b border-line py-tight last:border-0">
          <div className="flex items-baseline justify-between gap-tight">
            <span className={`min-w-0 break-words font-medium line-clamp-2 ${refunded(l) ? "text-faint line-through" : ""}`}>
              {l.productName}
              {l.booking?.resourceName ? ` — ${l.booking.resourceName}` : l.tierName && l.tierName !== l.productName && l.quantity === 1 && !l.tierId ? ` — ${l.tierName}` : ""}
            </span>
            <span className={`${money} ${refunded(l) ? "text-faint line-through" : ""}`}>{formatMoney(l.subtotal)}</span>
          </div>
          <p className="font-mono text-[11px] text-faint">{l.tierId ? `${l.quantity} ${l.tierName} × ${formatMoney(l.unitPrice)}` : lineMeta(l)}</p>
          {l.lineDiscount > 0 && (
            <div className="flex justify-between font-mono text-[12px] text-danger">
              <span>Line discount</span><span className={money}>−{formatMoney(l.lineDiscount)}</span>
            </div>
          )}
          {refunded(l) && <p className="font-mono text-[11px] text-danger">Refunded {l.refundedQuantity} × · −{formatMoney(l.refundedAmount)}</p>}
          {childrenOf(l.id).map((c) => (
            <div key={c.id} className="mt-inline flex items-baseline justify-between gap-tight pl-section">
              <span className="min-w-0 break-words text-muted line-clamp-2">↳ {c.productName} · <span className="font-mono text-[12px]">{c.quantity} × {formatMoney(c.unitPrice)}</span></span>
              <span className={`${money} text-[13px]`}>{formatMoney(c.subtotal)}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="mt-tight flex flex-col gap-inline">
        <div className="flex justify-between text-muted"><span>Subtotal</span><span className={money}>{formatMoney(order.subtotal)}</span></div>
        {(order.lineDiscountTotal ?? 0) > 0 && <div className="flex justify-between text-muted"><span>Line discounts</span><span className={`${money} text-danger`}>−{formatMoney(order.lineDiscountTotal)}</span></div>}
        {(order.orderDiscount ?? 0) > 0 && (
          <div className="flex justify-between text-muted">
            <span>Discount{order.subtotal > 0 ? ` ${Math.round((order.orderDiscount / Math.max(1, order.subtotal - (order.lineDiscountTotal ?? 0))) * 100)}%` : ""}</span>
            <span className={`${money} text-danger`}>−{formatMoney(order.orderDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted"><span>VAT</span><span className={money}>{formatMoney(order.taxTotal ?? 0)}</span></div>
        <div className="flex justify-between font-medium"><span>Total</span><span className={money}>{formatMoney(order.total)}</span></div>
      </div>

      {order.payments.length > 0 && (
        <p className="mt-tight border-t border-line pt-tight font-mono text-[12px] text-muted">
          Paid&nbsp;&nbsp;{order.payments.filter((p) => p.amount > 0).map((p) => `${METHOD_LABEL[p.method] ?? p.method} ${formatMoney(p.amount)}`).join(" · ")}
          {order.payments.some((p) => p.amount < 0) && (
            <span className="text-danger"> · Refunded {formatMoney(-order.payments.filter((p) => p.amount < 0).reduce((s, p) => s + p.amount, 0))}</span>
          )}
        </p>
      )}
    </div>
  );
}
