"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Banknote, Check, Lock, Minus, Plus, Unlock, UserCheck } from "lucide-react";
import { Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPriceShort } from "@/lib/format";
import type { OpenOption } from "@/app/(os)/calendar/_components/openSlots";
import { toTimeOfDay, type Block, type Column } from "../_lib/board";

/* The two big buttons every sheet here ends on, always in the same places:
   Hold on the LEFT, Sell on the RIGHT. A cashier who cannot read the words
   learns "orange on the right sells it" once and never has to look again. */
const BIG = "inline-flex h-14 flex-1 items-center justify-center gap-tight rounded-go-sm text-[1rem] font-semibold transition-transform duration-quick active:scale-[0.98]";
const PRIMARY = `${BIG} bg-ember-solid text-white`;
const SECONDARY = `${BIG} border-2 border-line bg-card text-fg`;

export type HoldLength = 15 | 30 | 60 | "day";
const LENGTHS: HoldLength[] = [15, 30, 60, "day"];

export interface HoldRequest {
  heldFor: string;
  length: HoldLength;
  quantity: number;
}

/**
 * A free hour, or a show with seats: sell it or hold it.
 *
 * One question at most before the two buttons — which booking, when a field
 * is shared (Cricket or Futsal). Everything else (how many people, how long)
 * is asked on the till's own sheet, which Sell opens already on this field,
 * this day and this time.
 */
export function SlotSheet({
  open,
  onClose,
  title,
  when,
  options,
  isSession,
  maxHold,
  onSell,
  onHold,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  when: string;
  options: OpenOption[];
  isSession: boolean;
  /** Seats that can still be held on a show. */
  maxHold: number;
  onSell: (option: OpenOption) => void;
  onHold: (option: OpenOption, req: HoldRequest) => void;
  busy: boolean;
}) {
  const t = useTranslations("schedule");
  const tc = useTranslations("common");
  const [pick, setPick] = useState(0);
  const [mode, setMode] = useState<"choose" | "hold">("choose");
  const [name, setName] = useState("");
  const [length, setLength] = useState<HoldLength>(30);
  const [qty, setQty] = useState(1);
  const [missing, setMissing] = useState(false);
  const option = options[Math.min(pick, options.length - 1)];

  const hold = () => {
    if (!name.trim()) {
      setMissing(true);
      return;
    }
    onHold(option, { heldFor: name.trim(), length, quantity: qty });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={tc("close")}
      lead={<p className="text-[0.875rem] font-medium text-fg">{when}</p>}
      footer={
        mode === "choose" ? (
          <div className="flex w-full gap-tight">
            <button type="button" className={SECONDARY} onClick={() => setMode("hold")}>
              <Lock size={20} strokeWidth={2} aria-hidden />
              {t("sheet.hold")}
            </button>
            <button type="button" className={PRIMARY} onClick={() => option && onSell(option)} disabled={!option}>
              <Banknote size={20} strokeWidth={2} aria-hidden />
              {t("sheet.sell")}
            </button>
          </div>
        ) : (
          <div className="flex w-full gap-tight">
            <button type="button" className={SECONDARY} onClick={() => { setMode("choose"); setMissing(false); }}>
              {t("sheet.back")}
            </button>
            <button type="button" className={PRIMARY} onClick={hold} disabled={busy}>
              <Lock size={20} strokeWidth={2} aria-hidden />
              {t("sheet.holdIt")}
            </button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-section p-card">
        {mode === "choose" ? (
          options.length > 1 ? (
            <div role="radiogroup" aria-label={t("sheet.sellAs")} className="flex flex-col gap-tight">
              <p className="text-[0.875rem] font-semibold text-fg">{t("sheet.sellAs")}</p>
              {options.map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={i === pick}
                  onClick={() => setPick(i)}
                  className={cn(
                    "flex min-h-14 items-center justify-between gap-comfortable rounded-go-sm border-2 px-comfortable text-left",
                    i === pick ? "border-ember-solid bg-ember/10" : "border-line bg-card",
                  )}
                >
                  <span className="flex items-center gap-tight text-[1rem] font-semibold text-fg">
                    <span
                      aria-hidden
                      className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", i === pick ? "border-ember-solid bg-ember-solid text-white" : "border-line")}
                    >
                      {i === pick && <Check size={14} strokeWidth={3} />}
                    </span>
                    {o.product.name}
                  </span>
                  <span className="text-[1rem] font-semibold tabular-nums text-fg">{formatPriceShort(o.price)}</span>
                </button>
              ))}
            </div>
          ) : option ? (
            <div className="flex items-center justify-between gap-comfortable rounded-go-sm bg-subtle px-comfortable py-comfortable">
              <span className="text-[1rem] font-semibold text-fg">{option.product.name}</span>
              <span className="text-[1.25rem] font-semibold tabular-nums text-fg">{formatPriceShort(option.price)}</span>
            </div>
          ) : null
        ) : (
          <>
            <div className="flex flex-col gap-inline">
              <label htmlFor="hold-name" className="text-[0.875rem] font-semibold text-fg">{t("sheet.holdName")}</label>
              <input
                id="hold-name"
                autoFocus
                value={name}
                onChange={(e) => { setName(e.target.value); setMissing(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") hold(); }}
                placeholder={t("sheet.holdNamePh")}
                aria-invalid={missing || undefined}
                aria-describedby={missing ? "hold-name-err" : undefined}
                className={cn(
                  "h-14 rounded-go-sm border-2 bg-card px-comfortable text-[1rem] outline-none focus:border-ember",
                  missing ? "border-danger" : "border-line",
                )}
              />
              {missing && <p id="hold-name-err" className="text-[0.875rem] text-danger">{t("sheet.holdNameMissing")}</p>}
            </div>

            {isSession && maxHold > 1 && (
              <div className="flex items-center justify-between gap-comfortable">
                <span className="text-[0.875rem] font-semibold text-fg">{t("sheet.holdPlaces")}</span>
                <div className="flex items-center gap-tight">
                  <button type="button" aria-label={t("sheet.fewer")} disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-card disabled:opacity-40">
                    <Minus size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                  <span className="w-8 text-center text-[1.25rem] font-semibold tabular-nums">{qty}</span>
                  <button type="button" aria-label={t("sheet.more")} disabled={qty >= maxHold} onClick={() => setQty((q) => Math.min(maxHold, q + 1))} className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-card disabled:opacity-40">
                    <Plus size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </div>
            )}

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
                    className={cn(
                      "h-12 rounded-go-sm border-2 text-[0.9375rem] font-semibold",
                      length === l ? "border-ember-solid bg-ember-solid text-white" : "border-line bg-card text-fg",
                    )}
                  >
                    {l === "day" ? t("sheet.holdDay") : l === 60 ? t("sheet.hold1h") : t("sheet.holdMin", { count: l })}
                  </button>
                ))}
              </div>
              <p className="text-[0.875rem] text-muted">{t("sheet.holdHelp")}</p>
            </div>
          </>
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
 * it was held for, or put it back on sale.
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
            <button type="button" className={PRIMARY} onClick={onSellHold} disabled={busy}>
              <Banknote size={20} strokeWidth={2} aria-hidden />
              {t("sheet.sellTo", { name: h.heldFor })}
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
