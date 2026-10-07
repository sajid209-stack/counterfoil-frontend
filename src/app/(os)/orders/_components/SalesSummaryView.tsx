"use client";

import { useTranslations } from "next-intl";
import type { SalesSummary } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { SalesLabels } from "../_lib/labels";

/**
 * The sales summary, drawn once.
 *
 * The Summary sheet on the Orders list and the printed page are the same
 * figures in the same order, so they are the same component: what a manager
 * reads on screen is what lands on paper, and neither can drift from the
 * other. `variant` changes only the scale — the sheet is a 30rem drawer, the
 * page is A4.
 *
 * Every table ends in a total line, and the totals are the headline figures:
 * the orders in each breakdown add up to Transactions, the amounts add up to
 * Sales. A breakdown that does not sum to the number above it is the kind of
 * thing nobody notices until the accountant does, so the sum is on the page.
 *
 * Amounts carry their raw value in `data-amount`, so a check can compare
 * figures exactly rather than parsing "৳1,234.50".
 */
/** Orders whose money is no longer the venue's. */
const isVoidedStatus = (status: string) => status === "cancelled" || status === "refunded";

export function SalesSummaryView({ summary: s, L, variant = "sheet", compact = false }: { summary: SalesSummary; L: SalesLabels; variant?: "sheet" | "print"; /** Headline, totals and payment methods only — the top of a printed list. */ compact?: boolean }) {
  const t = useTranslations("orders.summary");
  const print = variant === "print";
  const h = "mb-tight text-base font-semibold text-fg";

  const ledger: { key: string; label: string; amount: number; strong?: boolean; tone?: "danger" | "warning"; rule?: boolean; hide?: boolean }[] = [
    { key: "gross", label: t("gross"), amount: s.gross },
    { key: "discounts", label: t("discounts"), amount: -s.discounts, tone: s.discounts > 0 ? "danger" : undefined },
    { key: "net", label: t("net"), amount: s.net, rule: true },
    { key: "vat", label: t("vat"), amount: s.vat },
    { key: "total", label: t("total"), amount: s.total, strong: true, rule: true },
    { key: "partRefunds", label: t("partRefunds"), amount: -s.partRefunds, tone: "danger", hide: s.partRefunds === 0 },
    { key: "sales", label: t("sales"), amount: s.sales, strong: true, rule: s.partRefunds > 0, hide: s.partRefunds === 0 },
  ];
  const money: typeof ledger = [
    { key: "paid", label: t("paid"), amount: s.paid },
    { key: "refunds", label: t("refunds"), amount: -s.refunds, tone: s.refunds > 0 ? "danger" : undefined },
    { key: "owed", label: t("owed"), amount: s.owed, tone: s.owed > 0 ? "warning" : undefined },
    { key: "writtenOff", label: t("writtenOff"), amount: s.writtenOff },
  ];

  const row = (r: (typeof ledger)[number]) =>
    r.hide ? null : (
      <div
        key={r.key}
        data-row={r.key}
        data-amount={r.amount}
        className={cn("flex items-baseline justify-between gap-tight py-1.5", r.rule && "border-t border-line", r.strong && "font-semibold")}
      >
        <dt className={cn(!r.strong && "text-muted")}>{r.label}</dt>
        <dd className={cn("shrink-0 tabular-nums", r.tone === "danger" && "text-danger", r.tone === "warning" && "text-warning")}>{formatMoney(r.amount)}</dd>
      </div>
    );

  return (
    <div className={cn("flex flex-col", print ? "gap-major text-[13px]" : "gap-major text-sm")}>
      {/* The headline: what the sales came to, and how many it took. */}
      <div className="grid grid-cols-3 gap-section">
        <div className="col-span-3 sm:col-span-1">
          <p className="text-[13px] font-medium text-muted">{t("sales")}</p>
          <p data-figure="sales" data-amount={s.sales} className={cn("mt-inline font-semibold tabular-nums", print ? "text-2xl" : "text-[1.625rem] leading-tight")}>{formatMoney(s.sales)}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-muted">{t("orders")}</p>
          <p data-figure="orders" data-amount={s.orders} className="mt-inline text-lg font-semibold tabular-nums">{s.orders}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-muted">{t("items")}</p>
          <p data-figure="items" data-amount={s.items} className="mt-inline text-lg font-semibold tabular-nums">{s.items}</p>
        </div>
      </div>

      {/* On a printed list the totals and the payment methods sit side by side, so
          the summary above the orders costs half the page it would stacked. */}
      <div className={compact ? "grid gap-major sm:grid-cols-2 sm:items-start" : "contents"}>
      <section aria-label={t("totals")} data-section="totals">
        <h3 className={h}>{t("totals")}</h3>
        <dl>
          {ledger.map((r) => row(r))}
        </dl>
        <dl className="mt-tight">
          {money.map((r, i) => row({ ...r, rule: i === 0 }))}
        </dl>
        {s.orders > s.counted && <p className="mt-tight text-[12px] text-muted">{t("voidedNote", { count: s.orders - s.counted })}</p>}
      </section>

      {/* Money in, by how it was paid. Still owed and written off make up the
          rest, so the table lands on Sales. */}
      <section aria-label={t("byMethod")} data-section="methods">
        <h3 className={h}>{t("byMethod")}</h3>
        <table className="w-full border-collapse">
          <thead><tr><th scope="col" className="sr-only">{t("colMethod")}</th><th scope="col" className="sr-only">{t("colAmount")}</th></tr></thead>
          <tbody>
            {s.methods.map((m) => (
              <tr key={m.key} data-key={m.key} data-amount={m.amount} className="border-b border-hairline">
                <th scope="row" className="py-1.5 pr-tight text-left font-normal">{L.method(m.key)}</th>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(m.amount)}</td>
              </tr>
            ))}
            {s.owed > 0 && (
              <tr data-key="owed" data-amount={s.owed} className="border-b border-hairline">
                <th scope="row" className="py-1.5 pr-tight text-left font-normal text-warning">{t("owed")}</th>
                <td className="py-1.5 text-right tabular-nums text-warning">{formatMoney(s.owed)}</td>
              </tr>
            )}
            {s.writtenOff > 0 && (
              <tr data-key="writtenOff" data-amount={s.writtenOff} className="border-b border-hairline">
                <th scope="row" className="py-1.5 pr-tight text-left font-normal">{t("writtenOff")}</th>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(s.writtenOff)}</td>
              </tr>
            )}
            {s.methods.length === 0 && s.owed === 0 && s.writtenOff === 0 && (
              <tr><td colSpan={2} className="py-1.5 text-muted">{t("none")}</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr data-total data-amount={s.sales} className="font-semibold">
              <th scope="row" className="pt-1.5 text-left">{t("sales")}</th>
              <td className="pt-1.5 text-right tabular-nums">{formatMoney(s.sales)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
      </div>

      {!compact && (
        <>
      <Breakdown id="channels" title={t("byChannel")} rows={s.channels} name={(k) => L.channel(k as never)} s={s} />
      <Breakdown id="counters" title={t("byCounter")} rows={s.counters} name={(k) => L.counter(k)} s={s} />
      <Breakdown id="staff" title={t("byStaff")} rows={s.staff} name={(k) => L.staff(k)} s={s} />
      <Breakdown id="statuses" title={t("byStatus")} rows={s.statuses} name={(k) => L.status(k)} s={s} voided />

      <section aria-label={t("topItems")} data-section="items">
        <h3 className={h}>{t("topItems")}</h3>
        <table className="w-full border-collapse">
          <thead><tr><th scope="col" className="sr-only">{t("colItem")}</th><th scope="col" className="sr-only">{t("colQty")}</th><th scope="col" className="sr-only">{t("colAmount")}</th></tr></thead>
          <tbody>
            {s.topItems.map((i) => (
              <tr key={i.key} data-key={i.key} data-amount={i.amount} data-qty={i.qty} className="border-b border-hairline align-top">
                <th scope="row" className="min-w-0 break-words py-1.5 pr-tight text-left font-normal">{i.name}</th>
                <td className="whitespace-nowrap py-1.5 pr-tight text-right tabular-nums text-muted">× {i.qty}</td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatMoney(i.amount)}</td>
              </tr>
            ))}
            {s.otherItems.count > 0 && (
              <tr data-key="other" data-amount={s.otherItems.amount} data-qty={s.otherItems.qty} className="border-b border-hairline">
                <th scope="row" className="py-1.5 pr-tight text-left font-normal text-muted">{t("otherItems", { count: s.otherItems.count })}</th>
                <td className="whitespace-nowrap py-1.5 pr-tight text-right tabular-nums text-muted">× {s.otherItems.qty}</td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatMoney(s.otherItems.amount)}</td>
              </tr>
            )}
            {s.topItems.length === 0 && <tr><td colSpan={3} className="py-1.5 text-muted">{t("none")}</td></tr>}
          </tbody>
          <tfoot>
            <tr data-total data-amount={s.sales} className="font-semibold">
              <th scope="row" className="pt-1.5 text-left">{t("total")}</th>
              <td className="pt-1.5" />
              <td className="pt-1.5 text-right tabular-nums">{formatMoney(s.sales)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
        </>
      )}
    </div>
  );
}

/** One cut of the orders — by channel, counter, staff or status — with how
 *  many and how much, ending in a line that is the headline figure. */
function Breakdown({
  id,
  title,
  rows,
  name,
  s,
  voided = false,
}: {
  id: string;
  title: string;
  rows: SalesSummary["channels"];
  name: (key: string) => string;
  s: SalesSummary;
  /** Status only: the cancelled and refunded rows are counted but worth nothing. */
  voided?: boolean;
}) {
  const t = useTranslations("orders.summary");
  return (
    <section aria-label={title} data-section={id}>
      <h3 className="mb-tight text-base font-semibold text-fg">{title}</h3>
      <table className="w-full border-collapse">
        <thead>
          <tr><th scope="col" className="sr-only">{title}</th><th scope="col" className="sr-only">{t("colOrders")}</th><th scope="col" className="sr-only">{t("colAmount")}</th></tr>
          </thead>
        <tbody>
          {rows.map((r) => {
            const out = voided && isVoidedStatus(r.key);
            return (
              <tr key={r.key} data-key={r.key} data-orders={r.orders} data-amount={r.amount} className="border-b border-hairline">
                <th scope="row" className="min-w-0 break-words py-1.5 pr-tight text-left font-normal">{name(r.key)}</th>
                <td className="py-1.5 pr-tight text-right tabular-nums text-muted">{t("ordersCount", { count: r.orders })}</td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">
                  {out ? <span className="text-muted" title={t("notCounted")}>{t("notCountedShort")}</span> : formatMoney(r.amount)}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={3} className="py-1.5 text-muted">{t("none")}</td></tr>}
        </tbody>
        <tfoot>
          <tr data-total data-orders={s.orders} data-amount={s.sales} className="font-semibold">
            <th scope="row" className="pt-1.5 text-left">{t("total")}</th>
            <td className="pt-1.5 pr-tight text-right tabular-nums">{t("ordersCount", { count: s.orders })}</td>
            <td className="pt-1.5 text-right tabular-nums">{formatMoney(s.sales)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
