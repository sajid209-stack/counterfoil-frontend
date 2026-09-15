"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Clock, MessageSquare, Plus, Printer, ReceiptText, Ticket as TicketIcon } from "lucide-react";
import { Button, Modal, Qr, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOperator } from "@/lib/api";
import { useEnumLabels } from "@/lib/labels";
import { formatDay, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEFAULT_SMS_TEMPLATE, renderSms } from "@/lib/sms";
import type { CompleteInfo, CompleteTicket } from "../_lib/handover";

/*
 * The moment a sale lands, for the person still standing at the counter.
 *
 * It answers, in this order, what a cashier has to do next:
 *   1. hand back the change — the one figure that is an action, so it is the
 *      largest thing on the screen and stays until the next sale starts;
 *   2. give the guest their tickets — print them, print the receipt or send an
 *      SMS, and every ticket with its QR, which opens large for the guest;
 *   3. start the next sale — pinned in reach, and focused, so Enter starts it.
 * The sale itself (lines, VAT, how it was paid) sits below, for checking.
 *
 * Everything drawn here comes from the sale's own handover, so nothing waits on
 * the network and a reload loses nothing.
 */

/** Tickets drawn before the list offers to show the rest. */
const TICKETS_SHOWN = 3;

const noSubscribe = () => () => {};
const readComplete = () => sessionStorage.getItem("pos_complete");

/** An 11-digit Bangladesh mobile (01…) or the same with its 880 country code. */
const isMobile = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return /^01\d{9}$/.test(digits) || /^8801\d{9}$/.test(digits);
};

export default function CompletePage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const tk = useTranslations("ticket");
  const enumL = useEnumLabels();

  // Session storage is an external store; reading it this way keeps the server
  // render and the first client render in agreement.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(noSubscribe, readComplete, () => null);
  const info = useMemo<CompleteInfo | null>(() => (raw ? (JSON.parse(raw) as CompleteInfo) : null), [raw]);
  useEffect(() => {
    if (hydrated && !raw) router.replace("/pos");
  }, [hydrated, raw, router]);

  const operatorQ = useApiQuery(() => getOperator(), []);

  const [smsOpen, setSmsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState(false);
  const [shown, setShown] = useState<CompleteTicket | null>(null);
  const phoneId = useId();
  const phoneHelpId = useId();

  const tickets = info?.tickets ?? [];
  const smsText = renderSms(operatorQ.data?.smsTemplate || DEFAULT_SMS_TEMPLATE, {
    business: operatorQ.data?.name ?? "Counterfoil",
    code: info?.code ?? "",
    // The ticket’s own date, in the form a customer reads — so the message never
    // names a different day from the ticket it confirms.
    date: formatDay(tickets[0]?.date ?? DEMO_TODAY, { weekday: true }),
  });

  if (!info) return <main className="min-h-[60vh]" aria-busy="true" />;

  // A handover written before tickets travelled with the sale cannot say how
  // many there were, so it says nothing rather than "No tickets issued".
  const ticketsKnown = Array.isArray(info.tickets);
  const hasTickets = ticketsKnown ? tickets.length > 0 : !!info.code;
  const payment = info.payments?.[0];
  const total = info.receipt?.total ?? payment?.amount ?? 0;
  const paidNow = payment?.amount ?? total;
  const change = info.change ?? 0;
  const balance = info.balance ?? 0;
  const method = payment ? enumL.method(payment.method) : "";
  const knownPhone = info.customer?.phone ?? null;
  const orderId = info.orderId ?? "";

  const ticketMeta = (ticket: CompleteTicket) =>
    [
      ticket.showTier ? ticket.tierName : null,
      ticket.admits > 1 ? tk("admits", { count: ticket.admits }) : null,
      ticket.place,
      ticket.startTime,
      formatDay(ticket.date, { weekday: true }),
    ]
      .filter(Boolean)
      .join(" · ");

  const openSms = () => {
    setPhone((current) => current || knownPhone || "");
    setPhoneTouched(false);
    setSmsOpen(true);
  };
  const sendSms = () => {
    setSmsOpen(false);
    setSentTo(phone);
    toast.success(t("complete.smsSentTo", { phone }));
  };
  const phoneInvalid = phoneTouched && phone.trim() !== "" && !isMobile(phone);

  const visibleTickets = allTickets ? tickets : tickets.slice(0, TICKETS_SHOWN);

  return (
    <main className="mx-auto w-full max-w-xl px-section pb-[96px] pt-section sm:max-w-3xl rail:max-w-6xl rail:px-major rail:pb-major rail:pt-major">
      <div className="flex flex-col gap-section rail:grid rail:grid-cols-[minmax(0,1fr)_minmax(0,460px)] rail:items-start rail:gap-major">
        {/* ── Left: what just happened, and what to do now ── */}
        <div className="flex flex-col gap-section">
          <div id="sale-status" aria-live="polite" className="flex items-center gap-comfortable">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <Check size={26} strokeWidth={2.4} aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="type-h1 text-[26px] leading-tight text-fg">{t("complete.saleComplete")}</h1>
              {ticketsKnown && <p className="mt-0.5 text-sm text-muted">{t("complete.ticketsIssuedCount", { count: tickets.length })}</p>}
            </div>
          </div>

          {/* The money. Change is an action, so when there is change it leads, at the largest size on the screen. */}
          <section className="go-surface p-section">
            {change > 0 ? (
              <>
                <p className="text-sm font-medium text-muted">{t("complete.giveChange")}</p>
                <p className="mt-1.5 text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-fg">{formatMoney(change)}</p>
                {payment?.tendered !== undefined && (
                  <p className="mt-tight text-sm tabular-nums text-muted">{t("complete.receivedOfTotal", { received: formatMoney(payment.tendered), total: formatMoney(paidNow) })}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted">{t("complete.paidBy", { method })}</p>
                <p className="mt-1.5 text-[40px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-fg">{formatMoney(paidNow)}</p>
                <p className="mt-tight text-sm tabular-nums text-muted">
                  {balance > 0 ? t("complete.paidNowOfTotal", { paid: formatMoney(paidNow), total: formatMoney(total) }) : payment?.method === "cash" ? t("complete.noChange") : t("complete.paidInFull")}
                </p>
              </>
            )}
            {balance > 0 && (
              <p className="mt-section flex items-center gap-tight rounded-go-sm bg-warning/15 px-comfortable py-tight text-sm font-medium text-warning">
                <Clock size={16} strokeWidth={2} aria-hidden className="shrink-0" />
                {t("complete.collectAtArrival", { amount: formatMoney(balance) })}
              </p>
            )}
          </section>

          {/* Hand-over: one question with three answers, so on a phone it is one card of rows a thumb can read
              in full; once there is width for three it becomes three tiles. .go-surface is a component-layer
              class, so the sm: utilities below take its surface off the wrapper and give it to each tile. */}
          <section aria-labelledby="hand-over">
            <h2 id="hand-over" className="text-sm font-semibold text-fg">
              {hasTickets ? t("complete.handOverTitle") : t("complete.handOverReceiptTitle")}
            </h2>
            <div
              className={cn(
                "go-surface mt-tight flex flex-col overflow-hidden sm:grid sm:gap-tight sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none",
                hasTickets ? "sm:grid-cols-3" : "sm:grid-cols-1",
              )}
            >
              {hasTickets && (
                <HandOver
                  icon={<TicketIcon size={20} strokeWidth={1.7} />}
                  label={tk("printTickets")}
                  hint={ticketsKnown ? t("complete.ticketsCountHint", { count: tickets.length }) : undefined}
                  disabled={!orderId}
                  onClick={() => router.push(`/print/tickets/${orderId}`)}
                />
              )}
              <HandOver
                icon={<Printer size={20} strokeWidth={1.7} />}
                label={tk("printReceipt")}
                hint={t("complete.printReceiptHint")}
                disabled={!orderId}
                onClick={() => router.push(`/print/receipt/${orderId}`)}
              />
              {hasTickets && (
                <HandOver
                  icon={<MessageSquare size={20} strokeWidth={1.7} />}
                  label={t("complete.sendSms")}
                  hint={sentTo ? t("complete.smsSentState") : knownPhone ? t("complete.smsHintTo", { phone: knownPhone }) : t("complete.smsHintNoNumber")}
                  done={!!sentTo}
                  onClick={openSms}
                />
              )}
            </div>
          </section>

          {/* New sale: pinned above the tab bar on a phone, inline on a landscape tablet. Focused, so Enter starts the next sale. */}
          <div className="fixed inset-x-comfortable z-30 rail:static rail:z-auto" style={{ bottom: "calc(82px + env(safe-area-inset-bottom))" }}>
            {/* As wide as the cards above it: 48rem less the page's 16px gutters from sm. */}
            <div className="mx-auto max-w-[34rem] sm:max-w-[calc(48rem-32px)] rail:max-w-none">
              <Button
                shape="pill"
                size="lg"
                fullWidth
                autoFocus
                aria-describedby="sale-status"
                icon={<Plus size={20} strokeWidth={2.2} />}
                className="h-14 text-[17px] shadow-go-pop rail:shadow-none"
                onClick={() => router.push("/pos")}
              >
                {t("complete.newSale")}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right: the tickets and the sale, for checking ── */}
        <div className="flex flex-col gap-section">
          {ticketsKnown && tickets.length > 0 && (
            <section className="go-surface overflow-hidden" aria-labelledby="tickets-title">
              <h2 id="tickets-title" className="px-section pb-tight pt-section text-sm font-semibold text-fg">
                {t("complete.ticketsTitle")}
              </h2>
              <ul className="flex flex-col">
                {visibleTickets.map((ticket) => (
                  <li key={ticket.code} className="border-t border-line">
                    {/* The whole row opens the QR large, for the guest to photograph or the gate to scan. */}
                    <button
                      type="button"
                      onClick={() => setShown(ticket)}
                      className="flex w-full items-center gap-comfortable px-section py-comfortable text-left transition-colors duration-quick active:bg-subtle"
                    >
                      {/* The QR is what the gate scans, so it is dark on white in either theme. */}
                      <span className="shrink-0 rounded-[10px] bg-white p-1 ring-1 ring-line">
                        <Qr value={ticket.code} size={52} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-fg">{ticket.name}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted">{ticketMeta(ticket)}</span>
                        <span className="mt-0.5 block truncate font-mono text-[13px] text-fg">{ticket.code}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              {!allTickets && tickets.length > TICKETS_SHOWN && (
                <button
                  type="button"
                  onClick={() => setAllTickets(true)}
                  className="flex min-h-[52px] w-full items-center justify-center border-t border-line px-section text-sm font-medium text-brand-foreground transition-colors duration-quick active:bg-subtle"
                >
                  {t("complete.showAllTickets", { count: tickets.length })}
                </button>
              )}
            </section>
          )}

          {info.receipt && (
            <section className="go-surface p-section" aria-labelledby="sale-title">
              <div className="flex items-center gap-tight">
                <ReceiptText size={16} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
                <h2 id="sale-title" className="text-sm font-semibold text-fg">
                  {t("complete.saleTitle")}
                </h2>
                {info.reference && <span className="ml-auto min-w-0 truncate font-mono text-[13px] text-muted">{info.reference}</span>}
              </div>
              <ul className="mt-comfortable flex flex-col gap-tight">
                {info.receipt.lines.map((line, i) => (
                  <li key={i} className={cn("flex items-baseline justify-between gap-comfortable text-sm", line.child && "pl-section")}>
                    <span className="min-w-0 text-fg">
                      <span className={cn(line.child && "text-muted")}>{line.name}</span>
                      <span className="text-muted"> × {line.qty}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-fg">{formatMoney(line.amount)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-comfortable flex flex-col gap-1.5 border-t border-line pt-comfortable text-sm">
                <Row label={t("complete.subtotal")} value={formatMoney(info.receipt.subtotal)} />
                {info.receipt.lineDiscountTotal > 0 && <Row label={t("complete.lineDiscounts")} value={`−${formatMoney(info.receipt.lineDiscountTotal)}`} />}
                {info.receipt.orderDiscount > 0 && <Row label={t("complete.discount")} value={`−${formatMoney(info.receipt.orderDiscount)}`} />}
                <Row label={t("complete.vat")} value={formatMoney(info.receipt.tax)} />
                <Row label={t("complete.total")} value={formatMoney(info.receipt.total)} strong />
              </dl>
              {payment && (
                <dl className="mt-comfortable flex flex-col gap-1.5 border-t border-line pt-comfortable text-sm">
                  <Row label={t("complete.paidMethod", { method })} value={formatMoney(paidNow)} />
                  {payment.tendered !== undefined && change > 0 && (
                    <>
                      <Row label={t("complete.receivedLabel")} value={formatMoney(payment.tendered)} />
                      <Row label={t("complete.changeLabel")} value={formatMoney(change)} />
                    </>
                  )}
                  {balance > 0 && <Row label={t("complete.balanceDueAtArrival")} value={formatMoney(balance)} />}
                </dl>
              )}
            </section>
          )}
        </div>
      </div>

      {/* One ticket, large: the code a gate scans, readable from across the counter. */}
      <Modal open={!!shown} onClose={() => setShown(null)} title={shown?.name} size="sm">
        {shown && (
          <div className="flex flex-col items-center text-center normal-nums">
            <span className="rounded-go-sm bg-white p-3 ring-1 ring-line">
              <Qr value={shown.code} size={216} />
            </span>
            <p className="mt-section font-mono text-[15px] text-fg">{shown.code}</p>
            <p className="mt-1 text-sm text-muted">{ticketMeta(shown)}</p>
            <p className="mt-section text-[13px] text-muted">{t("complete.qrHelp")}</p>
          </div>
        )}
      </Modal>

      {/* SMS: the number it goes to, and the exact message it sends. */}
      <Modal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        title={t("complete.smsTitle")}
        footer={
          <>
            <Button shape="pill" variant="secondary" onClick={() => setSmsOpen(false)}>
              {t("complete.cancel")}
            </Button>
            <Button shape="pill" disabled={!isMobile(phone)} onClick={sendSms}>
              {t("complete.sendSmsButton")}
            </Button>
          </>
        }
      >
        {/* Written out rather than the OS Field, whose uppercase 12px label is a form convention and under the till's 13px floor.
            Proportional figures in this dialog: the app's tabular ones widen a hyphen, so "01712-345678" and the ticket code read as split. */}
        <div className="flex flex-col gap-tight text-left normal-nums">
          <label htmlFor={phoneId} className="text-sm font-medium text-fg">
            {t("complete.smsTo")}
          </label>
          {/* A native tel input, so a phone opens its number pad and the browser can offer the guest’s number. */}
          <input
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            aria-invalid={phoneInvalid || undefined}
            aria-describedby={phoneHelpId}
            placeholder="01XXXXXXXXX"
            className={cn(
              "h-12 w-full rounded-go-sm border bg-card px-comfortable font-mono text-[15px] text-fg outline-none transition-colors duration-quick placeholder:text-faint focus:border-ember focus:ring-2 focus:ring-ember/20",
              phoneInvalid ? "border-danger" : "border-line",
            )}
          />
          <p id={phoneHelpId} className={cn("text-[13px]", phoneInvalid ? "text-danger" : "text-muted")}>
            {phoneInvalid ? t("complete.smsInvalid") : t("complete.smsToHelp")}
          </p>
        </div>
        <div className="mt-section rounded-go-sm border border-line bg-subtle p-comfortable text-left text-sm text-fg normal-nums">{smsText}</div>
        <p className="mt-tight text-left text-[13px] text-muted normal-nums">{t("complete.smsMeta", { count: smsText.length })}</p>
      </Modal>
    </main>
  );
}

/** One way to hand the tickets over: a row of the shared card on a phone, its own tile once there is room for three. */
function HandOver({ icon, label, hint, done, disabled, onClick }: { icon: React.ReactNode; label: string; hint?: string; done?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[64px] w-full min-w-0 items-center gap-comfortable border-t border-line px-section py-comfortable text-left transition-[background-color,transform] duration-quick first:border-t-0 active:bg-subtle disabled:opacity-40 sm:min-h-[104px] sm:flex-col sm:justify-center sm:gap-1.5 sm:rounded-go sm:border-0 sm:bg-card sm:px-tight sm:text-center sm:shadow-go sm:active:scale-[0.98] sm:active:bg-card sm:dark:border sm:dark:border-line sm:dark:shadow-none"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", done ? "bg-success/15 text-success" : "bg-subtle text-fg dark:ring-1 dark:ring-line")}>
        {done ? <Check size={20} strokeWidth={2.4} aria-hidden /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col sm:flex-none sm:items-center">
        <span className="text-[15px] font-medium text-fg sm:text-sm">{label}</span>
        {hint && <span className="break-words text-[13px] text-muted normal-nums">{hint}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-muted sm:hidden" aria-hidden />
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-comfortable", strong && "text-[15px] font-semibold")}>
      <dt className={strong ? "text-fg" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums text-fg">{value}</dd>
    </div>
  );
}
