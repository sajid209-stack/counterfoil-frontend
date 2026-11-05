"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Clock, Mail, MessageSquare, Plus, Printer, ReceiptText, RotateCcw, Send, Ticket as TicketIcon } from "lucide-react";
import { Button, Modal, Qr, useToast } from "@/components/ui";
import { GoCard, TileLabel, tileClass } from "../../_components/Tiles";
import { HandOverMenu, type HandOverItem } from "./_components/HandOverMenu";
import { ChromeBackdrop } from "../../_components/ActionBar";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMedia";
import { useApiQuery } from "@/lib/useApi";
import { cancelSale, getOperator, UNDO_SALE_SECONDS } from "@/lib/api";
import { useEnumLabels } from "@/lib/labels";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { clockify } from "../../_components/Clock";
import { R } from "../../_components/railType";
import { T } from "../../_components/type";
import { usePrefs, type Prefs } from "@/lib/prefs";
import { DEMO_TODAY } from "@/lib/schedule";
import { DEFAULT_SMS_TEMPLATE, renderSms } from "@/lib/sms";
import { DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT } from "@/lib/email";
import type { CompleteInfo, CompleteTicket } from "../_lib/handover";
import { takeReturnTo, takeUndoSnapshot, writeLiveSale } from "../_lib/liveSale";

/*
 * The moment a sale lands, for the person still standing at the counter.
 *
 * One figure leads — the change to hand back, or what was paid — set large and
 * centred on the page itself rather than boxed in a card. Under it the guest
 * gets their tickets in one of two ways, each its own group of separate tiles:
 * printed (all of it, just the tickets, just the receipt) or sent (SMS, email,
 * or both). New sale stays pinned in reach and focused. The tickets (a card
 * each) and the sale (a card) sit below, for checking.
 *
 * Everything drawn here comes from the sale's own handover, so nothing waits on
 * the network and a reload loses nothing.
 */

/** Tickets drawn before the list offers to show the rest. A desktop has the room for more. */
const TICKETS_SHOWN = 3;
const TICKETS_SHOWN_RAIL = 8;
/** A desktop: 1024px and wider, held landscape (docs/pos-desktop.md §8). */
const RAIL = "(min-width: 64rem) and (orientation: landscape)";

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

/**
 * What the till did by itself when the sale landed, from this device's "After
 * a sale" settings. Decided once per sale: the result is kept in session
 * storage under the order, so a reload (or React's second render in
 * development) shows the same status and does not print or send again.
 */
interface AutoDone {
  /** What was printed, or null. */
  print: "receipt" | "tickets" | "both" | null;
  ticketCount: number;
  sms: string | null;
  email: string | null;
  /** Why something the settings asked for was not sent. */
  missing: "phone" | "email" | "contact" | null;
}

function autoHandOver(info: CompleteInfo, prefs: Pick<Prefs, "printAuto" | "sendAuto">): AutoDone {
  const key = info.orderId ? `pos_complete_auto_${info.orderId}` : null;
  if (key) {
    try {
      const prior = sessionStorage.getItem(key);
      if (prior) return JSON.parse(prior) as AutoDone;
    } catch {
      // Unreadable: decide again.
    }
  }
  const ticketsKnown = Array.isArray(info.tickets);
  const count = ticketsKnown ? (info.tickets?.length ?? 0) : info.code ? 1 : 0;
  const hasTickets = count > 0;
  const wantReceipt = prefs.printAuto === "receipt" || prefs.printAuto === "both";
  const wantTickets = (prefs.printAuto === "tickets" || prefs.printAuto === "both") && hasTickets;
  const canPrint = !!info.orderId;
  const print = !canPrint ? null : wantReceipt && wantTickets ? "both" : wantReceipt ? "receipt" : wantTickets ? "tickets" : null;

  const wantSms = hasTickets && (prefs.sendAuto === "sms" || prefs.sendAuto === "both");
  const wantEmail = hasTickets && (prefs.sendAuto === "email" || prefs.sendAuto === "both");
  const phone = info.customer?.phone ?? "";
  const address = info.customer?.email?.trim() ?? "";
  const sms = wantSms && isMobile(phone) ? phone : null;
  const email = wantEmail && isEmail(address) ? address : null;
  const noPhone = wantSms && !sms;
  const noEmail = wantEmail && !email;
  const missing = noPhone && noEmail ? "contact" : noPhone ? "phone" : noEmail ? "email" : null;

  const done: AutoDone = { print, ticketCount: count, sms, email, missing };
  if (key) {
    try {
      sessionStorage.setItem(key, JSON.stringify(done));
    } catch {
      // Storage blocked: the status still shows for this visit.
    }
  }
  return done;
}

export default function CompletePage() {
  const router = useRouter();

  // Session storage is an external store; reading it this way keeps the server
  // render and the first client render in agreement.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(noSubscribe, readComplete, () => null);
  const info = useMemo<CompleteInfo | null>(() => (raw ? (JSON.parse(raw) as CompleteInfo) : null), [raw]);
  /* Undo clears this handover itself (so Back cannot show a cancelled sale as
     complete) and then navigates away — but clearing it while this page is
     still mounted makes `raw` go empty for a tick, which would otherwise race
     the effect below to `/pos` instead of the cart Undo is heading to. Set
     the instant Undo starts clearing up, read by the effect, never reset:
     this page is about to unmount for good either way. */
  const leavingOnPurpose = useRef(false);
  useEffect(() => {
    if (hydrated && !raw && !leavingOnPurpose.current) router.replace("/pos");
  }, [hydrated, raw, router]);

  // No sale handed over (first render, or on the way back to /pos): nothing to show.
  if (!info) return null;

  return (
    <CompleteView
      info={info}
      onUndoing={() => {
        leavingOnPurpose.current = true;
      }}
    />
  );
}

function CompleteView({ info, onUndoing }: { info: CompleteInfo; onUndoing: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const tk = useTranslations("ticket");
  const enumL = useEnumLabels();
  const prefs = usePrefs();
  // Decided once, on this sale's first render (see autoHandOver); the same
  // result seeds the "sent" state the Send menu shows.
  const [auto] = useState(() => autoHandOver(info, prefs));

  const operatorQ = useApiQuery(() => getOperator(), []);
  const rail = useMediaQuery(RAIL);

  const [sending, setSending] = useState<Channel | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [smsSentTo, setSmsSentTo] = useState<string | null>(auto.sms);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(auto.email);
  const [allTickets, setAllTickets] = useState(false);
  const [shown, setShown] = useState<CompleteTicket | null>(null);
  const phoneId = useId();
  const phoneHelpId = useId();
  const emailId = useId();
  const emailHelpId = useId();

  const tickets = info.tickets ?? [];
  const business = operatorQ.data?.name ?? "Counterfoil";
  // The ticket’s own date, in the form a customer reads — so a message never names a different day from the ticket it confirms.
  const ticketDay = formatDay(tickets[0]?.date ?? DEMO_TODAY, { weekday: true });
  const smsText = renderSms(operatorQ.data?.smsTemplate || DEFAULT_SMS_TEMPLATE, { business, code: info.code ?? "", date: ticketDay });

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
      ticket.startTime ? formatClock(ticket.startTime) : null,
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
  /* The operator's words, not the product's. This used to be two message
     keys — so a venue could set the voice of its SMS and not of the e-mail
     about the same ticket, and the two arrived sounding like different
     businesses. Same template mechanism, same placeholders, edited in
     Settings - Notifications. */
  const mailVars = {
    business,
    reference: info.reference ?? info.code ?? "",
    code: info.code ?? "",
    date: ticketDay,
    count: String(Math.max(tickets.length, 1)),
    total: formatMoney(total),
  };
  const emailSubject = renderSms(operatorQ.data?.emailSubject || DEFAULT_EMAIL_SUBJECT, mailVars);
  const emailBody = renderSms(operatorQ.data?.emailTemplate || DEFAULT_EMAIL_BODY, mailVars);

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

  const shownCount = rail ? TICKETS_SHOWN_RAIL : TICKETS_SHOWN;
  const visibleTickets = allTickets ? tickets : tickets.slice(0, shownCount);

  /* The sale, as a receipt. On a desktop it is the left column; on a phone it
     stays below the tickets. Lines are body text with a quiet quantity and a
     price in its own weight; the total is the one bold line. */
  const receiptCard = info.receipt && (
    <GoCard
      title={t("complete.saleTitle")}
      aside={info.reference ? <span className="min-w-0 truncate font-mono text-sm text-muted">{info.reference}</span> : undefined}
      className="rail:order-first"
    >
      <ul className="flex flex-col gap-tight">
        {info.receipt.lines.map((line, i) => (
          <li key={i} className={cn("flex items-baseline justify-between gap-comfortable text-base", line.child && "pl-section")}>
            <span className={`min-w-0 text-fg ${R.body}`}>
              <span className={cn(line.child && "text-muted")}>{clockify(line.name)}</span>
              <span className={`text-muted ${R.meta}`}> × {line.qty}</span>
            </span>
            <span className={`shrink-0 tabular-nums text-fg ${R.price}`}>{formatMoney(line.amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1.5 border-t border-line pt-comfortable text-base">
        <Row label={t("complete.subtotal")} value={formatMoney(info.receipt.subtotal)} />
        {info.receipt.lineDiscountTotal > 0 && <Row label={t("complete.lineDiscounts")} value={`−${formatMoney(info.receipt.lineDiscountTotal)}`} />}
        {info.receipt.orderDiscount > 0 && <Row label={t("complete.discount")} value={`−${formatMoney(info.receipt.orderDiscount)}`} />}
        <Row label={t("complete.vat")} value={formatMoney(info.receipt.tax)} />
        <Row label={t("complete.total")} value={formatMoney(info.receipt.total)} kind="total" />
      </dl>
      {payment && (
        <dl className="flex flex-col gap-1.5 border-t border-line pt-comfortable text-base">
          <Row label={t("complete.paidMethod", { method })} value={formatMoney(paidNow)} kind="paid" />
          {payment.tendered !== undefined && change > 0 && (
            <>
              <Row label={t("complete.receivedLabel")} value={formatMoney(payment.tendered)} />
              <Row label={t("complete.changeLabel")} value={formatMoney(change)} kind="paid" />
            </>
          )}
          {balance > 0 && <Row label={t("complete.balanceDueAtArrival")} value={formatMoney(balance)} kind="paid" />}
        </dl>
      )}
    </GoCard>
  );

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
  /* On a desktop the amount sits under the title with one line saying how it
     was paid. With change to give, the figure is the change (its label stays)
     and the line says what was received. */
  const railNote = !payment
    ? null
    : balance > 0
      ? t("complete.balanceNote", { method, paid: formatMoney(paidNow), total: formatMoney(total) })
      : change > 0 && payment.tendered !== undefined
        ? t("complete.paidByChange", { method, received: formatMoney(payment.tendered) })
        : payment.method === "cash"
          ? t("complete.paidByExact", { method })
          : `${t("complete.paidBy", { method })} · ${t("complete.paidInFull")}`;

  // What the till already did by itself, in one line, and what it could not do.
  const printedText =
    auto.print === "both"
      ? t("complete.autoBothPrinted", { count: auto.ticketCount })
      : auto.print === "tickets"
        ? t("complete.autoTicketsPrinted", { count: auto.ticketCount })
        : auto.print === "receipt"
          ? t("complete.autoReceiptPrinted")
          : null;
  const sentText =
    auto.sms && auto.email
      ? t("complete.autoBothSent", { phone: auto.sms, email: auto.email })
      : auto.sms
        ? t("complete.autoSmsSent", { phone: auto.sms })
        : auto.email
          ? t("complete.autoEmailSent", { email: auto.email })
          : null;
  const doneText = [printedText, sentText].filter(Boolean).join(" · ");
  const missingText =
    auto.missing === "contact" ? t("complete.autoNoContact") : auto.missing === "phone" ? t("complete.autoNoPhone") : auto.missing === "email" ? t("complete.autoNoEmail") : null;

  // The two menus. A way that cannot be used stays in the list and says why.
  const noTicketsHint = !hasTickets ? t("complete.noTicketsToPrint") : undefined;
  const unsavedHint = !orderId ? t("complete.notSavedYet") : undefined;
  const printItems: HandOverItem[] = [
    { key: "all", label: tk("printAll"), icon: <Printer />, disabled: !orderId || !hasTickets, hint: unsavedHint ?? noTicketsHint, onSelect: () => router.push(`/print/order/${orderId}`) },
    { key: "tickets", label: tk("printTickets"), icon: <TicketIcon />, disabled: !orderId || !hasTickets, hint: unsavedHint ?? noTicketsHint, onSelect: () => router.push(`/print/tickets/${orderId}`) },
    { key: "receipt", label: tk("printReceipt"), icon: <ReceiptText />, disabled: !orderId, hint: unsavedHint, onSelect: () => router.push(`/print/receipt/${orderId}`) },
  ];
  const sentState = t("complete.smsSentState");
  const sendItems: HandOverItem[] = [
    {
      key: "sms",
      label: t("complete.sendSms"),
      icon: <MessageSquare />,
      done: !!smsSentTo,
      hint: smsSentTo ? sentState : knownPhone && isMobile(knownPhone) ? t("complete.useNumberOnFile", { phone: knownPhone }) : t("complete.askNumber"),
      onSelect: () => openSend("sms"),
    },
    {
      key: "email",
      label: t("complete.sendEmail"),
      icon: <Mail />,
      done: !!emailSentTo,
      hint: emailSentTo ? sentState : knownEmail && isEmail(knownEmail) ? t("complete.useEmailOnFile", { email: knownEmail }) : t("complete.askEmail"),
      onSelect: () => openSend("email"),
    },
    {
      key: "both",
      label: t("complete.sendBoth"),
      icon: <Send />,
      done: !!smsSentTo && !!emailSentTo,
      hint: smsSentTo && emailSentTo ? sentState : knownPhone && isMobile(knownPhone) && knownEmail && isEmail(knownEmail) ? undefined : t("complete.askBoth"),
      onSelect: () => openSend("both"),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-xl px-section pb-24 pt-major sm:max-w-3xl rail:max-w-[75rem] rail:px-major rail:pb-major rail:pt-major">
      {/* The 5-second Undo, above everything else: a cashier who has just
          tapped the wrong sale needs it before "Sale complete" even, not
          after reading past it. Gone entirely on a handover written before
          Undo existed, or once the order itself is too old for one. */}
      {info.completedAt && orderId && (
        <UndoBar orderId={orderId} completedAt={info.completedAt} payment={payment} onUndoing={onUndoing} />
      )}

      <div className="flex flex-col gap-major">
        {/* ── One header row: what happened on the left, what to do next on the right ── */}
        <div className="flex flex-col gap-major rail:flex-row rail:items-start rail:justify-between rail:gap-major">
          <section className="flex min-w-0 flex-col items-center text-center rail:items-start rail:text-left" aria-labelledby="sale-complete">
            <div id="sale-status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rail:justify-start">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success-wash text-success">
                <Check size={16} strokeWidth={2.6} aria-hidden />
              </span>
              <h1 id="sale-complete" className={`text-md font-semibold text-fg ${R.page}`}>
                {t("complete.saleComplete")}
              </h1>
              {ticketsKnown && (
                <>
                  <span aria-hidden className="text-muted rail:hidden">
                    ·
                  </span>
                  <span className="text-md text-muted rail:hidden">{t("complete.ticketsIssuedCount", { count: tickets.length })}</span>
                </>
              )}
            </div>

            {/* The label names the figure on a phone. On a desktop only the change has one: a paid amount is named by the line under it. */}
            <p className={cn(`mt-major text-base font-medium text-muted ${R.label}`, "rail:mt-comfortable", change <= 0 && "rail:hidden")}>{lead.label}</p>
            <p className="mt-1.5 text-[clamp(2.5rem,13vw,3.5rem)] font-semibold leading-none tracking-figure text-fg rail:mt-tight rail:text-4xl rail:font-bold">{lead.amount}</p>
            {lead.note && <p className={`mt-tight text-base text-muted rail:hidden`}>{lead.note}</p>}
            {railNote && <p className={`mt-inline hidden ${T.meta} rail:block`}>{railNote}</p>}
            {balance > 0 && (
              <p className="mt-comfortable inline-flex items-center gap-1.5 rounded-full bg-warning-wash px-comfortable py-inline text-sm font-medium text-fg">
                <Clock size={14} strokeWidth={2.2} aria-hidden className="shrink-0" />
                {t("complete.collectAtArrival", { amount: formatMoney(balance) })}
              </p>
            )}
          </section>

          {/* Hand-over is two menus, not six tiles: what the till does by itself
              is set once in Till settings, so this is only the exception. New
              sale is the one primary action; pinned above the tab bar on a
              phone, in the row on a desktop. Focused, so Enter starts the next sale. */}
          <section aria-label={hasTickets ? t("complete.handOverTitle") : t("complete.handOverReceiptTitle")} className="flex flex-col gap-comfortable rail:flex-row rail:items-center rail:gap-tight">
            <div className={cn("grid gap-tight rail:flex", hasTickets ? "grid-cols-2" : "grid-cols-1")}>
              <HandOverMenu label={t("complete.printMenu")} icon={<Printer size={18} strokeWidth={2} aria-hidden />} items={printItems} />
              {hasTickets && <HandOverMenu label={t("complete.sendMenu")} icon={<Send size={18} strokeWidth={2} aria-hidden />} items={sendItems} align="right" />}
            </div>
            {/* The page colour runs behind the phone's floating button down to the tab bar (with a short fade above), and the page is padded by its height. */}
            <div className="fixed inset-x-comfortable z-30 pt-tight rail:static rail:z-auto rail:pt-0" style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}>
              <ChromeBackdrop />
              {/* As wide as the content above it: 48rem less the page's 16px gutters from sm. */}
              <div className="mx-auto max-w-[34rem] sm:max-w-[calc(48rem-32px)] rail:max-w-none">
                <Button
                  size="lg"
                  autoFocus
                  aria-describedby="sale-status"
                  icon={<Plus size={20} strokeWidth={2.2} />}
                  className={`h-13 w-full text-md font-semibold shadow-float rail:h-10 rail:w-auto rail:px-section rail:shadow-none ${R.button} rail:font-semibold`}
                  onClick={() => router.push(takeReturnTo() ?? "/pos")}
                >
                  {t("complete.newSale")}
                </Button>
              </div>
            </div>
          </section>
        </div>

        {(doneText || missingText) && (
          <div role="status" className="flex flex-col items-center gap-1 text-center rail:items-start rail:text-left">
            {doneText && (
              <p className={`flex items-center gap-1.5 ${T.meta}`}>
                <Check size={16} strokeWidth={2.4} aria-hidden className="shrink-0 text-success" />
                {doneText}
              </p>
            )}
            {missingText && <p className={T.meta}>{missingText}</p>}
          </div>
        )}

        {/* ── The sale and the tickets, for checking: two columns on a desktop ── */}
        <div className={cn("flex flex-col gap-major rail:grid rail:items-start", info.receipt ? "rail:grid-cols-[26rem_minmax(0,1fr)]" : "rail:grid-cols-1")}>
          {ticketsKnown && tickets.length > 0 && (
            <section aria-labelledby="tickets-title" className="flex flex-col gap-tight">
              <TileLabel id="tickets-title">
                {t("complete.ticketsTitle")}
                <span className="hidden font-normal text-muted rail:inline"> · {tickets.length}</span>
              </TileLabel>
              {/* One card per ticket, a gap of page between: the wall's drawing. */}
              <ul className={cn("flex flex-col gap-comfortable rail:gap-tight", rail && tickets.length > 2 && "grid grid-cols-2")}>
                {visibleTickets.map((ticket) => (
                  <li key={ticket.code}>
                    {/* The whole card opens the QR large, for the guest to photograph or the gate to scan. */}
                    <button
                      type="button"
                      onClick={() => setShown(ticket)}
                      className="card-surface flex w-full items-center gap-comfortable p-comfortable text-left transition-colors duration-quick active:bg-muted-wash rail:p-tight"
                    >
                      {/* The QR is what the gate scans, so it is dark on white in either theme. */}
                      <span className="shrink-0 rounded-md bg-white p-1 ring-1 ring-line">
                        <Qr value={ticket.code} size={rail ? 72 : 44} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block break-words text-md font-semibold leading-snug text-fg ${R.item}`}>{ticket.name}</span>
                        <span className="mt-0.5 block truncate text-sm text-muted">{ticketMeta(ticket)}</span>
                        <span className="mt-0.5 block truncate font-mono text-sm text-muted">{ticket.code}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
                {!allTickets && tickets.length > shownCount && (
                  <li className="col-span-full">
                    <button
                      type="button"
                      onClick={() => setAllTickets(true)}
                      className={tileClass({ className: "min-h-12 w-full text-base font-medium text-brand-foreground" })}
                    >
                      {t("complete.showAllTickets", { count: tickets.length })}
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}
          {/* A sale with no tickets (a receipt-only sale) would leave the right column blank on a desktop: say so. */}
          {ticketsKnown && tickets.length === 0 && <p className={`hidden ${T.meta} rail:block`}>{t("complete.noTicketsIssued")}</p>}

          {receiptCard}
        </div>
      </div>

      {/* One ticket, large: the code a gate scans, readable from across the counter. */}
      <Modal open={!!shown} onClose={() => setShown(null)} title={shown?.name} size="sm">
        {shown && (
          <div className="flex flex-col items-center text-center normal-nums">
            <span className="rounded-inner bg-white p-3 ring-1 ring-line">
              <Qr value={shown.code} size={216} />
            </span>
            <p className="mt-section font-mono text-md text-fg">{shown.code}</p>
            <p className="mt-1 text-base text-muted">{ticketMeta(shown)}</p>
            <p className="mt-section text-sm text-muted">{t("complete.qrHelp")}</p>
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
            <Button variant="secondary" onClick={() => setSending(null)}>
              {t("complete.cancel")}
            </Button>
            <Button disabled={!canSend} onClick={send}>
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
              <label htmlFor={phoneId} className="text-base font-medium text-fg">
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
                  "h-12 w-full rounded-inner border bg-card px-comfortable font-mono text-md text-fg transition-colors duration-quick placeholder:text-faint",
                  phoneInvalid ? "border-danger" : "border-line",
                )}
              />
              <p id={phoneHelpId} className={cn("text-sm", phoneInvalid ? "text-danger" : "text-muted")}>
                {phoneInvalid ? t("complete.smsInvalid") : t("complete.smsToHelp")}
              </p>
            </div>
          )}
          {wantsEmail && (
            <div className="flex flex-col gap-tight">
              <label htmlFor={emailId} className="text-base font-medium text-fg">
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
                  "h-12 w-full rounded-inner border bg-card px-comfortable text-md text-fg transition-colors duration-quick placeholder:text-faint",
                  emailInvalid ? "border-danger" : "border-line",
                )}
              />
              <p id={emailHelpId} className={cn("text-sm", emailInvalid ? "text-danger" : "text-muted")}>
                {emailInvalid ? t("complete.emailInvalid") : t("complete.emailToHelp")}
              </p>
            </div>
          )}

          {wantsSms && (
            <div>
              {sending === "both" && <p className="mb-1.5 text-sm font-medium text-muted">{t("complete.handOverSms")}</p>}
              <div className="rounded-inner border border-line bg-subtle p-comfortable text-base text-fg">{smsText}</div>
              <p className="mt-tight text-sm text-muted">{t("complete.smsMeta", { count: smsText.length })}</p>
            </div>
          )}
          {wantsEmail && (
            <div>
              {sending === "both" && <p className="mb-1.5 text-sm font-medium text-muted">{t("complete.handOverEmail")}</p>}
              {/* The message as it will arrive: its subject, then what it says. */}
              <div className="rounded-inner border border-line bg-subtle p-comfortable text-base">
                <p className="break-words font-semibold text-fg">{emailSubject}</p>
                {/* The operator's own line breaks, kept: the body is now
                    their wording, and a preview that runs their paragraphs
                    together is showing a message that is not the one sent. */}
                <p className="mt-1 whitespace-pre-wrap break-words text-muted">{emailBody}</p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </main>
  );
}

/**
 * Gmail's "Undo send", at the till: act on the sale at once, and offer a
 * timed way to take it back rather than a confirmation dialog in front of it.
 * A visible countdown and a draining line say exactly how long the offer
 * stands; past it, the bar collapses away (instantly under reduced motion —
 * the global rule already turns the transition off, so no branch is needed
 * here for that).
 *
 * Pressing Undo cancels the real order (`cancelSale`, which also refuses a
 * sale that is genuinely too old), hands the sale's own lines, customer and
 * discount back to the live sale so the cart reads exactly as it did before
 * the mistake, and clears this handover so Back cannot show a cancelled sale
 * as complete.
 */
function UndoBar({
  orderId,
  completedAt,
  payment,
  onUndoing,
}: {
  orderId: string;
  completedAt: string;
  payment?: { method: string; amount: number };
  /** Called the instant a successful Undo starts clearing this page's own
   *  handover, so the page's "no handover → back to /pos" effect does not
   *  mistake that for a stale visit and race its own navigation to the cart. */
  onUndoing: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("pos");
  const totalMs = UNDO_SALE_SECONDS * 1000;
  const deadline = useMemo(() => Date.parse(completedAt) + totalMs, [completedAt, totalMs]);
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  const [draining, setDraining] = useState(false);
  const [collapsing, setCollapsing] = useState(() => deadline - Date.now() <= 0);
  const [gone, setGone] = useState(() => deadline - Date.now() <= 0);
  const [undoing, setUndoing] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gone) return;
    // Draw at the full width first, THEN start the drain — so the browser has
    // something to transition FROM rather than starting already at 0%.
    const raf = requestAnimationFrame(() => setDraining(true));
    const tick = setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(tick);
        setCollapsing(true);
        collapseTimer.current = setTimeout(() => setGone(true), 320);
      }
    }, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tick);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, [deadline, gone]);

  if (gone) return null;

  const seconds = Math.max(1, Math.ceil(remaining / 1000));

  const undo = async () => {
    setUndoing(true);
    const res = await cancelSale(orderId);
    setUndoing(false);
    if (!res.ok) {
      // "Too late to undo this sale" — the window closed between the tap and
      // the call. The message names it; the screen itself does not move.
      toast.error(res.error.message);
      return;
    }
    onUndoing();
    // Hand the sale back to the cart BEFORE clearing this handover, so a
    // reload mid-navigation still has somewhere to land it.
    const snapshot = takeUndoSnapshot();
    if (snapshot) writeLiveSale(snapshot);
    sessionStorage.removeItem("pos_complete");
    toast.success(
      payment?.method === "cash" && payment.amount > 0
        ? t("complete.saleUndoneCash", { amount: formatMoney(payment.amount) })
        : t("complete.saleUndone"),
    );
    router.push("/pos/cart");
  };

  return (
    <div
      className={cn(
        "mb-major grid transition-[grid-template-rows] duration-considered ease-counterfoil",
        collapsing ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
    >
      <div className="overflow-hidden">
        {/* A slim strip, not a card: one line of words, the seconds left, and a
            secondary button, with a thin bar draining underneath. The offer is
            a quiet one and it stands for five seconds; orange here would be
            New sale's. The count sits OUTSIDE the button, so the button reads
            as one action and the number as the clock. */}
        <div
          className={cn(
            "overflow-hidden rounded-inner ring-1 ring-inset ring-line transition-opacity duration-considered ease-counterfoil",
            collapsing && "opacity-0",
          )}
        >
          <div className="flex items-center gap-tight py-1 pl-comfortable pr-1">
            <p className="min-w-0 flex-1 py-tight text-sm text-muted">{t("complete.undoHint", { seconds: UNDO_SALE_SECONDS })}</p>
            <span aria-hidden className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-fg">
              {t("complete.undoCount", { seconds })}
            </span>
            <Button
              variant="secondary"
              icon={<RotateCcw size={18} strokeWidth={2} aria-hidden />}
              loading={undoing}
              onClick={undo}
              className="shrink-0"
            >
              {t("complete.undoSale")}
            </Button>
          </div>
          {/* The draining line: it empties over the window on its own, via a
              CSS transition rather than a per-frame width calculation — smooth
              with no extra JS, and instant under reduced motion like every
              other transition in this app. */}
          <div aria-hidden className="h-1 bg-subtle">
            <div
              className="h-full bg-muted"
              style={{ width: draining ? "0%" : "100%", transition: draining ? `width ${totalMs}ms linear` : "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, kind = "plain" }: { label: string; value: string; kind?: "plain" | "paid" | "total" }) {
  return (
    <div className="flex items-baseline justify-between gap-comfortable">
      <dt className={cn(kind === "total" ? "text-fg" : "text-muted", kind === "total" ? R.item : kind === "paid" ? R.body : R.meta)}>{label}</dt>
      <dd className={cn("tabular-nums text-fg", kind === "total" ? R.total : kind === "paid" ? R.price : "rail:text-sm rail:text-muted")}>{value}</dd>
    </div>
  );
}
