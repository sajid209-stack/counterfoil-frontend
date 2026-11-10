"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listLocations, listRoles } from "@/lib/api";
import { useActiveLocation } from "@/lib/activeLocation";
import { DEMO_STAFF_ID } from "@/lib/session";
import { cn } from "@/lib/cn";
import { NAV_MAIN } from "./nav";
import { useWaitingTotal } from "./navBadges";
import { MenuBody } from "./mobile/MenuBody";
import { BusinessTile, PhoneSheet, PhoneSheetHead } from "./mobile/PhoneSheet";
import { initialsOf } from "./mobile/shared";

/**
 * The phone's way around (docs/mobile.md section 8, v8): a floating tab bar, and
 * the full-height sheet its More tab opens.
 *
 *     ( Home  Orders  Calendar  Catalog  More )
 *
 * The idea taken from the best phone apps is the floating bar — it sits above
 * the content as an object you hold, 12px off the floor, so the page runs under
 * it to the edge. The drawing is Counterfoil's:
 *
 *   - Every tab keeps its name under its icon (recognised faster than a glyph,
 *     and an operator opens this a few times a day, not all day).
 *   - The current tab sits in a soft ember bubble, the icon and the name in the
 *     brand's text colour: the product's accent marks "here", where a grey
 *     bubble would only mark "different".
 *   - A refund or write-off waiting puts a small ember count on Orders.
 *   - More opens the menu sheet; while it is open the sheet's own foot (your
 *     profile and a close button) takes this bar's place under the thumb.
 *
 * Every page reserves `--os-fab-clear` at its foot so the bar never covers a
 * last row.
 */
const DOCK_TABS = ["/dashboard", "/orders", "/calendar", "/catalog"] as const;
const tabOf = (href: string) => NAV_MAIN.find((d) => d.href === href)!;

const tabCls = (on: boolean) =>
  cn(
    "relative flex h-13 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition-colors duration-quick active:scale-95 motion-reduce:transition-none",
    on ? "bg-ember-wash font-semibold text-brand-foreground" : "font-medium text-muted active:text-fg",
  );

export function PhoneDock({ menuOpen, onOpenMenu }: { menuOpen: boolean; onOpenMenu: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const waiting = useWaitingTotal();
  return (
    <nav
      aria-label={t("dock")}
      data-phone-dock
      className="fixed inset-x-gutter bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-0.5 rounded-full border border-line bg-card/90 p-1 shadow-float backdrop-blur-md md:hidden dark:bg-surface/90"
    >
      {DOCK_TABS.map((href) => {
        const d = tabOf(href);
        const current = !menuOpen && (pathname === href || pathname.startsWith(`${href}/`));
        const count = href === "/orders" ? waiting : 0;
        const Icon = d.icon;
        return (
          <Link
            key={href}
            href={href}
            aria-label={count > 0 ? t("ordersWaiting", { count }) : undefined}
            aria-current={current ? "page" : undefined}
            data-dock-tab={d.key}
            data-waiting={count > 0 ? count : undefined}
            className={tabCls(current)}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={current ? 2 : 1.75} aria-hidden />
              {count > 0 && (
                <span
                  aria-hidden
                  data-menu-dot
                  className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember-solid px-1 text-xs font-semibold leading-none text-on-solid ring-2 ring-card"
                >
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
            <span className="max-w-full truncate px-0.5">{t(d.key)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onOpenMenu} aria-haspopup="dialog" aria-expanded={menuOpen} data-menu-button className={tabCls(menuOpen)}>
        <MoreHorizontal size={20} strokeWidth={menuOpen ? 2 : 1.75} aria-hidden />
        <span className="max-w-full truncate px-0.5">{t("more")}</span>
      </button>
    </nav>
  );
}

/**
 * The sheet. Mounted by the shell, but its body only exists while it is open,
 * so the account queries are not paid for on every page of every phone.
 */
export function MobileNav({ open, onClose, business }: { open: boolean; onClose: () => void; business?: string }) {
  if (!open) return null;
  return <MenuSurface onClose={onClose} business={business} />;
}

function MenuSurface({ onClose, business }: { onClose: () => void; business?: string }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [venuesOpen, setVenuesOpen] = useState(false);

  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = locationsQ.data?.data ?? [];
  const { location } = useActiveLocation(locations);
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const me = meQ.data;
  const role = me ? rolesQ.data?.data.find((r) => r.id === me.roleId)?.name : undefined;

  return (
    <PhoneSheet
      open
      /* Escape closes the top layer: the venue picker if it is up, else the menu. */
      onClose={() => (venuesOpen ? setVenuesOpen(false) : onClose())}
      label={t("menu")}
      /* Full height: the menu is a place you go, not a note over the page. */
      className="h-[calc(100dvh-0.5rem)]"
      head={
        <PhoneSheetHead
          tile={<BusinessTile initials={initialsOf(business)} />}
          title={business ?? "Counterfoil"}
          sub={locationsQ.data ? t("menuHeadSub", { count: locations.length }) : <Skeleton className="h-3 w-28" />}
        />
      }
      /* The foot, where the bar was under the thumb: you (your profile — the
         appearance and the language live there) and a round close. */
      foot={
        <>
          <Link
            href="/settings/profile"
            onClick={onClose}
            data-menu-item="myProfile"
            className="flex h-13 min-w-0 items-center gap-tight rounded-full border border-line bg-card pl-1.5 pr-section shadow-float transition-colors duration-quick active:bg-nav-hover dark:bg-surface"
          >
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-inverse text-sm font-semibold text-inverse-fg">
              {me ? initialsOf(me.name) : ""}
            </span>
            <span className="min-w-0 truncate text-md font-semibold text-fg">{me?.name ?? t("myProfile")}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            data-menu-close
            className="grid h-13 w-13 shrink-0 place-items-center rounded-full border border-line bg-card text-fg shadow-float transition-colors duration-quick active:bg-nav-hover dark:bg-surface"
          >
            <X size={22} strokeWidth={1.75} aria-hidden />
          </button>
        </>
      }
    >
      <MenuBody
        data={{ locations, location, me, role }}
        onClose={onClose}
        venuesOpen={venuesOpen}
        setVenuesOpen={setVenuesOpen}
      />
    </PhoneSheet>
  );
}
