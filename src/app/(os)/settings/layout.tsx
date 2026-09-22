"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { SETTINGS_GROUPS, useResourceNoun } from "./_lib/nav";
import { useSettingsAttention } from "./_lib/attention";
import { BackToList, SettingsMenu, SettingsRail } from "./_components/SettingsNav";

/**
 * The settings frame.
 *
 * Settings opens straight onto its first section, Business profile —
 * `/settings` redirects there. It used to open on an index of every section,
 * which was a page to pass through: every section page linked back to it
 * ("All settings"), so moving from Tax to Payments below 1280px was two page
 * loads and a scroll through a list.
 *
 * Moving between sections is now one step at every width:
 *  • wide (xl): the grouped rail beside the page — the shape Stripe, Linear
 *    and GitHub use once settings outgrow a handful of tabs;
 *  • narrower: a Settings button above the page that opens the same list in
 *    place — a sheet on a phone, a panel beyond.
 *
 * A record (/settings/team/stf_nadia, /settings/roles/new) instead carries a
 * way back to its list, at every width: the list is where someone who opened
 * the record came from, and with the breadcrumb gone from settings it is the
 * only link back up.
 *
 * What the index flagged — cash only, a 0% reduced rate in use, a quiet
 * tablet, tickets reaching nobody — marks its section in both lists.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("settings");
  const noun = useResourceNoun();
  const attention = useSettingsAttention();

  const parent = SETTINGS_GROUPS.flatMap((g) => g.items).find((item) => pathname.startsWith(`${item.href}/`));
  const back = parent && { href: parent.href, label: parent.key === "resources" && noun ? noun : t(`nav.items.${parent.key}.title`) };

  return (
    <div className="xl:flex">
      <SettingsRail pathname={pathname} noun={noun} attention={attention} />
      <div className="min-w-0 flex-1">
        <div className={cn("px-gutter pt-section", !back && "xl:hidden")}>
          {back ? <BackToList href={back.href} label={back.label} /> : <SettingsMenu pathname={pathname} noun={noun} attention={attention} />}
        </div>
        {children}
      </div>
    </div>
  );
}
