"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { MembershipView } from "@/lib/api";

/**
 * The membership drawn like the card the member carries: venue and plan on
 * top, the member's name large, the code and the end date underneath. It is
 * what staff read out at the gate.
 *
 * Mode-locked ink on paper (`bg-ink text-paper` are literal values, not the
 * theme's `inverse` pair), the same way the ticket stub is locked, so it reads
 * the same under glare in either theme.
 */
export function MembershipCard({
  membership,
  venue,
  className,
}: {
  membership: MembershipView;
  venue: string;
  className?: string;
}) {
  const t = useTranslations("membershipDetail.card");
  const ts = useTranslations("membershipsList.shared");
  const state = membership.effectiveStatus;
  const label = state === "paused" ? t("paused") : state === "lapsed" ? t("ended") : state === "cancelled" ? t("cancelled") : null;
  const forLife = membership.daysToExpiry > 3650;

  return (
    <article
      aria-label={t("label", { name: membership.customerName })}
      className={cn(
        "relative flex min-h-56 w-full max-w-md flex-col justify-between gap-major overflow-hidden rounded-card bg-ink p-card text-paper shadow-card print:break-inside-avoid",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-comfortable">
        <p className="min-w-0 break-words text-sm font-medium text-paper/70">{venue}</p>
        <p className="min-w-0 break-words text-right text-sm font-semibold">{membership.tierName}</p>
      </div>

      <div className="min-w-0">
        {label && (
          <span className="mb-tight inline-flex rounded-full bg-paper/15 px-comfortable py-inline text-xs font-medium text-paper">
            {label}
          </span>
        )}
        <p className="break-words text-xl font-semibold leading-tight">{membership.customerName}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-comfortable gap-y-inline">
        <p className="font-mono text-sm text-paper/70">{membership.code}</p>
        <p className="text-sm text-paper/70">{forLife ? ts("forLife") : t("validUntil", { date: formatDate(membership.expiresAt) })}</p>
      </div>
    </article>
  );
}
