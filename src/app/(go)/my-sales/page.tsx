"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Printer, ReceiptText, RotateCcw, Search, Ticket } from "lucide-react";
import { ActionMenu, Button, Notice, SegmentedControl, Skeleton, StatusPill } from "@/components/ui";
import { AffixInput } from "@/components/ui/Field";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatClockOf, formatDay, formatMoney } from "@/lib/format";
import { DEMO_TODAY, demoDay } from "@/lib/schedule";
import { DEMO_STAFF_ID } from "@/lib/session";
import { getOperator, getStaff, listOrders, listProducts, peekPaymentSettings, type Order } from "@/lib/api";
import { goodwillMaxFor, pendingRefundForOrder, useRefundVersion } from "@/lib/api/refundRequests";
import { GoCard } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";
import { R, RAIL_SEGMENT } from "../_components/railType";
import { T } from "../_components/type";
import { Thumb } from "../_components/Thumb";
import { RefundFlowSheet } from "../_components/RefundFlowSheet";
import { useActor } from "../schedule/_lib/actor";
import { dayBeforeDays, summarise, todayDays, yesterdayDays } from "./_lib/summary";
import { MethodBars } from "./_components/MethodBars";

const PAGE = 10;

type Period = "today" | "yesterday";

/* The phone body, exactly as it was before the page sat in GoPage (16px above,
   room for the tab bar below); on a desktop GoPage's own rhythm takes over. */
const PHONE = "mx-auto w-full max-w-216 pt-tight pb-28 lg:pb-section rail:max-w-none rail:pt-0 rail:pb-0";

/* One row of the sales list. Phone: time and code over the amount, the items
   under them, the status and the menu at the right. Desktop: one line of
   columns, the same ones as the header row. */
const COLS = "rail:grid-cols-[64px_128px_minmax(0,1fr)_72px_96px_96px_44px]";
const ROW = `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-comfortable gap-y-inline px-comfortable py-comfortable rail:gap-y-0 rail:px-card rail:py-tight rail:min-h-12 ${COLS}`;

/** "2× Adult, Child" — short enough for one line. */
const itemsShort = (o: Order) =>
  o.lines
    .filter((l) => !l.parentLineId)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.productName}` : l.productName))
    .join(", ");

/** What was paid with: the first method that took money. */
const methodOf = (o: Order) => o.payments.find((p) => p.amount > 0)?.method;

/** "▲ ৳9,384 more than yesterday" — only when there is a previous figure. */
function Delta({ diff, show, fmt, name }: { diff: number; show: boolean; fmt: (n: number) => string; name: string }) {
  const t = useTranslations("mysales");
  if (!show) return <p className={T.meta}>{t("noCompare", { name })}</p>;
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
  const [period, setPeriod] = useState<Period>("today");
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
  /* The period shown, and the one before it for the "more than…" lines. */
  const cur = useMemo(
    () => (orders ? summarise(orders, DEMO_STAFF_ID, period === "today" ? todayDays() : yesterdayDays()) : null),
    [orders, period],
  );
  const prev = useMemo(
    () => (orders ? summarise(orders, DEMO_STAFF_ID, period === "today" ? yesterdayDays() : dayBeforeDays()) : null),
    [orders, period],
  );

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

  const isToday = period === "today";
  const refName = isToday ? t("refYesterday") : t("refDayBefore");
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
              <span className="hidden print:inline">{t("printedFor", { name: meQ.data?.name ?? "", date: formatDay(isToday ? DEMO_TODAY : demoDay(-1)) })}</span>
            </>
          }
          /* The word is always visible (a bare printer glyph is a guess); the full
             action is the name and the tooltip. */
          actions={
            <Button variant="secondary" size="lg" className={`shrink-0 shadow-card print:hidden rail:h-10! ${R.button}`} aria-label={t("print")} title={t("print")} onClick={() => window.print()}>
              <Printer size={18} strokeWidth={1.5} aria-hidden />
              {t("printShort")}
            </Button>
          } className="mb-comfortable! rail:mb-major!"
        />
      </div>

      <main className="flex flex-col gap-comfortable rail:gap-section">
        {/* Which day. "This shift" waits for the till to stamp a shift on a sale
            (orders carry a shiftId field that nothing fills in yet). */}
        <div className="print:hidden">
          <SegmentedControl
            size="sm"
            className={`w-full rail:w-auto ${RAIL_SEGMENT} rail:[&_[role=radio]]:min-h-9 rail:[&_[role=radio]]:h-9`}
            fullWidth
            aria-label={t("periodLabel")}
            value={period}
            onChange={(v) => {
              setPeriod(v as Period);
              setShown(PAGE);
            }}
            options={[
              { value: "today", label: t("today") },
              { value: "yesterday", label: t("yesterday") },
            ]}
          />
        </div>

        {/* The figures: what you sold is the one that leads. */}
        <GoCard className="rail:p-card" aria-labelledby="ms-hero">
          <div className="grid grid-cols-2 gap-x-comfortable gap-y-section rail:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] rail:gap-x-section">
            <div className="col-span-2 flex flex-col gap-inline rail:col-span-1">
              <p id="ms-hero" className={T.label}>{t("youSold")} · {isToday ? t("today") : t("yesterday")}</p>
              <p className="text-3xl font-semibold tabular-nums text-fg rail:text-4xl">{money(cur.total)}</p>
              <Delta diff={cur.total - prev.total} show={hasPrev} fmt={money} name={refName} />
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
                <p className={T.card}>{isToday ? t("empty") : t("emptyDay")}</p>
                <p className={T.meta}>{isToday ? t("emptyHint") : t("emptyDayHint")}</p>
              </GoCard>
            ) : found.length === 0 ? (
              <GoCard className="items-center py-major text-center">
                <Search size={28} strokeWidth={1.5} aria-hidden className="text-muted" />
                <p className={T.card}>{t("noMatch", { query: query.trim() })}</p>
                <Button variant="secondary" size="lg" className={`rail:h-10! ${R.button}`} onClick={() => setQuery("")}>{t("clearSearch")}</Button>
              </GoCard>
            ) : (
              <div className="overflow-hidden rounded-card bg-card shadow-card">
                <div aria-hidden className={`hidden border-b border-line bg-subtle px-card py-tight ${T.label} rail:grid rail:items-center rail:gap-0 ${COLS}`}>
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
                      <li key={o.id} className={ROW}>
                        <div className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-tight rail:contents">
                          <span className={`${T.meta} tabular-nums`}>{formatClockOf(o.createdAt)}</span>
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
