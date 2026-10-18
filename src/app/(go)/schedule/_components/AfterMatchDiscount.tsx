"use client";

import { useTranslations } from "next-intl";
import { Percent, X } from "lucide-react";
import { Notice } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Minor } from "@/lib/api";
import { discountMinorFrom, withinDiscountLimit, type DiscountMode } from "../_lib/discount";
import { Tile, TileGrid } from "../../_components/Tiles";

/* ── The after-match discount ─────────────────────────────────────────────
 *
 * What a counter gives when a guest comes to pay what they still owe and the
 * game ran short, or the lights went out for twenty minutes. It is ONE piece,
 * used by the Schedule's balance sheet and by Check-in's payment sheet, so the
 * two cannot drift into two different ideas of what a discount is: the same
 * ৳ / % choice, the same four reasons, the same cap from the signed-in role,
 * refused in words, and the same sum stated back — "Owed ৳1,000 − discount
 * ৳200 = Take ৳800" — because that is the sentence a cashier reads to the
 * guest.
 */

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
 * amount (taka or percent), a reason as four large cells, and the one sum a
 * cashier needs to read back to the guest.
 *
 * Fully controlled — no state of its own — so a sheet holds exactly this
 * rather than a second copy of the same logic.
 */
export function AfterMatchDiscount({
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
        data-after-match="closed"
        onClick={() => setState({ ...state, open: true })}
        className="flex min-h-11 w-full items-center justify-center gap-tight rounded-card bg-subtle text-md font-semibold text-fg hover:bg-muted-wash active:bg-muted-wash"
      >
        <Percent size={18} strokeWidth={2} aria-hidden />
        {t("discount.give")}
      </button>
    );
  }

  const take = Math.max(0, owed - calc.minor);

  return (
    <div data-after-match="open" className="flex flex-col gap-tight rounded-card bg-subtle p-comfortable">
      <div className="flex items-start justify-between gap-tight">
        <div className="min-w-0">
          <p className="text-md font-semibold text-fg">{t("discount.title")}</p>
          <p className="text-sm text-muted">{t("discount.help")}</p>
        </div>
        <button type="button" aria-label={t("discount.remove")} onClick={() => setState(emptyDiscount())} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-muted-wash">
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="flex items-stretch gap-tight">
        <div role="radiogroup" aria-label={t("discount.modeLabel")} className="flex shrink-0 gap-tight">
          {(["amount", "percent"] as DiscountMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={state.mode === m}
              aria-label={m === "amount" ? t("discount.modeAmount") : t("discount.modePercent")}
              onClick={() => setState({ ...state, mode: m })}
              className={cn("flex h-11 w-11 items-center justify-center rounded-inner text-md font-semibold", state.mode === m ? "bg-ember-solid text-on-solid" : "bg-card text-fg shadow-card")}
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
          className="h-11 min-w-0 flex-1 rounded-inner bg-card px-comfortable text-md"
        />
      </div>

      <TileGrid cols={2} role="radiogroup" aria-label={t("discount.reasonLabel")}>
        {DISCOUNT_REASONS.map((r) => (
          <Tile
            key={r}
            role="radio"
            aria-checked={state.reasonKey === r}
            selected={state.reasonKey === r}
            onClick={() => setState({ ...state, reasonKey: r })}
            className="min-h-11 text-base font-semibold"
          >
            {t(`discount.reasons.${r}`)}
          </Tile>
        ))}
      </TileGrid>

      {state.reasonKey === "other" && (
        <input
          aria-label={t("discount.noteLabelRequired")}
          value={state.note}
          onChange={(e) => setState({ ...state, note: e.target.value })}
          placeholder={t("discount.notePlaceholder")}
          className="h-11 rounded-inner bg-card px-comfortable text-md"
        />
      )}

      {calc.overOwed && <Notice tone="danger" size="sm">{t("discount.overOwed")}</Notice>}
      {calc.overLimit && <Notice tone="danger" size="sm">{t("discount.overLimit", { pct: limitPct ?? 0 })}</Notice>}
      {calc.needsNote && <Notice tone="danger" size="sm">{t("discount.noteRequired")}</Notice>}

      {calc.valid && calc.hasAmount && (
        <p data-after-match-sum className="text-md font-semibold tabular-nums text-fg">
          {t("discount.mathsLine", { owed: formatMoney(owed), discount: formatMoney(calc.minor), take: formatMoney(take) })}
        </p>
      )}
    </div>
  );
}
