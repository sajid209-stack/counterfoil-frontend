"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Banknote, ChevronLeft, CreditCard, Pencil, QrCode, Send, Wallet, type LucideIcon } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatPriceShort } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import type { Minor, PaymentMethod } from "@/lib/api";
import { primaryButton, secondaryButton } from "../../_components/ActionBar";
import { Tile, TileGrid } from "../../_components/Tiles";
import { AfterMatchDiscount, discountFromState, discountReasonText, emptyDiscount, type DiscountState } from "./AfterMatchDiscount";

/* ── Take what a booking still owes ───────────────────────────────────────
 *
 * ONE payment sheet for every place a counter takes a balance — Check-in's
 * "Take ৳X" and the Schedule's booked-slot sheet — and drawn the way the
 * till's own checkout sheet is, so the screen a cashier meets here is the one
 * they already know from selling:
 *
 *   the amount, large  →  an after-match discount  →  how they are paying
 *   →  cash received (Exact by default, "No change due")  →  Back · Take
 *
 * The orange button is bottom-right and moves things on; Back is its left
 * neighbour. Cash is chosen when the sheet opens, so the button works at once.
 * Where it is offered (Check-in), taking the money also checks the party in —
 * one step, not two — with "Take ৳X only" under it for a guest who has paid
 * ahead of arriving.
 */

const METHOD_ICON: Partial<Record<PaymentMethod, LucideIcon>> = {
  cash: Banknote,
  bkash: Send,
  bangla_qr: QrCode,
  card_terminal: CreditCard,
};

export interface PaymentResult {
  discountMinor: Minor;
  reasonText: string;
  method: PaymentMethod | null;
  /** What is being taken now — may be less than what is owed when `allowPart`. */
  payAmount: Minor;
  /** Check the party in as part of this step. Only ever true when paid in full. */
  checkIn: boolean;
}

/** The notes a guest is likely to hand over for an amount: the next round
 *  hundred, five hundred and thousand above it, never one that is too small. */
function quickNotes(dueMinor: Minor): number[] {
  const due = Math.ceil(dueMinor / 100);
  const out: number[] = [];
  for (const step of [100, 500, 1000, 2000, 5000]) {
    const n = Math.ceil(due / step) * step;
    if (n > due && !out.includes(n)) out.push(n);
    if (out.length === 3) break;
  }
  return out;
}

export function PaymentSheet(props: {
  open: boolean;
  onClose: () => void;
  /** Who it is for, and what — the line under the title. */
  title: string;
  when: string;
  orderTotal: Minor;
  owed: Minor;
  limitPct: number | null;
  methods: PaymentMethod[];
  /** Offer to check the party in as part of taking the money. */
  checkIn?: boolean;
  /** Let the cashier take less than the whole balance (two phones, two tenders). */
  allowPart?: boolean;
  /** Offer "Write off ৳X" beside the discount — giving up on the balance rather
   *  than taking it. Omitted when the role may not, or one is already waiting. */
  onWriteOff?: () => void;
  onConfirm: (result: PaymentResult) => void;
  busy: boolean;
}) {
  // Mounted only while open, so every opening starts clean: cash, exact, no discount.
  return props.open ? <PaymentSheetBody {...props} /> : null;
}

function PaymentSheetBody({ onClose, title, when, orderTotal, owed, limitPct, methods, checkIn = false, allowPart = false, onWriteOff, onConfirm, busy }: Parameters<typeof PaymentSheet>[0]) {
  const t = useTranslations("schedule");
  const tp = useTranslations("pos");
  const tc = useTranslations("common");
  const tr = useTranslations("refunds");
  const enumL = useEnumLabels();

  const [discount, setDiscount] = useState<DiscountState>(emptyDiscount());
  const [picked, setPicked] = useState<PaymentMethod | null>(null);
  /* What the guest handed over, in whole taka. Empty means the exact amount —
     the till's rule: the number is already on screen, so the cashier is not
     asked to type it back. */
  const [tender, setTender] = useState("");
  const [typing, setTyping] = useState(false);
  const [part, setPart] = useState<string | null>(null);

  const calc = discountFromState(discount, orderTotal, owed, limitPct);
  const afterDiscount = Math.max(0, owed - calc.minor);
  const partMinor = part == null ? null : Math.max(0, Math.min(afterDiscount, Math.round((parseFloat(part) || 0) * 100)));
  const payNow = partMinor ?? afterDiscount;
  const full = payNow >= afterDiscount;
  const left = afterDiscount - payNow;

  const method = picked && methods.includes(picked) ? picked : methods[0] ?? null;
  const cash = method === "cash";
  const tenderedMinor = cash && tender !== "" ? (parseInt(tender, 10) || 0) * 100 : payNow;
  const exact = tenderedMinor === payNow;
  const enough = tenderedMinor >= payNow;
  const change = tenderedMinor - payNow;

  // A discount that covers everything leaves nothing to take: the button just applies it.
  const nothingToTake = afterDiscount === 0;
  const ready = calc.valid && (nothingToTake ? calc.hasAmount : payNow > 0 && !!method && (!cash || enough));
  const checksIn = checkIn && full;

  const go = (alsoCheckIn: boolean) => {
    if (!ready) return;
    onConfirm({
      discountMinor: calc.minor,
      reasonText: discountReasonText(discount, (k) => t(`discount.reasons.${k}`)),
      method: nothingToTake ? null : method,
      payAmount: nothingToTake ? 0 : payNow,
      checkIn: alsoCheckIn && full,
    });
  };

  const money = formatMoney(payNow);
  const primaryLabel = nothingToTake
    ? checksIn ? t("pay.applyAndCheckIn") : t("discount.applyOnly")
    : checksIn ? t("pay.takeAndCheckIn", { amount: money }) : t("sheet.takeAmount", { amount: money });

  /* Back on the left, the orange button on the right — the till’s rule. The
     label can run long ("Take ৳862.50 and check in", and longer in Bangla), so
     the button grows to two lines rather than cutting the amount short. */
  const footer: ReactNode = (
    <div className="flex w-full flex-col gap-tight">
      {/* A guest who has paid ahead of turning up: take the money, leave them
          for the door. A quiet text button, never a second orange one. */}
      {checksIn && !nothingToTake && (
        <Button variant="link" data-pay-only onClick={() => go(false)} disabled={busy || !ready} className="min-h-11 self-center text-center">
          {t("pay.takeOnly", { amount: money })}
        </Button>
      )}
      <div className="flex w-full gap-tight">
        <button type="button" className={secondaryButton("h-13", "flex-none")} onClick={onClose} disabled={busy}>
          <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          {t("sheet.back")}
        </button>
        <button type="button" data-pay-primary className={primaryButton("min-h-13 py-2", "flex-1")} onClick={() => go(checksIn)} disabled={busy || !ready}>
          <span className="text-center leading-tight">{primaryLabel}</span>
        </button>
      </div>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={t("sheet.takeTitle")} closeLabel={tc("close")} className="mx-auto max-w-xl" lead={<p className="text-base font-medium text-muted">{title} · {when}</p>} footer={footer}>
      <div className="flex flex-col gap-section p-card">
        {/* What is being taken, as large as the screen allows: it is the number
            the guest is told. It follows the discount and any part-payment. */}
        <div className="text-center" data-pay-amount>
          <p className="text-base font-medium text-muted">{part != null ? t("pay.partNow") : t("pay.toTake")}</p>
          <p className="mt-inline text-4xl font-semibold leading-tight tabular-nums text-fg">{money}</p>
          {(calc.hasAmount && calc.valid) || left > 0 ? (
            <p className="mt-inline text-base text-muted">
              {left > 0 ? t("pay.stillOwed", { amount: formatMoney(left) }) : t("pay.owedWas", { amount: formatMoney(owed) })}
            </p>
          ) : null}
        </div>

        <AfterMatchDiscount state={discount} setState={setDiscount} orderTotal={orderTotal} owed={owed} limitPct={limitPct} />
        {onWriteOff && owed > 0 && (
          <Button variant="link" data-write-off onClick={onWriteOff} disabled={busy} className="min-h-11 self-start">
            {tr("pos.writeOff.action", { amount: formatMoney(owed) })}
          </Button>
        )}

        {allowPart && afterDiscount > 0 && (
          part == null ? (
            <Button variant="link" onClick={() => setPart(String(afterDiscount / 100))} className="min-h-11 self-start">
              {t("pay.payPart")}
            </Button>
          ) : (
            <div className="flex flex-col gap-tight">
              <label htmlFor="pay-part" className="text-md font-semibold text-fg">{t("pay.partLabel")}</label>
              <div className="flex items-center gap-tight">
                <input
                  id="pay-part"
                  inputMode="decimal"
                  value={part}
                  onChange={(e) => { setPart(e.target.value); setTender(""); }}
                  className="h-11 min-w-0 flex-1 rounded-inner bg-subtle px-comfortable text-right text-md tabular-nums"
                />
                <button type="button" onClick={() => setPart(null)} className="h-11 shrink-0 rounded-full bg-subtle px-comfortable text-md font-semibold text-fg hover:bg-muted-wash">
                  {t("pay.partAll")}
                </button>
              </div>
            </div>
          )
        )}

        {!nothingToTake && methods.length > 1 && (
          <div>
            <p className="mb-tight text-md font-semibold text-fg">{tp("pay.method")}</p>
            {/* Each way to pay its own tile, a picture and a word. Chosen is
                solid orange, white, a tick. */}
            <TileGrid cols={Math.min(methods.length, 4) as 2 | 3 | 4} role="radiogroup" aria-label={tp("pay.method")}>
              {methods.map((m) => {
                const Icon = METHOD_ICON[m] ?? Wallet;
                const on = method === m;
                return (
                  <Tile
                    key={m}
                    role="radio"
                    aria-checked={on}
                    selected={on}
                    data-method={m}
                    onClick={() => { setPicked(m); setTender(""); setTyping(false); }}
                    className="min-h-[4.5rem] gap-inline text-base font-semibold leading-tight"
                  >
                    <Icon size={22} strokeWidth={1.75} aria-hidden />
                    <span className="max-w-full break-words">{enumL.method(m)}</span>
                  </Tile>
                );
              })}
            </TileGrid>
          </div>
        )}

        {!nothingToTake && cash && (
          <div className="flex flex-col gap-tight">
            {/* The received figure IS the way to type another: tap it. */}
            {typing ? (
              <label className="flex min-h-14 items-center justify-between gap-tight rounded-inner bg-subtle px-comfortable">
                <span className="text-md">{tp("cash.tendered")}</span>
                <span className="flex items-center gap-1 text-lg font-semibold">
                  ৳
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={tender}
                    placeholder={String(Math.ceil(payNow / 100))}
                    onChange={(e) => setTender(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    aria-label={tp("cash.tendered")}
                    className="h-11 w-28 rounded-inner bg-card px-tight text-right tabular-nums"
                  />
                </span>
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setTyping(true)}
                aria-label={`${tp("cash.tendered")} ${formatMoney(tenderedMinor)} — ${tp("cash.tapToChange")}`}
                className="flex min-h-14 w-full items-center justify-between gap-tight rounded-inner bg-subtle px-comfortable text-left active:bg-muted-wash"
              >
                <span className="flex min-w-0 items-center gap-inline text-md">
                  {tp("cash.tendered")}
                  <Pencil size={13} strokeWidth={2} aria-hidden className="shrink-0 text-muted" />
                </span>
                <span className="shrink-0 text-lg font-semibold tabular-nums" data-pay-tendered>{formatMoney(tenderedMinor)}</span>
              </button>
            )}
            {exact ? (
              <p className="flex min-h-14 items-center rounded-inner bg-success-wash px-comfortable text-md font-medium text-success">{tp("cash.noChange")}</p>
            ) : (
              <div className={cn("flex min-h-14 items-baseline justify-between gap-tight rounded-inner px-comfortable py-tight font-semibold", enough ? "bg-success-wash text-success" : "bg-subtle text-muted")}>
                <span className="shrink-0 text-xl">{enough ? tp("complete.giveChange") : t("pay.notEnough")}</span>
                <span className="min-w-0 truncate text-right text-3xl">{enough ? formatMoney(change) : "—"}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-tight" data-pay-notes>
              <NoteChip on={exact} onClick={() => { setTender(""); setTyping(false); }}>{tp("cash.exact")}</NoteChip>
              {quickNotes(payNow).map((amt) => (
                <NoteChip key={amt} on={tender !== "" && parseInt(tender, 10) === amt} onClick={() => { setTender(String(amt)); setTyping(false); }}>
                  {formatPriceShort(amt * 100)}
                </NoteChip>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function NoteChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tile aria-pressed={on} selected={on} onClick={onClick} className="h-11 min-w-16 flex-1 text-md font-semibold tabular-nums">
      <span className="truncate">{children}</span>
    </Tile>
  );
}
