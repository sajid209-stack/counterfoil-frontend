"use client";

import { useTranslations } from "next-intl";
import { Qr } from "@/components/ui";
import { orderDue, orderNetPaid } from "@/lib/api";
import type { OrderLine } from "@/lib/api/types";
import { formatClock, formatClockOf, formatClockRange, formatDate, formatDay, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { logoWidthMm, receiptType, type ReceiptData } from "@/components/receipt/types";

/*
 * Every part of a printed receipt, drawn once.
 *
 * The receipt page, the receipt-with-tickets strip, the A4 invoice and the
 * preview in Settings → Business profile all assemble these, so what an
 * operator sees while choosing a logo or a footer is exactly what the paper
 * says — a preview built separately drifts the first time one of the two is
 * changed.
 *
 * Paper is paper: dark ink on white, no fills, dashed rules like a thermal
 * roll. The `paper` class on the sheet pins the light colours in either theme.
 */

const NUM = "shrink-0 whitespace-nowrap text-right tabular-nums";

/** The dashed tear-line rule between sections of a roll. */
export function ReceiptRule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("my-tight border-t border-dashed border-fg-secondary", className)} />;
}

function Row({ label, value, className, strong }: { label: React.ReactNode; value: React.ReactNode; className?: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-tight", strong && "font-semibold", className)}>
      <span className="min-w-0 break-words">{label}</span>
      <span className={NUM}>{value}</span>
    </div>
  );
}

/** "2 × ৳1,500.00 ........ ৳3,000.00": the quantity sum on the left, the line's money on the right. */
function Leader({ left, right, className }: { left: React.ReactNode; right: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline gap-inline", className)}>
      <span className="min-w-0 shrink-0 tabular-nums">{left}</span>
      <span aria-hidden className="min-w-3 flex-1 -translate-y-0.5 border-b border-dotted border-fg-secondary" />
      <span className={NUM}>{right}</span>
    </div>
  );
}

const percent = (rate: number) => `${+(rate * 100).toFixed(2)}`;

/** The business name, venue, contact and tax line: the part of every receipt that says who sold it. */
export function ReceiptBusiness({ data, align = "center" }: { data: ReceiptData; align?: "center" | "start" }) {
  const t = useTranslations("ticket");
  const { operator, place, settings } = data;
  const ty = receiptType(settings.paper);
  const address = place ? [place.name, [place.addressLine1, place.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ") : "";
  const contact = [operator.contactPhone, operator.website].filter(Boolean).join(" · ");
  const reg = taxRegLine(data, t);
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <p className={cn("break-words font-semibold leading-snug", ty.name)}>{operator.name}</p>
      {address && <p className={cn("mt-inline break-words", ty.meta)}>{address}</p>}
      {contact && <p className={cn("break-words", ty.meta)}>{contact}</p>}
      {reg && <p className={cn("break-words", ty.meta)}>{reg}</p>}
    </div>
  );
}

function taxRegLine(data: ReceiptData, t: ReturnType<typeof useTranslations>) {
  const { tax } = data;
  return tax?.showOnReceipts && tax.registrationNumber ? t("taxReg", { name: tax.taxName || "VAT", number: tax.registrationNumber }) : "";
}

/** True when the seller's tax number prints: the document is then a tax invoice, not a plain receipt. */
export const isTaxInvoice = (data: ReceiptData) => !!(data.tax?.showOnReceipts && data.tax.registrationNumber);

/** The logo, when it is switched on and there is one. Black on thermal paper, so greyscale on screen too. */
export function ReceiptLogo({ data, className }: { data: ReceiptData; className?: string }) {
  const { operator, settings } = data;
  if (!settings.showLogo || !operator.logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a stored data URL or a path; next/image adds nothing on paper
    <img
      src={operator.logo}
      alt={operator.name}
      className={cn("block h-auto object-contain grayscale", className)}
      style={{ width: `${logoWidthMm(settings)}mm`, maxWidth: "100%", maxHeight: "22mm" }}
    />
  );
}

function customerOf(data: ReceiptData) {
  if (!data.settings.showCustomer) return null;
  const name = data.order.customerName?.trim();
  const phone = data.customerPhone?.trim();
  return name || phone ? { name, phone } : null;
}

/** The key/value block under the title: receipt number, when, who served, who bought. */
function ReceiptFacts({ data, number }: { data: ReceiptData; number: string }) {
  const t = useTranslations("ticket.receipt");
  const { order, settings, cashier, counter } = data;
  const ty = receiptType(settings.paper);
  const customer = customerOf(data);
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: number, value: <span className="font-mono">{order.reference}</span> },
    { label: t("dateTime"), value: `${formatDate(order.createdAt)} · ${formatClockOf(order.createdAt)}` },
  ];
  if (settings.showCashier && counter) rows.push({ label: t("counter"), value: counter });
  if (settings.showCashier && cashier) rows.push({ label: t("servedBy"), value: cashier });
  if (customer?.name) rows.push({ label: t("customer"), value: customer.name });
  if (customer?.phone) rows.push({ label: t("phone"), value: customer.phone });
  return (
    <dl className={cn("flex flex-col gap-inline", ty.meta)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-tight">
          <dt className="shrink-0">{r.label}</dt>
          <dd className="min-w-0 break-words text-right tabular-nums">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Logo, business, document title and the facts block: the top of a roll receipt. */
export function ReceiptTop({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket.receipt");
  const ty = receiptType(data.settings.paper);
  const hasLogo = data.settings.showLogo && !!data.operator.logo;
  return (
    <header>
      {hasLogo && <ReceiptLogo data={data} className="mx-auto mb-tight" />}
      <ReceiptBusiness data={data} />
      <ReceiptRule className="my-comfortable" />
      <p className={cn("text-center font-semibold uppercase tracking-widest", ty.title)}>{isTaxInvoice(data) ? t("taxInvoice") : t("title")}</p>
      <ReceiptRule className="my-comfortable" />
      <ReceiptFacts data={data} number={isTaxInvoice(data) ? t("invoiceNumber") : t("number")} />
    </header>
  );
}

/** One line's second row: tier, when, where, who, seat — only what the line's snapshot carries. */
function lineMeta(l: OrderLine, t: ReturnType<typeof useTranslations>): string {
  const parts: string[] = [];
  if (l.tierName && l.tierName !== l.productName && l.tierId) parts.push(l.tierName);
  const b = l.booking;
  if (b) {
    const when = [formatDay(b.date), b.startTime && b.endTime ? formatClockRange(b.startTime, b.endTime) : b.startTime ? formatClock(b.startTime) : null]
      .filter(Boolean)
      .join(" · ");
    if (when) parts.push(when);
    if (b.resourceName && b.resourceName !== l.tierName) parts.push(b.resourceName);
    if (b.providerName) parts.push(b.providerName);
    if (b.seatLabel) parts.push(t("seat", { label: b.seatLabel }));
  }
  return parts.join(" · ");
}

/** The items of a roll receipt: name, a muted meta line, then "qty × unit ..... total". */
export function ReceiptItems({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket.receipt");
  const { order, settings } = data;
  const ty = receiptType(settings.paper);
  const parents = order.lines.filter((l) => !l.parentLineId);
  const childrenOf = (id: string) => order.lines.filter((l) => l.parentLineId === id);
  const refunded = (l: OrderLine) => l.refundedQuantity > 0;
  return (
    <div className="flex flex-col gap-tight">
      {parents.map((l) => (
        <div key={l.id} className="break-inside-avoid">
          <p className={cn("break-words font-medium leading-snug", refunded(l) && "line-through")}>
            {l.productName}
            {!l.tierId && l.tierName && l.tierName !== l.productName ? ` — ${l.tierName}` : ""}
          </p>
          {lineMeta(l, t) && <p className={cn("break-words", ty.meta)}>{lineMeta(l, t)}</p>}
          <Leader left={`${l.quantity} × ${formatMoney(l.unitPrice)}`} right={formatMoney(l.subtotal)} className={refunded(l) ? "line-through" : undefined} />
          {l.lineDiscount > 0 && <Row label={t("discount")} value={`−${formatMoney(l.lineDiscount)}`} className={ty.meta} />}
          {refunded(l) && <Row label={t("refundedLine", { count: l.refundedQuantity, amount: formatMoney(l.refundedAmount) })} value="" className={ty.meta} />}
          {childrenOf(l.id).map((c) => (
            <div key={c.id} className="mt-inline pl-section">
              <p className={cn("break-words", ty.meta)}>+ {c.productName}</p>
              <Leader left={`${c.quantity} × ${formatMoney(c.unitPrice)}`} right={formatMoney(c.subtotal)} className={ty.meta} />
              {c.lineDiscount > 0 && <Row label={t("discount")} value={`−${formatMoney(c.lineDiscount)}`} className={ty.meta} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** VAT grouped by the rate each line was sold at: what the tax was charged on, and the tax. */
export function vatGroups(data: ReceiptData): { rate: number; base: number; tax: number }[] {
  const map = new Map<number, { rate: number; base: number; tax: number }>();
  for (const l of data.order.lines) {
    if (!(l.taxRate > 0) || (l.taxAmount === 0 && l.taxableAmount === 0)) continue;
    const g = map.get(l.taxRate) ?? { rate: l.taxRate, base: 0, tax: 0 };
    g.base += l.taxableAmount;
    g.tax += l.taxAmount;
    map.set(l.taxRate, g);
  }
  return [...map.values()].sort((a, b) => b.rate - a.rate);
}

/** Subtotal, discounts, VAT by rate, then the heavy rule and TOTAL. */
export function ReceiptTotals({ data, boxed }: { data: ReceiptData; boxed?: boolean }) {
  const t = useTranslations("ticket.receipt");
  const { order, tax, settings } = data;
  const ty = receiptType(settings.paper);
  const groups = vatGroups(data);
  const name = tax?.taxName || "VAT";
  return (
    <div className="flex flex-col gap-inline">
      <Row label={t("subtotal")} value={formatMoney(order.subtotal)} />
      {order.discountTotal > 0 && <Row label={t("discounts")} value={`−${formatMoney(order.discountTotal)}`} />}
      {groups.map((g) => (
        <Row key={g.rate} label={t("vatOn", { name, rate: percent(g.rate), base: formatMoney(g.base) })} value={formatMoney(g.tax)} />
      ))}
      <div aria-hidden className={cn("border-t-2 border-fg", boxed ? "mt-inline" : "mt-tight")} />
      <Row label={t("total").toUpperCase()} value={formatMoney(order.total)} strong className={cn(ty.total, "pt-inline leading-tight")} />
    </div>
  );
}

/** How it was paid: each method, cash tendered and change, what is paid and what is still owed. */
export function ReceiptPayments({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket.receipt");
  const enumL = useEnumLabels();
  const { order, settings } = data;
  const ty = receiptType(settings.paper);
  const taken = order.payments.filter((p) => p.amount > 0 && p.status !== "failed");
  const back = order.payments.filter((p) => p.amount < 0).reduce((s, p) => s - p.amount, 0);
  const paid = orderNetPaid(order);
  const due = orderDue(order);
  if (taken.length === 0 && due === 0) return null;
  return (
    <div className="flex flex-col gap-inline">
      {taken.map((p) => (
        <div key={p.id}>
          <Row label={`${enumL.method(p.method)}${p.status === "pending" ? ` (${t("pending")})` : ""}`} value={formatMoney(p.amount)} />
          {p.method === "cash" && p.tendered != null && p.tendered > p.amount && (
            <>
              <Row label={t("tendered")} value={formatMoney(p.tendered)} className={ty.meta} />
              <Row label={t("change")} value={formatMoney(p.change ?? p.tendered - p.amount)} className={ty.meta} />
            </>
          )}
        </div>
      ))}
      {back > 0 && <Row label={t("refunded")} value={`−${formatMoney(back)}`} />}
      <Row label={t("paid")} value={formatMoney(paid)} className="font-medium" />
      {due > 0 && <Row label={t("balanceDue")} value={formatMoney(due)} strong className={cn(ty.total, "leading-tight")} />}
    </div>
  );
}

/** The lookup QR, the shop's own message, and the quiet credit. */
export function ReceiptBottom({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket");
  const { order, operator, settings } = data;
  const ty = receiptType(settings.paper);
  const message = operator.receiptFooter?.trim();
  const qr = settings.paper === "58mm" ? 80 : settings.paper === "a4" ? 96 : 96;
  return (
    <footer className="text-center">
      {settings.showLookupQr && (
        <div className="mt-section flex flex-col items-center gap-inline break-inside-avoid">
          <Qr value={order.reference} size={qr} />
          <p className={ty.meta}>{t("receipt.lookup")}</p>
        </div>
      )}
      {message && <p className={cn("mt-section whitespace-pre-line break-words leading-relaxed", ty.body)}>{message}</p>}
      <p className={cn("mt-section text-muted", ty.meta)}>{t("poweredBy")}</p>
    </footer>
  );
}

/** A whole roll receipt, top to bottom. */
export function ReceiptRoll({ data }: { data: ReceiptData }) {
  const ty = receiptType(data.settings.paper);
  return (
    <div className={cn("text-fg", ty.body)}>
      <ReceiptTop data={data} />
      <ReceiptRule className="my-comfortable" />
      <ReceiptItems data={data} />
      <ReceiptRule className="my-comfortable" />
      <ReceiptTotals data={data} />
      <ReceiptRule className="my-comfortable" />
      <ReceiptPayments data={data} />
      <ReceiptBottom data={data} />
    </div>
  );
}

/** The same receipt laid out as an A4 invoice: letterhead, customer box, item table, totals box. */
export function ReceiptInvoice({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket.receipt");
  const { order, settings } = data;
  const ty = receiptType(settings.paper);
  const customer = customerOf(data);
  const parents = order.lines.filter((l) => !l.parentLineId);
  const childrenOf = (id: string) => order.lines.filter((l) => l.parentLineId === id);
  const cell = "py-tight align-top";
  const row = (l: OrderLine, child: boolean) => (
    <tr key={l.id} className="break-inside-avoid border-b border-line">
      <td className={cn(cell, "pr-section", child && "pl-section")}>
        <p className={cn("break-words", !child && "font-medium")}>
          {child ? "+ " : ""}
          {l.productName}
          {!child && !l.tierId && l.tierName && l.tierName !== l.productName ? ` — ${l.tierName}` : ""}
        </p>
        {lineMeta(l, t as never) && <p className={cn("break-words text-muted", ty.meta)}>{lineMeta(l, t as never)}</p>}
        {l.lineDiscount > 0 && <p className={ty.meta}>{t("discount")} −{formatMoney(l.lineDiscount)}</p>}
        {l.refundedQuantity > 0 && <p className={ty.meta}>{t("refundedLine", { count: l.refundedQuantity, amount: formatMoney(l.refundedAmount) })}</p>}
      </td>
      <td className={cn(cell, "text-right tabular-nums")}>{l.quantity}</td>
      <td className={cn(cell, "whitespace-nowrap pl-section text-right tabular-nums")}>{formatMoney(l.unitPrice)}</td>
      <td className={cn(cell, "pl-section text-right tabular-nums")}>{l.taxRate > 0 ? `${percent(l.taxRate)}%` : "—"}</td>
      <td className={cn(cell, "whitespace-nowrap pl-section text-right tabular-nums")}>{formatMoney(l.subtotal)}</td>
    </tr>
  );
  return (
    <div className={cn("text-fg", ty.body)}>
      <header className="flex items-start justify-between gap-major border-b-2 border-fg pb-section">
        <div className="min-w-0">
          <ReceiptLogo data={data} className="mb-tight" />
          <ReceiptBusiness data={data} align="start" />
        </div>
        <div className="min-w-0 shrink-0 text-right">
          <h2 className={cn("font-semibold uppercase tracking-widest", ty.title)}>{isTaxInvoice(data) ? t("taxInvoice") : t("title")}</h2>
          <p className={cn("mt-inline", ty.meta)}>
            {isTaxInvoice(data) ? t("invoiceNumber") : t("number")} <span className="font-mono">{order.reference}</span>
          </p>
          <p className={cn("tabular-nums", ty.meta)}>
            {formatDate(order.createdAt)} · {formatClockOf(order.createdAt)}
          </p>
          {settings.showCashier && data.counter && <p className={ty.meta}>{t("counter")}: {data.counter}</p>}
          {settings.showCashier && data.cashier && <p className={ty.meta}>{t("servedBy")}: {data.cashier}</p>}
        </div>
      </header>

      {customer && (
        <div className="mt-section rounded-sm border border-strong px-section py-tight">
          <p className={cn("font-medium uppercase tracking-widest", ty.meta)}>{t("billedTo")}</p>
          {customer.name && <p className="font-medium">{customer.name}</p>}
          {customer.phone && <p className={ty.meta}>{customer.phone}</p>}
        </div>
      )}

      <table className="mt-section w-full border-collapse">
        <thead>
          <tr className={cn("border-b-2 border-fg text-left uppercase tracking-widest", ty.meta)}>
            <th className="py-tight font-medium">{t("item")}</th>
            <th className="py-tight text-right font-medium">{t("qty")}</th>
            <th className="py-tight pl-section text-right font-medium">{t("unit")}</th>
            <th className="py-tight pl-section text-right font-medium">{t("vat")}</th>
            <th className="py-tight pl-section text-right font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {parents.flatMap((l) => [row(l, false), ...childrenOf(l.id).map((c) => row(c, true))])}
        </tbody>
      </table>

      <div className="mt-section flex items-start justify-between gap-major">
        <div className="min-w-0 flex-1">
          {settings.showLookupQr && <LookupQr data={data} />}
        </div>
        <div className="flex w-72 shrink-0 flex-col gap-section">
          <div className="rounded-sm border border-strong px-section py-tight">
            <ReceiptTotals data={data} boxed />
          </div>
          <div className="px-section">
            <ReceiptPayments data={data} />
          </div>
        </div>
      </div>

      <InvoiceFooter data={data} />
    </div>
  );
}

function LookupQr({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket.receipt");
  const ty = receiptType(data.settings.paper);
  return (
    <div className="flex w-28 flex-col items-center gap-inline text-center break-inside-avoid">
      <Qr value={data.order.reference} size={96} />
      <p className={ty.meta}>{t("lookup")}</p>
    </div>
  );
}

function InvoiceFooter({ data }: { data: ReceiptData }) {
  const t = useTranslations("ticket");
  const ty = receiptType(data.settings.paper);
  const message = data.operator.receiptFooter?.trim();
  return (
    <footer className="mt-major border-t border-line pt-section text-center">
      {message && <p className={cn("whitespace-pre-line break-words leading-relaxed", ty.body)}>{message}</p>}
      <p className={cn("mt-tight text-muted", ty.meta)}>{t("poweredBy")}</p>
    </footer>
  );
}
