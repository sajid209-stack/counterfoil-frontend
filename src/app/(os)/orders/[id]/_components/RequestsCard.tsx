"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { refundRequestsForOrder, refundStatusOf, useRefundVersion } from "@/lib/api/refundRequests";
import { useWriteOffVersion, writeOffRequestsForOrder, writeOffStatusOf } from "@/lib/api/writeOffRequests";
import { REFUND_TONE } from "../../../refunds/_components/RefundDetail";
import { WRITE_OFF_TONE } from "../../../write-offs/_components/WriteOffDetail";
import { useAgo, useNow } from "../../../refunds/_components/kit";
import { Section } from "./Section";

interface Row {
  id: string;
  kind: "refund" | "writeOff";
  amount: number;
  statusLabel: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  by: string;
  at: string;
  href: string;
}

/**
 * Every refund and write-off request on this order, newest first: what it was
 * for, how much, where it stands, and a link to open it on its own page.
 *
 * The order page used to carry the counter's whole refund queue, with buttons,
 * above the sale. Refunds and write-offs are answered on their own pages now
 * (`/refunds`, `/write-offs`), so here a request is a line that says it exists
 * and points there — `?open=<id>` opens it. Nothing is drawn for an order that
 * has had none.
 */
export function RequestsCard({ orderId, className }: { orderId: string; className?: string }) {
  const t = useTranslations("requests");
  const tf = useTranslations("requests.refunds");
  const tw = useTranslations("requests.writeOffs");
  const ago = useAgo();
  const now = useNow();
  useRefundVersion();
  useWriteOffVersion();

  const rows: Row[] = [
    ...refundRequestsForOrder(orderId).map((r): Row => {
      const st = refundStatusOf(r, now);
      return {
        id: r.id,
        kind: "refund",
        amount: st === "approved" ? (r.approvedAmount ?? r.amount) : r.amount,
        statusLabel: tf(`status.${st}`),
        tone: REFUND_TONE[st],
        by: r.requestedBy,
        at: r.requestedAt,
        href: `/refunds?open=${encodeURIComponent(r.id)}`,
      };
    }),
    ...writeOffRequestsForOrder(orderId).map((r): Row => {
      const st = writeOffStatusOf(r, now);
      return {
        id: r.id,
        kind: "writeOff",
        amount: st === "approved" ? (r.approvedAmount ?? r.amount) : r.amount,
        statusLabel: tw(`status.${st}`),
        tone: WRITE_OFF_TONE[st],
        by: r.requestedBy,
        at: r.requestedAt,
        href: `/write-offs?open=${encodeURIComponent(r.id)}`,
      };
    }),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (rows.length === 0) return null;

  return (
    <Section title={t("card.title")} id="order-requests" className={className}>
      <ul className="flex flex-col divide-y divide-hairline">
        {rows.map((r) => {
          const kind = r.kind === "refund" ? t("card.refund") : t("card.writeOff");
          return (
            <li key={`${r.kind}-${r.id}`} data-request-row={r.kind} className="flex items-center gap-comfortable py-tight first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-tight gap-y-inline">
                  <span className="text-base font-medium text-fg">{kind}</span>
                  <StatusPill tone={r.tone}>{r.statusLabel}</StatusPill>
                </p>
                <p className="mt-inline truncate text-sm text-muted">{t("card.askedLine", { name: r.by, ago: ago(r.at, now) })}</p>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums text-fg">{formatMoney(r.amount)}</span>
              <Link
                href={r.href}
                aria-label={t("card.openAria", { kind, amount: formatMoney(r.amount) })}
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand-foreground underline underline-offset-4 hover:no-underline sm:min-h-0"
              >
                {t("card.open")}
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
