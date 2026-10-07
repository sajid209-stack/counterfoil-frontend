"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { MarketBadge, useToast } from "@/components/ui";
import { isVoidedOrder, orderChannelOf, type Order } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Directory } from "../../_lib/useReport";
import type { SalesLabels } from "../../_lib/labels";
import { Section } from "./Section";

/**
 * Order information: the labelled facts about the sale, in a grid — who rang
 * it up and where, when it was placed and paid — with the reference you can
 * copy and, for a marketplace sale, what the marketplace keeps.
 *
 * Everything here was on the old page in one of three places (a "Sale" card, a
 * line under it, the buyer's name); this gathers it, and adds the two facts
 * the order already carried and nothing showed: who sold it, and at which
 * counter. Times are 12-hour. The reference is the one identifier, so it is the
 * one thing set in DM Mono.
 */
export function FactsCard({ o, dir, labels, due, className }: { o: Order; dir: Directory; labels: SalesLabels; due: number; className?: string }) {
  const t = useTranslations("orders.facts");
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const taken = o.payments.filter((p) => p.amount > 0).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const firstPaid = taken[0]?.createdAt;
  const lastPaid = taken[taken.length - 1]?.createdAt;
  const settled = !isVoidedOrder(o) && due === 0 && taken.length > 0;
  const channel = orderChannelOf(o);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused; the reference is on screen to read.
    }
  };

  const fact = (label: string, value: React.ReactNode, key: string, className?: string) => (
    <div key={key} data-fact={key} className={cn("min-w-0", className)}>
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className="mt-inline break-words text-sm">{value}</dd>
    </div>
  );
  const none = <span className="text-muted">{t("none")}</span>;

  return (
    <Section title={t("title")} className={className}>
      <dl className="grid grid-cols-2 gap-x-major gap-y-section lg:grid-cols-4">
        {fact(
          t("reference"),
          <span className="inline-flex max-w-full items-center gap-inline">
            <span className="min-w-0 whitespace-nowrap font-mono text-[13px]">{o.reference}</span>
            <button
              type="button"
              onClick={() => void copy(o.reference)}
              aria-label={copied ? t("copied") : t("copy")}
              className="-my-2 grid h-11 w-11 shrink-0 place-items-center rounded-sm text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash sm:h-8 sm:w-8"
            >
              {copied ? <Check size={14} strokeWidth={2} aria-hidden /> : <Copy size={14} strokeWidth={1.5} aria-hidden />}
            </button>
          </span>,
          "reference",
          /* The reference is an identifier: it stays on one line, so on a phone it takes both columns. */
          "col-span-2 lg:col-span-1",
        )}
        {fact(t("placed"), formatDateTime(o.createdAt), "placed")}
        {fact(
          t("channel"),
          <span className="inline-flex items-center gap-inline">
            {o.source && <MarketBadge id={o.source.marketplaceId} />}
            {o.source ? `${labels.channel(channel)} · ${o.source.marketplaceName}` : labels.soldAt(o)}
          </span>,
          "channel",
        )}
        {fact(t("venue"), dir.locationName(o.locationId) || none, "venue")}
        {fact(t("soldBy"), o.staffId ? dir.staffName(o.staffId) || none : <span className="text-muted">{o.channel === "online" ? t("onlineCheckout") : t("notRecorded")}</span>, "staff")}
        {/* A counter sale was rung up at a counter even where the order never recorded which; an online sale has none. */}
        {fact(t("counter"), o.counterId ? dir.counterName(o.counterId) || none : <span className="text-muted">{o.channel === "counter" ? t("notRecorded") : t("none")}</span>, "counter")}
        {fact(t("paid"), firstPaid ? formatDateTime(firstPaid) : <span className="text-muted">{t("nothingPaid")}</span>, "paid")}
        {fact(t("settled"), settled && lastPaid ? formatDateTime(lastPaid) : <span className="text-muted">{isVoidedOrder(o) ? t("none") : t("notYet")}</span>, "settled")}
      </dl>

      {/* A marketplace sale is not a direct one: somebody else took the booking
          and keeps a cut, and without this the commission is invisible on the
          one record that should carry it. */}
      {o.source && (
        <div data-marketplace className="mt-section flex flex-wrap items-center gap-x-comfortable gap-y-inline rounded-sm bg-market-wash px-comfortable py-tight text-[13px]">
          <MarketBadge id={o.source.marketplaceId} />
          <span className="font-medium">{t("via", { name: o.source.marketplaceName })}</span>
          <span className="text-muted">
            {t("cut", { commission: formatMoney(o.source.commissionAmount), net: formatMoney(o.total - o.source.commissionAmount) })}
          </span>
          {o.source.reference && <span className="font-mono text-[12px] text-muted">{o.source.reference}</span>}
        </div>
      )}
    </Section>
  );
}
