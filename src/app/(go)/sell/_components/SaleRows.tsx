"use client";

/* ── The decisions that belong to the sale, not to one item ────────────────
 *
 * Who it is for, what came off it, a promo code, and how much is paid now —
 * drawn as the cart till's payment step draws them: ONE card of rows (each
 * saying where it stands and opening in place), then how much now as its own
 * tiles. They sit below the items and above the payment, which is the order
 * the decisions are made in.
 */

import { useTranslations } from "next-intl";
import { Percent } from "lucide-react";
import { DiscountInput, Notice, type DiscountMode } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatPriceShort } from "@/lib/format";
import type { AppliedPromotion } from "@/lib/api";
import type { AttachedCustomer } from "../../pos/CustomerPicker";
import { CustomerRow, PromoCodeRow, SaleRow, type PayChoice } from "../../pos/CheckoutParts";
import { TileText } from "../../_components/SheetParts";
import { GoCard, Tile, TileGrid, TileLabel } from "../../_components/Tiles";

export type RowKey = "customer" | "discount" | "advance";

export function SaleRows({
  currency,
  openRow,
  onOpenRow,
  attached,
  onPickCustomer,
  onRemoveCustomer,
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
  appliedCoupon,
  couponTaken,
  couponInput,
  onCouponInput,
  onApplyCoupon,
  onRemoveCoupon,
  couponError,
  payOptions,
  payChoice,
  onPayChoice,
  dueNow,
  balance,
}: {
  currency: string;
  openRow: RowKey | null;
  onOpenRow: (r: RowKey | null) => void;
  attached: AttachedCustomer | null;
  onPickCustomer: () => void;
  onRemoveCustomer: () => void;
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
  appliedCoupon: AppliedPromotion | null;
  couponTaken: number;
  couponInput: string;
  onCouponInput: (v: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  /** Already in words. */
  couponError: string | null;
  payOptions: { id: PayChoice; label: string; amount: number }[];
  payChoice: PayChoice;
  onPayChoice: (c: PayChoice) => void;
  dueNow: number;
  balance: number;
}) {
  const t = useTranslations("sell");
  const tp = useTranslations("pos");

  const reasonNeeded = discountValue > 0 && reasonRequired && !discountReason.trim();
  // A discount that cannot be given opens its own row, so the refusal is read
  // where it can be fixed and cannot be folded away.
  const discountOpen = openRow === "discount" || overLimit || reasonNeeded;
  const discountText =
    discountValue > 0
      ? discountMode === "percent"
        ? `${discountValue}%`
        : formatMoney(discountValue, currency)
      : tp("summary.none");

  return (
    <>
      <GoCard className="gap-0 overflow-hidden py-0">
        <CustomerRow attached={attached} onOpen={onPickCustomer} onRemove={onRemoveCustomer} />
        <SaleRow
          icon={Percent}
          label={tp("summary.discount")}
          value={discountText}
          open={discountOpen}
          onToggle={() => onOpenRow(openRow === "discount" ? null : "discount")}
        >
          <DiscountInput
            shape="go"
            mode={discountMode}
            onMode={onDiscountMode}
            value={discountValue}
            onChange={onDiscountValue}
            base={Math.max(0, discountBase)}
            currency={currency}
            className="[&_p]:text-sm"
          />
          {/* The cap is named, and so is the way past it. */}
          {overLimit && (
            <Notice tone="warning" size="sm" className="mt-tight">
              {t("rows.overLimit", { limit: capPct })}
            </Notice>
          )}
          {discountValue > 0 && reasonRequired && (
            <input
              value={discountReason}
              onChange={(e) => onDiscountReason(e.target.value)}
              placeholder={t("rows.reasonPlaceholder")}
              aria-label={t("rows.reason")}
              className={cn(
                "mt-tight h-11 w-full rounded-full border bg-card px-comfortable text-md placeholder:text-muted",
                reasonNeeded ? "border-danger" : "border-line",
              )}
            />
          )}
        </SaleRow>
        <PromoCodeRow
          applied={appliedCoupon}
          taken={couponTaken}
          input={couponInput}
          onInput={onCouponInput}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
          error={couponError}
          currency={currency}
        />
      </GoCard>

      {/* How much of it now. Only where the business takes part payment (or a
          booking asks for a deposit), and only the choices that really differ. */}
      {payOptions.length > 1 && (
        <div className="flex flex-col gap-tight">
          <TileLabel>{tp("pay.howMuch")}</TileLabel>
          {/* The same tiles as the cart till's payment step, with the amount at
              the 13px reading floor (the shared tile's second line is 12px). */}
          <TileGrid cols={payOptions.length >= 3 ? 3 : 2} role="radiogroup" aria-label={tp("pay.howMuch")}>
            {payOptions.map((o) => (
              <Tile
                key={o.id}
                role="radio"
                aria-checked={payChoice === o.id}
                data-pay-choice={o.id}
                selected={payChoice === o.id}
                onClick={() => onPayChoice(o.id)}
                className="h-[4.25rem]"
              >
                <TileText label={o.label} sub={<span className="tabular-nums">{formatPriceShort(o.amount, currency)}</span>} selected={payChoice === o.id} />
              </Tile>
            ))}
          </TileGrid>
          {balance > 0 && (
            <p className="text-md font-medium text-fg">
              {tp("pay.partSummary", { now: formatMoney(dueNow, currency), later: formatMoney(balance, currency) })}
            </p>
          )}
        </div>
      )}
    </>
  );
}
