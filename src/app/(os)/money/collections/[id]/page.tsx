"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, Download } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { formatDay, formatMoney } from "@/lib/format";
import { getFeeCollection, peekPlatformFeeRates, percentLabel } from "@/lib/api";
import { COLLECTION_TONE, csvMoney, downloadCsv, periodText } from "../../_components/MoneyKit";
import { SettlementHeader, SettlementLines } from "../../_components/SettlementLines";
import { PayCollectionDialog } from "../../_components/PayCollectionDialog";

/** One collection: what it charges, on which sales, and how to pay it. */
export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("money");
  const q = useApiQuery(() => getFeeCollection(id), [id]);
  const [paying, setPaying] = useState(false);

  const back = (
    <Link href="/money/collections" className="inline-flex min-h-11 items-center gap-inline text-[13px] text-muted hover:text-fg md:min-h-0">
      <ChevronLeft size={14} strokeWidth={1.5} aria-hidden />
      {t("collections.back")}
    </Link>
  );
  if (q.error) {
    return (
      <PageShell title={t("collections.title")}>
        {back}
        <EmptyState title={t("collections.notFound")} />
      </PageShell>
    );
  }
  if (!q.data) {
    return (
      <PageShell title={t("collections.title")}>
        <div className="card-surface h-48 animate-pulse" />
      </PageShell>
    );
  }
  const { collection: c, entries } = q.data;
  const payable = c.status === "open" || c.status === "past_due";
  const headline =
    c.status === "accruing" ? t("collections.accruing", { date: formatDay(c.issuedOn) })
    : c.status === "paid" ? t("collections.paidOn", { date: formatDay(c.paidOn), method: c.paidWith ?? "" })
    : t("collections.dueOn", { date: formatDay(c.dueOn, { weekday: true }) });

  const download = () =>
    downloadCsv(`${c.number}.csv`, ["Collection", c.number], [
      ["Issued", c.issuedOn],
      ["Due", c.dueOn],
      ["Status", t(`collectionStatus.${c.status}`)],
      ["Charged on", csvMoney(c.feeBase)],
      ["Fee due", csvMoney(c.amount)],
      [],
      ["When", "Order", "Method", "Amount", "VAT", "Fee base", "Platform fee"],
      ...entries.map((e) => [e.createdAt, e.orderNumber, e.paymentMethod, csvMoney(e.amount), csvMoney(e.vat), csvMoney(e.feeBase), csvMoney(e.owedByOperator)]),
    ]);

  return (
    <PageShell title={c.number} description={t("collections.description")}>
      <div className="flex flex-col gap-section">
        {back}
        <SettlementHeader
          amount={formatMoney(c.amount)}
          pill={<StatusPill tone={COLLECTION_TONE[c.status]}>{t(`collectionStatus.${c.status}`)}</StatusPill>}
          headline={headline}
          actions={
            <>
              <Button variant="secondary" icon={<Download size={16} strokeWidth={1.5} />} onClick={download}>{t("collections.download")}</Button>
              {payable && <Button onClick={() => setPaying(true)}>{t("collections.pay", { amount: formatMoney(c.amount) })}</Button>}
            </>
          }
          facts={[
            [t("collections.colBase"), formatMoney(c.feeBase)],
            [t("balances.platformFee", { rate: percentLabel(peekPlatformFeeRates().platformFeeBp) }), formatMoney(c.amount)],
            [t("collections.colPeriod"), periodText(c.periodFrom, c.periodTo)],
            [t("collections.payByLabel"), formatDay(c.dueOn)],
          ]}
        />
        <section aria-labelledby="lines-h" className="flex flex-col gap-comfortable">
          <div>
            <h2 id="lines-h" className="text-sm font-semibold text-fg">{t("collections.lines")}</h2>
            <p className="mt-inline text-[13px] text-muted">{t("collections.linesHelp")}</p>
          </div>
          <SettlementLines entries={entries} side="oweUs" />
        </section>
      </div>
      <PayCollectionDialog collection={paying ? c : null} onClose={() => setPaying(false)} onPaid={() => { setPaying(false); q.reload(); }} />
    </PageShell>
  );
}
