"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
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
 * The phone's way around (docs/mobile.md section 8, v6): a tab bar docked to the
 * foot of the screen, and the full-height sheet its More tab opens.
 *
 *   [ Home | Orders | Calendar | Catalog | More ]
 *
 * The principle is the one every good phone app shares — the places used all day
 * are always one thumb-tap away, never behind a hamburger (NN/g: hidden
 * navigation cost phone users ~15% in speed; Apple: 3–5 tab destinations) — but
 * the drawing is Counterfoil's own rather than a floating pill of bare glyphs:
 *
 *   - Every tab says its name under its icon. A label is recognised faster than
 *     a glyph and needs no learning; an operator opens this app a few times a
 *     day, not all day.
 *   - The current tab is marked the way Counterfoil marks "here" everywhere —
 *     the till's tab bar and the admin rail: a short ember bar on its top edge,
 *     the icon and the label in ink and semibold. Others are muted.
 *   - It is docked full width on the card colour with a hairline above it, so it
 *     reads as the floor of the app, not as an object over the content.
 *   - Something waiting at the venue (a refund or a write-off) is a small ember
 *     count on Orders, where Refunds and Write-offs live: orange because it asks
 *     for a decision.
 *   - Search is at the top of every page (the header's tool row), where a phone
 *     looks for it; More holds everything else — other destinations, the other
 *     apps, Settings and the account.
 *
 * The bar is 60px plus the safe area; every page reserves `--os-fab-clear` at its
 * foot so it never covers a last row.
 */
const DOCK_TABS = ["/dashboard", "/orders", "/calendar", "/catalog"] as const;
const tabOf = (href: string) => NAV_MAIN.find((d) => d.href === href)!;

const tabCls = (on: boolean) =>
  cn(
    "relative flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1 text-xs transition-colors duration-quick",
    /* "Here": the ember bar on the top edge (24px wide, 3px tall). */
    "before:absolute before:left-1/2 before:top-0 before:h-[3px] before:w-6 before:-translate-x-1/2 before:rounded-b-full before:content-['']",
    on ? "font-semibold text-fg before:bg-ember-solid" : "font-medium text-muted before:bg-transparent active:text-fg",
  );

export function PhoneDock({ menuOpen, onOpenMenu }: { menuOpen: boolean; onOpenMenu: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const waiting = useWaitingTotal();
  return (
    <nav
      aria-label={t("dock")}
      data-phone-dock
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:bg-surface/95"
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
            className={cn(tabCls(current), "h-15")}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={current ? 2 : 1.5} aria-hidden />
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
            <span className="max-w-full truncate px-1">{t(d.key)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        data-menu-button
        className={cn(tabCls(menuOpen), "h-15")}
      >
        <MoreHorizontal size={22} strokeWidth={menuOpen ? 2 : 1.5} aria-hidden />
        <span className="max-w-full truncate px-1">{t("more")}</span>
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
          onClose={onClose}
          closeLabel={tCommon("close")}
        />
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
