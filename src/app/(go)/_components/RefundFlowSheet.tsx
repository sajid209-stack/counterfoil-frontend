"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { Notice, Sheet, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { peekOrders, peekTickets, ticketShares, type Minor, type Ticket } from "@/lib/api";
import {
  REFUND_REASONS,
  canAskNow,
  goodwillMaxFor,
  refundOptions,
  useRefundVersion,
  type RefundReason,
  type RefundScope,
} from "@/lib/api/refundRequests";
import { canRefundDirectly, useActor } from "../schedule/_lib/actor";
import { sendOrApproveRefund } from "../schedule/_lib/refundFlow";
import { primaryButton, secondaryButton } from "./ActionBar";
import { OptionRow } from "./SheetParts";
import { Tile, TileGrid } from "./Tiles";

/* ── One refund sheet, three choices ──────────────────────────────────────
 *
 * Every place the till gives money back asks the same two questions, in the
 * same order, so a cashier learns the sheet once: WHAT goes back, then WHY.
 *
 *   Cancel the booking   the worked-out amount; the slot goes back on sale
 *   Some tickets         (only when there are two or more) pick which; the
 *                        total follows the tiles
 *   An amount            goodwill: type it, tickets stay valid
 *
 * The amount for the first two is never typed — it is what was paid — so the
 * only money field is the goodwill one, and it is refused in words when it is
 * more than the sale still holds. The window to ask comes from Settings →
 * Refunds & write-offs; when it has closed the sheet says so in the form's
 * place and offers no orange button.
 *
 * The orange button is bottom-right, "Back" its left neighbour. It says
 * "Send to a manager" — or "Refund ৳X now" where this role may do it on the
 * spot and the amount is within its limit.
 */

/* A phone and a tablet held upright keep the bottom sheet; from the desktop up
   it is a dialog, centred on the screen at about 560px. */
const WIDTH = "mx-auto max-w-xl rail:inset-y-0 rail:my-auto rail:h-fit rail:rounded-sheet rail:[animation-name:sf-fade-in]";
const toMinor = (raw: string): Minor => Math.round((parseFloat(raw.replace(/,/g, "")) || 0) * 100);
/** "…-01" → "#01": which of several identical tickets this is. */
const tail = (t: Ticket) => {
  const s = t.code.split("-").pop() ?? "";
  return s ? `#${s}` : "";
};

export function RefundFlowSheet({
  open,
  onClose,
  title,
  when,
  bookingId,
  orderId,
  place,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Who it is for — the lead line. */
  title: string;
  when?: string;
  /** Refund from a booked slot: all three choices. */
  bookingId?: string;
  /** Refund from a sale with no booking behind it (My sales): tickets and an
   *  amount only. */
  orderId?: string;
  place?: string | null;
  /** The request was sent (or the refund done): the caller closes and re-reads. */
  onDone?: () => void;
}) {
  const t = useTranslations("refunds");
  const tc = useTranslations("common");
  const enumL = useEnumLabels();
  const toast = useToast();
  const actor = useActor();
  useRefundVersion();

  /* What the counter can offer, read fresh on every render: the mock store is
     synchronous, and a request made elsewhere changes it. */
  const opts = bookingId ? refundOptions(bookingId) : null;
  const order = opts?.order ?? (orderId ? peekOrders().find((o) => o.id === orderId) : undefined);
  const tickets: { ticket: Ticket; amount: Minor }[] = (() => {
    if (opts) return opts.tickets;
    if (!order) return [];
    const live = peekTickets().filter((x) => x.orderId === order.id && x.status === "issued");
    const shares = new Map(ticketShares(order, live.map((x) => x.id)).map((s) => [s.ticketId, s.amount]));
    return live.filter((x) => shares.has(x.id)).map((x) => ({ ticket: x, amount: shares.get(x.id)! }));
  })();
  const bookingAmount = opts?.bookingAmount ?? 0;
  const goodwillMax = opts?.goodwillMax ?? (order ? goodwillMaxFor(order.id) : 0);
  const gate = bookingId ? canAskNow(bookingId) : ({ ok: true } as const);

  const canBooking = !!bookingId && bookingAmount > 0;
  const canTickets = tickets.length >= 2;
  const canGoodwill = goodwillMax > 0;
  const nothing = !canBooking && !canTickets && !canGoodwill;

  const [what, setWhat] = useState<RefundScope>(() => (canBooking ? "booking" : canTickets ? "tickets" : "goodwill"));
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [raw, setRaw] = useState("");
  const [reason, setReason] = useState<RefundReason>("customer_cancelled");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{ field: "tickets" | "amount" | "note" | "form"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pickedTickets = tickets.filter((x) => picked.has(x.ticket.id));
  const typed = toMinor(raw);
  const amount: Minor = what === "booking" ? bookingAmount : what === "tickets" ? pickedTickets.reduce((s, x) => s + x.amount, 0) : typed;
  const direct = !actor.loading && amount > 0 && canRefundDirectly(actor, amount);
  const blocked = !gate.ok;

  const choose = (w: RefundScope) => { setWhat(w); setErr(null); };
  const toggle = (id: string) => {
    setErr(null);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const fail = (field: NonNullable<typeof err>["field"], text: string, focusId?: string) => {
    setErr({ field, text });
    if (focusId) document.getElementById(focusId)?.focus();
  };

  const send = async () => {
    if (busy) return;
    if (what === "tickets" && pickedTickets.length === 0) return fail("tickets", t("pos.flow.noTickets"));
    if (what === "goodwill") {
      if (!(typed > 0)) return fail("amount", t("pos.flow.amountNeed"), "rf-amount");
      if (typed > goodwillMax) return fail("amount", t("pos.flow.amountOver", { max: formatMoney(goodwillMax) }), "rf-amount");
    }
    if (reason === "other" && !note.trim()) return fail("note", t("pos.flow.noteRequired"), "rf-note");
    setErr(null);
    setBusy(true);
    const res = await sendOrApproveRefund({
      scope: what,
      bookingId,
      orderId: order?.id,
      ticketIds: what === "tickets" ? pickedTickets.map((x) => x.ticket.id) : undefined,
      amount: what === "goodwill" ? typed : undefined,
      reason,
      note: note.trim(),
      requestedBy: actor.name,
      place,
      direct,
    });
    setBusy(false);
    if (!res.ok) {
      // The API's own sentence is the answer ("A refund … is already waiting").
      setErr({ field: "form", text: res.error.message || t("pos.flow.failed") });
      return;
    }
    if (res.data.status === "approved") {
      const method = order?.payments[0]?.method ?? "cash";
      toast.success(t("pos.flow.doneDirect", { amount: formatMoney(res.data.approvedAmount ?? res.data.amount), method: enumL.method(method) }));
    } else {
      toast.success(t("pos.flow.sent"));
    }
    onDone?.();
  };

  const footer = (
    <div className="flex w-full gap-tight">
      <button type="button" className={secondaryButton("h-13", "flex-1")} onClick={onClose} disabled={busy}>
        <ChevronLeft size={20} strokeWidth={2} aria-hidden />
        {t("pos.flow.back")}
      </button>
      {!blocked && !nothing && (
        <button type="button" data-refund-primary className={primaryButton("min-h-13 py-2", "flex-[1.4]")} onClick={() => void send()} disabled={busy}>
          <RotateCcw size={20} strokeWidth={2} aria-hidden />
          <span className="text-center leading-tight">{direct ? t("pos.flow.sendNow", { amount: formatMoney(amount) }) : t("pos.flow.send")}</span>
        </button>
      )}
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={direct ? t("pos.flow.titleDirect") : t("pos.flow.title")}
      closeLabel={tc("close")}
      className={WIDTH}
      lead={<p className="text-base font-medium text-muted">{title}{when ? ` · ${when}` : ""}</p>}
      footer={footer}
    >
      <div className="flex flex-col gap-section p-card">
        {blocked ? (
          <div data-refund-blocked><Notice tone="warning">{gate.reason}</Notice></div>
        ) : nothing ? (
          <Notice tone="neutral">{t("pos.flow.nothing")}</Notice>
        ) : (
          <>
            <fieldset className="flex flex-col gap-tight">
              <legend className="mb-tight p-0 text-md font-semibold text-fg">{t("pos.flow.whatLabel")}</legend>
              {canBooking && (
                <OptionRow
                  selected={what === "booking"}
                  onClick={() => choose("booking")}
                  title={t("pos.flow.cancelBooking")}
                  sub={t("pos.flow.cancelBookingSub", { amount: formatMoney(bookingAmount) })}
                />
              )}
              {canTickets && (
                <OptionRow selected={what === "tickets"} onClick={() => choose("tickets")} title={t("pos.flow.someTickets")} sub={t("pos.flow.someTicketsSub")} />
              )}
              {canGoodwill && (
                <OptionRow selected={what === "goodwill"} onClick={() => choose("goodwill")} title={t("pos.flow.goodwill")} sub={t("pos.flow.goodwillSub")} />
              )}
            </fieldset>

            {what === "tickets" && (
              <fieldset className="flex flex-col gap-tight">
                <legend className="mb-tight p-0 text-md font-semibold text-fg">{t("pos.flow.ticketsLabel")}</legend>
                <TileGrid cols={2}>
                  {tickets.map((x) => {
                    const on = picked.has(x.ticket.id);
                    return (
                      <Tile
                        key={x.ticket.id}
                        selected={on}
                        onClick={() => toggle(x.ticket.id)}
                        aria-label={t("pos.flow.ticketItem", { tier: `${x.ticket.tierName} ${tail(x.ticket)}`.trim(), amount: formatMoney(x.amount) })}
                        className="min-h-16 gap-0"
                      >
                        <span className="text-base font-semibold leading-tight">{x.ticket.tierName}</span>
                        <span className={cn("text-sm leading-tight", on ? "text-on-solid" : "text-muted")}>{[tail(x.ticket), formatMoney(x.amount)].filter(Boolean).join(" · ")}</span>
                      </Tile>
                    );
                  })}
                </TileGrid>
                {err?.field === "tickets" && <span className="text-base font-medium text-danger">{err.text}</span>}
              </fieldset>
            )}

            {what === "goodwill" && (
              <label data-focus-host className="flex flex-col gap-tight">
                <span className="text-md font-semibold text-fg">{t("pos.flow.amountLabel")}</span>
                <span className="flex h-12 items-center gap-tight rounded-inner bg-subtle ring-1 ring-inset ring-line px-comfortable focus-within:ring-2 focus-within:ring-ember">
                  <span aria-hidden className="text-md font-semibold text-muted">৳</span>
                  <input
                    id="rf-amount"
                    inputMode="decimal"
                    value={raw}
                    onChange={(e) => { setRaw(e.target.value); setErr(null); }}
                    placeholder="0"
                    aria-invalid={err?.field === "amount"}
                    aria-describedby="rf-amount-help"
                    className="h-full min-w-0 flex-1 bg-transparent text-right text-lg font-semibold tabular-nums text-fg"
                  />
                </span>
                <span id="rf-amount-help" className={cn("text-sm", err?.field === "amount" ? "font-medium text-danger" : "text-muted")}>
                  {err?.field === "amount" ? err.text : t("pos.flow.amountHint", { max: formatMoney(goodwillMax) })}
                </span>
              </label>
            )}

            {amount > 0 && (
              <div data-refund-total className="rounded-inner bg-subtle ring-1 ring-inset ring-line p-comfortable">
                <p className="text-base text-muted">{t("pos.flow.total")}</p>
                <p className="text-3xl font-semibold leading-tight tabular-nums text-fg">{formatMoney(amount)}</p>
                <p className="text-sm text-muted">{t(`pos.flow.totalSub.${what}`)}</p>
              </div>
            )}

            <fieldset>
              <legend className="mb-tight p-0 text-md font-semibold text-fg">{t("pos.flow.reasonLabel")}</legend>
              <TileGrid cols={2} role="radiogroup" aria-label={t("pos.flow.reasonLabel")}>
                {REFUND_REASONS.map((r, i) => (
                  <Tile
                    key={r}
                    role="radio"
                    aria-checked={reason === r}
                    selected={reason === r}
                    onClick={() => { setReason(r); setErr(null); }}
                    className={cn("min-h-14 text-md font-semibold", i === REFUND_REASONS.length - 1 && REFUND_REASONS.length % 2 === 1 && "col-span-2")}
                  >
                    {t(`reasons.${r}`)}
                  </Tile>
                ))}
              </TileGrid>
            </fieldset>

            <label data-focus-host className="flex flex-col gap-tight">
              <span className="text-md font-semibold text-fg">{reason === "other" ? t("pos.flow.noteLabelRequired") : t("pos.flow.noteLabel")}</span>
              <textarea
                id="rf-note"
                value={note}
                onChange={(e) => { setNote(e.target.value); setErr(null); }}
                rows={2}
                placeholder={t("pos.flow.notePlaceholder")}
                aria-invalid={err?.field === "note"}
                aria-describedby={err?.field === "note" ? "rf-note-err" : undefined}
                className="min-h-[5.5rem] resize-none rounded-inner bg-subtle ring-1 ring-inset ring-line px-comfortable py-tight text-md text-fg focus:ring-2 focus:ring-ember"
              />
              {err?.field === "note" && <span id="rf-note-err" className="text-base font-medium text-danger">{err.text}</span>}
            </label>

            {err?.field === "form" && <Notice tone="danger">{err.text}</Notice>}
            <p className="text-sm text-muted">{direct ? t("pos.flow.leadDirect") : t("pos.flow.leadAsk")}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
