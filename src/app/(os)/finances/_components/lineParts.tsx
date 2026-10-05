"use client";

import { useTranslations } from "next-intl";
import { ArrowDownLeft, Landmark, Percent, Plus, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDay, formatMoney } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { DEMO_TODAY } from "@/lib/schedule";
import { percentLabel, type FinanceLine, type FinanceLineKind, type FinanceLineStatus } from "@/lib/api";

/** Signed money for a ledger: + for money in, a real minus for money out. */
export const signed = (minor: number) => (minor > 0 ? `+${formatMoney(minor)}` : formatMoney(minor));

/** Green is for money in, and only for money in. */
export const amountTone = (minor: number) => (minor > 0 ? "text-success" : "text-fg");

const KIND_LOOK: Record<FinanceLineKind, { Icon: LucideIcon; disc: string }> = {
  sale: { Icon: ArrowDownLeft, disc: "bg-success-wash text-success" },
  refund: { Icon: Undo2, disc: "bg-warning-wash text-warning" },
  platform_fee: { Icon: Percent, disc: "bg-muted-wash text-fg" },
  processing_fee: { Icon: Percent, disc: "bg-muted-wash text-fg" },
  payout: { Icon: Landmark, disc: "bg-muted-wash text-fg" },
  withdrawal: { Icon: Landmark, disc: "bg-muted-wash text-fg" },
  deposit: { Icon: Plus, disc: "bg-success-wash text-success" },
};

/** The tinted disc that says what kind of line this is. The glyph differs per
 *  kind, so colour is never the only carrier. */
export function KindDisc({ kind, size = 32 }: { kind: FinanceLineKind; size?: number }) {
  const { Icon, disc } = KIND_LOOK[kind];
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full", disc)} style={{ width: size, height: size }}>
      <Icon size={size >= 40 ? 20 : 16} strokeWidth={1.75} />
    </span>
  );
}

/** A line, in words: "Online payment" with its reference when it has one. The
 *  reference is returned apart so the page can set it in DM Mono. */
export function useLineText() {
  const t = useTranslations("finances");
  const enumL = useEnumLabels();
  return (l: FinanceLine): { text: string; ref?: string } => {
    switch (l.kind) {
      case "sale":
        return { text: t("line.sale"), ref: l.orderReference };
      case "refund":
        return { text: t("line.refund"), ref: l.orderReference };
      case "platform_fee":
      case "processing_fee": {
        const rate = percentLabel(l.rateBp ?? 0);
        const base = formatMoney(l.feeBase ?? 0);
        return { text: t(l.kind === "platform_fee" ? "line.platformFee" : "line.processingFee", { rate, base }) };
      }
      case "payout":
        return { text: l.destination ? t("line.payout", { bank: l.destination }) : t("line.payoutNoBank") };
      case "withdrawal":
        return { text: l.destination ? t("line.withdrawal", { bank: l.destination }) : t("line.withdrawalNoBank") };
      case "deposit": {
        const m = l.method ?? "";
        const method = m === "bkash" || m === "card_terminal" || m === "bank_transfer" ? t(`by.${m}`) : enumL.method(m);
        return { text: t("line.deposit", { method }) };
      }
    }
  };
}

/** "Today", "Yesterday", else "Mon 27 Jul". */
export function useDayLabel() {
  const t = useTranslations("finances");
  const yesterday = new Date(`${DEMO_TODAY}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  return (date: string) => (date === DEMO_TODAY ? t("day.today") : date === y ? t("day.yesterday") : formatDay(date, { weekday: true }));
}

/** The chip a line wears only while it is not final. */
export const isInFlight = (s: FinanceLineStatus) => s === "pending" || s === "processing";

/** What one row of a day stands for. Display only: the ledger stays line by
 *  line (the CSV and every figure), a row just reads like a bank statement. */
export type DisplayRow = {
  id: string;
  type: "line" | "sale" | "onlineFees" | "counterFees";
  /** The line whose details open (the sale, the fee, or the first fee). */
  line: FinanceLine;
  lines: FinanceLine[];
  /** The signed amount the row shows. */
  amount: number;
  /** For a sale row: what was paid and what was taken in fees. */
  paid?: number;
  fees?: number;
};

const entryKey = (id: string) => id.replace(/_(sale|pf|gf)$/, "");

/** One row per online payment (sale and its fees together), the Counterfoil
 *  fees on counter payments as ONE row, everything else one row each. */
export function groupDay(lines: FinanceLine[]): DisplayRow[] {
  const byEntry = new Map<string, FinanceLine[]>();
  for (const l of lines) {
    if (l.kind === "sale" || l.kind === "platform_fee" || l.kind === "processing_fee") {
      const k = entryKey(l.id);
      byEntry.set(k, [...(byEntry.get(k) ?? []), l]);
    }
  }
  const rows: DisplayRow[] = [];
  const counter: FinanceLine[] = [];
  let counterAt = -1;
  const done = new Set<string>();
  lines.forEach((l) => {
    if (l.kind !== "sale" && l.kind !== "platform_fee" && l.kind !== "processing_fee") {
      rows.push({ id: l.id, type: "line", line: l, lines: [l], amount: l.amount });
      return;
    }
    const k = entryKey(l.id);
    if (done.has(k)) return;
    done.add(k);
    const group = byEntry.get(k)!;
    const sale = group.find((g) => g.kind === "sale");
    const fees = group.filter((g) => g.kind !== "sale");
    if (sale) {
      const feeSum = -fees.reduce((s, g) => s + g.amount, 0);
      rows.push({
        id: sale.id,
        type: "sale",
        line: sale,
        lines: group,
        amount: sale.amount - feeSum,
        ...(fees.length ? { paid: sale.amount, fees: feeSum } : {}),
      });
    } else if (fees.some((g) => g.kind === "processing_fee")) {
      rows.push({ id: fees[0].id, type: "onlineFees", line: fees[0], lines: fees, amount: fees.reduce((s, g) => s + g.amount, 0) });
    } else {
      if (counterAt < 0) counterAt = rows.length;
      counter.push(...fees);
    }
  });
  if (counter.length) {
    rows.splice(counterAt, 0, { id: `counter_${counter[0].id}`, type: "counterFees", line: counter[0], lines: counter, amount: counter.reduce((s, g) => s + g.amount, 0) });
  }
  return rows;
}

export type RowStatus = { key: "pending" | "cleared" | "fee" | "processing" | "paid" | "received" | "refunded"; tone: "warning" | "info" | "success" | "neutral" };

/** One vocabulary for a row's status, everywhere it is shown. */
export function rowStatus(row: DisplayRow): RowStatus {
  if (row.type === "onlineFees" || row.type === "counterFees") return { key: "fee", tone: "neutral" };
  const l = row.line;
  switch (l.kind) {
    case "sale":
      return l.status === "pending" ? { key: "pending", tone: "warning" } : { key: "cleared", tone: "neutral" };
    case "refund":
      return { key: "refunded", tone: "neutral" };
    case "deposit":
      return { key: "received", tone: "success" };
    case "payout":
    case "withdrawal":
      return l.status === "processing" ? { key: "processing", tone: "info" } : { key: "paid", tone: "success" };
    default:
      return { key: "fee", tone: "neutral" };
  }
}

/** The money the row brings in and sends out. An online payment brings in what
 *  was paid and sends out its fees, so credit less debit is its net. */
export function rowAmounts(row: DisplayRow): { credit: number; debit: number } {
  if (row.type === "sale") return { credit: row.paid ?? row.amount, debit: row.fees ?? 0 };
  return row.amount > 0 ? { credit: row.amount, debit: 0 } : { credit: 0, debit: -row.amount };
}
