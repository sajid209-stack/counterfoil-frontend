"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, Switch } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { MembershipTier, MembershipView } from "@/lib/api";
import { useEndsIn, usePlanPrice } from "../shared";

/** The facts of this membership, as a definition list. */
export function DetailsCard({
  membership,
  tier,
  onAutoRenew,
  onCopy,
}: {
  membership: MembershipView;
  tier: MembershipTier;
  onAutoRenew: (next: boolean) => void;
  onCopy: () => void;
}) {
  const t = useTranslations("membershipDetail.details");
  const price = usePlanPrice();
  const endsIn = useEndsIn();
  const forLife = membership.daysToExpiry > 3650;
  const canSwitch = membership.effectiveStatus === "active" || membership.effectiveStatus === "paused";

  const row = "grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-x-comfortable py-comfortable";
  const link = "font-medium text-fg underline underline-offset-4 hover:no-underline";

  return (
    <Card title={t("title")}>
      <dl className="-my-comfortable divide-y divide-hairline text-base">
        <div className={row}>
          <dt className="text-sm text-muted">{t("plan")}</dt>
          <dd className="min-w-0 break-words text-fg">
            <Link href={`/memberships/plans/${membership.tierId}`} className={link}>
              {membership.tierName}
            </Link>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-sm text-muted">{t("started")}</dt>
          <dd className="text-fg">{formatDate(membership.startedAt)}</dd>
        </div>
        <div className={row}>
          <dt className="text-sm text-muted">{t("periodEnds")}</dt>
          <dd className="text-fg">
            {forLife ? endsIn(membership) : formatDate(membership.expiresAt)}
            {!forLife && <span className="block text-sm text-muted">{endsIn(membership)}</span>}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-sm text-muted" id="md-renews">
            {t("renews")}
          </dt>
          <dd>
            <Switch checked={membership.autoRenew} onChange={onAutoRenew} disabled={!canSwitch} labelledBy="md-renews" />
            <span className="mt-inline block text-sm text-muted">{t("renewNotice", { count: tier.renewalNoticeDays })}</span>
          </dd>
        </div>
        <div className={row}>
          <dt className="text-sm text-muted">{t("price")}</dt>
          <dd className="text-fg">{price(tier)}</dd>
        </div>
        <div className={row}>
          <dt className="text-sm text-muted">{t("soldIn")}</dt>
          <dd className="min-w-0 break-words text-fg">
            {membership.orderId ? (
              <Link href={`/orders/${membership.orderId}`} className={link}>
                {t("soldInOrder")}
              </Link>
            ) : (
              t("soldInOs")
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-sm text-muted">{t("code")}</dt>
          <dd className="flex min-w-0 items-center gap-tight">
            <span className="min-w-0 break-all font-mono text-sm text-fg">{membership.code}</span>
            <button
              type="button"
              aria-label={t("copyCode")}
              onClick={onCopy}
              className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:size-9"
            >
              <Copy size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
