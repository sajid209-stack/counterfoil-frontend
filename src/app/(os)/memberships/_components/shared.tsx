"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { PillTone } from "@/components/ui";
import type { MembershipStatus, MembershipTier, MembershipView } from "@/lib/api";

/**
 * Pieces every memberships screen draws the same way (docs/memberships.md):
 * a plan's price, its benefit lines, a member's initials, a usage meter, and
 * which states raise their voice. Words come from the `memberships` namespace.
 */

/** Active is the normal state and stays quiet; the rest say what they are. */
export const STATUS_TONE: Record<MembershipStatus, PillTone> = {
  active: "success",
  lapsed: "danger",
  paused: "warning",
  cancelled: "neutral",
};

type Tier = Pick<MembershipTier, "price" | "billingPeriod" | "includedVisits" | "discountBps" | "discountScope" | "guestPassesPerPeriod" | "maxMembers" | "autoRenew">;

/** "৳3,500 a year", "৳800 a month", "৳12,000 once". */
export function usePlanPrice() {
  const t = useTranslations("membershipsList");
  return (tier: Pick<MembershipTier, "price" | "billingPeriod">) => t(`shared.per.${tier.billingPeriod}`, { price: formatMoney(tier.price) });
}

/** The plan's benefits as short plain lines, in the order a member cares. */
export function usePlanBenefits() {
  const t = useTranslations("memberships");
  const tl = useTranslations("membershipsList");
  return (tier: Tier): string[] => {
    const lines: string[] = [];
    lines.push(tier.includedVisits == null ? t("summaryUnlimited") : tl(`shared.visits.${tier.billingPeriod}`, { count: tier.includedVisits }));
    if (tier.discountBps > 0) {
      const pct = Math.round(tier.discountBps / 100);
      lines.push(tier.discountScope === "all" ? t("summaryDiscountAll", { pct }) : t("summaryDiscountScoped", { pct }));
    }
    if (tier.guestPassesPerPeriod > 0) lines.push(t("summaryGuestPasses", { count: tier.guestPassesPerPeriod }));
    if (tier.maxMembers > 1) lines.push(tl("shared.covers", { count: tier.maxMembers }));
    return lines;
  };
}

/** Two letters from a name, for the avatar. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** A round avatar with the member's initials. `md` 36px, `lg` 48px. */
export function MemberAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-subtle font-semibold text-fg-secondary border border-line",
        size === "sm" ? "size-7 text-xs" : size === "lg" ? "size-12 text-md" : "size-9 text-sm",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** A thin bar: how much of something is used or left. Colour is the caller's
 *  (`tone`), and the bar never carries meaning alone — a label always sits by it. */
export function Meter({ value, max, tone = "fg", className, label }: { value: number; max: number; tone?: "fg" | "warning" | "ember"; className?: string; label: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)}>
      <span
        className={cn("block h-full rounded-full", tone === "warning" ? "bg-warning" : tone === "ember" ? "bg-ember" : "bg-fg-secondary")}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

/** "in 12 days", "today", "26 days ago" — the end of a membership, relative to now. */
export function useEndsIn() {
  const t = useTranslations("membershipsList");
  return (m: Pick<MembershipView, "daysToExpiry">) => {
    const d = m.daysToExpiry;
    if (d > 3650) return t("shared.forLife");
    if (d === 0) return t("shared.endsToday");
    return d > 0 ? t("shared.inDays", { count: d }) : t("shared.daysAgo", { count: -d });
  };
}
