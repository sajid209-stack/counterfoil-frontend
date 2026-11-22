"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Printer, RotateCcw } from "lucide-react";
import { ActionMenu, Button, StatusPill, formatRange } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useEnumLabels } from "@/lib/labels";
import { formatClock, formatClockOf, formatDay, formatMoney } from "@/lib/format";
import type { Order, PaymentMethod } from "@/lib/api";
import { R } from "../../_components/railType";
import { T } from "../../_components/type";
import { isBalancePayment, orderDay, type SaleRow, type SalesView } from "../_lib/summary";

/* The desktop columns, shared by the header row and every sale row so they stay
   aligned: Time & code | Customer | Items | Paid with | Amount | Status. */
export const INNER = "rail:grid-cols-[148px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_104px_120px]";
const OUTER = "grid grid-cols-[minmax(0,1fr)_44px] gap-x-tight rail:items-center rail:gap-x-0";

export interface Who {
  name: string;
  phone: string | null;
  email: string | null;
}

export interface SaleListContext {
  view: SalesView;
  oneDay: boolean;
  currency: string;
  who: (o: Order) => Who;
  staffName: (id: string | null | undefined) => string | null;
  counterName: (id: string | null) => string | null;
  asked: (o: Order) => boolean;
  canAsk: (o: Order) => boolean;
  onAsk: (o: Order) => void;
  onReprint: (o: Order) => void;
}

/** "2× Adult, Child": short enough for one line. */
export const itemsShort = (o: Order) =>
  o.lines
    .filter((l) => !l.parentLineId)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.productName}` : l.productName))
    .join(", ");

/** The money a row's payments took, by method, in the order they were first used. */
export function byMethod(row: SaleRow): { method: PaymentMethod; amount: number }[] {
  const out: { method: PaymentMethod; amount: number }[] = [];
  for (const p of row.payments) {
    if (p.amount <= 0) continue;
    const hit = out.find((x) => x.method === p.method);
    if (hit) hit.amount += p.amount;
    else out.push({ method: p.method, amount: p.amount });
  }
  return out;
}

/** The first booking on a sale: when the guest comes, so when they pay what is owed. */
const firstBooking = (o: Order) => o.lines.find((l) => l.booking)?.booking;

function useParts(ctx: SaleListContext) {
  const t = useTranslations("mysales");
  const labels = useEnumLabels();
  const money = (m: number) => formatMoney(m, ctx.currency);
  const paidWith = (row: SaleRow) => {
    const parts = byMethod(row);
    if (parts.length === 0) return t("notPaid");
    if (parts.length === 1) return labels.method(parts[0].method);
    return parts.map((p) => `${labels.method(p.method)} ${money(p.amount)}`).join(" + ");
  };
  const when = (iso: string) => (ctx.oneDay ? formatClockOf(iso) : `${formatRange(iso.slice(0, 10), iso.slice(0, 10)).replace(/ \d{4}$/, "")} · ${formatClockOf(iso)}`);
  return { t, labels, money, paidWith, when };
}

/** The little sub-line under a sale code: when a balance was collected, the sale's day. */
function CodeLine({ row, ctx, className }: { row: SaleRow; ctx: SaleListContext; className?: string }) {
  const { t } = useParts(ctx);
  return (
    <span className="flex min-w-0 flex-col items-start">
      <span className={cn("truncate font-mono", T.meta, "font-medium text-fg-secondary", className)}>{row.order.reference}</span>
      {ctx.view === "dueCollected" && <span className={cn("truncate", T.caption)}>{t("saleOn", { date: formatDay(orderDay(row.order)) })}</span>}
    </span>
  );
}

function Phone({ who, tel }: { who: Who; tel: boolean }) {
  if (!who.phone) return null;
  return tel ? (
    <a href={`tel:${who.phone.replace(/[^\d+]/g, "")}`} className="relative z-10 inline-flex min-h-11 items-center font-medium text-brand-foreground underline-offset-2 hover:underline rail:min-h-0">
      {who.phone}
    </a>
  ) : (
    <span>{who.phone}</span>
  );
}

function AmountText({ row, ctx, align }: { row: SaleRow; ctx: SaleListContext; align: "end" | "start" }) {
  const { t, money } = useParts(ctx);
  const owed = ctx.view === "owed";
  return (
    <span className={cn("flex flex-col", align === "end" ? "items-end text-right" : "items-start")}>
      <span className={cn(T.price, "whitespace-nowrap")}>{money(row.amount)}</span>
      {owed && <span className={cn(T.caption, "whitespace-nowrap")}>{t("ofOnly", { total: money(row.order.total) })}</span>}
    </span>
  );
}

function Pills({ row, ctx }: { row: SaleRow; ctx: SaleListContext }) {
  const { t, money } = useParts(ctx);
  return (
    <>
      {row.due > 0 && ctx.view !== "owed" && (
        <StatusPill tone="warning" size="md">
          {t("dueTag", { amount: money(row.due) })}
        </StatusPill>
      )}
      <StatusPill status={row.order.status} size="md" />
      {ctx.asked(row.order) && (
        <span data-refund-asked className="inline-flex w-fit items-center gap-1 rounded-full bg-warning-wash px-tight py-0.5 text-sm font-medium text-fg">
          <RotateCcw size={12} strokeWidth={2.25} aria-hidden />
          {t("refundAsked")}
        </span>
      )}
    </>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-tight", className)}>
      <h3 className={T.label}>{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "warning" }) {
  return (
    <div className="flex items-baseline justify-between gap-comfortable">
      <dt className={cn(strong ? T.item : T.body, tone === "warning" && "text-warning")}>{label}</dt>
      <dd className={cn(strong ? T.price : T.body, "text-right tabular-nums", tone === "warning" && "font-semibold text-warning")}>{value}</dd>
    </div>
  );
}

/** Everything about one sale, opened under its row. */
function Details({ row, ctx, id }: { row: SaleRow; ctx: SaleListContext; id: string }) {
  const { t, labels, money } = useParts(ctx);
  const o = row.order;
  const who = ctx.who(o);
  const confirmed = o.payments.filter((p) => p.status === "confirmed");
  const net = confirmed.reduce((s, p) => s + p.amount, 0);
  const counter = ctx.counterName(o.counterId);
  const tickets = o.lines.filter((l) => !l.parentLineId).reduce((s, l) => s + l.quantity, 0);
  return (
    <div id={id} className="grid gap-section border-t border-line bg-subtle px-comfortable py-comfortable rail:grid-cols-2 rail:gap-x-major rail:px-card">
      <Section title={t("d.customer")}>
        <p className={cn(T.item)}>{who.name}</p>
        {who.phone || who.email ? (
          <div className={cn("flex flex-col", T.body)}>
            {who.phone && (
              <a href={`tel:${who.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 w-fit items-center font-medium text-brand-foreground underline-offset-2 hover:underline rail:min-h-8">
                {who.phone}
              </a>
            )}
            {who.email && <span className="break-all text-fg-secondary">{who.email}</span>}
          </div>
        ) : (
          <p className={T.meta}>{t("d.noContact")}</p>
        )}
      </Section>

      <Section title={t("d.where")}>
        <dl className="flex flex-col gap-inline">
          <Line label={t("d.counter")} value={counter ?? "—"} />
          <Line label={t("d.channel")} value={o.channel === "online" ? t("d.channelOnline") : t("d.channelCounter")} />
          <Line label={t("d.ticketsLabel")} value={String(tickets)} />
        </dl>
      </Section>

      <Section title={t("d.items")}>
        <ul className="flex flex-col gap-tight">
          {o.lines.map((l) => (
            <li key={l.id} className={cn("flex items-start justify-between gap-comfortable", l.parentLineId && "ps-section")}>
              <div className="min-w-0">
                <p className={cn(T.body, "break-words")}>
                  {l.quantity}× {l.productName}
                  {l.tierName && l.tierName !== l.productName ? <span className="text-muted"> · {l.tierName}</span> : null}
                </p>
                {l.booking && (
                  <p className={T.meta}>
                    {[formatDay(l.booking.date, { weekday: true }), l.booking.startTime ? formatClock(l.booking.startTime) : null, l.booking.resourceName ?? l.booking.providerName].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <span className={cn(T.price, "shrink-0 whitespace-nowrap")}>{money(l.total)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("d.payments")}>
        {confirmed.length === 0 ? (
          <p className={T.meta}>{t("d.noPayments")}</p>
        ) : (
          <ul className="flex flex-col gap-tight">
            {confirmed.map((p) => {
              const staff = ctx.staffName(p.staffId);
              const bal = isBalancePayment(o, p);
              return (
                <li key={p.id} className="flex items-start justify-between gap-comfortable">
                  <div className="min-w-0">
                    <p className={cn(T.body, "break-words")}>
                      {p.amount < 0 ? t("d.refund") + " · " : ""}
                      {labels.method(p.method)}
                      {bal && <span className="ms-tight inline-flex rounded-full bg-warning-wash px-tight py-0.5 align-middle text-sm font-medium text-fg">{t("d.duePayment")}</span>}
                    </p>
                    <p className={cn(T.meta, "break-words")}>
                      {[formatClockOf(p.createdAt), p.reference ? t("d.ref", { ref: p.reference }) : null, staff ? t("d.takenBy", { name: staff }) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={cn(T.price, "shrink-0 whitespace-nowrap", p.amount < 0 && "text-danger")}>{money(p.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t("d.totals")}>
        <dl className="flex flex-col gap-inline tabular-nums">
          <Line label={t("d.subtotal")} value={money(o.subtotal)} />
          {o.discountTotal > 0 && <Line label={t("d.discount")} value={`−${money(o.discountTotal)}`} />}
          <Line label={t("d.vat")} value={money(o.taxTotal)} />
          <Line label={t("d.total")} value={money(o.total)} strong />
          <Line label={t("d.paid")} value={money(net)} />
          <Line label={t("d.due")} value={money(row.due)} tone={row.due > 0 ? "warning" : undefined} />
        </dl>
      </Section>

      <Section title={t("d.actions")}>
        <div className="flex flex-wrap gap-tight">
          <Button variant="secondary" size="lg" className={`rail:h-10! ${R.button}`} onClick={() => ctx.onReprint(o)}>
            <Printer size={16} strokeWidth={1.75} aria-hidden />
            {t("reprint")}
          </Button>
          {ctx.canAsk(o) && (
            <Button variant="secondary" size="lg" className={`rail:h-10! ${R.button}`} onClick={() => ctx.onAsk(o)}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden />
              {t("askRefund")}
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}

function SaleItem({ row, ctx, open, onToggle }: { row: SaleRow; ctx: SaleListContext; open: boolean; onToggle: () => void }) {
  const { t, paidWith, when } = useParts(ctx);
  const o = row.order;
  const who = ctx.who(o);
  const owed = ctx.view === "owed";
  const bk = owed ? firstBooking(o) : undefined;
  const bookingText = bk ? t("bookedFor", { when: [formatDay(bk.date, { weekday: true }), bk.startTime ? formatClock(bk.startTime) : null].filter(Boolean).join(" · ") }) : null;
  const items = itemsShort(o);
  const detailsId = `sale-${o.id}-${ctx.view}`;
  const canAsk = ctx.canAsk(o);
  return (
    <li className={cn("relative", open && "bg-subtle", "[&:last-child]:rounded-b-card")}>
      <div className={cn(OUTER, "px-comfortable py-comfortable rail:px-card rail:py-tight rail:min-h-14")}>
        {/* The whole row opens its details. A button laid under the row's
            text, so the phone link and the menu (which sit above it) can be
            pressed without opening it. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={t("detailsFor", { code: o.reference })}
          onClick={onToggle}
          className="absolute inset-0 z-0 w-full rounded-[inherit] focus-visible:outline-offset-[-2px]" // ds-exception: inherits the row's own corner so the focus ring follows it
        />

        {/* Phone: three lines, then the badges. */}
        <div className="pointer-events-none flex min-w-0 flex-col gap-inline rail:hidden">
          <div className="flex items-baseline justify-between gap-comfortable">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-tight">
              <span className={cn(T.meta, "whitespace-nowrap tabular-nums")}>{when(row.at)}</span>
              <span className={cn("whitespace-nowrap font-mono", T.meta, "font-medium text-fg-secondary")}>{o.reference}</span>
            </span>
            <AmountText row={row} ctx={ctx} align="end" />
          </div>
          {ctx.view === "dueCollected" && <span className={T.caption}>{t("saleOn", { date: formatDay(orderDay(o)) })}</span>}
          <p className={cn("flex min-w-0 flex-wrap items-baseline gap-x-tight", T.body)}>
            <span className="truncate font-medium">{who.name}</span>
            <span className={cn(T.meta, "pointer-events-auto")}>
              <Phone who={who} tel={owed} />
            </span>
          </p>
          <p className={cn("truncate", T.meta)}>{items}</p>
          {bookingText && <p className={cn(T.meta, "font-medium text-fg")}>{bookingText}</p>}
          <div className="flex flex-wrap items-center gap-tight">
            <span className={cn("inline-flex w-fit max-w-full items-center rounded-full bg-subtle px-tight py-0.5 text-sm font-medium text-fg-secondary ring-1 ring-inset ring-line", open && "bg-card")}>{paidWith(row)}</span>
            <Pills row={row} ctx={ctx} />
          </div>
        </div>

        {/* Desktop: one line of columns, the same ones as the header. */}
        <div className={cn("pointer-events-none hidden min-w-0 items-center rail:grid", INNER)}>
          <div className="flex min-w-0 flex-col-reverse items-start">
            <span className={cn(T.meta, "whitespace-nowrap tabular-nums")}>{when(row.at)}</span>
            <CodeLine row={row} ctx={ctx} />
          </div>
          <div className="flex min-w-0 flex-col pr-section">
            <span className={cn("truncate", T.body, "font-medium")} title={who.name}>{who.name}</span>
            <span className={cn("truncate", T.meta, "pointer-events-auto")}>
              <Phone who={who} tel={owed} />
            </span>
          </div>
          <div className="flex min-w-0 flex-col pr-section">
            <span className={cn("truncate", T.body)} title={items}>{items}</span>
            {bookingText && <span className={cn("truncate", T.meta)}>{bookingText}</span>}
          </div>
          <span className={cn(T.body, "text-fg-secondary", "pr-section")}>{paidWith(row)}</span>
          <AmountText row={row} ctx={ctx} align="end" />
          <div className="flex flex-col items-start gap-inline pl-section">
            <Pills row={row} ctx={ctx} />
          </div>
        </div>

        <span className="relative z-10 flex justify-end self-start print:hidden rail:self-center">
          <ActionMenu
            shape="go"
            label={t("rowActions", { code: o.reference })}
            items={[
              ...(canAsk ? [{ key: "refund", label: t("askRefund"), icon: <RotateCcw size={16} strokeWidth={2} aria-hidden />, onSelect: () => ctx.onAsk(o) }] : []),
              { key: "reprint", label: t("reprint"), icon: <Printer size={16} strokeWidth={1.75} aria-hidden />, onSelect: () => ctx.onReprint(o) },
            ]}
          />
        </span>
      </div>
      {open && <Details row={row} ctx={ctx} id={detailsId} />}
    </li>
  );
}

/** The sales of the chosen list, as a card of rows with a header on a desktop.
 *  No overflow clipping on the card: the row menu hangs below the last row. */
export function SaleList({ rows, ctx, openId, onOpen }: { rows: SaleRow[]; ctx: SaleListContext; openId: string | null; onOpen: (id: string | null) => void }) {
  const t = useTranslations("mysales");
  return (
    <div className="rounded-card bg-card shadow-card">
      <div aria-hidden className={cn(OUTER, "hidden rounded-t-card border-b border-line px-card py-comfortable rail:grid", T.label)}>
        <div className={cn("grid items-center", INNER)}>
          <span>{t("colTimeCode")}</span>
          <span>{t("colCustomer")}</span>
          <span>{t("colItems")}</span>
          <span>{t("colMethod")}</span>
          <span className="text-right">{t("colAmount")}</span>
          <span className="pl-section">{t("colStatus")}</span>
        </div>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const key = `${r.order.id}:${r.at}`;
          return <SaleItem key={key} row={r} ctx={ctx} open={openId === key} onToggle={() => onOpen(openId === key ? null : key)} />;
        })}
      </ul>
    </div>
  );
}
