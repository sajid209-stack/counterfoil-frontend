"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Clock, Mail, MessageSquare, Plus, Printer, ReceiptText, Send, Ticket as TicketIcon } from "lucide-react";
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
 * One figure leads — the change to hand back, or what was paid — set large and
 * centred on the page itself rather than boxed in a card. Under it the guest
 * gets their tickets in one of two ways, each its own group: printed (all of
 * it, just the tickets, just the receipt) or sent (SMS, email, or both). New
 * sale stays pinned in reach and focused. The tickets and the sale sit below
 * as quiet lists, for checking.
 *
 * Everything drawn here comes from the sale's own handover, so nothing waits on
 * the network and a reload loses nothing.
 */

/** Tickets drawn before the list offers to show the rest. */
const TICKETS_SHOWN = 3;

type Channel = "sms" | "email" | "both";

const noSubscribe = () => () => {};
const readComplete = () => sessionStorage.getItem("pos_complete");

/** An 11-digit Bangladesh mobile (01…) or the same with its 880 country code. */
const isMobile = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return /^01\d{9}$/.test(digits) || /^8801\d{9}$/.test(digits);
};

/** Something shaped like an address: a name, an @, a domain with a dot. The mail server is the real test. */
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

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

  const [sending, setSending] = useState<Channel | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [smsSentTo, setSmsSentTo] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState(false);
  const [shown, setShown] = useState<CompleteTicket | null>(null);
  const phoneId = useId();
  const phoneHelpId = useId();
  const emailId = useId();
  const emailHelpId = useId();

  const tickets = info?.tickets ?? [];
  const business = operatorQ.data?.name ?? "Counterfoil";
  // The ticket’s own date, in the form a customer reads — so a message never names a different day from the ticket it confirms.
  const ticketDay = formatDay(tickets[0]?.date ?? DEMO_TODAY, { weekday: true });
  const smsText = renderSms(operatorQ.data?.smsTemplate || DEFAULT_SMS_TEMPLATE, { business, code: info?.code ?? "", date: ticketDay });

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
  const knownEmail = info.customer?.email ?? null;
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

  // One dialog for all three ways of sending: it asks for whichever of the number and the address the channel needs.
  const wantsSms = sending === "sms" || sending === "both";
  const wantsEmail = sending === "email" || sending === "both";
  const phoneInvalid = phoneTouched && phone.trim() !== "" && !isMobile(phone);
  const emailInvalid = emailTouched && email.trim() !== "" && !isEmail(email);
  const canSend = (!wantsSms || isMobile(phone)) && (!wantsEmail || isEmail(email));
  const emailSubject = t("complete.emailSubject", { business, ref: info.reference ?? info.code });
  const emailBody = t("complete.emailBody", { count: Math.max(tickets.length, 1), date: ticketDay, total: formatMoney(total) });

  const openSend = (channel: Channel) => {
    setPhone((current) => current || knownPhone || "");
    setEmail((current) => current || knownEmail || "");
    setPhoneTouched(false);
    setEmailTouched(false);
    setSending(channel);
  };
  const send = () => {
    if (wantsSms) setSmsSentTo(phone);
    if (wantsEmail) setEmailSentTo(email.trim());
    toast.success(
      sending === "both"
        ? t("complete.bothSentTo", { phone, email: email.trim() })
        : sending === "email"
          ? t("complete.emailSentTo", { email: email.trim() })
          : t("complete.smsSentTo", { phone }),
    );
    setSending(null);
  };
  const sentName = (name: string, sent: boolean) => (sent ? `${name} · ${t("complete.smsSentState")}` : name);

  const visibleTickets = allTickets ? tickets : tickets.slice(0, TICKETS_SHOWN);

  // The lead figure: change is an action, so when there is change it IS the figure.
  const lead =
    change > 0
      ? {
          label: t("complete.giveChange"),
          amount: formatMoney(change),
          note: payment?.tendered !== undefined ? t("complete.receivedOfTotal", { received: formatMoney(payment.tendered), total: formatMoney(paidNow) }) : null,
        }
      : {
          label: t("complete.paidBy", { method }),
          amount: formatMoney(paidNow),
          note: balance > 0 ? t("complete.paidNowOfTotal", { paid: formatMoney(paidNow), total: formatMoney(total) }) : payment?.method === "cash" ? t("complete.noChange") : t("complete.paidInFull"),
        };

  return (
    <main className="mx-auto w-full max-w-xl px-section pb-[96px] pt-major sm:max-w-3xl rail:max-w-6xl rail:px-major rail:pb-major">
      <div className="flex flex-col gap-wide rail:grid rail:grid-cols-[minmax(0,1fr)_minmax(0,440px)] rail:items-start rail:gap-wide">
        {/* ── What just happened, and what to do now ── */}
        <div className="flex flex-col gap-major">
          <section className="flex flex-col items-center text-center" aria-labelledby="sale-complete">
            <div id="sale-status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <Check size={16} strokeWidth={2.6} aria-hidden />
              </span>
              <h1 id="sale-complete" className="text-[15px] font-semibold text-fg">
                {t("complete.saleComplete")}
              </h1>
              {ticketsKnown && (
                <>
                  <span aria-hidden className="text-muted">
                    ·
                  </span>
                  <span className="text-[15px] text-muted">{t("complete.ticketsIssuedCount", { count: tickets.length })}</span>
                </>
              )}
            </div>

            <p className="mt-major text-sm font-medium text-muted">{lead.label}</p>
            <p className="mt-1.5 text-[clamp(40px,13vw,56px)] font-semibold leading-none tracking-[-0.03em] text-fg">{lead.amount}</p>
            {lead.note && <p className="mt-tight text-sm text-muted">{lead.note}</p>}
            {balance > 0 && (
              <p className="mt-comfortable inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-comfortable py-1.5 text-[13px] font-medium text-warning">
                <Clock size={14} strokeWidth={2.2} aria-hidden className="shrink-0" />
                {t("complete.collectAtArrival", { amount: formatMoney(balance) })}
              </p>
            )}
          </section>

          {/* Hand-over, as two decisions rather than six loose buttons: printed or sent. Each group is one card of
              three joined segments, so what belongs together reads together — side by side once there is room,
              stacked on a phone. The visible word is short; each button's name says the whole action. */}
          <section aria-labelledby="hand-over" className={cn("flex flex-col gap-section", hasTickets && "sm:grid sm:grid-cols-2 sm:gap-comfortable")}>
            <h2 id="hand-over" className="sr-only">
              {hasTickets ? t("complete.handOverTitle") : t("complete.handOverReceiptTitle")}
            </h2>
            <HandOverGroup label={t("complete.printGroup")}>
              {hasTickets && (
                <HandOver icon={<Printer size={20} strokeWidth={1.8} />} label={t("complete.handOverAll")} name={tk("printAll")} disabled={!orderId} onClick={() => router.push(`/print/order/${orderId}`)} />
              )}
              {hasTickets && (
                <HandOver icon={<TicketIcon size={20} strokeWidth={1.8} />} label={t("complete.handOverTickets")} name={tk("printTickets")} disabled={!orderId} onClick={() => router.push(`/print/tickets/${orderId}`)} />
              )}
              <HandOver
                icon={<ReceiptText size={20} strokeWidth={1.8} />}
                label={t("complete.handOverReceipt")}
                name={tk("printReceipt")}
                disabled={!orderId}
                row={!hasTickets}
                onClick={() => router.push(`/print/receipt/${orderId}`)}
              />
            </HandOverGroup>
            {hasTickets && (
              <HandOverGroup label={t("complete.sendGroup")}>
                <HandOver
                  icon={smsSentTo ? <Check size={20} strokeWidth={2.4} /> : <MessageSquare size={20} strokeWidth={1.8} />}
                  label={t("complete.handOverSms")}
                  name={sentName(t("complete.sendSms"), !!smsSentTo)}
                  done={!!smsSentTo}
                  onClick={() => openSend("sms")}
                />
                <HandOver
                  icon={emailSentTo ? <Check size={20} strokeWidth={2.4} /> : <Mail size={20} strokeWidth={1.8} />}
                  label={t("complete.handOverEmail")}
                  name={sentName(t("complete.sendEmail"), !!emailSentTo)}
                  done={!!emailSentTo}
                  onClick={() => openSend("email")}
                />
                <HandOver
                  icon={smsSentTo && emailSentTo ? <Check size={20} strokeWidth={2.4} /> : <Send size={20} strokeWidth={1.8} />}
                  label={t("complete.handOverBoth")}
                  name={sentName(t("complete.sendBoth"), !!smsSentTo && !!emailSentTo)}
                  done={!!smsSentTo && !!emailSentTo}
                  onClick={() => openSend("both")}
                />
              </HandOverGroup>
            )}
          </section>

          {/* New sale: pinned above the tab bar on a phone, inline on a landscape tablet. Focused, so Enter starts the next sale. */}
          <div className="fixed inset-x-comfortable z-30 rail:static rail:z-auto" style={{ bottom: "calc(82px + env(safe-area-inset-bottom))" }}>
            {/* As wide as the content above it: 48rem less the page's 16px gutters from sm. */}
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

        {/* ── The tickets and the sale, for checking ── */}
        <div className="flex flex-col gap-major">
          {ticketsKnown && tickets.length > 0 && (
            <section aria-labelledby="tickets-title">
              <h2 id="tickets-title" className="px-1 text-sm font-semibold text-fg">
                {t("complete.ticketsTitle")}
              </h2>
              <ul className="go-surface mt-tight overflow-hidden">
                {visibleTickets.map((ticket) => (
                  <li key={ticket.code} className="border-t border-line first:border-t-0">
                    {/* The whole row opens the QR large, for the guest to photograph or the gate to scan. */}
                    <button
                      type="button"
                      onClick={() => setShown(ticket)}
                      className="flex w-full items-center gap-comfortable px-section py-comfortable text-left transition-colors duration-quick active:bg-subtle"
                    >
                      {/* The QR is what the gate scans, so it is dark on white in either theme. */}
                      <span className="shrink-0 rounded-[10px] bg-white p-1 ring-1 ring-line">
                        <Qr value={ticket.code} size={44} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[15px] font-semibold leading-snug text-fg">{ticket.name}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted">{ticketMeta(ticket)}</span>
                        <span className="mt-0.5 block truncate font-mono text-[13px] text-muted">{ticket.code}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
                {!allTickets && tickets.length > TICKETS_SHOWN && (
                  <li className="border-t border-line">
                    <button
                      type="button"
                      onClick={() => setAllTickets(true)}
                      className="flex min-h-[48px] w-full items-center justify-center px-section text-sm font-medium text-brand-foreground transition-colors duration-quick active:bg-subtle"
                    >
                      {t("complete.showAllTickets", { count: tickets.length })}
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {info.receipt && (
            <section aria-labelledby="sale-title">
              <div className="flex items-baseline justify-between gap-comfortable px-1">
                <h2 id="sale-title" className="text-sm font-semibold text-fg">
                  {t("complete.saleTitle")}
                </h2>
                {info.reference && <span className="min-w-0 truncate font-mono text-[13px] text-muted">{info.reference}</span>}
              </div>
              <div className="go-surface mt-tight p-section">
                <ul className="flex flex-col gap-tight">
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
              </div>
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

      {/* Sending: the number and/or the address it goes to, and exactly what each carries. */}
      <Modal
        open={!!sending}
        onClose={() => setSending(null)}
        title={sending === "both" ? t("complete.bothTitle") : sending === "email" ? t("complete.emailTitle") : t("complete.smsTitle")}
        footer={
          <>
            <Button shape="pill" variant="secondary" onClick={() => setSending(null)}>
              {t("complete.cancel")}
            </Button>
            <Button shape="pill" disabled={!canSend} onClick={send}>
              {sending === "both" ? t("complete.sendBoth") : sending === "email" ? t("complete.sendEmail") : t("complete.sendSmsButton")}
            </Button>
          </>
        }
      >
        {/* Written out rather than the OS Field, whose uppercase 12px label is a form convention and under the till's 13px floor.
            Proportional figures in this dialog: the app's tabular ones widen a hyphen, so "01712-345678" and the ticket code read as split. */}
        <div className="flex flex-col gap-section text-left normal-nums">
          {wantsSms && (
            <div className="flex flex-col gap-tight">
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
          )}
          {wantsEmail && (
            <div className="flex flex-col gap-tight">
              <label htmlFor={emailId} className="text-sm font-medium text-fg">
                {t("complete.emailTo")}
              </label>
              {/* A native email input, so a phone opens the keyboard with @ and the browser can offer the guest’s address. */}
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                aria-invalid={emailInvalid || undefined}
                aria-describedby={emailHelpId}
                placeholder="name@example.com"
                className={cn(
                  "h-12 w-full rounded-go-sm border bg-card px-comfortable text-[15px] text-fg outline-none transition-colors duration-quick placeholder:text-faint focus:border-ember focus:ring-2 focus:ring-ember/20",
                  emailInvalid ? "border-danger" : "border-line",
                )}
              />
              <p id={emailHelpId} className={cn("text-[13px]", emailInvalid ? "text-danger" : "text-muted")}>
                {emailInvalid ? t("complete.emailInvalid") : t("complete.emailToHelp")}
              </p>
            </div>
          )}

          {wantsSms && (
            <div>
              {sending === "both" && <p className="mb-1.5 text-[13px] font-medium text-muted">{t("complete.handOverSms")}</p>}
              <div className="rounded-go-sm border border-line bg-subtle p-comfortable text-sm text-fg">{smsText}</div>
              <p className="mt-tight text-[13px] text-muted">{t("complete.smsMeta", { count: smsText.length })}</p>
            </div>
          )}
          {wantsEmail && (
            <div>
              {sending === "both" && <p className="mb-1.5 text-[13px] font-medium text-muted">{t("complete.handOverEmail")}</p>}
              {/* The message as it will arrive: its subject, then what it says. */}
              <div className="rounded-go-sm border border-line bg-subtle p-comfortable text-sm">
                <p className="break-words font-semibold text-fg">{emailSubject}</p>
                <p className="mt-1 break-words text-muted">{emailBody}</p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </main>
  );
}

/** A group of hand-over actions: a label, then one card of joined segments — shared edges say these are one decision. */
function HandOverGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="min-w-0">
      <p id={id} className="px-1 text-sm font-semibold text-fg">
        {label}
      </p>
      <div className="go-surface mt-tight flex">{children}</div>
    </div>
  );
}

/** One way to hand the tickets over: an icon over a short word on screen, the whole action as its name.
 *  Segments carry their own end radii rather than the card clipping them, so a keyboard focus ring is never cut off.
 *  `row` is for a segment that has the card to itself, where the icon sits beside its word instead. */
function HandOver({ icon, label, name, done, disabled, row, onClick }: { icon: React.ReactNode; label: string; name: string; done?: boolean; disabled?: boolean; row?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={name}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center border-l border-line font-medium text-fg transition-colors duration-quick first:rounded-l-go first:border-l-0 last:rounded-r-go active:bg-subtle disabled:opacity-40",
        row ? "h-12 gap-1.5 px-comfortable text-sm" : "h-16 flex-col gap-1 px-1 text-[13px]",
      )}
    >
      <span aria-hidden className={cn("grid shrink-0 place-items-center", done ? "text-success" : "text-muted")}>
        {icon}
      </span>
      <span className="max-w-full truncate">{label}</span>
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
