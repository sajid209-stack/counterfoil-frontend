"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Sheet, StatusPill, useToast, type PillTone } from "@/components/ui";
import { FeeBreakdown } from "@/components/FeeParts";
import { formatClockOf, formatDay } from "@/lib/format";
import { useEnumLabels } from "@/lib/labels";
import { peekFeeEntries, peekPlatformFeeRates, type FinanceLine, type FinanceLineStatus, type ID } from "@/lib/api";
import { KindDisc, amountTone, signed, useLineText, type DisplayRow } from "./lineParts";

const TONE: Record<FinanceLineStatus, PillTone> = {
  pending: "warning",
  processing: "info",
  cleared: "neutral",
  billed: "neutral",
  paid: "success",
  received: "success",
};

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** One line, read in full: the amount, what it is, when, and — for a payment,
 *  a fee or a refund — the arithmetic behind it. */
export function LineDrawer({ row, locationId, onClose }: { row: DisplayRow | null; locationId: ID; onClose: () => void }) {
  const line: FinanceLine | null = row?.line ?? null;
  const bucket = row?.type === "counterFees";
  const t = useTranslations("finances");
  const tm = useTranslations("money");
  const enumL = useEnumLabels();
  const toast = useToast();
  const describe = useLineText();
  // Kept for the close animation: the sheet is unmounted by `open`, so a null
  // line simply draws nothing.
  const d0 = line ? describe(line) : null;
  const d = d0 && row && row.type === "onlineFees" ? { ...d0, text: t("line.onlineFees") } : d0 && bucket ? { text: t("line.counterFees", { count: row!.lines.length }) } : d0;
  const entry = !bucket && line?.orderId && ["sale", "platform_fee", "processing_fee", "refund"].includes(line.kind)
    ? peekFeeEntries(locationId).find((e) => line.id.startsWith(`fl_${e.id}_`))
    : undefined;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("detail.copied"));
    } catch {
      /* A browser that refuses the clipboard leaves the reference selectable. */
    }
  };

  const item = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-section py-comfortable">
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[14px] text-fg">{value}</dd>
    </div>
  );

  const method = line?.method ? (line.method === "bank_transfer" ? t("detail.bankTransfer") : enumL.method(line.method)) : null;

  return (
    <Sheet open={!!row} onClose={onClose} title={d?.text ?? ""} closeLabel={t("detail.close")} side>
      {line && row && d && (
        <div className="p-card">
          <div className="flex items-center gap-comfortable">
            <KindDisc kind={bucket || row.type === "onlineFees" ? "platform_fee" : line.kind} size={44} />
            <div className="min-w-0">
              <p className={`text-[28px] font-semibold leading-tight tracking-[-0.5px] ${amountTone(row.amount)}`}>{signed(row.amount)}</p>
            </div>
          </div>
          <p className="mt-comfortable text-[14px] text-fg">
            {d.text}
            {d.ref && (
              <>
                {" · "}
                <span className="font-mono text-[13px]">{d.ref}</span>
              </>
            )}
          </p>

          {bucket ? (
            <ul className="mt-section divide-y divide-hairline border-y border-hairline">
              {row.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-section py-comfortable">
                  {l.orderId ? (
                    <Link href={`/orders/${l.orderId}`} className="inline-flex min-h-11 items-center font-mono text-[13px] text-brand-foreground underline underline-offset-2 hover:opacity-80 md:min-h-0">
                      {l.orderReference}
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-[14px] font-semibold text-fg">{signed(l.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
          <dl className="mt-section divide-y divide-hairline border-y border-hairline">
            {item(t("detail.status"), <StatusPill tone={TONE[line.status]}>{t(`status.${line.status}`)}</StatusPill>)}
            {item(t("detail.when"), `${formatDay(localDay(line.at), { weekday: true })} · ${formatClockOf(line.at)}`)}
            {line.orderId && line.orderReference &&
              item(
                t("detail.order"),
                <Link href={`/orders/${line.orderId}`} className="inline-flex min-h-11 items-center font-mono text-[13px] text-brand-foreground underline underline-offset-2 hover:opacity-80 md:min-h-0">
                  {line.orderReference}
                </Link>,
              )}
            {method && item(t("detail.method"), method)}
            {line.destination && item(t("detail.to"), line.destination)}
            {line.by && item(t("detail.by"), line.by)}
            {line.reference &&
              item(
                t("detail.reference"),
                <span className="inline-flex items-center gap-tight">
                  <span className="font-mono text-[13px]">{line.reference}</span>
                  <button
                    type="button"
                    onClick={() => copy(line.reference!)}
                    className="inline-flex h-11 items-center gap-inline rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:opacity-80 md:h-9"
                  >
                    <Copy size={14} strokeWidth={1.5} aria-hidden />
                    {t("detail.copy")}
                  </button>
                </span>,
              )}
          </dl>
          )}

          {entry && (
            <section className="mt-major">
              <h3 className="mb-comfortable text-[14px] font-semibold">{tm("breakdown.title")}</h3>
              <FeeBreakdown entry={entry} rates={peekPlatformFeeRates()} />
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
