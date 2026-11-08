"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Notice } from "@/components/ui";
import { SM, useMediaQuery } from "@/lib/useMedia";
import { listLocations } from "@/lib/api";
import { refundSummary, useRefundVersion } from "@/lib/api/refundRequests";
import { useWriteOffVersion, writeOffSummary } from "@/lib/api/writeOffRequests";
import { useActiveLocation } from "@/lib/activeLocation";
import { useApiQuery } from "@/lib/useApi";

/** The same quiet underlined link a Notice's own action uses, at a thumb's height on a phone. */
const LINK = "inline-flex min-h-11 items-center text-sm font-medium text-fg underline underline-offset-4 transition-colors duration-quick hover:no-underline md:min-h-0";

/**
 * One line that says requests are waiting, with a way to answer them.
 *
 * The Orders page used to carry the whole queue — every refund and move the
 * counter had asked for, each with its buttons — above the sales it is meant to
 * be a report of. Refunds and write-offs have their own pages now (with lists,
 * tabs and a detail), so this is only a pointer: "2 refunds and 1 write-off are
 * waiting · Review". It reads the venue in the bar, draws nothing at all while
 * nothing waits, and nothing until the browser has the venue (the requests are
 * seeded with the real clock, so the server cannot count them).
 */
export function RequestsBanner() {
  const t = useTranslations("requests.banner");
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const { id, pending } = useActiveLocation(locationsQ.data?.data ?? []);
  useRefundVersion();
  useWriteOffVersion();
  const phone = !useMediaQuery(SM);
  if (pending) return null;
  const refunds = refundSummary(id).waiting;
  const writeOffs = writeOffSummary(id).waiting;
  if (refunds === 0 && writeOffs === 0) return null;

  const text =
    refunds > 0 && writeOffs > 0
      ? t("both", { refunds: t("nRefunds", { count: refunds }), writeOffs: t("nWriteOffs", { count: writeOffs }) })
      : refunds > 0
        ? t("refundsOnly", { count: refunds })
        : t("writeOffsOnly", { count: writeOffs });

  /* On a phone it is a slim single line with an icon and a chevron, not a box:
     one tap goes to what is waiting (refunds first, then write-offs). */
  if (phone) {
    return (
      <Link
        href={refunds > 0 ? "/refunds" : "/write-offs"}
        data-requests-banner
        className="-mx-gutter flex min-h-11 items-center gap-comfortable px-gutter text-base transition-colors duration-quick hover:bg-nav-hover active:bg-nav-hover"
      >
        <RotateCcw size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-info" />
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
      </Link>
    );
  }

  return (
    <Notice tone="info" size="sm">
      <p data-requests-banner className="flex flex-wrap items-center gap-x-tight">
        <span className="max-sm:basis-full">{text}</span>
        <span aria-hidden className="text-muted max-sm:hidden">·</span>
        {refunds > 0 && (
          <Link href="/refunds" className={LINK}>
            {writeOffs > 0 ? t("reviewRefunds") : t("review")}
          </Link>
        )}
        {refunds > 0 && writeOffs > 0 && <span aria-hidden className="text-muted max-sm:mx-tight">·</span>}
        {writeOffs > 0 && (
          <Link href="/write-offs" className={LINK}>
            {refunds > 0 ? t("reviewWriteOffs") : t("review")}
          </Link>
        )}
      </p>
    </Notice>
  );
}
