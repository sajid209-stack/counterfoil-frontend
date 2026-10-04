"use client";

import { useTranslations } from "next-intl";
import { StatusPill, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { percentLabel, type CollectedBy, type PlatformFeeEntry, type PlatformFeeRates, type SettlementStatus } from "@/lib/api";

/* How Counterfoil's fee on a payment is explained, wherever a payment appears
   (the order page's fee block, and the "Why this amount?" arithmetic). These
   were the money screens' shared vocabulary before Finances replaced them: who
   held the money, what settles it, and how a fee was worked out. */

/** A signed amount, with a real minus sign rather than a hyphen. */
export const money = (minor: number) => (minor < 0 ? `−${formatMoney(-minor)}` : formatMoney(minor));

/** Who held the money: Counterfoil, or you. Colour and words both, because
 *  this is the one fact that decides which way a row's debt runs. */
export function CollectorBadge({ by }: { by: CollectedBy }) {
  const t = useTranslations("money");
  return <StatusPill tone={by === "platform" ? "info" : "neutral"}>{t(`heldBy.${by}`)}</StatusPill>;
}

const SETTLEMENT_TONE: Record<SettlementStatus, PillTone> = {
  unsettled: "neutral",
  scheduled: "info",
  instructed: "info",
  paid: "success",
  open: "info",
  past_due: "warning",
  none: "neutral",
};

export function SettlementBadge({ status }: { status: SettlementStatus }) {
  const t = useTranslations("money");
  /* One line: a status broken over three lines reads as three statuses. */
  return (
    <span className="whitespace-nowrap">
      <StatusPill tone={SETTLEMENT_TONE[status]}>{t(`settlement.${status}`)}</StatusPill>
    </span>
  );
}

/** "bKash online · held by Counterfoil", "Cash · held by you". */
export function useHoldingLabel() {
  const t = useTranslations("money");
  const enumL = useEnumLabels();
  return (e: Pick<PlatformFeeEntry, "paymentMethod" | "provider" | "collectedBy">) =>
    e.paymentMethod === "cash"
      ? t("heldBy.cash")
      : e.provider
        ? t(e.collectedBy === "platform" ? "heldBy.onlinePlatform" : "heldBy.onlineOperator", { method: enumL.method(e.paymentMethod) })
        : t("heldBy.counter", { method: enumL.method(e.paymentMethod) });
}

/**
 * "Why this amount?" — one entry's arithmetic, laid out as a receipt.
 *
 * The figures on every money screen are sums of these, so this is the thing a
 * tenant who disputes a number is actually asking for: amount, less VAT, the
 * fee base, each fee at its rate, and in one sentence who owes whom.
 */
export function FeeBreakdown({ entry: e, rates }: { entry: PlatformFeeEntry; rates: PlatformFeeRates }) {
  const t = useTranslations("money");
  const refund = e.kind === "refund";
  const platformHeld = e.collectedBy === "platform";
  const line = (label: React.ReactNode, value: React.ReactNode, opts: { strong?: boolean; muted?: boolean; note?: React.ReactNode } = {}) => (
    <div className={cn("flex items-baseline justify-between gap-comfortable px-comfortable py-tight", opts.strong && "bg-subtle")}>
      <div className="min-w-0">
        <p className={cn("text-[14px]", opts.strong ? "font-semibold text-fg" : opts.muted ? "text-muted" : "text-fg")}>{label}</p>
        {opts.note && <p className="mt-inline text-[12px] leading-relaxed text-muted">{opts.note}</p>}
      </div>
      <p className={cn("shrink-0 font-mono text-[14px] tabular-nums", opts.strong && "font-semibold")}>{value}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-comfortable">
      <p className="text-[13px] leading-relaxed text-fg">
        {refund ? (platformHeld ? t("breakdown.refundPlatform") : t("breakdown.refundOperator")) : platformHeld ? t("breakdown.platformHeld") : t("breakdown.operatorHeld")}
      </p>
      <div className="divide-y divide-hairline overflow-hidden rounded-sm border border-hairline">
        {line(refund ? t("breakdown.refund") : t("breakdown.amount"), money(Math.abs(e.amount)))}
        {!refund && (
          <>
            {line(t("breakdown.vat"), `− ${formatMoney(e.vat)}`, { muted: true, note: t("breakdown.vatNote") })}
            {line(t("breakdown.base"), formatMoney(e.feeBase))}
            {line(t("breakdown.platform", { rate: percentLabel(rates.platformFeeBp) }), `− ${formatMoney(e.platformFee)}`)}
            {platformHeld
              ? line(t("breakdown.gateway", { rate: percentLabel(rates.platformGatewayFeeBp) }), `− ${formatMoney(e.gatewayFee)}`)
              : line(t("breakdown.gatewayNone"), formatMoney(0), { muted: true, note: t("breakdown.gatewayNoneNote") })}
          </>
        )}
        {line(t("breakdown.payYou"), money(e.owedToOperator), {
          strong: platformHeld,
          note: platformHeld && !refund
            ? t("breakdown.payYouCalc", { amount: formatMoney(e.amount), platform: formatMoney(e.platformFee), gateway: formatMoney(e.gatewayFee) })
            : undefined,
        })}
        {line(t("breakdown.oweUs"), money(e.owedByOperator), { strong: !platformHeld && !refund })}
      </div>
      <p className="text-[12px] leading-relaxed text-muted">{t("breakdown.fixedNote")}</p>
    </div>
  );
}
