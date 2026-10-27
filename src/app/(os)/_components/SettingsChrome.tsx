"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, getStaff, listLocations, listRoles } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { cn } from "@/lib/cn";
import { NAV_IDLE, NAV_SELECTED } from "@/components/ui/navStyles";
import { SettingsSectionList } from "../settings/_components/SettingsNav";
import { useResourceNoun } from "../settings/_lib/nav";
import { useSettingsAttention } from "../settings/_lib/attention";
import { BusinessTile, PhoneSheet, PhoneSheetHead } from "./mobile/PhoneSheet";
import { SettingsSheetList } from "./mobile/SettingsSheetList";
import { initialsOf } from "./mobile/shared";

/** Where the last page outside Settings was — written by the shell, read here. */
export const LAST_APP_KEY = "cf_last_app";

const subscribeNothing = () => () => {};
const readLastApp = () => {
  try {
    return sessionStorage.getItem(LAST_APP_KEY) || "/dashboard";
  } catch {
    return "/dashboard";
  }
};

/**
 * The Settings chrome — Shopify admin's shape.
 *
 * While any /settings/* page is open, the main rail folds to its 64px icon
 * column (without touching the person's saved preference — see `Sidebar`'s
 * `locked`) and THIS column stands beside it: a second piece of chrome, white
 * like the rail and the bar, with no line between any of them.
 *
 *  - the way out: "‹ Settings", back to the last page that was not Settings
 *    (the dashboard when there was none — a new tab opened straight onto Tax);
 *  - whose business this is: an initials tile, the name, how many venues;
 *  - the sections, grouped, with attention dots and the current one drawn the
 *    way the rail draws its current page (navStyles);
 *  - who is signed in, at the foot — name and role — linking to My profile.
 *
 * It scrolls on its own and draws no scrollbar. The page beside it is just the
 * page; nothing about settings navigation is inside the frame any more.
 *
 * Below md there is no room for a second column. The phone's top bar carries a
 * back chevron that opens the same list as a sheet — rendered here too, so the
 * attention data is fetched once for both.
 */
export function SettingsChrome({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const noun = useResourceNoun();
  const attention = useSettingsAttention();
  const backTo = useSyncExternalStore(subscribeNothing, readLastApp, () => "/dashboard");

  const operatorQ = useApiQuery(() => getOperator(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const me = meQ.data;
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);

  const business = operatorQ.data?.name;
  const venues = locationsQ.data?.data.length;
  const role = me ? rolesQ.data?.data.find((r) => r.id === me.roleId)?.name : undefined;
  const profileCurrent = pathname === "/settings/profile";

  return (
    <>
      <aside
        data-settings-column
        aria-label={t("settingsSections")}
        className="hidden h-dvh w-[216px] shrink-0 flex-col bg-chrome text-fg md:sticky md:top-0 md:flex xl:w-[248px]"
      >
        {/* The way out. Same 56px as the bar and the rail's logo row, so the
            three line up across the top of the window. */}
        <div className="flex h-14 shrink-0 items-center px-comfortable">
          <Link
            href={backTo}
            data-settings-back
            aria-label={t("settingsExit")}
            className="-ml-tight inline-flex h-9 items-center gap-inline rounded-control pl-tight pr-comfortable text-md font-semibold text-fg transition-colors duration-quick hover:bg-muted-wash [@media(pointer:coarse)]:h-11"
          >
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden className="text-muted" />
            {t("settings")}
          </Link>
        </div>

        {/* No scrollbar, so the bottom 24px fades instead: with 17 sections the
            list is taller than a laptop, and a hard cut at the foot reads as the
            end of the list. The padding is the fade's room, so a list that fits
            is not dimmed at all. */}
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-comfortable pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]">
          {/* Whose business: a tile, the name, a quiet count. Not a control. */}
          <div className="flex items-center gap-comfortable px-comfortable pb-3 pt-1">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-fg text-sm font-semibold text-chrome"
            >
              {initialsOf(business)}
            </span>
            <span className="min-w-0 flex-1">
              {business ? (
                <span title={business} className="line-clamp-2 break-words text-base font-semibold leading-tight text-fg">{business}</span>
              ) : (
                <Skeleton className="h-3.5 w-28" />
              )}
              {venues !== undefined ? (
                <span className="mt-0.5 block truncate text-xs leading-tight text-muted">{t("venueCount", { count: venues })}</span>
              ) : (
                <Skeleton className="mt-1 h-3 w-16" />
              )}
            </span>
          </div>

          <SettingsSectionList pathname={pathname} noun={noun} attention={attention} variant="column" />
        </div>

        {/* Who is signed in — name and role, and the way to their own page. */}
        <Link
          href="/settings/profile"
          aria-label={me ? t("signedInAs", { name: me.name }) : undefined}
          aria-current={profileCurrent ? "page" : undefined}
          className={cn(
            "mx-comfortable mb-comfortable flex shrink-0 items-center gap-comfortable rounded-control px-comfortable py-tight transition-colors duration-quick [@media(pointer:coarse)]:min-h-11",
            profileCurrent ? NAV_SELECTED : NAV_IDLE,
          )}
        >
          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-subtle text-xs font-semibold text-fg ring-1 ring-line">
            {initialsOf(me?.name)}
          </span>
          <span className="min-w-0 flex-1">
            {me ? (
              <>
                <span className={cn("block truncate text-sm leading-tight", profileCurrent ? "font-semibold text-brand-foreground" : "font-medium text-fg")}>{me.name}</span>
                <span className="mt-0.5 block truncate text-xs leading-tight text-muted">{role ?? me.email ?? ""}</span>
              </>
            ) : (
              <>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </>
            )}
          </span>
        </Link>
        {/* The way out of the account, last and quiet: under the person it
            signs out, in the soft-danger text a destructive row uses. */}
        <Link
          href="/signed-out"
          data-settings-signout
          className="mx-comfortable -mt-tight mb-comfortable flex h-9 shrink-0 items-center gap-comfortable rounded-control px-comfortable text-sm font-medium text-danger-soft-fg transition-colors duration-quick hover:bg-danger-soft [@media(pointer:coarse)]:h-11"
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden className="ml-tight shrink-0" />
          {t("signOut")}
        </Link>
      </aside>

      {/* Phone: the same sections, as a sheet over the page — white cards on the
          paper ground, drawn like the menu (docs/mobile.md §7, rule 4). The
          dialog is named by what it is, "Settings sections". */}
      <PhoneSheet
        open={open}
        onClose={onClose}
        label={t("settingsSections")}
        className="max-h-[88dvh]"
        head={
          <PhoneSheetHead
            tile={<BusinessTile initials={initialsOf(business)} />}
            title={t("settings")}
            sub={business ?? <Skeleton className="h-3 w-28" />}
            onClose={onClose}
            closeLabel={tCommon("close")}
          />
        }
      >
        <SettingsSheetList pathname={pathname} noun={noun} attention={attention} onNavigate={onClose} />
      </PhoneSheet>
    </>
  );
}
