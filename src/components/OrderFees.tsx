"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOrderFeeEntries, peekPlatformFeeRates } from "@/lib/api";
import { CollectorBadge, FeeBreakdown, SettlementBadge, money, useHoldingLabel } from "./FeeParts";

/**
 * An order's payments, as Counterfoil's fee sees them: who held each one, the
 * fees on it, and which way the balance runs — so somebody looking at a sale
 * does not have to go to Fees & balances to ask what it cost. Each row opens
 * its own arithmetic in place.
 */
export function OrderFees({ orderId }: { orderId: string }) {
  const t = useTranslations("money");
  const holding = useHoldingLabel();
  const q = useApiQuery(() => getOrderFeeEntries(orderId), [orderId]);
  const [open, setOpen] = useState<string | null>(null);
  const entries = q.data ?? [];
  if (!entries.length) return null;
  return (
    <div className="mt-comfortable border-t border-line pt-comfortable">
      <p className="text-base font-semibold text-fg">{t("order.title")}</p>
      <ul className="mt-tight flex flex-col gap-tight">
        {entries.map((e) => {
          const expanded = open === e.id;
          return (
            <li key={e.id} className="rounded-sm border border-hairline">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : e.id)}
                className="flex min-h-11 w-full flex-wrap items-center gap-tight px-comfortable py-tight text-left text-[13px]"
              >
                <CollectorBadge by={e.collectedBy} />
                <span className="min-w-0 flex-1 truncate text-muted">{e.kind === "refund" ? `${t("kind.refund")} · ` : ""}{holding(e)}</span>
                <span className="tabular-nums">
                  {e.owedToOperator !== 0
                    ? `${t("balances.colPayYou")} ${money(e.owedToOperator)}`
                    : e.owedByOperator !== 0
                      ? `${t("balances.colOweUs")} ${money(e.owedByOperator)}`
                      : t("settlement.none")}
                </span>
                <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <div className="flex flex-col gap-comfortable border-t border-hairline p-comfortable">
                  <FeeBreakdown entry={e} rates={peekPlatformFeeRates()} />
                  {e.settlementId && (
                    <Link href="/finances" className="inline-flex min-h-11 items-center gap-tight self-start text-[13px] md:min-h-0">
                      <span className="text-muted">{t("breakdown.settledBy")}</span>
                      <SettlementBadge status={e.settlementStatus} />
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
