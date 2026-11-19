"use client";

import { useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Download, Printer, ReceiptText, RotateCcw, Search } from "lucide-react";
import { ActionMenu, Button, DateRangePicker, formatRange, Notice, Skeleton, StatusPill, type DateRangeValue } from "@/components/ui";
import { saveCsv, toCsv } from "@/lib/csv";
import { AffixInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatClockOf, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEMO_STAFF_ID } from "@/lib/session";
import { getOperator, getStaff, listOrders, peekPaymentSettings, type Order } from "@/lib/api";
import { goodwillMaxFor, pendingRefundForOrder, useRefundVersion } from "@/lib/api/refundRequests";
import { GoCard } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";
import { R } from "../_components/railType";
import { T } from "../_components/type";
import { RefundFlowSheet } from "../_components/RefundFlowSheet";
import { useActor } from "../schedule/_lib/actor";
import { daysIn, orderDay, previousRange, rangeLength, shiftIso, summarise } from "./_lib/summary";

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
   columns, the same ones as the header row. The first column holds the time
   on one day, or "8 Nov · 11:05 AM" over several, so it widens when the range
   does. */
const COLS = "rail:grid-cols-[148px_minmax(0,1fr)_96px_120px_112px_44px]";
const COLS_RANGE = COLS;
const ROW_BASE = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-comfortable gap-y-inline px-comfortable py-comfortable rail:gap-0 rail:px-card rail:py-tight rail:min-h-14";

/** "2× Adult, Child" — short enough for one line. */
const itemsShort = (o: Order) =>
  o.lines
    .filter((l) => !l.parentLineId)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.productName}` : l.productName))
    .join(", ");

/** What was paid with: the first method that took money. */
const methodOf = (o: Order) => o.payments.find((p) => p.amount > 0)?.method;

/**
 * "▲ ৳9,384 more than yesterday" — only when there is a previous figure.
 *
 * The lead figure says the whole sentence, so it names what is being compared
 * with. The figures beside it say only the change ("▲ 5"): five copies of "more
 * than yesterday" in a row is noise, and it wrapped in every narrow column. The
 * full sentence stays on them for a hover and for a screen reader.
 */
function Delta({ diff, show, fmt, name, lead = false }: { diff: number; show: boolean; fmt: (n: number) => string; name: string; lead?: boolean }) {
  const t = useTranslations("mysales");
  /* Nothing to compare with is said once, under the lead figure, not five times. */
  if (!show) return lead ? <p className={T.meta}>{t("noCompare", { name })}</p> : null;
  if (diff === 0) return <p className={T.meta}>{lead ? t("cmpSame", { name }) : t("cmpSameShort")}</p>;
  const up = diff > 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  const full = t(up ? "cmpUp" : "cmpDown", { amount: fmt(Math.abs(diff)), name });
  return (
    <p title={lead ? undefined : full} className={`flex items-start gap-1 ${T.meta} font-medium ${up ? "text-success" : "text-danger"}`}>
      <Arrow size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
      {lead ? (
        <span>{full}</span>
      ) : (
        <>
          <span aria-hidden className="tabular-nums">{fmt(Math.abs(diff))}</span>
          <span className="sr-only">{full}</span>
        </>
      )}
    </p>
  );
}

interface Figure {
  key: string;
  label: ReactNode;
  value: ReactNode;
  note: ReactNode;
  lead?: boolean;
}

/**
 * The figures for the dates shown.
 *
 * Phone: a row of small cards that scrolls sideways — the figures are a glance,
 * and on a phone the sales list is what the cashier came for, so the summary
 * takes one card's height instead of a screenful. The first card is wider and
 * the next one peeks in at the edge, which is what says "there is more this way".
 *
 * Desktop: one band, five equal figures split by hairlines. Equal columns keep
 * every "more than yesterday" on one line; the lead figure is set larger, not wider.
 */
function Figures({ items, labelledBy }: { items: Figure[]; labelledBy: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="-mx-section flex snap-x snap-mandatory scroll-px-section gap-tight overflow-x-auto px-section pb-inline no-scrollbar rail:mx-0 rail:grid rail:snap-none rail:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] rail:gap-0 rail:overflow-visible rail:rounded-card rail:bg-card rail:px-0 rail:pb-0 rail:shadow-card rail:divide-x rail:divide-line"
    >
      {items.map((f) => (
        <div
          key={f.key}
          className={cn(
            // relative: the screen-reader text inside a card scrolled out of view must not widen the page.
            "card-surface relative flex shrink-0 snap-start flex-col gap-inline p-comfortable",
            f.lead ? "w-64" : "w-44",
            "rail:w-auto rail:min-w-0 rail:rounded-none rail:bg-transparent rail:p-card rail:shadow-none",
          )}
        >
          <p className={T.label}>{f.label}</p>
          <p className={cn("tabular-nums text-fg", f.lead ? "text-2xl font-semibold rail:text-3xl" : "text-xl font-semibold rail:text-2xl")}>{f.value}</p>
          {f.note}
        </div>
      ))}
    </section>
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
          <Skeleton h={120} className="rounded-card" />
          <div className="flex flex-col gap-comfortable rail:grid rail:grid-cols-[minmax(0,1fr)_340px] rail:gap-section">
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
  const q = query.trim().toLocaleLowerCase();
  const found = q ? cur.recent.filter((o) => o.reference.toLocaleLowerCase().includes(q) || itemsShort(o).toLocaleLowerCase().includes(q)) : cur.recent;
  const rows = found.slice(0, shown);

  const figures: Figure[] = [
    {
      key: "total",
      lead: true,
      label: (
        <span id="ms-hero">
          {t("youSold")} · {rangeName}
        </span>
      ),
      value: money(cur.total),
      note: <Delta lead diff={cur.total - prev.total} show={hasPrev} fmt={money} name={refName} />,
    },
    { key: "count", label: t("kpiCount"), value: cur.orders, note: <Delta diff={cur.orders - prev.orders} show={hasPrev} fmt={String} name={refName} /> },
    {
      key: "avg",
      label: t("kpiAvg"),
      value: avg == null ? "—" : money(avg),
      note: avg != null ? <Delta diff={avg - prevAvg} show={hasPrev} fmt={money} name={refName} /> : null,
    },
    { key: "items", label: t("kpiItems"), value: cur.items, note: <Delta diff={cur.items - prev.items} show={hasPrev} fmt={String} name={refName} /> },
    { key: "refunds", label: t("kpiRefunds"), value: money(cur.refunds), note: <p className={T.meta}>{t("refundCount", { count: cur.refundCount })}</p> },
  ];

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
            className="mb-comfortable! rail:mb-section!"
          />
        </div>

        <main className="flex flex-col gap-section rail:gap-major">
          {/* Which dates, and what to do with them. One button names the range and
              opens the named ranges beside a two-month calendar (the picker the
              admin's reports use); Export and Print act on exactly what is shown. */}
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

          <Figures items={figures} labelledBy="ms-hero" />

          {/* The sales, then the drawer. On a phone they stack in that order; on a
              desktop the drawer sits beside the list while it is today's. */}
          <div className={cn("flex flex-col gap-section", isToday && "rail:grid rail:grid-cols-[minmax(0,1fr)_340px] rail:items-start rail:gap-major")}>
            <section className="flex min-w-0 flex-col gap-comfortable" aria-labelledby="ms-recent">
              <div className="flex flex-col gap-tight rail:flex-row rail:items-center rail:justify-between rail:gap-comfortable">
                <h2 id="ms-recent" className={T.card}>
                  {t("recent")}
                  {cur.recent.length > 0 && <span className={`ms-tight ${T.meta} font-normal`}>{cur.recent.length}</span>}
                </h2>
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
                  <Button variant="secondary" size="lg" className={`rail:h-10! ${R.button}`} onClick={() => setQuery("")}>
                    {t("clearSearch")}
                  </Button>
                </GoCard>
              ) : (
                <div className="overflow-hidden rounded-card bg-card shadow-card">
                  <div aria-hidden className={`hidden border-b border-line px-card py-comfortable ${T.label} rail:grid rail:items-center rail:gap-0 ${oneDay ? COLS : COLS_RANGE}`}>
                    <span>{t("colCode")}</span>
                    <span>{t("colItems")}</span>
                    <span>{t("colMethod")}</span>
                    <span className="text-right">{t("colAmount")}</span>
                    <span className="pl-section">{t("colStatus")}</span>
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
                          {/* Phone: the time, then the code, on one line. Desktop: the code over its time. */}
                          <div className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-tight rail:col-auto rail:row-auto rail:flex-col-reverse rail:items-start rail:gap-0">
                            <span className={`${T.meta} whitespace-nowrap tabular-nums`}>{oneDay ? formatClockOf(o.createdAt) : `${formatRange(orderDay(o), orderDay(o)).replace(/ \d{4}$/, "")} · ${formatClockOf(o.createdAt)}`}</span>
                            <span className={`truncate font-mono ${T.meta} font-medium text-fg-secondary`}>{o.reference}</span>
                          </div>
                          <span className={`col-start-1 row-start-2 truncate ${T.body} rail:col-auto rail:row-auto rail:pr-section`} title={itemsShort(o)}>
                            {itemsShort(o)}
                            {method && <span className={`${T.meta} rail:hidden`}> · {labels.method(method)}</span>}
                          </span>
                          <span className={`hidden ${T.body} text-fg-secondary rail:block`}>{method ? labels.method(method) : "—"}</span>
                          <span className={`${T.price} col-start-2 row-start-1 text-right rail:col-auto rail:row-auto`}>{money(o.total)}</span>
                          <div className="col-start-2 row-start-2 flex items-center justify-end gap-tight rail:contents">
                            <span className="flex flex-col items-end gap-inline rail:items-start rail:pl-section">
                              <StatusPill status={o.status} size="md" />
                              {asked && (
                                <span data-refund-asked className="inline-flex w-fit items-center gap-1 rounded-full bg-warning-wash px-tight py-0.5 text-xs font-medium text-fg">
                                  <RotateCcw size={12} strokeWidth={2.25} aria-hidden />
                                  {t("refundAsked")}
                                </span>
                              )}
                            </span>
                            <span className="flex justify-end print:hidden">
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
                    <Button variant="secondary" size="lg" fullWidth className={`rail:h-10! ${R.button}`} onClick={() => setShown((n) => n + PAGE)}>
                      {t("showMore")}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="lg" fullWidth className={`rail:h-10! ${R.button}`} onClick={() => setShown(PAGE)}>
                      {t("showLess")}
                    </Button>
                  )}
                </div>
              )}
            </section>

            {/* The cash drawer: what staff count against at the end of a shift. It
                is about the drawer now, so it is shown for today only. */}
            {isToday && (
              <GoCard className="rail:sticky rail:top-section" aria-labelledby="ms-drawer" title={<span id="ms-drawer">{t("drawerTitle")}</span>}>
                <dl className="flex flex-col tabular-nums">
                  <div className="flex items-baseline justify-between py-tight">
                    <dt className={T.body}>{t("startCash")}</dt>
                    <dd className={T.price}>{money(float)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between py-tight">
                    <dt className={T.body}>+ {t("cashTaken")}</dt>
                    <dd className={T.price}>{money(cur.cashTaken)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between py-tight">
                    <dt className={T.body}>− {t("cashRefunds")}</dt>
                    <dd className={T.price}>{money(cur.cashRefunds)}</dd>
                  </div>
                  <div className="mt-tight flex items-baseline justify-between border-t border-line pt-comfortable">
                    <dt className={`${T.body} font-semibold`}>{t("shouldHave")}</dt>
                    <dd className={T.total}>{money(shouldHave)}</dd>
                  </div>
                </dl>
                <p className={T.meta}>{t("drawerNote")}</p>
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
