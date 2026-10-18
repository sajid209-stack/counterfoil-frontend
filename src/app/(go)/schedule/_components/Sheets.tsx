"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Banknote,
  CalendarClock,
  ChevronLeft,
  Clock,
  Lock,
  RotateCcw,
  Send,
  ShoppingBag,
  Unlock,
  UserCheck,
} from "lucide-react";
import { MarketBadge, Notice, Sheet, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClock, formatClockOf, formatClockRange, formatDay, formatMoney, formatPriceShort } from "@/lib/format";
import { DEMO_NOW_MINUTES, DEMO_TODAY, demoDay, slotISO, toMinutes, toTime } from "@/lib/schedule";
import { isOpenOn, type Minor, type PaymentMethod, type Product } from "@/lib/api";
import { REFUND_REASONS, type RefundReason, type RefundRequest } from "@/lib/api/refundRequests";
import {
  pendingRescheduleFor,
  requestReschedule,
  rescheduleRequestsForOrder,
  useRescheduleVersion,
  withdrawRescheduleRequest,
  type RescheduleReason,
} from "@/lib/api/rescheduleRequests";
import { canRefundDirectly, useActor } from "../_lib/actor";
import { resourceMoveTimes, sessionMoveTimes, type MoveTime } from "../_lib/moveOptions";
import { PaymentSheet } from "./PaymentSheet";
import { type Block, type Column } from "../_lib/board";
import { ClockCell } from "../../_components/Clock";
import { Stepper } from "../../_components/Stepper";
import { Tile, TileGrid, TileLabel } from "../../_components/Tiles";
import { DateTiles } from "../../_components/SheetParts";

/* The two big buttons every sheet here ends on, always in the same places:
   Hold on the LEFT, Add to sale on the RIGHT. A cashier who cannot read the
   words learns "orange on the right sells it" once and never has to look
   again — and it is the same pair, in the same order, as the bar under the
   board. */
const BASE = "inline-flex min-w-0 items-center justify-center gap-tight rounded-full px-comfortable text-md font-semibold transition-transform duration-quick active:scale-[0.98] disabled:opacity-50";
/** On a counter tablet a bottom sheet stretched the whole screen; the till’s own
 *  sheets stop at about 560px, centred, and these do too. */
export const SHEET_WIDTH = "mx-auto max-w-xl";
/** The two buttons, at a height. Built here rather than overridden at the
 *  call site: `cn` does not merge conflicting utilities, so "h-14 h-13" is
 *  decided by stylesheet order, not by intent. */
export const primary = (h = "h-13", grow = "flex-1") => `${BASE} ${h} ${grow} bg-ember-solid text-on-solid`;
export const secondary = (h = "h-13", grow = "flex-1") => `${BASE} ${h} ${grow} bg-card text-fg shadow-card ring-1 ring-inset ring-line`;
const PRIMARY = primary();
const SECONDARY = secondary();
/** Add to sale gets the larger share of the row: it is the common answer. */
const PRIMARY_WIDE = primary("h-13", "flex-[1.4]");

export type HoldLength = 15 | 30 | 60 | "day";
const LENGTHS: HoldLength[] = [15, 30, 60, "day"];

export interface HoldRequest {
  heldFor: string;
  length: HoldLength;
  quantity: number;
}

/** Who a hold is for, and for how long — the same questions wherever a hold
 *  is placed from. */
function HoldForm({
  name,
  setName,
  missing,
  setMissing,
  length,
  setLength,
  onEnter,
}: {
  name: string;
  setName: (v: string) => void;
  missing: boolean;
  setMissing: (v: boolean) => void;
  length: HoldLength;
  setLength: (v: HoldLength) => void;
  onEnter: () => void;
}) {
  const t = useTranslations("schedule");
  return (
    <>
      {/* The field draws its own ember border when focused; the app-wide ring
          on top of it read as two rings. The opt-out is on the host. */}
      <div data-focus-host className="flex flex-col gap-inline">
        <label htmlFor="hold-name" className="text-md font-semibold text-fg">{t("sheet.holdName")}</label>
        <input
          id="hold-name"
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setMissing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
          placeholder={t("sheet.holdNamePh")}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? "hold-name-err" : undefined}
          className={cn("h-14 rounded-inner bg-subtle px-comfortable text-md focus:ring-2 focus:ring-ember", missing && "ring-2 ring-danger")}
        />
        {missing && <p id="hold-name-err" className="text-base text-danger">{t("sheet.holdNameMissing")}</p>}
      </div>
      <div role="radiogroup" aria-label={t("sheet.holdLength")} className="flex flex-col gap-tight">
        <TileLabel>{t("sheet.holdLength")}</TileLabel>
        <TileGrid cols={4} className="max-[400px]:grid-cols-2">
          {LENGTHS.map((l) => (
            <Tile
              key={String(l)}
              role="radio"
              aria-checked={length === l}
              selected={length === l}
              onClick={() => setLength(l)}
              className="h-12 text-md font-semibold"
            >
              {l === "day" ? t("sheet.holdDay") : l === 60 ? t("sheet.hold1h") : t("sheet.holdMin", { count: l })}
            </Tile>
          ))}
        </TileGrid>
        <p className="text-base text-muted">{t("sheet.holdHelp")}</p>
      </div>
    </>
  );
}

function useHoldForm(onHold: (req: HoldRequest) => void, quantity: () => number) {
  const [name, setName] = useState("");
  const [length, setLength] = useState<HoldLength>(30);
  const [missing, setMissing] = useState(false);
  const submit = () => {
    if (!name.trim()) {
      setMissing(true);
      return;
    }
    onHold({ heldFor: name.trim(), length, quantity: quantity() });
  };
  return { name, setName, length, setLength, missing, setMissing, submit };
}

/** Hold the hours chosen on the board. */
export function HoldSheet({
  open,
  onClose,
  title,
  when,
  onHold,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  when: string;
  onHold: (req: HoldRequest) => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const f = useHoldForm(onHold, () => 1);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={tc("close")}
      className={SHEET_WIDTH}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={SECONDARY} onClick={onClose}>{t("sheet.back")}</button>
          <button type="button" className={PRIMARY} onClick={f.submit} disabled={busy}>
            <Lock size={20} strokeWidth={2} aria-hidden />
            {t("sheet.holdIt")}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        {/* What is being held, under its title — the title says what the
            sheet does, this says to what. */}
        <p className="-mt-tight text-base text-muted">{when}</p>
        <HoldForm name={f.name} setName={f.setName} missing={f.missing} setMissing={f.setMissing} length={f.length} setLength={f.setLength} onEnter={f.submit} />
      </div>
    </Sheet>
  );
}

/**
 * A show or a tour: how many of which ticket, then Hold or Add to sale.
 *
 * It opens with one of the first ticket type already chosen — "one, please"
 * is the commonest answer at a counter, so the orange button is ready the
 * moment the sheet is.
 */
export function SessionSheet({
  open,
  onClose,
  product,
  block,
  title,
  when,
  initialQty,
  sellLabel,
  guideMissing,
  onAdd,
  onHold,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  block: Extract<Block, { type: "session" }>;
  title: string;
  when: string;
  /** Places to start on — a held group being sold starts on its size. */
  initialQty?: number;
  sellLabel?: string;
  guideMissing: boolean;
  onAdd: (qty: Record<string, number>) => void;
  /** Absent when this sheet is selling a hold rather than offering one. */
  onHold?: (req: HoldRequest) => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  /* In the operator's own order, and starting on the FIRST ticket type — the
     standard one. Not the cheapest: that is usually a concession (a senior or
     a child ticket), and defaulting a queue to it is how concessions get sold
     to people who are not entitled to them. */
  const tiers = product.tiers.filter((x) => x.active && !x.donation);
  const [qty, setQty] = useState<Record<string, number>>(() => (tiers[0] ? { [tiers[0].id]: Math.max(1, initialQty ?? 1) } : {}));
  const [mode, setMode] = useState<"tickets" | "hold">("tickets");
  const people = tiers.reduce((s, x) => s + (qty[x.id] ?? 0) * (x.admits ?? 1), 0);
  const tickets = tiers.reduce((s, x) => s + (qty[x.id] ?? 0), 0);
  const total = tiers.reduce((s, x) => s + (qty[x.id] ?? 0) * x.price, 0);
  const over = people > block.remaining;
  const f = useHoldForm((req) => onHold?.(req), () => Math.max(1, people));
  const [nothing, setNothing] = useState(false);

  const add = () => {
    if (tickets === 0) {
      setNothing(true);
      return;
    }
    if (over || guideMissing) return;
    onAdd(qty);
  };
  const setTo = (id: string, v: number) => {
    setNothing(false);
    setQty((q) => ({ ...q, [id]: Math.max(0, v) }));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={tc("close")}
      className={SHEET_WIDTH}
      footer={
        mode === "tickets" ? (
          <div className="flex w-full gap-tight">
            {onHold && (
              <button type="button" className={SECONDARY} onClick={() => setMode("hold")}>
                <Lock size={20} strokeWidth={2} aria-hidden />
                {t("sheet.hold")}
              </button>
            )}
            <button type="button" className={PRIMARY_WIDE} onClick={add} disabled={busy}>
              <ShoppingBag size={20} strokeWidth={2} aria-hidden />
              {sellLabel ?? t("sheet.addToSale")}
            </button>
          </div>
        ) : (
          <div className="flex w-full gap-tight">
            <button type="button" className={SECONDARY} onClick={() => { setMode("tickets"); f.setMissing(false); }}>{t("sheet.back")}</button>
            <button type="button" className={PRIMARY} onClick={f.submit} disabled={busy}>
              <Lock size={20} strokeWidth={2} aria-hidden />
              {t("sheet.holdIt")}
            </button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-section p-card">
        <p className="-mt-tight text-base text-muted">{when}</p>
        {mode === "tickets" ? (
          <>
            <ul className="flex flex-col gap-tight">
              {tiers.map((x) => {
                const n = qty[x.id] ?? 0;
                return (
                  <li key={x.id} className="flex min-h-16 items-center gap-comfortable rounded-inner bg-subtle px-comfortable py-tight">
                    <span className="min-w-0 flex-1">
                      <span className="block text-md font-semibold text-fg">{x.name}</span>
                      <span className="block text-base tabular-nums text-muted">
                        {formatPriceShort(x.price)}
                        {(x.admits ?? 1) > 1 && ` · ${t("sheet.admitsCount", { count: x.admits ?? 1 })}`}
                      </span>
                    </span>
                    <Stepper
                      value={n}
                      onChange={(v) => setTo(x.id, v)}
                      lessLabel={t("sheet.lessOf", { name: x.name })}
                      moreLabel={t("sheet.moreOf", { name: x.name })}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between gap-comfortable">
              <span className="text-base text-muted">{t("sheet.seatsLeftNow", { count: block.remaining })}</span>
              <span className="text-xl font-semibold tabular-nums text-fg">{formatMoney(total)}</span>
            </div>
            {nothing && <Notice tone="danger" size="sm">{t("sheet.pickTickets")}</Notice>}
            {over && <Notice tone="danger" size="sm">{t("sheet.tooMany", { count: block.remaining })}</Notice>}
            {guideMissing && <Notice tone="danger" size="sm">{t("sheet.noGuide")}</Notice>}
          </>
        ) : (
          <HoldForm name={f.name} setName={f.setName} missing={f.missing} setMissing={f.setMissing} length={f.length} setLength={f.setLength} onEnter={f.submit} />
        )}
      </div>
    </Sheet>
  );
}

/**
 * Something already on the board: a booking or a hold.
 *
 * A booking offers the one thing a counter does with it today — let the
 * people in. A hold offers the two things that end it: sell it to the person
 * it was held for (straight into the sale), or put it back on sale.
 */
export function BlockSheet({
  open,
  onClose,
  column,
  block,
  isToday,
  onCheckIn,
  onRelease,
  onSellHold,
  refund,
  onRefund,
  onWithdrawRefund,
  /** Offered whenever the booking can be moved — hidden rather than disabled,
   *  the way a cashier under pressure expects a button that is not for now. */
  canMove,
  onMove,
  /** What is still owed on this booking's order. Above zero, the orange
   *  button takes it (and offers the after-game discount) instead of
   *  checking the party in — the same order check-in already keeps: money
   *  first, then the door. */
  owed,
  onTake,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  column: Column | null;
  block: Extract<Block, { type: "booking" | "hold" }> | null;
  isToday: boolean;
  onCheckIn: () => void;
  onRelease: () => void;
  onSellHold: () => void;
  /** Where this booking stands on a refund: one waiting for a manager, the
   *  last one decided, and whether there is any money on it to give back. */
  refund?: { pending: RefundRequest | null; last: RefundRequest | null; refundable: boolean; amount?: Minor };
  onRefund?: () => void;
  onWithdrawRefund?: () => void;
  canMove?: boolean;
  onMove?: () => void;
  owed?: Minor;
  onTake?: () => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const toast = useToast();
  /* What this role may do at the counter — Settings → Roles. "Off" hides the
     button, "request" asks a manager, "direct" does it on the spot. */
  const actor = useActor();
  // A move request is made and answered elsewhere; re-read it when it changes.
  useRescheduleVersion();
  const [withdrawing, setWithdrawing] = useState(false);
  if (!block || !column) return null;
  const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
  const when = `${place} · ${formatClockRange(block.start, block.end)}`;

  if (block.type === "hold") {
    const h = block.hold;
    const until = h.expiresAt ? new Date(h.expiresAt) : null;
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={h.heldFor}
        closeLabel={tc("close")}
      className={SHEET_WIDTH}
        lead={<p className="flex items-center gap-1 text-base font-medium text-muted"><Lock size={14} aria-hidden />{t("board.onHold")}</p>}
        footer={
          <div className="flex w-full gap-tight">
            <button type="button" className={SECONDARY} onClick={onRelease} disabled={busy}>
              <Unlock size={20} strokeWidth={2} aria-hidden />
              {t("sheet.release")}
            </button>
            <button type="button" className={PRIMARY_WIDE} onClick={onSellHold} disabled={busy}>
              <ShoppingBag size={20} strokeWidth={2} aria-hidden />
              <span className="truncate">{t("sheet.sellTo", { name: h.heldFor })}</span>
            </button>
          </div>
        }
      >
        <dl className="flex flex-col gap-tight p-card text-md">
          <Fact label={t("sheet.where")} value={when} />
          <Fact label={t("sheet.what")} value={h.productName} />
          <Fact
            label={t("sheet.holdUntil")}
            value={until ? formatClockOf(until) : t("sheet.holdNoEnd")}
          />
          <Fact label={t("sheet.heldBy")} value={h.placedBy} />
        </dl>
      </Sheet>
    );
  }

  const b = block.booking;
  const who = block.guest ?? t("board.walkIn");
  const allIn = (b.checkedIn ?? 0) >= b.partySize;
  const pendingMove = pendingRescheduleFor(b.id);
  const lastMove = pendingMove ? null : rescheduleRequestsForOrder(b.orderId).find((r) => r.bookingId === b.id) ?? null;
  const withdrawMove = async () => {
    if (!pendingMove) return;
    setWithdrawing(true);
    await withdrawRescheduleRequest(pendingMove.id);
    setWithdrawing(false);
    toast.success(t("refund.moveWithdrawn"));
  };
  /* Roles are read once at the start; until they have arrived there is no
     honest answer to "may this person refund", so neither button is drawn
     rather than drawn with the wrong words and then changed. */
  const refundAllowed = !actor.loading && actor.refundMode !== "off";
  const moveAllowed = !actor.loading && actor.rescheduleMode !== "off";
  const refundDirect = canRefundDirectly(actor, refund?.amount ?? 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={who}
      closeLabel={tc("close")}
      className={SHEET_WIDTH}
      lead={
        <>
          <p className="text-base font-medium text-muted">{block.product?.name ?? ""}</p>
          {/* Sold through a marketplace: say which, with the reference a
              guest will quote and a voucher can be checked against. */}
          {block.source && (
            <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-fg">
              <MarketBadge id={block.source.marketplaceId} size="go" />
              <span className="min-w-0 break-words">
                {block.source.reference
                  ? t("board.bookedOnRef", { name: block.source.marketplaceName, reference: block.source.reference })
                  : t("board.bookedOn", { name: block.source.marketplaceName })}
              </span>
            </p>
          )}
        </>
      }
      footer={(() => {
        /* Refund and Move are the left-hand, "not the usual thing" buttons;
           the orange one on the right is always the step that moves the
           booking on — taking what is owed, or letting the party in. While a
           refund is waiting, Refund is not offered again — the sheet says
           what is waiting. Owing money comes before the door, the same order
           Check-in itself keeps. */
        const canRefund = !!onRefund && refundAllowed && !!refund?.refundable && !refund.pending;
        const move = !!onMove && !!canMove && moveAllowed && !pendingMove;
        const take = !!onTake && (owed ?? 0) > 0;
        const canCheckIn = !take && isToday && !allIn && !block.noShow;
        const secondaries: { key: string; icon: ReactNode; label: string; onClick: () => void }[] = [
          ...(canRefund ? [{ key: "refund", icon: <RotateCcw size={20} strokeWidth={2} aria-hidden />, label: refundDirect ? t("refund.action") : t("refund.ask"), onClick: onRefund as () => void }] : []),
          ...(move ? [{ key: "move", icon: <CalendarClock size={20} strokeWidth={2} aria-hidden />, label: actor.rescheduleMode === "direct" ? t("sheet.move") : t("sheet.moveAsk"), onClick: onMove as () => void }] : []),
        ];
        if (!secondaries.length && !take && !canCheckIn) return undefined;
        /* Three buttons do not fit one row on a phone once the first two read
           "Ask to refund" and "Ask to move". Two secondaries share a row of
           their own and the orange button takes the row under it, full width —
           still the last thing, at the bottom, that moves the booking on.
           Labels wrap to a second line rather than being cut. */
        const stack = secondaries.length >= 2 && (take || canCheckIn);
        const lead = secondaries.map((s) => (
          <button key={s.key} type="button" className={secondary("min-h-13 py-2", "flex-1")} onClick={s.onClick} disabled={busy}>
            {s.icon}
            <span className="text-center leading-tight">{s.label}</span>
          </button>
        ));
        const grow = secondaries.length && !stack ? "flex-[1.3]" : "flex-1";
        return (
          <div className="flex w-full flex-col gap-tight">
            {stack && <div className="flex gap-tight">{lead}</div>}
            <div className="flex gap-tight">
              {!stack && lead}
              {take && (
                <button type="button" data-block-primary className={primary("min-h-13 py-2", grow)} onClick={onTake} disabled={busy}>
                  <Banknote size={20} strokeWidth={2} aria-hidden />
                  <span className="text-center leading-tight">{t("sheet.takeAmount", { amount: formatMoney(owed ?? 0) })}</span>
                </button>
              )}
              {!take && canCheckIn && (
                <button type="button" data-block-primary className={primary("min-h-13 py-2", grow)} onClick={onCheckIn} disabled={busy}>
                  <UserCheck size={20} strokeWidth={2} aria-hidden />
                  <span className="text-center leading-tight">{t("sheet.checkIn", { count: b.partySize })}</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}
    >
      {refund?.pending && (
        <Notice
          tone="warning"
          icon={<Clock size={18} strokeWidth={1.75} />}
          title={t("refund.pending", { amount: formatMoney(refund.pending.amount) })}
          action={onWithdrawRefund ? { label: t("refund.withdraw"), onClick: () => { if (!busy) onWithdrawRefund(); }, busy } : undefined}
          className="mx-card mt-card"
        >
          {t(`refund.reasons.${refund.pending.reason}`)}{refund.pending.note ? ` · ${refund.pending.note}` : ""}
        </Notice>
      )}
      {!refund?.pending && refund?.last?.status === "declined" && refund.last.decisionNote && refund.last.decidedBy !== refund.last.requestedBy && (
        <Notice tone="neutral" className="mx-card mt-card">
          {t("refund.declined", { note: refund.last.decisionNote })}
        </Notice>
      )}
      {pendingMove && (
        <Notice
          tone="warning"
          icon={<CalendarClock size={18} strokeWidth={1.75} />}
          title={t("refund.movePending", { when: `${formatDay(pendingMove.toStart.slice(0, 10), { weekday: true })}, ${formatClock(pendingMove.toStart.slice(11, 16))}` })}
          action={{ label: t("refund.moveWithdraw"), onClick: () => { if (!busy && !withdrawing) void withdrawMove(); }, busy: withdrawing }}
          className="mx-card mt-card"
        >
          {pendingMove.reason ? t(`refund.moveReasons.${pendingMove.reason}`) : t("refund.moveWaiting")}{pendingMove.note ? ` · ${pendingMove.note}` : ""}
        </Notice>
      )}
      {!pendingMove && lastMove?.status === "declined" && lastMove.decisionNote && lastMove.decidedBy !== lastMove.requestedBy && (
        <Notice tone="neutral" className="mx-card mt-card">
          {t("refund.moveDeclined", { note: lastMove.decisionNote })}
        </Notice>
      )}
      <dl className="flex flex-col gap-tight p-card text-md">
        <Fact label={t("sheet.where")} value={when} />
        <Fact label={t("sheet.people")} value={t("sheet.peopleCount", { count: b.partySize })} />
        <Fact
          label={t("sheet.status")}
          value={block.noShow ? t("board.didntCome") : allIn ? t("board.allIn") : (b.checkedIn ?? 0) > 0 ? t("board.someIn", { count: b.checkedIn ?? 0, total: b.partySize }) : t("board.notYet")}
        />
      </dl>
      {refund && !refund.refundable && !refund.pending && (
        <p className="px-card pb-card text-sm text-muted">{t("refund.nothingToRefund")}</p>
      )}
    </Sheet>
  );
}

/**
 * Ask for a refund on a booking.
 *
 * The cashier does not type an amount — it is what was paid for this booking,
 * worked out from the sale — so the one thing they choose is why, as large
 * cells a non-reader can learn by position. A manager decides; this only
 * sends the request.
 */
export function RefundSheet({
  open,
  onClose,
  title,
  when,
  amount,
  /** This till's role can give the money back itself, within its limit — the
   *  primary button does it on the spot instead of asking a manager. */
  direct = false,
  onSend,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  when: string;
  amount: number;
  direct?: boolean;
  onSend: (reason: RefundReason, note: string) => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const [reason, setReason] = useState<RefundReason>("customer_cancelled");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = () => {
    if (reason === "other" && !note.trim()) {
      setErr(t("refund.noteRequired"));
      document.getElementById("refund-note")?.focus();
      return;
    }
    setErr(null);
    onSend(reason, note.trim());
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={direct ? t("refund.titleDirect") : t("refund.title")}
      closeLabel={tc("close")}
      className={SHEET_WIDTH}
      lead={<p className="text-base font-medium text-muted">{title} · {when}</p>}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            {t("refund.back")}
          </button>
          <button type="button" className={primary("min-h-13 py-2", "flex-[1.4]")} onClick={send} disabled={busy}>
            <RotateCcw size={20} strokeWidth={2} aria-hidden />
            <span className="text-center leading-tight">{direct ? t("refund.sendNow", { amount: formatMoney(amount) }) : t("refund.send")}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        <div className="rounded-inner bg-subtle p-comfortable">
          <p className="text-base text-muted">{t("refund.amountLabel")}</p>
          <p className="text-3xl font-semibold tabular-nums leading-tight text-fg">{formatMoney(amount)}</p>
          <p className="text-sm text-muted">{t("refund.amountNote")}</p>
        </div>
        <fieldset>
          <legend className="mb-tight text-md font-semibold text-fg">{t("refund.reasonLabel")}</legend>
          <TileGrid cols={2} role="radiogroup" aria-label={t("refund.reasonLabel")}>
            {REFUND_REASONS.map((r, i) => (
              <Tile
                key={r}
                role="radio"
                aria-checked={reason === r}
                selected={reason === r}
                onClick={() => { setReason(r); setErr(null); }}
                className={cn("min-h-14 text-md font-semibold", i === REFUND_REASONS.length - 1 && REFUND_REASONS.length % 2 === 1 && "col-span-2")}
              >
                {t(`refund.reasons.${r}`)}
              </Tile>
            ))}
          </TileGrid>
        </fieldset>
        <label data-focus-host className="flex flex-col gap-tight">
          <span className="text-md font-semibold text-fg">{reason === "other" ? t("refund.noteLabelRequired") : t("refund.noteLabel")}</span>
          <textarea
            id="refund-note"
            value={note}
            onChange={(e) => { setNote(e.target.value); setErr(null); }}
            rows={2}
            placeholder={t("refund.notePlaceholder")}
            aria-invalid={!!err}
            aria-describedby={err ? "refund-note-err" : undefined}
            className="min-h-[5.5rem] rounded-inner bg-subtle px-comfortable py-tight text-md text-fg focus:ring-2 focus:ring-ember"
          />
          {err && <span id="refund-note-err" className="text-base font-medium text-danger">{err}</span>}
        </label>
        <p className="text-sm text-muted">{direct ? t("refund.leadDirect") : t("refund.lead")}</p>
      </div>
    </Sheet>
  );
}

/**
 * Move an already-booked slot to another day or hour — Square Appointments'
 * and Fresha's reschedule, built from the same two questions the till asks
 * when it first sells the time: which day, then which hour.
 *
 * The booking's own place stays the same (the API that moves a booking's
 * time does not yet carry a place to move it to — see the report). Taken
 * hours are struck through; the hour the booking already has is marked
 * rather than offered, since choosing it again is not a move.
 */
export function MoveSheet({
  open,
  onClose,
  title,
  product,
  resourceId,
  placeName,
  date,
  time,
  durationMinutes,
  bufferMinutes,
  partySize,
  bookingId,
  onConfirm,
  onRequested,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  product: Product;
  /** Null for a show or tour — a slot-based booking with no place of its own. */
  resourceId: string | null;
  placeName: string;
  date: string;
  time: string;
  durationMinutes: number;
  bufferMinutes: number;
  partySize: number;
  bookingId: string;
  /** Moves the booking on the spot. Only called when this role may do that
   *  (`direct`); a role set to "request" sends the move to a manager from
   *  here and never reaches this. */
  onConfirm: (date: string, time: string) => void;
  /** A move was asked for — the caller may want to reload or close more. */
  onRequested?: () => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const toast = useToast();
  const actor = useActor();
  /* "request": the cashier asks, a manager decides. Everything about choosing
     where to go is the same; only the last button and what it does differ. */
  const asking = actor.rescheduleMode !== "direct";
  const [selDate, setSelDate] = useState(date);
  const [selTime, setSelTime] = useState<string | null>(null);
  const [reason, setReason] = useState<RescheduleReason | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; out.length < 7 && i < 30; i++) {
      const d = demoDay(i);
      if (isOpenOn(product, d)) out.push(d);
    }
    return out;
  }, [product]);

  const times = useMemo<MoveTime[]>(() => {
    const all = resourceId
      ? resourceMoveTimes({ product, resourceId, date: selDate, durationMinutes, bufferMinutes, excludeBookingId: bookingId, nowDate: date, nowTime: time })
      : sessionMoveTimes({ product, date: selDate, partySize, nowDate: date, nowTime: time });
    // A booking cannot be moved to an hour that has already started today.
    if (selDate !== DEMO_TODAY) return all;
    return all.map((c) => (!c.isNow && toMinutes(c.time) < DEMO_NOW_MINUTES ? { ...c, free: false } : c));
  }, [product, resourceId, selDate, durationMinutes, bufferMinutes, bookingId, date, time, partySize]);

  const changed = !!selTime && (selDate !== date || selTime !== time);
  // Short, so the button fits a phone: "Today", "Tomorrow", or "Fri 31 Jul".
  const dayLabel = selDate === DEMO_TODAY ? tc("today") : selDate === demoDay(1) ? t("sheet.moveTomorrow") : formatDay(selDate, { weekday: true });

  const confirm = async () => {
    if (!changed || !selTime) return;
    if (!asking) {
      onConfirm(selDate, selTime);
      return;
    }
    if (reason === "other" && !note.trim()) {
      setErr(t("sheet.moveNoteRequired"));
      document.getElementById("move-note")?.focus();
      return;
    }
    setErr(null);
    setSending(true);
    const res = await requestReschedule({
      bookingId,
      toStart: slotISO(selDate, selTime),
      toEnd: slotISO(selDate, toTime(toMinutes(selTime) + durationMinutes)),
      reason,
      note: note.trim(),
      requestedBy: actor.name,
      place: resourceId ? placeName : null,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("sheet.moveAsked"));
    onRequested?.();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={asking ? t("sheet.moveAskTitle") : t("sheet.moveTitle")}
      closeLabel={tc("close")}
      className={SHEET_WIDTH}
      lead={<p className="text-base font-medium text-muted">{title} · {placeName} · {formatClockRange(time, toTime(toMinutes(time) + durationMinutes))}</p>}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy || sending}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            {t("sheet.back")}
          </button>
          <button type="button" className={primary("min-h-13 py-2", "flex-[1.4]")} onClick={() => void confirm()} disabled={busy || sending || !changed}>
            {asking ? <Send size={20} strokeWidth={2} aria-hidden /> : <CalendarClock size={20} strokeWidth={2} aria-hidden />}
            <span className="text-center leading-tight">
              {asking
                ? t("sheet.moveAskButton")
                : changed && selTime
                  ? t("sheet.moveTo", { day: dayLabel, time: formatClock(selTime, { short: true }) })
                  : t("sheet.moveTitle")}
            </span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        <DateTiles
          dates={dates}
          value={selDate}
          onChange={(d) => { setSelDate(d); setSelTime(null); }}
          today={DEMO_TODAY}
          tomorrow={demoDay(1)}
          min={DEMO_TODAY}
          labels={{ today: tc("today"), tomorrow: t("sheet.moveTomorrow"), pick: t("sheet.movePick"), previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth") }}
        />

        {times.length === 0 ? (
          <p className="text-base text-muted">{t("sheet.moveClosed")}</p>
        ) : (
          <TileGrid cols={4}>
            {times.map((cell) => {
              if (cell.isNow) {
                return (
                  <div key={cell.time} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-inner bg-transparent px-1 py-1 text-muted ring-1 ring-inset ring-line">
                    <ClockCell hhmm={cell.time} className="text-md font-semibold tabular-nums" />
                    <span className="text-sm font-medium">{t("sheet.moveNow")}</span>
                  </div>
                );
              }
              if (!cell.free) {
                return (
                  <span key={cell.time} className="flex min-h-14 items-center justify-center rounded-inner bg-transparent px-1 py-1 text-base text-muted line-through ring-1 ring-inset ring-line">
                    <ClockCell hhmm={cell.time} className="line-through" />
                  </span>
                );
              }
              const chosen = selTime === cell.time;
              return (
                <Tile
                  key={cell.time}
                  aria-pressed={chosen}
                  selected={chosen}
                  onClick={() => setSelTime(cell.time)}
                  className="min-h-14 text-md font-semibold"
                >
                  <ClockCell hhmm={cell.time} />
                </Tile>
              );
            })}
          </TileGrid>
        )}

        {asking && changed && (
          <div className="flex flex-col gap-tight">
            <p className="text-md font-semibold text-fg">{t("sheet.moveWhy")}</p>
            <TileGrid cols={2} role="radiogroup" aria-label={t("sheet.moveWhy")}>
              {(["customer_asked", "weather", "venue_problem", "other"] as RescheduleReason[]).map((r) => {
                const on = reason === r;
                return (
                  <Tile
                    key={r}
                    role="radio"
                    aria-checked={on}
                    selected={on}
                    onClick={() => { setReason(on ? null : r); setErr(null); }}
                    className="min-h-11 text-base font-semibold"
                  >
                    {t(`refund.moveReasons.${r}`)}
                  </Tile>
                );
              })}
            </TileGrid>
            <input
              id="move-note"
              value={note}
              onChange={(e) => { setNote(e.target.value); setErr(null); }}
              aria-label={reason === "other" ? t("sheet.moveNoteRequired") : t("sheet.moveNoteLabel")}
              aria-invalid={!!err}
              placeholder={reason === "other" ? t("sheet.moveNoteRequired") : t("sheet.moveNoteLabel")}
              className={cn("h-11 rounded-inner bg-subtle px-comfortable text-md", err && "ring-2 ring-danger")}
            />
            {err && <p role="alert" className="text-base font-medium text-danger">{err}</p>}
          </div>
        )}

        <p className="text-sm text-muted">{asking ? t("sheet.moveAskNote") : t("sheet.movePriceNote")}</p>
      </div>
    </Sheet>
  );
}

/**
 * Take what a booking's order still owes — with the after-match discount
 * folded in, so the cashier sees exactly one number by the end: what the guest
 * hands over. It is the same payment sheet Check-in uses (PaymentSheet), so the
 * two screens read, and behave, as one.
 */
export function TakeBalanceSheet({
  open,
  onClose,
  title,
  when,
  orderTotal,
  owed,
  limitPct,
  methods,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  when: string;
  orderTotal: Minor;
  owed: Minor;
  limitPct: number | null;
  methods: PaymentMethod[];
  onConfirm: (opts: { discountMinor: Minor; reasonText: string; method: PaymentMethod | null; payAmount: Minor }) => void;
  busy: boolean;
}) {
  return (
    <PaymentSheet
      open={open}
      onClose={onClose}
      title={title}
      when={when}
      orderTotal={orderTotal}
      owed={owed}
      limitPct={limitPct}
      methods={methods}
      onConfirm={({ discountMinor, reasonText, method, payAmount }) => onConfirm({ discountMinor, reasonText, method, payAmount })}
      busy={busy}
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-comfortable py-tight">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="text-right font-semibold text-fg">{value}</dd>
    </div>
  );
}
