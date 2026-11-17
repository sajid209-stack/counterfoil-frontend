"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { MembershipTier, MembershipView } from "@/lib/api";
import { Meter } from "../shared";

/** How much of this period has been used: visits, guest passes, or "Unlimited entry". */
export function UsageCard({ membership, tier }: { membership: MembershipView; tier: MembershipTier }) {
  const t = useTranslations("membershipDetail.usage");
  const total = tier.includedVisits;
  const guests = tier.guestPassesPerPeriod;
  const forLife = membership.daysToExpiry > 3650;

  const visitsText = total != null ? t("visits", { used: membership.visitsUsed, total }) : "";
  const guestsText = guests > 0 ? t("guests", { used: membership.guestPassesUsed, total: guests }) : "";

  return (
    <Card title={t("title")}>
      <div className="flex flex-col gap-major">
        {total != null ? (
          <div className="flex flex-col gap-tight">
            <p className="text-base font-medium text-fg">{visitsText}</p>
            <Meter value={membership.visitsUsed} max={total} tone={membership.visitsUsed >= total ? "warning" : "fg"} label={visitsText} />
            {!forLife && <p className="text-sm text-muted">{t("resets", { date: formatDate(membership.expiresAt) })}</p>}
          </div>
        ) : (
          <p className="text-base font-medium text-fg">{t("unlimited")}</p>
        )}
        {guests > 0 && (
          <div className="flex flex-col gap-tight">
            <p className="text-base font-medium text-fg">{guestsText}</p>
            <Meter value={membership.guestPassesUsed} max={guests} tone={membership.guestPassesUsed >= guests ? "warning" : "fg"} label={guestsText} />
          </div>
        )}
      </div>
    </Card>
  );
}
