"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Download, Printer, ReceiptText, RotateCcw, Search, Ticket } from "lucide-react";
import { ActionMenu, Button, DateRangePicker, formatRange, Notice, Skeleton, StatusPill, type DateRangeValue } from "@/components/ui";
import { saveCsv, toCsv } from "@/lib/csv";
import { AffixInput } from "@/components/ui/Field";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatClockOf, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEMO_STAFF_ID } from "@/lib/session";
import { getOperator, getStaff, listOrders, listProducts, peekPaymentSettings, type Order } from "@/lib/api";
import { goodwillMaxFor, pendingRefundForOrder, useRefundVersion } from "@/lib/api/refundRequests";
import { GoCard } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";
import { R } from "../_components/railType";
import { T } from "../_components/type";
import { Thumb } from "../_components/Thumb";
import { RefundFlowSheet } from "../_components/RefundFlowSheet";
import { useActor } from "../schedule/_lib/actor";
import { daysIn, orderDay, previousRange, rangeLength, shiftIso, summarise } from "./_lib/summary";
import { MethodBars } from "./_components/MethodBars";

const PAGE = 10;

/* The named ranges, the way Square's sales summary and Shopify POS's reports
   offer them: the ones a cashier or a supervisor actually asks for, newest
   first. Anything else is drawn on the calendar ("Pick dates"). Weeks start on
   Monday, as the till's day strip does. */
const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;
const weekStart = (iso: string) => shiftIso(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));
const PRESETS: { value: string; range: () => [string, string] }[] = [
  { value: "today", range: () => [DEMO_TODAY, DEMO_TODAY] },
  { value: "yesterday", range: () => [shiftIso(DEMO_TODAY, -1), shiftIso(DEMO_TODAY, -1)] },
  { value: "7d", range: () => [shiftIso(DEMO_TODAY, -6), DEMO_TODAY] },
  { value: "week", range: () => [weekStart(DEMO_TODAY), DEMO_TODAY] },
  { value: "month", range: () => [monthStart(DEMO_TODAY), DEMO_TODAY] },
  { value: "lastmonth", range: () => [monthStart(shiftIso(monthStart(DEMO_TODAY), -1)), shiftIso(monthStart(DEMO_TODAY), -1)] },
];

/* The phone body, exactly as it was before the page sat in GoPage (16px above,
   room for the tab bar below); on a desktop GoPage's own rhythm takes over. */
const PHONE = "mx-auto w-full max-w-216 pt-tight pb-28 lg:pb-section rail:max-w-none rail:pt-0 rail:pb-0";

/* One row of the sales list. Phone: time and code over the amount, the items
   under them, the status and the menu at the right. Desktop: one line of
   columns, the same ones as the header row. */
/* The first column holds the time on one day, or "8 Nov · 11:05 AM" over
   several, so it widens when the range does. */
const COLS = "rail:grid-cols-[64px_128px_minmax(0,1fr)_72px_96px_96px_44px]";
const COLS_RANGE = "rail:grid-cols-[124px_128px_minmax(0,1fr)_72px_96px_96px_44px]";
const ROW_BASE = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-comfortable gap-y-inline px-comfortable py-comfortable rail:gap-y-0 rail:px-card rail:py-tight rail:min-h-12";

/** "2× Adult, Child" — short enough for one line. */
const itemsShort = (o: Order) =>
  o.lines
    .filter((l) => !l.parentLineId)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.productName}` : l.productName))
    .join(", ");

/** What was paid with: the first method that took money. */
const methodOf = (o: Order) => o.payments.find((p) => p.amount > 0)?.method;

/** "▲ ৳9,384 more than yesterday" — only when there is a previous figure. */
function Delta({ diff, show, fmt, name, lead = false }: { diff: number; show: boolean; fmt: (n: number) => string; name: string; lead?: boolean }) {
  const t = useTranslations("mysales");
  /* Nothing to compare with is said once, under the lead figure, not four times. */
  if (!show) return lead ? <p className={T.meta}>{t("noCompare", { name })}</p> : null;
  if (diff === 0) return <p className={T.meta}>{t("cmpSame", { name })}</p>;
  const up = diff > 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <p className={`inline-flex items-center gap-1 ${T.meta} font-medium ${up ? "text-success" : "text-danger"}`}>
      <Arrow size={14} strokeWidth={2} aria-hidden />
      {t(up ? "cmpUp" : "cmpDown", { amount: fmt(Math.abs(diff)), name })}
    </p>
  );
}

export default function MySalesPage() {
  const t = useTranslations("mysales");
  const labels = useEnumLabels();
  const router = useRouter();
  const [range, setRange] = useState<DateRangeValue>({ preset: "today", from: DEMO_TODAY, to: DEMO_TODAY });
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  /* A sale the cashier is asking to give money back on. There is no booking
     behind a sale here, so the sheet offers some tickets or an amount. */
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const actor = useActor();
  // A request made, answered or taken back changes which sales offer the button.
  useRefundVersion();
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 2000 }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const imageOf = (name: string) => productsQ.data?.data.find((p) => p.name === name)?.images?.[0]?.url;
  const currency = opQ.data?.currency ?? "BDT";
  const money = (m: number) => formatMoney(m, currency);

  const orders = ordersQ.data?.data;
  /* The dates shown, and the same number of days before them for the
     "more than…" lines. */
  const cur = useMemo(() => (orders ? summarise(orders, DEMO_STAFF_ID, daysIn(range.from, range.to)) : null), [orders, range.from, range.to]);
  const prev = useMemo(() => {
    if (!orders) return null;
    const [a, b] = previousRange(range.from, range.to);
    return summarise(orders, DEMO_STAFF_ID, daysIn(a, b));
  }, [orders, range.from, range.to]);

  if (ordersQ.error) {
    return (
      <GoPage width="wide">
        <main className="pt-tight pb-section rail:pt-0">
          <Notice tone="danger" title={t("loadError")} action={{ label: t("retry"), onClick: ordersQ.reload }} />
        </main>
      </GoPage>
    );
  }

  if (!cur || !prev) {
    return (
      <GoPage width="wide">
        <main aria-busy className={`flex flex-col gap-comfortable ${PHONE}`}>
          <Skeleton h={28} w="40%" className="rail:hidden" />
          <Skeleton h={36} w={280} />
          <Skeleton h={150} className="rounded-card" />
          <div className="flex flex-col gap-comfortable rail:grid rail:grid-cols-[minmax(0,1fr)_360px] rail:gap-section">
            <Skeleton h={320} className="rounded-card" />
            <Skeleton h={220} className="rounded-card" />
          </div>
        </main>
      </GoPage>
    );
  }

  const isToday = range.from === DEMO_TODAY && range.to === DEMO_TODAY;
  const days = rangeLength(range.from, range.to);
  const oneDay = days === 1;
  const refName = isToday ? t("refYesterday") : t("refPrevious", { count: days });
  /* The range in words: the preset's name, or its dates. */
  const rangeName = range.preset !== "custom" && PRESETS.some((p) => p.value === range.preset) ? t(`presets.${range.preset}` as never) : formatRange(range.from, range.to);
  const float = peekPaymentSettings().defaultFloat;
  const shouldHave = float + cur.cashTaken - cur.cashRefunds;
  const hasPrev = prev.orders > 0;
  const avg = cur.orders > 0 ? Math.round(cur.total / cur.orders) : null;
  const prevAvg = prev.orders > 0 ? Math.round(prev.total / prev.orders) : 0;
  const share = Math.max(1, cur.byMethod.reduce((s, m) => s + Math.max(0, m.amount), 0));
  const sold = cur.byMethod.filter((m) => m.count > 0 || m.amount !== 0);
  const q = query.trim().toLocaleLowerCase();
  const found = q ? cur.recent.filter((o) => o.reference.toLocaleLowerCase().includes(q) || itemsShort(o).toLocaleLowerCase().includes(q)) : cur.recent;
  const rows = found.slice(0, shown);

  /* Export: the sales in these dates (and any search), one row each, as a CSV a
     spreadsheet opens. Amounts in major units with two decimals, so a sum in
     the spreadsheet is the sum on screen. */
  const exportCsv = () => {
    const head = [t("csv.date"), t("csv.time"), t("csv.code"), t("csv.items"), t("csv.method"), t("csv.amount"), t("csv.refunded"), t("csv.status")];
    const body = found.map((o) => {
      const m = methodOf(o);
      const back = o.payments.filter((p) => p.status === "confirmed" && p.amount < 0).reduce((n, p) => n - p.amount, 0);
      return [orderDay(o), formatClockOf(o.createdAt), o.reference, itemsShort(o), m ? labels.method(m) : "", (o.total / 100).toFixed(2), (back / 100).toFixed(2), labels.status(o.status)];
    });
    saveCsv(`my-sales_${range.from}_${range.to}.csv`, toCsv([head, ...body]));
  };
  /* Print every sale in the range, not the first page of the list: the list is
     opened in full first (flushSync, so it is in the page before the dialog
     takes its snapshot), and stays open afterwards. */
  const printAll = () => {
    flushSync(() => setShown(Number.POSITIVE_INFINITY));
    window.print();
  };

  return (
    <GoPage width="wide">
      {/* The shell's bars are not part of a printed summary; the page's own
          title is (it carries data-page-head). */}
      <style>{`@media print { header:not([data-page-head] header), nav { display: none !important; } }`}</style>

      <div className={PHONE}>
      <div data-page-head>
        <GoPageHeader
          title={t("title")}
          subtitle={
            <>
              <span className="print:hidden">{t("subtitle")}</span>
              <span className="hidden print:inline">{t("printedFor", { name: meQ.data?.name ?? "", date: formatRange(range.from, range.to) })}</span>
            </>
          }
          className="mb-comfortable! rail:mb-major!"
        />
      </div>

      <main className="flex flex-col gap-comfortable rail:gap-section">
        {/* Which dates, and what to do with them. One button names the range and
            opens the named ranges beside a two-month calendar (the picker the
            admin's reports use); Export and Print act on exactly what is shown.
            "This shift" waits for the till to stamp a shift on a sale. */}
        <div className="flex items-center gap-tight print:hidden rail:gap-comfortable">
          <DateRangePicker
            value={range}
            onChange={(r) => {
              setRange({ preset: r.preset, from: r.from, to: r.to });
              setShown(PAGE);
            }}
            presets={PRESETS.map((p) => ({ ...p, label: t(`presets.${p.value}` as never) }))}
            today={DEMO_TODAY}
            max={DEMO_TODAY}
            labels={{
              choose: t("range.choose"),
              custom: t("range.custom"),
              from: t("range.from"),
              to: t("range.to"),
              apply: t("range.apply"),
              cancel: t("range.cancel"),
              previousMonth: t("range.previousMonth"),
              nextMonth: t("range.nextMonth"),
              days: (count: number) => t("range.days", { count }),
              pickEnd: t("range.pickEnd"),
            }}
            className="min-w-0 flex-1 rail:w-auto rail:flex-none"
          />
          <span className="hidden flex-1 rail:block" />
          <Button variant="secondary" size="sm" className={`w-11 shrink-0 px-0 rail:w-auto rail:px-comfortable ${R.button}`} aria-label={t("exportAria")} title={t("exportAria")} onClick={exportCsv} disabled={found.length === 0}>
            <Download size={16} strokeWidth={1.75} aria-hidden />
            <span className="sr-only rail:not-sr-only">{t("export")}</span>
          </Button>
          <Button variant="secondary" size="sm" className={`w-11 shrink-0 px-0 rail:w-auto rail:px-comfortable ${R.button}`} aria-label={t("print")} title={t("print")} onClick={printAll}>
            <Printer size={16} strokeWidth={1.75} aria-hidden />
            <span className="sr-only rail:not-sr-only">{t("printShort")}</span>
          </Button>
        </div>

        {/* The figures: what you sold is the one that leads. */}
        <GoCard className="rail:p-card" aria-labelledby="ms-hero">
          <div className="grid grid-cols-2 gap-x-comfortable gap-y-section rail:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] rail:gap-x-section">
            <div className="col-span-2 flex flex-col gap-inline rail:col-span-1">
              <p id="ms-hero" className={T.label}>{t("youSold")} · {rangeName}</p>
              <p className="text-3xl font-semibold tabular-nums text-fg rail:text-4xl">{money(cur.total)}</p>
              <Delta lead diff={cur.total - prev.total} show={hasPrev} fmt={money} name={refName} />
            </div>
            <div className="flex flex-col gap-inline">
              <p className={T.label}>{t("kpiCount")}</p>
              <p className={T.stat}>{cur.orders}</p>
              <Delta diff={cur.orders - prev.orders} show={hasPrev} fmt={String} name={refName} />
            </div>
            <div className="flex flex-col gap-inline">
              <p className={T.label}>{t("kpiAvg")}</p>
              <p className={T.stat}>{avg == null ? "—" : money(avg)}</p>
              {avg != null && <Delta diff={avg - prevAvg} show={hasPrev} fmt={money} name={refName} />}
            </div>
            <div className="flex flex-col gap-inline">
              <p className={T.label}>{t("kpiItems")}</p>
              <p className={T.stat}>{cur.items}</p>
              <Delta diff={cur.items - prev.items} show={hasPrev} fmt={String} name={refName} />
            </div>
            <div className="flex flex-col gap-inline">
              <p className={T.label}>{t("kpiRefunds")}</p>
              <p className={T.stat}>{money(cur.refunds)}</p>
              <p className={T.meta}>{t("refundCount", { count: cur.refundCount })}</p>
            </div>
          </div>
        </GoCard>

        <div className="flex flex-col gap-comfortable rail:grid rail:grid-cols-[minmax(0,1fr)_360px] rail:items-start rail:gap-section">
          {/* The cash drawer: staff count against this at the end of a shift. */}
          {isToday && (
            <GoCard className="rail:col-start-2 rail:row-start-1" aria-labelledby="ms-drawer" title={<span id="ms-drawer">{t("drawerTitle")}</span>}>
              <dl className="flex flex-col tabular-nums">
                <div className="flex items-baseline justify-between py-tight"><dt className={T.body}>{t("startCash")}</dt><dd className={T.price}>{money(float)}</dd></div>
                <div className="flex items-baseline justify-between py-tight"><dt className={T.body}>+ {t("cashTaken")}</dt><dd className={T.price}>{money(cur.cashTaken)}</dd></div>
                <div className="flex items-baseline justify-between py-tight"><dt className={T.body}>− {t("cashRefunds")}</dt><dd className={T.price}>{money(cur.cashRefunds)}</dd></div>
                <div className="mt-tight flex items-baseline justify-between border-t border-line pt-comfortable"><dt className={`${T.body} font-semibold`}>{t("shouldHave")}</dt><dd className={T.total}>{money(shouldHave)}</dd></div>
              </dl>
              <p className={T.meta}>{t("drawerNote")}</p>
            </GoCard>
          )}

          <GoCard className="rail:col-start-2" aria-labelledby="ms-methods" title={<span id="ms-methods">{t("byMethod")}</span>}>
            {sold.length === 0 ? (
              <p className={T.meta}>{t("noMethods")}</p>
            ) : (
              <MethodBars
                rows={sold.map((m) => {
                  const pct = Math.round((Math.max(0, m.amount) / share) * 100);
                  return {
                    key: m.method,
                    label: labels.method(m.method),
                    amount: money(m.amount),
                    meta: `${t("salesShort", { count: m.count })} · ${pct}%`,
                    share: t("share", { pct, method: labels.method(m.method).toLocaleLowerCase() }),
                    pct,
                  };
                })}
              />
            )}
          </GoCard>

          {/* The sales, as one list: a table on a desktop, stacked rows on a phone. */}
          <section className="order-1 flex flex-col gap-tight rail:order-none rail:col-start-1 rail:row-span-3 rail:row-start-1" aria-labelledby="ms-recent">
            <div className="flex flex-col gap-tight rail:flex-row rail:items-center rail:justify-between rail:gap-comfortable">
              <h2 id="ms-recent" className={T.card}>{t("recent")}</h2>
              {cur.recent.length > 0 && (
                <AffixInput
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchLabel")}
                  prefix={<Search size={16} strokeWidth={1.75} aria-hidden />}
                  className="rail:h-10 rail:w-72 print:hidden"
                  inputClassName={T.body}
                />
              )}
            </div>

            {cur.recent.length === 0 ? (
              <GoCard className="items-center py-major text-center">
                <ReceiptText size={32} strokeWidth={1.5} aria-hidden className="text-muted" />
                <p className={T.card}>{isToday ? t("empty") : oneDay ? t("emptyDay") : t("emptyRange")}</p>
                <p className={T.meta}>{isToday ? t("emptyHint") : oneDay ? t("emptyDayHint") : t("emptyRangeHint")}</p>
              </GoCard>
            ) : found.length === 0 ? (
              <GoCard className="items-center py-major text-center">
                <Search size={28} strokeWidth={1.5} aria-hidden className="text-muted" />
                <p className={T.card}>{t("noMatch", { query: query.trim() })}</p>
                <Button variant="secondary" size="lg" className={`rail:h-10! ${R.button}`} onClick={() => setQuery("")}>{t("clearSearch")}</Button>
              </GoCard>
            ) : (
              <div className="overflow-hidden rounded-card bg-card shadow-card">
                <div aria-hidden className={`hidden border-b border-line bg-subtle px-card py-tight ${T.label} rail:grid rail:items-center rail:gap-0 ${oneDay ? COLS : COLS_RANGE}`}>
                  <span>{t("colTime")}</span>
                  <span>{t("colCode")}</span>
                  <span>{t("colItems")}</span>
                  <span>{t("colMethod")}</span>
                  <span className="text-right">{t("colAmount")}</span>
                  <span className="pl-comfortable">{t("colStatus")}</span>
                  <span />
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((o) => {
                    const method = methodOf(o);
                    /* Money is held on this sale and nobody has asked for it back yet. */
                    const asked = !!pendingRefundForOrder(o.id);
                    const canAsk = !asked && !actor.loading && actor.refundMode !== "off" && goodwillMaxFor(o.id) > 0;
                    return (
                      <li key={o.id} className={`${ROW_BASE} ${oneDay ? COLS : COLS_RANGE}`}>
                        <div className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-tight rail:contents">
                          <span className={`${T.meta} whitespace-nowrap tabular-nums`}>{oneDay ? formatClockOf(o.createdAt) : `${formatRange(orderDay(o), orderDay(o)).replace(/ \d{4}$/, "")} · ${formatClockOf(o.createdAt)}`}</span>
                          <span className={`truncate font-mono ${T.meta} font-medium text-fg-secondary`}>{o.reference}</span>
                        </div>
                        <span className={`col-start-1 row-start-2 truncate ${T.body} rail:col-auto rail:row-auto`}>
                          {itemsShort(o)}
                          {method && <span className={`${T.meta} rail:hidden`}> · {labels.method(method)}</span>}
                        </span>
                        <span className={`hidden ${T.body} rail:block`}>{method ? labels.method(method) : "—"}</span>
                        <span className={`${T.price} col-start-2 row-start-1 text-right rail:col-auto rail:row-auto`}>{money(o.total)}</span>
                        <div className="col-start-2 row-start-2 flex items-center justify-end gap-tight rail:contents">
                          <span className="flex flex-col items-end gap-inline rail:items-start rail:pl-comfortable">
                            <StatusPill status={o.status} size="md" />
                            {asked && (
                              <span data-refund-asked className={`inline-flex w-fit items-center gap-1 rounded-full bg-warning-wash px-tight py-0.5 text-xs font-medium text-fg`}>
                                <RotateCcw size={12} strokeWidth={2.25} aria-hidden />
                                {t("refundAsked")}
                              </span>
                            )}
                          </span>
                          <span className="print:hidden">
                            <ActionMenu
                              shape="go"
                              label={t("rowActions", { code: o.reference })}
                              items={[
                                ...(canAsk ? [{ key: "refund", label: t("askRefund"), icon: <RotateCcw size={16} strokeWidth={2} aria-hidden />, onSelect: () => setRefundOrder(o) }] : []),
                                { key: "reprint", label: t("reprint"), icon: <Printer size={16} strokeWidth={1.75} aria-hidden />, onSelect: () => router.push(`/print/receipt/${o.id}`) },
                              ]}
                            />
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {found.length > PAGE && (
              <div className="print:hidden">
                {shown < found.length ? (
                  <Button variant="secondary" size="lg" fullWidth className={`rail:h-10! ${R.button}`} onClick={() => setShown((n) => n + PAGE)}>{t("showMore")}</Button>
                ) : (
                  <Button variant="secondary" size="lg" fullWidth className={`rail:h-10! ${R.button}`} onClick={() => setShown(PAGE)}>{t("showLess")}</Button>
                )}
              </div>
            )}
          </section>

          {cur.best.length > 0 && (
            <GoCard className="order-2 rail:order-none rail:col-start-2" aria-labelledby="ms-best" title={<span id="ms-best">{t("bestSellers")}</span>}>
              <ol className="flex flex-col gap-comfortable">
                {cur.best.map((b, i) => (
                  <li key={b.name} className="flex items-center gap-comfortable">
                    <span className={`w-5 shrink-0 text-center ${T.meta} tabular-nums`}>{i + 1}</span>
                    <Thumb image={imageOf(b.name)} glyph={<Ticket strokeWidth={1.5} />} />
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 block ${T.item}`}>{b.name}</span>
                      <span className={`block ${T.meta}`}>{t("soldQty", { count: b.qty })}</span>
                    </span>
                    <span className={`shrink-0 ${T.price}`}>{money(b.amount)}</span>
                  </li>
                ))}
              </ol>
            </GoCard>
          )}
        </div>
      </main>
      </div>

      {refundOrder && (
        <RefundFlowSheet
          key={refundOrder.id}
          open
          onClose={() => setRefundOrder(null)}
          title={refundOrder.reference}
          when={formatClockOf(refundOrder.createdAt)}
          orderId={refundOrder.id}
          onDone={() => setRefundOrder(null)}
        />
      )}
    </GoPage>
  );
}
