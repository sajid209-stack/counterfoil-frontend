"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { DateRangePicker, StatusPill, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { DEMO_TODAY } from "@/lib/schedule";
import {
  percentLabel,
  type CollectedBy,
  type CollectionStatus,
  type PayoutStatus,
  type PlatformFeeEntry,
  type PlatformFeeRates,
  type SettlementStatus,
} from "@/lib/api";

/* The money screens' shared vocabulary. Every one of them says the same four
   things — who held the money, what it has been settled by, how a figure was
   worked out, and which period is on screen — and each is said once, here. */

export const periodText = (from: string, to: string) => (from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`);

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
export const PAYOUT_TONE: Record<PayoutStatus, PillTone> = {
  scheduled: "neutral",
  instructed: "info",
  paid: "success",
  failed: "danger",
  cancelled: "neutral",
};
export const COLLECTION_TONE: Record<CollectionStatus, PillTone> = {
  accruing: "neutral",
  open: "info",
  paid: "success",
  past_due: "warning",
  void: "neutral",
};

export const settlementHref = (id: string) => (id.startsWith("po_") ? `/money/payouts/${id}` : `/money/collections/${id}`);

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

export function SettledBy({ entry: e }: { entry: PlatformFeeEntry }) {
  const t = useTranslations("money");
  return (
    <div className="flex flex-wrap items-center justify-between gap-tight rounded-sm border border-hairline px-comfortable py-tight">
      <span className="text-[13px] text-muted">{t("breakdown.settledBy")}</span>
      {e.settlementId ? (
        <Link href={settlementHref(e.settlementId)} className="inline-flex min-h-11 items-center gap-tight text-[13px] font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-0">
          <SettlementBadge status={e.settlementStatus} />
        </Link>
      ) : (
        <span className="text-[13px]">{e.settlementStatus === "none" ? t("settlement.none") : t("breakdown.notYet")}</span>
      )}
    </div>
  );
}

// ── period ─────────────────────────────────────────────────────────────────

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const PERIOD_PRESETS = [
  { value: "today", range: (): [string, string] => [DEMO_TODAY, DEMO_TODAY] },
  { value: "7d", range: (): [string, string] => [shift(DEMO_TODAY, -6), DEMO_TODAY] },
  { value: "month", range: (): [string, string] => [`${DEMO_TODAY.slice(0, 8)}01`, DEMO_TODAY] },
  { value: "30d", range: (): [string, string] => [shift(DEMO_TODAY, -29), DEMO_TODAY] },
] as const;
export type Period = { preset: string; from: string; to: string };
export const defaultPeriod = (): Period => {
  const [from, to] = PERIOD_PRESETS[2].range();
  return { preset: "month", from, to };
};

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const t = useTranslations("money");
  const tc = useTranslations("common");
  return (
    <DateRangePicker
      value={value}
      onChange={onChange}
      presets={PERIOD_PRESETS.map((p) => ({ value: p.value, label: t(`presets.${p.value}`), range: p.range }))}
      today={DEMO_TODAY}
      max={DEMO_TODAY}
      labels={{
        choose: t("range.choose"),
        custom: t("range.custom"),
        from: t("range.from"),
        to: t("range.to"),
        apply: t("range.apply"),
        cancel: t("range.cancel"),
        previousMonth: tc("previousMonth"),
        nextMonth: tc("nextMonth"),
        days: (count) => t("range.days", { count }),
        pickEnd: t("range.pickEnd"),
      }}
      className="w-full shrink-0 md:w-auto"
    />
  );
}

/** A column header allowed to wrap onto two lines. The money tables have nine
 *  columns, and headers that say what a column is ("Online payment fee")
 *  are longer than the figures under them; kept on one line they pushed the
 *  last column off a 1440 screen. */
export const wrapHead = (label: string) => <span className="whitespace-normal">{label}</span>;

/** Quoted when it must be; a customer called "Rahman, M." stays one cell. */
export const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Money in major units for a CSV — an accountant's spreadsheet wants numbers. */
export const csvMoney = (minor: number) => (minor / 100).toFixed(2);

/** A figure with its label, the unit every money summary is built from. */
export function Figure({ label, value, note, tone }: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; tone?: "warning" }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cn("mt-inline font-mono text-[15px] font-medium tabular-nums", tone === "warning" ? "text-warning" : "text-fg")}>{value}</p>
      {note && <p className="mt-inline text-[12px] text-muted">{note}</p>}
    </div>
  );
}
