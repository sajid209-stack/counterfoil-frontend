"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Lock, Minus, Plus, ShoppingBag, Unlock, UserCheck } from "lucide-react";
import { Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatPriceShort } from "@/lib/format";
import type { Product } from "@/lib/api";
import { toTimeOfDay, type Block, type Column } from "../_lib/board";

/* The two big buttons every sheet here ends on, always in the same places:
   Hold on the LEFT, Add to sale on the RIGHT. A cashier who cannot read the
   words learns "orange on the right sells it" once and never has to look
   again — and it is the same pair, in the same order, as the bar under the
   board. */
const BASE = "inline-flex items-center justify-center gap-tight rounded-full px-comfortable text-[1rem] font-semibold transition-transform duration-quick active:scale-[0.98] disabled:opacity-50";
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
                length === l ? "border-ember-solid bg-ember/10 text-fg" : "border-line bg-card text-fg",
              )}
            >
              {length === l && <Check size={16} strokeWidth={3} className="shrink-0 text-brand-foreground" aria-hidden />}
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
            <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-go-sm border border-line">
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
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  if (!block || !column) return null;
  const place = column.kind === "unassigned" ? t("board.noPlace") : column.name;
  const when = `${place} · ${toTimeOfDay(block.start)}–${toTimeOfDay(block.end)}`;

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
            value={until ? `${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}` : t("sheet.holdNoEnd")}
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
      footer={
        isToday && !allIn && !block.noShow ? (
          <div className="flex w-full">
            <button type="button" className={PRIMARY} onClick={onCheckIn} disabled={busy}>
              <UserCheck size={20} strokeWidth={2} aria-hidden />
              {t("sheet.checkIn", { count: b.partySize })}
            </button>
          </div>
        ) : undefined
      }
    >
      <dl className="flex flex-col gap-tight p-card text-[1rem]">
        <Fact label={t("sheet.where")} value={when} />
        <Fact label={t("sheet.people")} value={t("sheet.peopleCount", { count: b.partySize })} />
        <Fact
          label={t("sheet.status")}
          value={block.noShow ? t("board.didntCome") : allIn ? t("board.allIn") : (b.checkedIn ?? 0) > 0 ? t("board.someIn", { count: b.checkedIn ?? 0, total: b.partySize }) : t("board.notYet")}
        />
      </dl>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-comfortable border-b border-hairline py-tight last:border-b-0">
      <dt className="text-[0.875rem] text-muted">{label}</dt>
      <dd className="text-right font-semibold text-fg">{value}</dd>
    </div>
  );
}
