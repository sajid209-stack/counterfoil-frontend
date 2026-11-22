"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, formatRange } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { useReportLabels, useReportMeta } from "@/lib/useReportLabels";
import { formatDay, formatDateTime, formatMoney } from "@/lib/format";
import { DEMO_STAFF_ID } from "@/lib/session";
import { getOperator, getStaff, listCustomers, listOrders, orderDue, type Order } from "@/lib/api";
import type { ReportTable } from "@/lib/report";
import { PrintDocument } from "@/app/print/_components/PrintDocument";
import { byMethod, itemsShort } from "@/app/(go)/my-sales/_components/SaleList";
import { buildMySalesReport } from "@/app/(go)/my-sales/_lib/report";
import { daysIn, previousRange, salesRows, summarise, viewMethods, type SalesView } from "@/app/(go)/my-sales/_lib/summary";

/**
 * "My sales" as an A4 document — `/print/my-sales?from=&to=&view=&q=`, the
 * address the till's Print button sends the cashier to with what is on screen.
 * It reuses the Excel report's own figures (buildMySalesReport), so the paper,
 * the spreadsheet and the screen cannot disagree, and opens the print dialog
 * itself once the data is in.
 */
function MySalesPrint() {
  const t = useTranslations("mysales");
  const tx = useTranslations("exports");
  const labels = useEnumLabels();
  const sp = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.get("from") || today;
  const to = sp.get("to") || from;
  const rawView = sp.get("view") ?? "all";
  const query = (sp.get("q") ?? "").trim();

  const ordersQ = useApiQuery(() => listOrders({ pageSize: 2000 }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const customersQ = useApiQuery(() => listCustomers({ pageSize: 2000 }), []);
  const reportLabels = useReportLabels();
  const reportMeta = useReportMeta();
  const currency = opQ.data?.currency ?? "BDT";
  const money = (m: number) => formatMoney(m, currency);

  const view: SalesView = (["all", ...viewMethods(), "dueCollected", "owed"] as string[]).includes(rawView) ? (rawView as SalesView) : "all";
  const orders = ordersQ.data?.data;
  const ready = !!orders && !opQ.loading && !meQ.loading && !customersQ.loading;

  const printed = useRef(false);
  useEffect(() => {
    if (ready && !printed.current) {
      printed.current = true;
      const id = setTimeout(() => window.print(), 400);
      return () => clearTimeout(id);
    }
  }, [ready]);

  const data = useMemo(() => {
    if (!orders) return null;
    const days = daysIn(from, to);
    const [pa, pb] = previousRange(from, to);
    const customers = new Map((customersQ.data?.data ?? []).map((c) => [c.id, c]));
    const who = (o: Order) => {
      const c = o.customerId ? customers.get(o.customerId) : undefined;
      return { name: c?.name ?? o.customerName ?? t("walkIn"), phone: c?.phone ?? null };
    };
    const rowsOf = (v: SalesView) => salesRows(orders, DEMO_STAFF_ID, days, v, orderDue);
    const list = rowsOf(view);
    const q = query.toLocaleLowerCase();
    const digits = q.replace(/\D/g, "");
    const found = q
      ? list.filter(({ order: o }) => {
          const w = who(o);
          return (
            o.reference.toLocaleLowerCase().includes(q) ||
            itemsShort(o).toLocaleLowerCase().includes(q) ||
            w.name.toLocaleLowerCase().includes(q) ||
            (w.phone != null && (w.phone.toLocaleLowerCase().includes(q) || (digits.length > 2 && w.phone.replace(/\D/g, "").includes(digits))))
          );
        })
      : list;
    const prev = summarise(orders, DEMO_STAFF_ID, daysIn(pa, pb));
    return { cur: summarise(orders, DEMO_STAFF_ID, days), prev, all: rowsOf("all"), dueCollected: rowsOf("dueCollected"), owed: rowsOf("owed"), found, who };
  }, [orders, customersQ.data, from, to, view, query, t]);

  const period = formatRange(from, to);
  const staffName = meQ.data?.name ?? "";
  const tabName = view === "all" ? t("tabAll") : view === "dueCollected" ? t("tabDue") : view === "owed" ? t("tabOwed") : labels.method(view);
  const filters = [view !== "all" ? t("report.filterTab", { name: tabName }) : "", query ? t("report.filterSearch", { q: query }) : ""].filter(Boolean).join(" · ") || t("report.filterAll");
  const lines = [filters, staffName ? `${tx("metaPreparedBy")}: ${staffName}` : ""].filter(Boolean);
  const scope = [staffName, period].filter(Boolean).join(" · ");

  const report = useMemo(() => {
    if (!data) return null;
    return buildMySalesReport({
      t: (key, values) => t(key as never, values as never),
      methodName: labels.method,
      statusName: labels.status,
      money,
      labels: reportLabels,
      business: opQ.data?.name ?? "Counterfoil",
      currency,
      fileBase: "my-sales",
      meta: reportMeta({ period, filters, preparedBy: staffName, currency }),
      cur: data.cur,
      prev: data.prev,
      hasPrev: data.prev.orders > 0,
      refName: "",
      all: data.all,
      dueCollected: data.dueCollected,
      owed: data.owed,
      found: data.found,
      who: data.who,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the helpers are re-made each render; the data decides
  }, [data, opQ.data, staffName, period, filters, currency]);

  const byDay = report?.summary?.[0];
  const byMethodTable = report?.summary?.[1];

  return (
    <>
    <style>{`@media print { html { color-scheme: light !important; } html, body { background: white !important; } }`}</style>
    <PrintDocument operator={opQ.data} title={t("title")} scope={scope} lines={lines} ready={ready && !!report}>
      {report && data && (
        <div className="flex flex-col gap-major">
          <dl className="grid grid-cols-4 gap-x-section gap-y-comfortable">
            {(report.kpis ?? []).map((k) => (
              <div key={k.label} className="min-w-0 break-inside-avoid border-t border-strong pt-tight">
                <dt className="text-xs font-medium text-muted">{k.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{k.type === "int" ? String(k.value) : money(Number(k.value))}</dd>
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-2 items-start gap-x-major">
            {byMethodTable && <Breakdown table={byMethodTable} money={money} salesTotal={data.cur.orders} />}
            {byDay && <Breakdown table={byDay} money={money} day />}
          </div>

          {data.found.length === 0 ? (
            <EmptyState title={t("report.printEmpty")} />
          ) : (
            <SalesTable rows={data.found} who={data.who} money={money} labels={labels} />
          )}
        </div>
      )}
    </PrintDocument>
    </>
  );
}

const th = "px-1.5 py-1.5 text-left text-xs font-medium text-muted";
const thr = `${th} text-right`;
const td = "px-1.5 py-1 align-top text-xs";
const tdr = `${td} whitespace-nowrap text-right tabular-nums`;

/** One breakdown (by method, by day): label, sales, amount, share, and a total row. */
function Breakdown({ table, money, day, salesTotal }: { table: ReportTable; money: (m: number) => string; day?: boolean; salesTotal?: number }) {
  const t = useTranslations("mysales");
  /* A sale paid two ways is in both method rows; the total counts it once. */
  const sales = salesTotal ?? table.rows.reduce((n, r) => n + Number(r[1] ?? 0), 0);
  const amount = table.rows.reduce((n, r) => n + Number(r[2] ?? 0), 0);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <section className="min-w-0 break-inside-avoid">
      <h2 className="mb-tight text-sm font-semibold">{table.title}</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-strong">
            <th scope="col" className={th}>{table.columns[0].header}</th>
            <th scope="col" className={thr}>{table.columns[1].header}</th>
            <th scope="col" className={thr}>{table.columns[2].header}</th>
            <th scope="col" className={thr}>{table.columns[3].header}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-b border-hairline">
              <td className={td}>{day ? formatDay(String(r[0])) : String(r[0])}</td>
              <td className={tdr}>{String(r[1])}</td>
              <td className={tdr}>{money(Number(r[2]))}</td>
              <td className={tdr}>{pct(Number(r[3]))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-fg font-semibold">
            <td className={td}>{t("report.total")}</td>
            <td className={tdr}>{sales}</td>
            <td className={tdr}>{money(amount)}</td>
            <td className={tdr}>{table.rows.length ? "100%" : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

/** Every sale of the list, hairline rows, the header repeated on each sheet, the sum once at the foot. */
function SalesTable({
  rows,
  who,
  money,
  labels,
}: {
  rows: ReturnType<typeof salesRows>;
  who: (o: Order) => { name: string; phone: string | null };
  money: (m: number) => string;
  labels: ReturnType<typeof useEnumLabels>;
}) {
  const t = useTranslations("mysales");
  const total = rows.reduce((n, r) => n + r.amount, 0);
  return (
    <section>
      <h2 className="mb-tight text-sm font-semibold">{t("recent")}</h2>
      <table data-print-sales className="w-full border-collapse">
        <thead className="table-header-group">
          <tr className="border-b border-strong">
            <th scope="col" className={th}>{t("report.printWhen")}</th>
            <th scope="col" className={th}>{t("report.printReceipt")}</th>
            <th scope="col" className={th}>{t("colCustomer")}</th>
            <th scope="col" className={th}>{t("colItems")}</th>
            <th scope="col" className={th}>{t("report.printMethod")}</th>
            <th scope="col" className={thr}>{t("colAmount")}</th>
            <th scope="col" className={th}>{t("colStatus")}</th>
          </tr>
        </thead>
        {/* The last sale and the total travel together: a total alone at the top
            of a new page reads as a different document. */}
        {[rows.slice(0, -1), rows.slice(-1)].map((group, gi) => (
        <tbody key={gi} className={gi === 1 ? "break-inside-avoid" : undefined}>
          {group.map((r) => {
            const o = r.order;
            const w = who(o);
            return (
              <tr key={`${o.id}-${r.at}`} data-order={o.id} className="break-inside-avoid border-b border-hairline">
                <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.at)}</td>
                <td className={`${td} whitespace-nowrap font-mono`}>{o.reference}</td>
                <td className={`${td} break-words`}>
                  {w.name}
                  {w.phone && <span className="block text-muted">{w.phone}</span>}
                </td>
                <td className={`${td} break-words`}>{itemsShort(o)}</td>
                <td className={td}>{byMethod(r).map((p) => labels.method(p.method)).join(" + ") || "—"}</td>
                <td className={tdr}>
                  {money(r.amount)}
                  {r.due > 0 && <span className="block text-muted">{t("dueTag", { amount: money(r.due) } as never)}</span>}
                </td>
                <td className={td}>{labels.status(o.status)}</td>
              </tr>
            );
          })}
          {gi === 1 && (
            <tr data-print-total className="border-t-2 border-fg font-semibold">
              <td colSpan={5} className={`${td} text-sm`}>{t("report.printTotalRow", { count: rows.length })}</td>
              <td className={`${tdr} text-sm`}>{money(total)}</td>
              <td className={td} />
            </tr>
          )}
        </tbody>
        ))}
      </table>
    </section>
  );
}

export default function PrintMySalesPage() {
  return (
    <Suspense>
      <MySalesPrint />
    </Suspense>
  );
}
