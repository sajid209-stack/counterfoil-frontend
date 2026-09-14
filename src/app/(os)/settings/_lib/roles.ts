"use client";

import { useTranslations } from "next-intl";
import type { Role, Staff } from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { ALL_PERMISSIONS, permissionKey } from "@/lib/permissions";

/** How many people hold each role, keyed by role id. */
export function countByRole(staff: Staff[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of staff) out[s.roleId] = (out[s.roleId] ?? 0) + 1;
  return out;
}

/**
 * A role said in words: "Sells at the till · Discounts up to 10% · Scans
 * tickets".
 *
 * The roles list used to read "Permissions: 2" — a count, which says nothing
 * about what two. Each limit is placed straight after the permission it limits,
 * so the sentence reads the way the job does, and a limit on something the role
 * cannot do is left out rather than stated.
 */
export function useRoleSummary() {
  const t = useTranslations("settings");
  return (role: Role): string => {
    const parts: string[] = [];
    for (const p of ALL_PERMISSIONS) {
      if (!role.permissions.includes(p)) continue;
      // Refunding is said once, by its limit ("Refunds up to ৳5,000"), rather
      // than as "Refunds · Refunds up to ৳5,000".
      if (p !== "orders.refund") parts.push(t(`perm.${permissionKey(p)}.short`));
      if (p === "pos.sell") {
        const pct = role.discountLimitPct;
        parts.push(pct == null ? t("roles.discountAny") : pct === 0 ? t("roles.discountNone") : t("roles.discountUpTo", { pct }));
      }
      if (p === "orders.refund") {
        const limit = role.refundLimit;
        parts.push(
          limit == null ? t("roles.refundAny") : limit === 0 ? t("roles.refundNone") : t("roles.refundUpTo", { amount: formatPriceShort(limit) }),
        );
      }
    }
    return parts.length ? parts.join(" · ") : t("roles.canNothing");
  };
}
