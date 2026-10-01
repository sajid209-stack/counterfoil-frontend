"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Banknote,
  CalendarClock,
  Check,
  ChevronLeft,
  Clock,
  CreditCard,
  Lock,
  Minus,
  Percent,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  ShoppingBag,
  Unlock,
  UserCheck,
  X,
} from "lucide-react";
import { DateStrip, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatClock, formatClockOf, formatClockRange, formatDay, formatMoney, formatPriceShort } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { DEMO_NOW_MINUTES, DEMO_TODAY, demoDay, toMinutes, toTime } from "@/lib/schedule";
import { isOpenOn, type Minor, type PaymentMethod, type Product } from "@/lib/api";
import { REFUND_REASONS, type RefundReason, type RefundRequest } from "@/lib/api/refundRequests";
import { discountMinorFrom, withinDiscountLimit, type DiscountMode } from "../_lib/discount";
import { resourceMoveTimes, sessionMoveTimes, type MoveTime } from "../_lib/moveOptions";
import { type Block, type Column } from "../_lib/board";
import { ClockCell } from "../../_components/Clock";

/* The two big buttons every sheet here ends on, always in the same places:
   Hold on the LEFT, Add to sale on the RIGHT. A cashier who cannot read the
   words learns "orange on the right sells it" once and never has to look
   again — and it is the same pair, in the same order, as the bar under the
   board. */
const BASE = "inline-flex min-w-0 items-center justify-center gap-tight rounded-full px-comfortable text-[1rem] font-semibold transition-transform duration-quick active:scale-[0.98] disabled:opacity-50";
/** The two buttons, at a height. Built here rather than overridden at the
 *  call site: `cn` does not merge conflicting utilities, so "h-14 h-13" is
 *  decided by stylesheet order, not by intent. */
export const primary = (h = "h-14", grow = "flex-1") => `${BASE} ${h} ${grow} bg-ember-solid text-white`;
export const secondary = (h = "h-14", grow = "flex-1") => `${BASE} ${h} ${grow} border-2 border-line bg-card text-fg`;
const PRIMARY = primary();
const SECONDARY = secondary();
/** Add to sale gets the larger share of the row: it is the common answer. */
const PRIMARY_WIDE = primary("h-14", "flex-[1.4]");

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
        <label htmlFor="hold-name" className="text-[0.875rem] font-semibold text-fg">{t("sheet.holdName")}</label>
        <input
          id="hold-name"
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setMissing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }}
          placeholder={t("sheet.holdNamePh")}
          aria-invalid={missing || undefined}
          aria-describedby={missing ? "hold-name-err" : undefined}
          className={cn("h-14 rounded-go-sm border-2 bg-card px-comfortable text-[1rem] outline-none focus:border-ember", missing ? "border-danger" : "border-line")}
        />
        {missing && <p id="hold-name-err" className="text-[0.875rem] text-danger">{t("sheet.holdNameMissing")}</p>}
      </div>
      <div role="radiogroup" aria-label={t("sheet.holdLength")} className="flex flex-col gap-tight">
        <p className="text-[0.875rem] font-semibold text-fg">{t("sheet.holdLength")}</p>
        <div className="grid grid-cols-2 gap-tight sm:grid-cols-4">
          {LENGTHS.map((l) => (
            <button
              key={String(l)}
              type="button"
              role="radio"
              aria-checked={length === l}
              onClick={() => setLength(l)}
              /* Chosen reads as a tint with a tick, the way every other
                 choice in the till reads — solid orange belongs to the one
                 button that does the thing. */
              className={cn(
                "inline-flex h-12 items-center justify-center gap-1 rounded-full border-2 px-tight text-[0.9375rem] font-semibold",
                length === l ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg",
              )}
            >
              {length === l && <Check size={16} strokeWidth={3} className="shrink-0" aria-hidden />}
              {l === "day" ? t("sheet.holdDay") : l === 60 ? t("sheet.hold1h") : t("sheet.holdMin", { count: l })}
            </button>
          ))}
        </div>
        <p className="text-[0.875rem] text-muted">{t("sheet.holdHelp")}</p>
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
        <p className="-mt-tight text-[0.875rem] text-muted">{when}</p>
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
  const bump = (id: string, d: number) => {
    setNothing(false);
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={tc("close")}
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
        <p className="-mt-tight text-[0.875rem] text-muted">{when}</p>
        {mode === "tickets" ? (
          <>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-go-sm border border-line">
              {tiers.map((x) => {
                const n = qty[x.id] ?? 0;
                return (
                  <li key={x.id} className="flex min-h-16 items-center gap-comfortable bg-card px-comfortable py-tight">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1rem] font-semibold text-fg">{x.name}</span>
                      <span className="block text-[0.875rem] tabular-nums text-muted">
                        {formatPriceShort(x.price)}
                        {(x.admits ?? 1) > 1 && ` · ${t("sheet.admitsCount", { count: x.admits ?? 1 })}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-tight">
                      <button type="button" aria-label={t("sheet.lessOf", { name: x.name })} disabled={n === 0} onClick={() => bump(x.id, -1)} className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-card disabled:opacity-40">
                        <Minus size={18} strokeWidth={2.25} aria-hidden />
                      </button>
                      <span className="w-7 text-center text-[1.25rem] font-semibold tabular-nums">{n}</span>
                      <button type="button" aria-label={t("sheet.moreOf", { name: x.name })} onClick={() => bump(x.id, 1)} className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-card">
                        <Plus size={18} strokeWidth={2.25} aria-hidden />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between gap-comfortable">
              <span className="text-[0.875rem] text-muted">{t("sheet.seatsLeftNow", { count: block.remaining })}</span>
              <span className="text-[1.25rem] font-semibold tabular-nums text-fg">{formatMoney(total)}</span>
            </div>
            {nothing && <p role="alert" className="text-[0.875rem] text-danger">{t("sheet.pickTickets")}</p>}
            {over && <p role="alert" className="text-[0.875rem] text-danger">{t("sheet.tooMany", { count: block.remaining })}</p>}
            {guideMissing && <p role="alert" className="text-[0.875rem] text-danger">{t("sheet.noGuide")}</p>}
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
  refund?: { pending: RefundRequest | null; last: RefundRequest | null; refundable: boolean };
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
        lead={<p className="flex items-center gap-1 text-[0.875rem] font-medium text-muted"><Lock size={14} aria-hidden />{t("board.onHold")}</p>}
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
        <dl className="flex flex-col gap-tight p-card text-[1rem]">
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={who}
      closeLabel={tc("close")}
      lead={<p className="text-[0.875rem] font-medium text-muted">{block.product?.name ?? ""}</p>}
      footer={(() => {
        /* Refund and Move are the left-hand, "not the usual thing" buttons;
           the orange one on the right is always the step that moves the
           booking on — taking what is owed, or letting the party in. While a
           refund is waiting, Refund is not offered again — the sheet says
           what is waiting. Owing money comes before the door, the same order
           Check-in itself keeps. */
        const canRefund = !!onRefund && !!refund?.refundable && !refund.pending;
        const move = !!onMove && !!canMove;
        const take = !!onTake && (owed ?? 0) > 0;
        const canCheckIn = !take && isToday && !allIn && !block.noShow;
        const secondaries: { key: string; icon: ReactNode; label: string; onClick: () => void }[] = [
          ...(canRefund ? [{ key: "refund", icon: <RotateCcw size={20} strokeWidth={2} aria-hidden />, label: t("refund.action"), onClick: onRefund as () => void }] : []),
          ...(move ? [{ key: "move", icon: <CalendarClock size={20} strokeWidth={2} aria-hidden />, label: t("sheet.move"), onClick: onMove as () => void }] : []),
        ];
        if (!secondaries.length && !take && !canCheckIn) return undefined;
        return (
          <div className="flex w-full gap-tight">
            {secondaries.map((s) => (
              <button key={s.key} type="button" className={secondary("h-14", "flex-1")} onClick={s.onClick} disabled={busy}>
                {s.icon}
                <span className="truncate">{s.label}</span>
              </button>
            ))}
            {take && (
              <button type="button" className={secondaries.length ? primary("h-14", "flex-[1.3]") : PRIMARY} onClick={onTake} disabled={busy}>
                <Banknote size={20} strokeWidth={2} aria-hidden />
                <span className="truncate">{t("sheet.takeAmount", { amount: formatMoney(owed ?? 0) })}</span>
              </button>
            )}
            {!take && canCheckIn && (
              <button type="button" className={secondaries.length ? primary("h-14", "flex-[1.3]") : PRIMARY} onClick={onCheckIn} disabled={busy}>
                <UserCheck size={20} strokeWidth={2} aria-hidden />
                <span className="truncate">{t("sheet.checkIn", { count: b.partySize })}</span>
              </button>
            )}
          </div>
        );
      })()}
    >
      {refund?.pending && (
        <div className="mx-card mt-card flex items-start gap-tight rounded-go-sm border border-warning/40 bg-warning-wash p-comfortable">
          <Clock size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold text-fg">{t("refund.pending", { amount: formatMoney(refund.pending.amount) })}</p>
            <p className="text-[0.8125rem] text-fg/80">{t(`refund.reasons.${refund.pending.reason}`)}{refund.pending.note ? ` · ${refund.pending.note}` : ""}</p>
            {onWithdrawRefund && (
              <button type="button" onClick={onWithdrawRefund} disabled={busy} className="mt-tight min-h-11 text-[0.875rem] font-semibold text-fg underline underline-offset-4">
                {t("refund.withdraw")}
              </button>
            )}
          </div>
        </div>
      )}
      {!refund?.pending && refund?.last?.status === "declined" && refund.last.decisionNote && (
        <p className="mx-card mt-card rounded-go-sm border border-line bg-surface p-comfortable text-[0.875rem] text-fg">
          {t("refund.declined", { note: refund.last.decisionNote })}
        </p>
      )}
      <dl className="flex flex-col gap-tight p-card text-[1rem]">
        <Fact label={t("sheet.where")} value={when} />
        <Fact label={t("sheet.people")} value={t("sheet.peopleCount", { count: b.partySize })} />
        <Fact
          label={t("sheet.status")}
          value={block.noShow ? t("board.didntCome") : allIn ? t("board.allIn") : (b.checkedIn ?? 0) > 0 ? t("board.someIn", { count: b.checkedIn ?? 0, total: b.partySize }) : t("board.notYet")}
        />
      </dl>
      {refund && !refund.refundable && !refund.pending && (
        <p className="px-card pb-card text-[0.8125rem] text-muted">{t("refund.nothingToRefund")}</p>
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
      title={t("refund.title")}
      closeLabel={tc("close")}
      lead={<p className="text-[0.875rem] font-medium text-muted">{title} · {when}</p>}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            {t("refund.back")}
          </button>
          <button type="button" className={PRIMARY_WIDE} onClick={send} disabled={busy}>
            <RotateCcw size={20} strokeWidth={2} aria-hidden />
            <span className="truncate">{direct ? t("refund.sendNow", { amount: formatMoney(amount) }) : t("refund.send")}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        <div className="rounded-go-sm border border-line bg-surface p-comfortable">
          <p className="text-[0.875rem] text-muted">{t("refund.amountLabel")}</p>
          <p className="text-[1.75rem] font-bold tabular-nums leading-tight text-fg">{formatMoney(amount)}</p>
          <p className="text-[0.8125rem] text-muted">{t("refund.amountNote")}</p>
        </div>
        <fieldset>
          <legend className="mb-tight text-[0.9375rem] font-semibold text-fg">{t("refund.reasonLabel")}</legend>
          <div role="radiogroup" aria-label={t("refund.reasonLabel")} className="grid grid-cols-2 overflow-hidden rounded-go-sm border border-line">
            {REFUND_REASONS.map((r, i) => {
              const on = reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setReason(r); setErr(null); }}
                  className={cn(
                    "relative flex min-h-14 items-center justify-center px-tight text-center text-[0.9375rem] font-semibold",
                    i % 2 === 1 && "border-l border-line",
                    i >= 2 && "border-t border-line",
                    i === REFUND_REASONS.length - 1 && REFUND_REASONS.length % 2 === 1 && "col-span-2",
                    on ? "bg-ember-solid text-white" : "bg-card text-fg",
                  )}
                >
                  {on && <Check size={16} strokeWidth={3} className="absolute right-2 top-2" aria-hidden />}
                  {t(`refund.reasons.${r}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label data-focus-host className="flex flex-col gap-tight">
          <span className="text-[0.9375rem] font-semibold text-fg">{reason === "other" ? t("refund.noteLabelRequired") : t("refund.noteLabel")}</span>
          <textarea
            id="refund-note"
            value={note}
            onChange={(e) => { setNote(e.target.value); setErr(null); }}
            rows={2}
            placeholder={t("refund.notePlaceholder")}
            aria-invalid={!!err}
            aria-describedby={err ? "refund-note-err" : undefined}
            className="min-h-[5.5rem] rounded-go-sm border border-line bg-card px-comfortable py-tight text-[1rem] text-fg outline-none focus:border-ember focus:ring-2 focus:ring-ember/25"
          />
          {err && <span id="refund-note-err" className="text-[0.875rem] font-medium text-danger">{err}</span>}
        </label>
        <p className="text-[0.8125rem] text-muted">{direct ? t("refund.leadDirect") : t("refund.lead")}</p>
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
  onConfirm: (date: string, time: string) => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const [selDate, setSelDate] = useState(date);
  const [selTime, setSelTime] = useState<string | null>(null);

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

  const confirm = () => {
    if (!changed || !selTime) return;
    onConfirm(selDate, selTime);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("sheet.moveTitle")}
      closeLabel={tc("close")}
      lead={<p className="text-[0.875rem] font-medium text-muted">{title} · {placeName} · {formatClockRange(time, toTime(toMinutes(time) + durationMinutes))}</p>}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            {t("sheet.back")}
          </button>
          <button type="button" className={PRIMARY_WIDE} onClick={confirm} disabled={busy || !changed}>
            <CalendarClock size={20} strokeWidth={2} aria-hidden />
            <span className="truncate">{changed && selTime ? t("sheet.moveTo", { day: dayLabel, time: formatClock(selTime, { short: true }) }) : t("sheet.moveTitle")}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        <DateStrip
          flat
          dates={dates}
          value={selDate}
          onChange={(d) => { setSelDate(d); setSelTime(null); }}
          today={DEMO_TODAY}
          tomorrow={demoDay(1)}
          min={DEMO_TODAY}
          labels={{ today: tc("today"), tomorrow: t("sheet.moveTomorrow"), pick: t("sheet.movePick"), previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth") }}
        />

        {times.length === 0 ? (
          <p className="text-[0.875rem] text-muted">{t("sheet.moveClosed")}</p>
        ) : (
          <div className="go-surface overflow-hidden rounded-go">
            <div className="-mb-px -mr-px grid grid-cols-4">
              {times.map((cell) => {
                if (cell.isNow) {
                  return (
                    <div key={cell.time} className="flex min-h-14 flex-col items-center justify-center gap-0.5 border-b border-r border-line bg-surface px-1 py-1 text-muted">
                      <ClockCell hhmm={cell.time} className="text-[0.9375rem] font-semibold tabular-nums" />
                      <span className="text-[0.8125rem] font-medium">{t("sheet.moveNow")}</span>
                    </div>
                  );
                }
                if (!cell.free) {
                  return (
                    <span key={cell.time} className="flex min-h-14 items-center justify-center border-b border-r border-line bg-surface px-1 py-1 text-[0.875rem] text-muted line-through">
                      <ClockCell hhmm={cell.time} className="line-through" />
                    </span>
                  );
                }
                const chosen = selTime === cell.time;
                return (
                  <button
                    key={cell.time}
                    type="button"
                    aria-pressed={chosen}
                    data-focus-inset
                    onClick={() => setSelTime(cell.time)}
                    className={cn(
                      "relative flex min-h-14 items-center justify-center border-b border-r border-line px-1 py-1 text-[0.9375rem] font-semibold transition-colors duration-quick",
                      chosen ? "bg-ember-solid text-white" : "bg-card text-fg active:bg-ember/10",
                    )}
                  >
                    {chosen && <Check size={12} strokeWidth={3} className="absolute right-1 top-1" aria-hidden />}
                    <ClockCell hhmm={cell.time} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[0.8125rem] text-muted">{t("sheet.movePriceNote")}</p>
      </div>
    </Sheet>
  );
}

// ── the after-game discount, given while the till takes what is still owed ──

export type DiscountReasonKey = "gameShort" | "facilityProblem" | "regularCustomer" | "other";
export const DISCOUNT_REASONS: DiscountReasonKey[] = ["gameShort", "facilityProblem", "regularCustomer", "other"];

export interface DiscountState {
  open: boolean;
  mode: DiscountMode;
  raw: string;
  reasonKey: DiscountReasonKey;
  note: string;
}

export const emptyDiscount = (): DiscountState => ({ open: false, mode: "amount", raw: "", reasonKey: "gameShort", note: "" });

export interface DiscountCalc {
  /** Minor units to take off — zero when no discount is in play. */
  minor: Minor;
  /** Something was typed, so an error (if any) is worth showing. */
  hasAmount: boolean;
  overLimit: boolean;
  overOwed: boolean;
  needsNote: boolean;
  valid: boolean;
}

/** What a discount's own fields add up to, checked against the role's cap and
 *  what is actually owed — pure, so the sheet and the page agree on whether
 *  Confirm is allowed without either of them recomputing it differently. */
export function discountFromState(state: DiscountState, orderTotal: Minor, owed: Minor, limitPct: number | null): DiscountCalc {
  if (!state.open) return { minor: 0, hasAmount: false, overLimit: false, overOwed: false, needsNote: false, valid: true };
  const minor = discountMinorFrom(state.mode, parseFloat(state.raw) || 0, orderTotal);
  const hasAmount = minor > 0;
  const overLimit = hasAmount && !withinDiscountLimit(minor, orderTotal, limitPct);
  const overOwed = hasAmount && minor > owed;
  const needsNote = hasAmount && state.reasonKey === "other" && !state.note.trim();
  return { minor: hasAmount ? minor : 0, hasAmount, overLimit, overOwed, needsNote, valid: !hasAmount || (!overLimit && !overOwed && !needsNote) };
}

/** The reason text `discountOrderBalance` records — the chip's own words, or
 *  the note typed for "Something else". */
export function discountReasonText(state: DiscountState, label: (key: DiscountReasonKey) => string): string {
  return state.reasonKey === "other" ? state.note.trim() : label(state.reasonKey);
}

/**
 * The discount row every balance-taking screen offers before the payment
 * method: closed to a single "Give a discount" button until tapped, then an
 * amount (taka or percent), a reason as four large chips, and the one sum a
 * cashier needs to read back to the guest.
 *
 * Fully controlled — no state of its own — so Check-in's own balance dialog
 * can hold exactly this inside its own `Modal` rather than a second copy of
 * the same logic drifting from this one.
 */
export function DiscountFields({
  state,
  setState,
  orderTotal,
  owed,
  limitPct,
}: {
  state: DiscountState;
  setState: (next: DiscountState) => void;
  orderTotal: Minor;
  owed: Minor;
  limitPct: number | null;
}) {
  const t = useTranslations("schedule");
  const calc = discountFromState(state, orderTotal, owed, limitPct);

  if (!state.open) {
    return (
      <button
        type="button"
        onClick={() => setState({ ...state, open: true })}
        className="flex min-h-11 w-full items-center justify-center gap-tight rounded-go border-2 border-dashed border-line text-[0.9375rem] font-semibold text-fg active:bg-ember/10"
      >
        <Percent size={18} strokeWidth={2} aria-hidden />
        {t("discount.give")}
      </button>
    );
  }

  const take = Math.max(0, owed - calc.minor);

  return (
    <div className="flex flex-col gap-tight rounded-go border border-line bg-surface p-comfortable">
      <div className="flex items-center justify-between gap-tight">
        <span className="text-[0.9375rem] font-semibold text-fg">{t("discount.give")}</span>
        <button type="button" aria-label={t("discount.remove")} onClick={() => setState(emptyDiscount())} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-muted-wash">
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="flex items-stretch gap-tight">
        <div role="radiogroup" aria-label={t("discount.amountLabel")} className="flex shrink-0 overflow-hidden rounded-go-sm border border-line">
          {(["amount", "percent"] as DiscountMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={state.mode === m}
              onClick={() => setState({ ...state, mode: m })}
              className={cn("flex h-11 w-11 items-center justify-center text-[1rem] font-semibold", state.mode === m ? "bg-ember-solid text-white" : "bg-card text-fg")}
            >
              {m === "amount" ? "৳" : "%"}
            </button>
          ))}
        </div>
        <input
          inputMode="decimal"
          aria-label={t("discount.amountLabel")}
          value={state.raw}
          onChange={(e) => setState({ ...state, raw: e.target.value })}
          placeholder="0"
          className="h-11 min-w-0 flex-1 rounded-go-sm border border-line bg-card px-comfortable text-[1rem] outline-none focus:border-ember"
        />
      </div>

      <div role="radiogroup" aria-label={t("discount.reasonLabel")} className="grid grid-cols-2 gap-tight">
        {DISCOUNT_REASONS.map((r) => {
          const on = state.reasonKey === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setState({ ...state, reasonKey: r })}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-go-sm border-2 px-tight text-center text-[0.875rem] font-semibold",
                on ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg",
              )}
            >
              {on && <Check size={14} strokeWidth={3} className="mr-1 shrink-0" aria-hidden />}
              {t(`discount.reasons.${r}`)}
            </button>
          );
        })}
      </div>

      {state.reasonKey === "other" && (
        <input
          aria-label={t("discount.noteLabelRequired")}
          value={state.note}
          onChange={(e) => setState({ ...state, note: e.target.value })}
          placeholder={t("discount.notePlaceholder")}
          className="h-11 rounded-go-sm border border-line bg-card px-comfortable text-[0.9375rem] outline-none focus:border-ember"
        />
      )}

      {calc.overOwed && <p role="alert" className="text-[0.8125rem] font-medium text-danger">{t("discount.overOwed")}</p>}
      {calc.overLimit && <p role="alert" className="text-[0.8125rem] font-medium text-danger">{t("discount.overLimit", { pct: limitPct ?? 0 })}</p>}
      {calc.needsNote && <p role="alert" className="text-[0.8125rem] font-medium text-danger">{t("discount.noteRequired")}</p>}

      {calc.valid && calc.hasAmount && (
        <p className="text-[0.9375rem] font-semibold tabular-nums text-fg">
          {t("discount.mathsLine", { owed: formatMoney(owed), discount: formatMoney(calc.minor), take: formatMoney(take) })}
        </p>
      )}
    </div>
  );
}

const METHOD_ICON: Partial<Record<PaymentMethod, typeof Banknote>> = {
  cash: Banknote,
  bkash: Send,
  bangla_qr: QrCode,
  card_terminal: CreditCard,
};

/**
 * Take what a booking's order still owes — with the after-game discount
 * folded in, so the cashier sees exactly one number by the end: what the
 * guest hands over.
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
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const enumL = useEnumLabels();
  const [discount, setDiscount] = useState<DiscountState>(emptyDiscount());
  // Opens on the first method the till offers (cash), as the till's own
  // payment sheet does — so Take works at once, and changing it is one tap.
  const [picked, setMethod] = useState<PaymentMethod | null>(null);
  const method = picked ?? methods[0] ?? null;

  const calc = discountFromState(discount, orderTotal, owed, limitPct);
  const take = Math.max(0, owed - calc.minor);
  const ready = calc.valid && (take === 0 || !!method);

  const confirm = () => {
    if (!ready) return;
    onConfirm({
      discountMinor: calc.minor,
      reasonText: discountReasonText(discount, (k) => t(`discount.reasons.${k}`)),
      method,
      payAmount: take,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("sheet.takeTitle")}
      closeLabel={tc("close")}
      lead={<p className="text-[0.875rem] font-medium text-muted">{title} · {when}</p>}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            {t("sheet.back")}
          </button>
          <button type="button" className={PRIMARY_WIDE} onClick={confirm} disabled={busy || !ready}>
            <Banknote size={20} strokeWidth={2} aria-hidden />
            <span className="truncate">{take > 0 ? t("sheet.takeAmount", { amount: formatMoney(take) }) : t("discount.applyOnly")}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        <div className="flex items-baseline justify-between gap-comfortable">
          <span className="text-[0.875rem] text-muted">{t("sheet.owed")}</span>
          <span className="text-[1.25rem] font-bold tabular-nums text-fg">{formatMoney(owed)}</span>
        </div>

        <DiscountFields state={discount} setState={setDiscount} orderTotal={orderTotal} owed={owed} limitPct={limitPct} />

        {take > 0 && (
          <div className="flex flex-col gap-tight">
            <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.payBy")}</span>
            <div className="grid grid-cols-2 gap-tight">
              {methods.map((m) => {
                const Icon = METHOD_ICON[m] ?? Banknote;
                const on = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "flex min-h-14 items-center justify-center gap-tight rounded-go border-2 px-comfortable text-[0.9375rem] font-semibold",
                      on ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg",
                    )}
                  >
                    <Icon size={18} strokeWidth={2} aria-hidden />
                    <span className="truncate">{enumL.method(m)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-comfortable border-b border-line py-tight last:border-b-0">
      <dt className="text-[0.875rem] text-muted">{label}</dt>
      <dd className="text-right font-semibold text-fg">{value}</dd>
    </div>
  );
}
