"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer, ReceiptText } from "lucide-react";
import { Button, Notice, Skeleton, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { useEnumLabels } from "@/lib/labels";
import { formatClockOf, formatDay, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEMO_STAFF_ID } from "@/lib/session";
import { getOperator, getStaff, listOrders, peekPaymentSettings, type Order } from "@/lib/api";
import { summarise, todayDays, yesterdayDays } from "./_lib/summary";
import { MethodBars } from "./_components/MethodBars";

const PAGE = 8;

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
  const ordersQ = useApiQuery(() => listOrders({ pageSize: 2000 }), []);
  const opQ = useApiQuery(() => getOperator(), []);
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const currency = opQ.data?.currency ?? "BDT";
  const money = (m: number) => formatMoney(m, currency);

  const orders = ordersQ.data?.data;
  const today = useMemo(() => (orders ? summarise(orders, DEMO_STAFF_ID, todayDays()) : null), [orders]);
  const yesterday = useMemo(() => (orders ? summarise(orders, DEMO_STAFF_ID, yesterdayDays()) : null), [orders]);

  if (ordersQ.error) {
    return (
      <main className="mx-auto w-full max-w-4xl px-section py-section">
        <Notice tone="danger" title={t("loadError")} action={{ label: t("retry"), onClick: ordersQ.reload }} />
      </main>
    );
  }

  if (!today || !yesterday) {
    return (
      <main aria-busy className="mx-auto flex w-full max-w-4xl flex-col gap-section px-section py-section pb-28 lg:pb-section">
        <Skeleton h={28} w="40%" />
        <Skeleton h={168} className="rounded-card" />
        <Skeleton h={140} className="rounded-card" />
        <Skeleton h={220} className="rounded-card" />
      </main>
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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-section px-section py-section pb-28 lg:pb-section">
      {/* The shell's bars are not part of a printed summary. */}
      <style>{`@media print { header, nav { display: none !important; } }`}</style>

      <div className="flex items-start justify-between gap-tight">
        <div className="min-w-0">
          <h1 className="type-h1 text-xl">{t("title")}</h1>
          <p className="text-sm text-muted print:hidden">{t("subtitle")}</p>
          <p className="hidden text-sm text-muted print:block">{t("printedFor", { name: meQ.data?.name ?? "", date: formatDay(DEMO_TODAY) })}</p>
        </div>
        {/* A glyph on a phone, so the title keeps its one line; the word is the name. */}
        <Button variant="secondary" size="lg" className="min-w-12 shrink-0 px-tight sm:px-major print:hidden" aria-label={t("print")} onClick={() => window.print()}>
          <Printer size={18} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">{t("print")}</span>
        </Button>
      </div>

      {/* The one number: what you sold. */}
      <section className="flex flex-col gap-tight p-section card-surface" aria-labelledby="ms-hero">
        <p id="ms-hero" className="text-sm font-semibold text-muted">
          {t("youSold")} · {t("today")}
        </p>
        <p className="text-4xl font-semibold tabular-nums">{money(today.total)}</p>
        <p className="text-base text-fg">
          {t("salesCount", { count: today.orders })} · {t("itemsCount", { count: today.items })}
        </p>
        <p className="text-sm text-muted">{compare}</p>
      </section>

      {today.recent.length === 0 ? (
        <section className="flex flex-col items-center gap-tight p-major text-center card-surface">
          <ReceiptText size={32} strokeWidth={1.5} aria-hidden className="text-muted" />
          <p className="text-md font-semibold">{t("empty")}</p>
          <p className="text-sm text-muted">{t("emptyHint")}</p>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-section lg:grid lg:grid-cols-2 lg:items-start">
            <section className="flex flex-col gap-comfortable p-section card-surface" aria-labelledby="ms-drawer">
              <h2 id="ms-drawer" className="text-base font-semibold">{t("drawerTitle")}</h2>
              <dl className="flex flex-col text-base tabular-nums">
                <div className="flex justify-between py-tight"><dt className="text-muted">{t("startCash")}</dt><dd>{money(float)}</dd></div>
                <div className="flex justify-between border-t border-line py-tight"><dt className="text-muted">+ {t("cashTaken")}</dt><dd>{money(today.cashTaken)}</dd></div>
                <div className="flex justify-between border-t border-line py-tight"><dt className="text-muted">− {t("cashRefunds")}</dt><dd>{money(today.cashRefunds)}</dd></div>
                <div className="flex justify-between border-t-2 border-line pt-comfortable text-lg font-semibold"><dt>{t("shouldHave")}</dt><dd>{money(shouldHave)}</dd></div>
              </dl>
              <p className="text-sm text-muted">{t("drawerNote")}</p>
            </section>

            <section className="flex flex-col gap-comfortable p-section card-surface" aria-labelledby="ms-methods">
              <h2 id="ms-methods" className="text-base font-semibold">{t("byMethod")}</h2>
              <MethodBars
                rows={today.byMethod.map((m) => ({
                  key: m.method,
                  label: labels.method(m.method),
                  amount: money(m.amount),
                  count: t("salesShort", { count: m.count }),
                  pct: Math.round((Math.max(0, m.amount) / share) * 100),
                }))}
              />
            </section>
          </div>

          {today.best.length > 0 && (
            <section className="flex flex-col gap-tight p-section card-surface" aria-labelledby="ms-best">
              <h2 id="ms-best" className="text-base font-semibold">{t("bestSellers")}</h2>
              <ol className="flex flex-col">
                {today.best.map((b, i) => (
                  <li key={b.name} className="flex min-h-11 items-center gap-tight border-t border-line first:border-t-0">
                    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-semibold tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{b.name}</span>
                      <span className="block text-sm text-muted">{t("soldQty", { count: b.qty })}</span>
                    </span>
                    <span className="shrink-0 text-base font-semibold tabular-nums">{money(b.amount)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="flex flex-col gap-tight p-section card-surface" aria-labelledby="ms-recent">
            <h2 id="ms-recent" className="text-base font-semibold">{t("recent")}</h2>
            <ul className="flex flex-col">
              {rows.map((o) => {
                const method = o.payments.find((p) => p.amount > 0)?.method;
                return (
                  <li key={o.id} className="flex min-h-14 items-center gap-tight border-t border-line py-tight first:border-t-0">
                    <span className="w-16 shrink-0 text-sm tabular-nums text-muted">{formatClockOf(o.createdAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm">{o.reference}</span>
                      <span className="block truncate text-sm text-muted">
                        {itemsShort(o)}
                        {method ? ` · ${labels.method(method)}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-inline">
                      <span className="text-base font-semibold tabular-nums">{money(o.total)}</span>
                      <StatusPill status={o.status} size="md" />
                    </span>
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
  );
}
