"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer, ReceiptText, RotateCcw, Ticket } from "lucide-react";
import { Button, Notice, Skeleton, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatClockOf, formatDay, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEMO_STAFF_ID } from "@/lib/session";
import { getOperator, getStaff, listOrders, listProducts, peekPaymentSettings, type Order } from "@/lib/api";
import { goodwillMaxFor, pendingRefundForOrder, useRefundVersion } from "@/lib/api/refundRequests";
import { GoCard, TileLabel } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";
import { Thumb } from "../_components/Thumb";
import { RefundFlowSheet } from "../_components/RefundFlowSheet";
import { useActor } from "../schedule/_lib/actor";
import { summarise, todayDays, yesterdayDays } from "./_lib/summary";
import { MethodBars } from "./_components/MethodBars";

const PAGE = 8;

/* The phone body, exactly as it was before the page sat in GoPage (16px above,
   room for the tab bar below); on a desktop GoPage's own rhythm takes over. */
const PHONE = "mx-auto w-full max-w-216 pt-tight pb-28 lg:pb-section rail:max-w-none rail:pt-0 rail:pb-0";

/* A list is one white card of hairline rows on a desktop; on a phone each row
   is its own card, as it always was. */
const LIST_CARD = "flex flex-col gap-tight rail:rounded-card rail:bg-card rail:shadow-card rail:gap-0 rail:overflow-hidden";
const LIST_ROW =
  "card-surface p-comfortable rail:rounded-none rail:border-t rail:border-line rail:bg-transparent rail:px-card rail:py-comfortable rail:shadow-none rail:first:border-t-0";

/** "2× Adult, Child" — short enough for one line. */
const itemsShort = (o: Order) =>
  o.lines
    .filter((l) => !l.parentLineId)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.productName}` : l.productName))
    .join(", ");

export default function MySalesPage() {
  const t = useTranslations("mysales");
  const labels = useEnumLabels();
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
  const today = useMemo(() => (orders ? summarise(orders, DEMO_STAFF_ID, todayDays()) : null), [orders]);
  const yesterday = useMemo(() => (orders ? summarise(orders, DEMO_STAFF_ID, yesterdayDays()) : null), [orders]);

  if (ordersQ.error) {
    return (
      <GoPage width="wide">
        <main className="pt-tight pb-section rail:pt-0">
          <Notice tone="danger" title={t("loadError")} action={{ label: t("retry"), onClick: ordersQ.reload }} />
        </main>
      </GoPage>
    );
  }

  if (!today || !yesterday) {
    return (
      <GoPage width="wide">
        <main aria-busy className={`flex flex-col gap-comfortable ${PHONE}`}>
          <Skeleton h={28} w="40%" className="rail:hidden" />
          <div className="flex flex-col gap-comfortable rail:grid rail:grid-cols-3 rail:gap-section">
            <Skeleton h={168} className="rounded-card" />
            <Skeleton h={140} className="rounded-card" />
            <Skeleton h={220} className="rounded-card" />
          </div>
        </main>
      </GoPage>
    );
  }

  const float = peekPaymentSettings().defaultFloat;
  const shouldHave = float + today.cashTaken - today.cashRefunds;
  const diff = today.total - yesterday.total;
  const compare =
    yesterday.orders === 0
      ? t("noYesterday")
      : diff === 0
        ? t("sameAsYesterday")
        : diff > 0
          ? t("moreThanYesterday", { amount: money(diff) })
          : t("lessThanYesterday", { amount: money(-diff) });
  const share = Math.max(1, today.byMethod.reduce((s, m) => s + Math.max(0, m.amount), 0));
  const rows = today.recent.slice(0, shown);
  const sold = today.byMethod.filter((m) => m.count > 0 || m.amount !== 0);

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
              <span className="hidden print:inline">{t("printedFor", { name: meQ.data?.name ?? "", date: formatDay(DEMO_TODAY) })}</span>
            </>
          }
          /* The word is always visible (a bare printer glyph is a guess); the full
             action is the name and the tooltip. */
          actions={
            <Button variant="secondary" size="lg" className="shrink-0 shadow-card print:hidden" aria-label={t("print")} title={t("print")} onClick={() => window.print()}>
              <Printer size={18} strokeWidth={1.5} aria-hidden />
              {t("printShort")}
            </Button>
          } className="mb-comfortable! rail:mb-major!"
        />
      </div>

      {/* Phone: one column, as before. Desktop: a band of three cards (what you
          sold, the drawer, the way people paid), then the sales as one card of
          rows beside the best sellers. Placed explicitly so the phone's own
          order (the one number, best sellers, drawer, methods, sales) stays. */}
      <main className="flex flex-col gap-comfortable rail:grid rail:grid-cols-12 rail:items-start rail:gap-section">
        {/* The one number: what you sold. */}
        <GoCard className="gap-tight rail:col-span-4 rail:col-start-1 rail:row-start-1 rail:self-stretch" aria-labelledby="ms-hero">
          <p id="ms-hero" className="text-sm font-semibold text-muted">
            {t("youSold")} · {t("today")}
          </p>
          <p className="text-3xl font-semibold tabular-nums rail:text-4xl">{money(today.total)}</p>
          <p className="text-base text-fg">
            {t("salesCount", { count: today.orders })} · {t("itemsCount", { count: today.items })}
          </p>
          <p className="text-sm text-muted">{compare}</p>
        </GoCard>

        {today.recent.length === 0 ? (
          <GoCard className="items-center py-major text-center rail:col-span-8 rail:col-start-5 rail:row-start-1 rail:justify-center rail:self-stretch">
            <ReceiptText size={32} strokeWidth={1.5} aria-hidden className="text-muted" />
            <p className="text-md font-semibold">{t("empty")}</p>
            <p className="text-sm text-muted">{t("emptyHint")}</p>
          </GoCard>
        ) : (
          <>
            {today.best.length > 0 && (
              <section className="flex flex-col gap-tight rail:col-span-5 rail:col-start-8 rail:row-start-2" aria-labelledby="ms-best">
                <TileLabel id="ms-best" className="px-inline">{t("bestSellers")}</TileLabel>
                <ol className={LIST_CARD}>
                  {today.best.map((b) => (
                    <li key={b.name} className={`${LIST_ROW} flex items-center gap-comfortable`}>
                      <Thumb image={imageOf(b.name)} glyph={<Ticket strokeWidth={1.5} />} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-md font-semibold">{b.name}</span>
                        <span className="block text-sm text-muted">{t("soldQty", { count: b.qty })}</span>
                      </span>
                      <span className="shrink-0 text-md font-semibold tabular-nums">{money(b.amount)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Phone and tablet-upright: two cards side by side from lg; on a
                desktop the wrapper steps aside and each card is a band cell. */}
            <div className="flex flex-col gap-comfortable lg:grid lg:grid-cols-2 lg:items-start rail:contents">
              <GoCard className="rail:col-span-4 rail:col-start-5 rail:row-start-1 rail:self-stretch" aria-labelledby="ms-drawer" title={<span id="ms-drawer">{t("drawerTitle")}</span>}>
                <dl className="flex flex-col text-base tabular-nums">
                  <div className="flex justify-between py-tight"><dt className="text-muted">{t("startCash")}</dt><dd>{money(float)}</dd></div>
                  <div className="flex justify-between py-tight"><dt className="text-muted">+ {t("cashTaken")}</dt><dd>{money(today.cashTaken)}</dd></div>
                  <div className="flex justify-between py-tight"><dt className="text-muted">− {t("cashRefunds")}</dt><dd>{money(today.cashRefunds)}</dd></div>
                  <div className="flex justify-between mt-tight pt-tight text-lg font-semibold rail:border-t rail:border-line"><dt>{t("shouldHave")}</dt><dd>{money(shouldHave)}</dd></div>
                </dl>
                <p className="text-sm text-muted">{t("drawerNote")}</p>
              </GoCard>

              <GoCard className="rail:col-span-4 rail:col-start-9 rail:row-start-1 rail:self-stretch" aria-labelledby="ms-methods" title={<span id="ms-methods">{t("byMethod")}</span>}>
                {sold.length === 0 ? (
                  <p className="text-sm text-muted">{t("noMethods")}</p>
                ) : (
                <MethodBars
                  rows={sold.map((m) => ({
                    key: m.method,
                    label: labels.method(m.method),
                    amount: money(m.amount),
                    count: t("salesShort", { count: m.count }),
                    share: t("share", { pct: Math.round((Math.max(0, m.amount) / share) * 100), method: labels.method(m.method).toLocaleLowerCase() }),
                    pct: Math.round((Math.max(0, m.amount) / share) * 100),
                  }))}
                />
                )}
              </GoCard>
            </div>

            <section className="flex flex-col gap-tight rail:col-span-7 rail:col-start-1 rail:row-start-2" aria-labelledby="ms-recent">
              <TileLabel id="ms-recent" className="px-inline">{t("recent")}</TileLabel>
              <ul className={LIST_CARD}>
                {rows.map((o) => {
                  const method = o.payments.find((p) => p.amount > 0)?.method;
                  /* Money is held on this sale and nobody has asked for it back yet. */
                  const asked = !!pendingRefundForOrder(o.id);
                  const canAsk = !asked && !actor.loading && actor.refundMode !== "off" && goodwillMaxFor(o.id) > 0;
                  return (
                    <li key={o.id} className={`${LIST_ROW} flex flex-col gap-tight`}>
                      <div className="flex items-center gap-comfortable">
                      <Thumb glyph={<ReceiptText strokeWidth={1.5} />} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm font-semibold">{o.reference}</span>
                        <span className="block truncate text-sm text-muted">
                          {formatClockOf(o.createdAt)} · {itemsShort(o)}
                          {method ? ` · ${labels.method(method)}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-inline">
                        <span className="text-md font-semibold tabular-nums">{money(o.total)}</span>
                        <StatusPill status={o.status} size="md" />
                      </span>
                      </div>
                      {asked ? (
                        <p data-refund-asked className="inline-flex w-fit items-center gap-1 rounded-full bg-warning-wash px-comfortable py-inline text-sm font-semibold text-fg">
                          <RotateCcw size={14} strokeWidth={2.25} aria-hidden />
                          {t("refundAsked")}
                        </p>
                      ) : canAsk ? (
                        <Button variant="link" data-ask-refund onClick={() => setRefundOrder(o)} className="min-h-11 self-end print:hidden">
                          <RotateCcw size={16} strokeWidth={2} aria-hidden />
                          {t("askRefund")}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {today.recent.length > PAGE && (
                <div className="print:hidden">
                  {shown < today.recent.length ? (
                    <Button variant="secondary" size="lg" fullWidth onClick={() => setShown((n) => n + PAGE)}>{t("showMore")}</Button>
                  ) : (
                    <Button variant="secondary" size="lg" fullWidth onClick={() => setShown(PAGE)}>{t("showLess")}</Button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
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
