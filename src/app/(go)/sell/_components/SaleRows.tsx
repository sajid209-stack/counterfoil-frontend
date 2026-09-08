"use client";

/* ── The decisions that belong to the sale, not to one item ────────────────
 *
 * Who it is for, what came off it, and how much of it is being paid now.
 *
 * Each is a row saying what it currently IS — "Walk-in", "None", "In full" —
 * that opens its controls in place. In place, not in a modal: v2's whole
 * argument is that nothing covers anything, and a sheet over the sale to set a
 * discount would be the cart's round trip in a smaller coat.
 *
 * They sit BELOW the items and ABOVE the payment, which is the order the
 * decisions are actually made in: what is being bought, then anything that
 * changes the price, then the money.
 */


import { useTranslations } from "next-intl";
import { ChevronRight, Percent, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { DiscountInput, type DiscountMode } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { AttachedCustomer } from "../../pos/CustomerPicker";

export type RowKey = "customer" | "discount" | "advance";

function SaleRow({
  icon: Icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-tight py-tight text-left"
      >
        <Icon size={16} strokeWidth={1.5} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-[14px]">{label}</span>
        <span className="min-w-0 shrink-0 truncate text-[13px] text-muted">{value}</span>
        <ChevronRight
          size={15}
          strokeWidth={1.5}
          className={`shrink-0 text-muted transition-transform duration-quick ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && children && <div className="pb-tight">{children}</div>}
    </div>
  );
}

export function SaleRows({
  currency,
  openRow,
  onOpenRow,
  attached,
  onPickCustomer,
  discountMode,
  onDiscountMode,
  discountValue,
  onDiscountValue,
  discountBase,
  discountReason,
  onDiscountReason,
  reasonRequired,
  overLimit,
  capPct,
  advanceAllowed,
  advance,
  onAdvance,
  advanceMin,
  total,
  depositBalance,
  payInFull,
  onPayInFull,
}: {
  currency: string;
  openRow: RowKey | null;
  onOpenRow: (r: RowKey | null) => void;
  attached: AttachedCustomer | null;
  onPickCustomer: () => void;
  discountMode: DiscountMode;
  onDiscountMode: (m: DiscountMode) => void;
  discountValue: number;
  onDiscountValue: (v: number) => void;
  discountBase: number;
  discountReason: string;
  onDiscountReason: (v: string) => void;
  reasonRequired: boolean;
  overLimit: boolean;
  capPct: number;
  advanceAllowed: boolean;
  advance: number | null;
  onAdvance: (v: number | null) => void;
  advanceMin: number;
  total: number;
  depositBalance: number;
  payInFull: boolean;
  onPayInFull: (v: boolean) => void;
}) {
  const t = useTranslations("sell");
  const toggle = (r: RowKey) => onOpenRow(openRow === r ? null : r);

  const advanceValid = advance != null && advance >= advanceMin && advance < total;

  return (
    <div className="rounded-go border border-line bg-card px-comfortable">
      {/* Who it is for. The phone sits under the name because two customers
          share a name far more often than they share a number. */}
      <SaleRow
        icon={UserRound}
        label={t("rows.customer")}
        value={attached?.name ?? t("rows.walkIn")}
        open={false}
        onToggle={onPickCustomer}
      />

      <SaleRow
        icon={Percent}
        label={t("rows.discount")}
        value={
          discountValue > 0
            ? discountMode === "percent"
              ? `${discountValue}%`
              : formatMoney(discountValue, currency)
            : t("rows.none")
        }
        open={openRow === "discount"}
        onToggle={() => toggle("discount")}
      >
        <DiscountInput
          compact
          label={t("rows.discount")}
          mode={discountMode}
          onMode={onDiscountMode}
          value={discountValue}
          onChange={onDiscountValue}
          base={Math.max(0, discountBase)}
          currency={currency}
          className="mb-tight"
        />
        {/* The cap is named, and so is the way past it. A control that simply
            refuses is not an answer. */}
        {overLimit && (
          <p className="mb-tight rounded-go border border-line border-l-[3px] border-l-ember bg-card p-tight text-[13px]">
            {t("rows.overLimit", { limit: capPct })}
          </p>
        )}
        {discountValue > 0 && reasonRequired !== undefined && (
          <input
            value={discountReason}
            onChange={(e) => onDiscountReason(e.target.value)}
            placeholder={t("rows.reasonPlaceholder")}
            aria-label={t("rows.reason")}
            className={`h-12 w-full rounded-go-sm border bg-card px-comfortable text-sm outline-none placeholder:text-faint ${
              reasonRequired && !discountReason.trim() ? "border-danger" : "border-line focus:border-ember"
            }`}
          />
        )}
      </SaleRow>

      {/* Part payment. Two different rules meet here: a booking's DEPOSIT says
          what the booking requires, and an ADVANCE says what this customer
          actually handed over. The deposit applies on its own; the advance is
          only offered where the business allows one, because a control that
          always refuses is worse than no control. */}
      {(advanceAllowed || depositBalance > 0) && (
        <SaleRow
          icon={Wallet}
          label={t("rows.payNow")}
          value={
            advanceValid
              ? t("rows.advanceSummary", {
                  now: formatMoney(advance!, currency),
                  later: formatMoney(total - advance!, currency),
                })
              : depositBalance > 0 && !payInFull
                ? t("rows.deposit", { later: formatMoney(depositBalance, currency) })
                : t("rows.inFull")
          }
          open={openRow === "advance"}
          onToggle={() => toggle("advance")}
        >
          <div className="flex flex-col gap-tight">
            {advanceAllowed && (
              <>
                <div className="flex items-center gap-tight">
                  <input
                    inputMode="decimal"
                    aria-label={t("rows.advanceAmount")}
                    placeholder={t("rows.advancePlaceholder")}
                    value={advance == null ? "" : String(advance / 100)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) return onAdvance(null);
                      const n = parseFloat(raw);
                      onAdvance(Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : null);
                    }}
                    className="h-12 min-w-0 flex-1 rounded-go-sm border border-line bg-card px-comfortable text-right text-sm tabular-nums outline-none focus:border-ember"
                  />
                  <button
                    type="button"
                    onClick={() => onAdvance(null)}
                    className={`h-12 shrink-0 rounded-full border px-comfortable text-[13px] ${
                      advance == null ? "border-ember bg-ember/10 text-brand-foreground" : "border-line"
                    }`}
                  >
                    {t("rows.inFull")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-tight">
                  {[advanceMin, Math.round(total / 2), total].map((amt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onAdvance(amt >= total ? null : amt)}
                      className="h-12 flex-1 rounded-full border border-line bg-card px-tight text-[13px] active:bg-ember/10"
                    >
                      {i === 0
                        ? t("rows.minimum", { amount: formatMoney(amt, currency) })
                        : i === 1
                          ? t("rows.half")
                          : t("rows.inFull")}
                    </button>
                  ))}
                </div>
                {advance != null && advance < advanceMin && (
                  <p className="text-[13px] text-danger">
                    {t("rows.belowMin", { amount: formatMoney(advanceMin, currency) })}
                  </p>
                )}
              </>
            )}

            {depositBalance > 0 && (
              <button
                type="button"
                onClick={() => onPayInFull(!payInFull)}
                className="flex min-h-12 w-full items-center justify-between gap-tight text-[13px]"
              >
                <span className="min-w-0 text-left text-muted">
                  {t("rows.depositExplain", { later: formatMoney(depositBalance, currency) })}
                </span>
                <span
                  className={`flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors duration-quick ${
                    payInFull ? "bg-ember" : "bg-strong"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-card transition-transform duration-quick ${payInFull ? "translate-x-4" : ""}`}
                  />
                </span>
              </button>
            )}
          </div>
        </SaleRow>
      )}
    </div>
  );
}
