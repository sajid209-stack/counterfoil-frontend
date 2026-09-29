"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, Download } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { formatDay, formatMoney } from "@/lib/format";
import { getPayout } from "@/lib/api";
import { PAYOUT_TONE, csvMoney, downloadCsv, periodText } from "../../_components/MoneyKit";
import { SettlementHeader, SettlementLines } from "../../_components/SettlementLines";

/** One payout: what it came to, where it went, and every line in it. */
export default function PayoutPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("money");
  const q = useApiQuery(() => getPayout(id), [id]);

  const back = (
    <Link href="/money/payouts" className="inline-flex min-h-11 items-center gap-inline text-[13px] text-muted hover:text-fg md:min-h-0">
      <ChevronLeft size={14} strokeWidth={1.5} aria-hidden />
      {t("payouts.back")}
    </Link>
  );

  if (q.error) {
    return (
      <PageShell title={t("payouts.title")}>
        {back}
        <EmptyState title={t("payouts.notFound")} />
      </PageShell>
    );
  }
  if (!q.data) {
    return (
      <PageShell title={t("payouts.title")}>
        <div className="card-surface h-48 animate-pulse" />
      </PageShell>
    );
  }
  const { payout: p, entries } = q.data;
  const headline =
    p.status === "paid" ? t("payouts.detailPaid", { date: formatDay(p.paidOn ?? p.date) })
    : p.status === "instructed" ? t("payouts.detailSent", { date: formatDay(p.date) })
    : t("payouts.detailExpected", { date: formatDay(p.date, { weekday: true }) });

  const download = () =>
    downloadCsv(
      `${p.number}.csv`,
      ["Payout", p.number],
      [
        ["Date", p.date],
        ["Status", t(`payoutStatus.${p.status}`)],
        ["Collected", csvMoney(p.gross)],
        ["Fees", csvMoney(-p.feesDeducted)],
        ["Refunds", csvMoney(-p.refundsDeducted)],
        ["Paid to you", csvMoney(p.amount)],
        ["Bank reference", p.reference ?? ""],
        [],
        ["When", "Order", "Kind", "Method", "Amount", "VAT", "Fee base", "Platform fee", "Gateway fee", "We pay you"],
        ...entries.map((e) => [e.createdAt, e.orderNumber, e.kind, e.paymentMethod, csvMoney(e.amount), csvMoney(e.vat), csvMoney(e.feeBase), csvMoney(e.platformFee), csvMoney(e.gatewayFee), csvMoney(e.owedToOperator)]),
      ],
    );

  return (
    <PageShell title={p.number} description={t("payouts.description")}>
      <div className="flex flex-col gap-section">
        {back}
        <SettlementHeader
          amount={formatMoney(p.amount)}
          pill={<StatusPill tone={PAYOUT_TONE[p.status]}>{t(`payoutStatus.${p.status}`)}</StatusPill>}
          headline={headline}
          actions={
            <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={download}>
              {t("payouts.download")}
            </Button>
          }
          facts={[
            [t("payouts.colGross"), formatMoney(p.gross)],
            [t("payouts.colFees"), `−${formatMoney(p.feesDeducted)}`],
            [t("payouts.colRefunds"), p.refundsDeducted ? `−${formatMoney(p.refundsDeducted)}` : formatMoney(0)],
            [t("payouts.period"), periodText(p.periodFrom, p.periodTo)],
            [t("payouts.to"), p.destination ?? "—"],
            [t("payouts.reference"), p.reference ?? "—"],
          ]}
        />
        <section aria-labelledby="lines-h" className="flex flex-col gap-comfortable">
          <div>
            <h2 id="lines-h" className="text-sm font-semibold text-fg">{t("payouts.lines")}</h2>
            <p className="mt-inline text-[13px] text-muted">{t("payouts.linesHelp")}</p>
          </div>
          <SettlementLines entries={entries} side="payYou" />
        </section>
      </div>
    </PageShell>
  );
}
