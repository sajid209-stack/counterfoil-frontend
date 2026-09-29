"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, DataTable, Sheet, type Column } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { peekPlatformFeeRates, type PlatformFeeEntry } from "@/lib/api";
import { CollectorBadge, FeeBreakdown, money, useHoldingLabel } from "./MoneyKit";

/**
 * The lines of a payout or a collection — the same rows as Movements, so a
 * figure on a statement is traced the same way wherever it is met. `side`
 * picks the column that settlement is about.
 */
export function SettlementLines({ entries, side }: { entries: PlatformFeeEntry[]; side: "payYou" | "oweUs" }) {
  const t = useTranslations("money");
  const tc = useTranslations("common");
  const router = useRouter();
  const holding = useHoldingLabel();
  const [open, setOpen] = useState<PlatformFeeEntry | null>(null);
  const [page, setPage] = useState(1);
  const size = 20;
  const num = (v: number, strong = false) => (
    <span className={cn("whitespace-nowrap font-mono text-[13px] tabular-nums", strong ? "font-semibold" : v === 0 && "text-muted")}>{money(v)}</span>
  );
  const columns: Column<PlatformFeeEntry>[] = [
    { key: "when", header: t("balances.colWhen"), render: (e) => <span className="whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</span> },
    { key: "order", header: t("balances.colOrder"), render: (e) => <span className="whitespace-nowrap font-mono text-[13px]">{e.orderNumber}</span> },
    { key: "payment", header: t("balances.colPayment"), render: (e) => <span className="whitespace-nowrap">{e.kind === "refund" ? `${t("kind.refund")} · ` : ""}{holding(e).split(" · ")[0]}</span> },
    { key: "held", header: t("heldBy.label"), render: (e) => <CollectorBadge by={e.collectedBy} /> },
    { key: "amount", header: t("balances.colAmount"), align: "right", render: (e) => num(e.amount) },
    { key: "base", header: t("balances.feeBase"), align: "right", render: (e) => num(e.feeBase) },
    { key: "platform", header: t("balances.colPlatformFee"), align: "right", render: (e) => num(e.platformFee) },
    ...(side === "payYou"
      ? [
          { key: "gateway", header: t("balances.colGatewayFee"), align: "right" as const, render: (e: PlatformFeeEntry) => num(e.gatewayFee) },
          { key: "payYou", header: t("balances.colPayYou"), align: "right" as const, render: (e: PlatformFeeEntry) => num(e.owedToOperator, true) },
        ]
      : [{ key: "oweUs", header: t("balances.colOweUs"), align: "right" as const, render: (e: PlatformFeeEntry) => num(e.owedByOperator, true) }]),
  ];
  return (
    <>
      <DataTable
        columns={columns}
        rows={entries.slice((page - 1) * size, page * size)}
        getRowId={(e) => e.id}
        onRowClick={setOpen}
        isSelected={(e) => e.id === open?.id}
        minWidth="60rem"
        cardVariant="list"
        renderCard={(e) => (
          <div className="flex items-baseline justify-between gap-tight">
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-mono text-[12px]">{e.orderNumber}</span> · {e.kind === "refund" ? `${t("kind.refund")} · ` : ""}{holding(e).split(" · ")[0]}
            </span>
            {num(side === "payYou" ? e.owedToOperator : e.owedByOperator, true)}
          </div>
        )}
        pagination={entries.length > size ? { page, pageSize: size, total: entries.length, onPageChange: setPage } : undefined}
      />
      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={t("breakdown.title")}
        closeLabel={tc("close")}
        side
        lead={open ? <p className="truncate font-mono text-[12px] text-muted">{open.orderNumber} · {formatDateTime(open.createdAt)}</p> : undefined}
        footer={open ? <div className="flex w-full justify-end"><Button onClick={() => router.push(`/orders/${open.orderId}`)}>{t("breakdown.openOrder")}</Button></div> : undefined}
      >
        {open && (
          <div className="p-card">
            <FeeBreakdown entry={open} rates={peekPlatformFeeRates()} />
          </div>
        )}
      </Sheet>
    </>
  );
}

/** The header block of a settlement: the figure, its state, and its facts. */
export function SettlementHeader({
  amount,
  pill,
  headline,
  facts,
  actions,
}: {
  amount: string;
  pill: React.ReactNode;
  headline: string;
  facts: [string, React.ReactNode][];
  actions?: React.ReactNode;
}) {
  return (
    <section className="card-surface flex flex-col gap-section p-card">
      <div className="flex flex-wrap items-start justify-between gap-section">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-tight">{pill}<span className="text-[13px] text-muted">{headline}</span></div>
          <p className="mt-tight font-mono text-[30px] font-semibold tabular-nums tracking-[-0.5px]">{amount}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-tight">{actions}</div>}
      </div>
      <dl className="grid gap-x-section gap-y-comfortable sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[12px] text-muted">{k}</dt>
            <dd className="mt-inline break-words font-mono text-[14px] tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
