"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Minus } from "lucide-react";
import type { Role } from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { PERMISSION_GROUPS, permissionKey } from "@/lib/permissions";
import { SettingsSection } from "../../_components/SettingsKit";

/** A permission the role does not have, or a limit on something it cannot do. */
function No({ label }: { label: string }) {
  return (
    <>
      <Minus size={16} strokeWidth={1.5} aria-hidden className="mx-auto text-muted" />
      <span className="sr-only">{label}</span>
    </>
  );
}

/**
 * Every role side by side.
 *
 * The question an admin actually has on this page is "what changes between a
 * Cashier and a Supervisor?", and one role at a time cannot answer it. At a
 * handful of roles a grouped grid can — the permission screens that stay
 * readable group rows by area and give "allowed" and "not allowed" different
 * shapes rather than a wall of identical ticks. Each limit sits in the group of
 * the permission it limits, and a limit on something a role cannot do is drawn
 * as "not allowed", not as a value.
 *
 * On a phone the grid is wider than the screen, so it scrolls inside its card
 * with the permission names pinned. The table is named with aria-label rather
 * than a visually hidden caption: an absolutely positioned caption escapes the
 * scroll box and was widening the whole page by 114px.
 */
export function RoleMatrix({ roles }: { roles: Role[] }) {
  const t = useTranslations("settings");
  // The pinned cells must be opaque to hide what scrolls under them, and the
  // card they sit on is 72% card over the page — a plain bg-card drew a whiter
  // stripe down the column. This is that composite, made solid.
  const pinned =
    "max-md:sticky max-md:left-0 max-md:z-[1] max-md:bg-[color-mix(in_srgb,var(--color-card)_72%,var(--color-surface))]";

  const discount = (r: Role) =>
    !r.permissions.includes("pos.sell") ? (
      <No label={t("roles.notAllowed")} />
    ) : r.discountLimitPct == null ? (
      t("roles.noLimit")
    ) : (
      `${r.discountLimitPct}%`
    );
  const refund = (r: Role) =>
    !r.permissions.includes("orders.refund") ? (
      <No label={t("roles.notAllowed")} />
    ) : r.refundLimit == null ? (
      t("roles.noLimit")
    ) : (
      formatPriceShort(r.refundLimit)
    );

  return (
    <SettingsSection title={t("roles.compareTitle")} description={t("roles.compareDesc")}>
      <div className="relative overflow-x-auto">
        <table aria-label={t("roles.compareTitle")} className="table-inset w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={`px-card py-tight text-left text-[13px] font-medium text-muted ${pinned}`}>
                {t("roles.compareWhat")}
              </th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="px-section py-tight text-center text-[13px] font-medium">
                  <Link
                    href={`/settings/roles/${r.id}`}
                    className="inline-flex min-h-11 items-center text-fg hover:underline md:min-h-0"
                  >
                    {r.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((g) => (
            <tbody key={g.key} className="border-b border-hairline last:border-0">
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={roles.length + 1}
                  className="px-card pb-inline pt-section text-left text-[12px] font-medium uppercase tracking-wide text-muted"
                >
                  <span className={pinned}>{t(`permGroup.${g.key}.title`)}</span>
                </th>
              </tr>
              {g.permissions.map((p) => (
                <tr key={p}>
                  <th scope="row" className={`px-card py-tight text-left font-normal text-fg ${pinned}`}>
                    {t(`perm.${permissionKey(p)}.title`)}
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} className="px-section py-tight text-center">
                      {r.permissions.includes(p) ? (
                        <>
                          <Check size={16} strokeWidth={2} aria-hidden className="mx-auto text-success" />
                          <span className="sr-only">{t("roles.allowed")}</span>
                        </>
                      ) : (
                        <No label={t("roles.notAllowed")} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {g.key === "selling" && (
                <tr>
                  <th scope="row" className={`px-card pb-section pt-tight text-left font-normal text-muted ${pinned}`}>
                    {t("roles.limitDiscount")}
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} className="px-section pb-section pt-tight text-center text-[13px] text-fg">
                      {discount(r)}
                    </td>
                  ))}
                </tr>
              )}
              {g.key === "orders" && (
                <tr>
                  <th scope="row" className={`px-card pb-section pt-tight text-left font-normal text-muted ${pinned}`}>
                    {t("roles.limitRefund")}
                  </th>
                  {roles.map((r) => (
                    <td key={r.id} className="px-section pb-section pt-tight text-center text-[13px] text-fg">
                      {refund(r)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>
    </SettingsSection>
  );
}
