"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
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
 * The phone's way around — a floating dock, and the full-height sheet its Menu
 * tab opens (docs/mobile.md section 8, rule 4).
 *
 * Shopify admin's phone app has the same shape: a round Search, then a pill of
 * icon tabs for the places used all day, so the primary destinations are always
 * one thumb-tap away in the natural thumb zone instead of behind a hamburger
 * (NN/g: hidden navigation cost phone users ~15% in speed). Everything else —
 * every other destination, the other apps, Settings, the account — is the last
 * tab, Menu.
 *
 *   ( Search )  [ Home  Orders  Calendar  Catalog  Menu ]
 *
 * It floats 12px above the safe area, centred, at most 420px wide with a 16px
 * margin each side; frosted (the card at 85% over a blur), a 1px line and the
 * soft float shadow. The pill is 56px tall (2px inside each 52px tab), so its
 * top is 68px up — exactly where the sticky save bars already sit — and every
 * page reserves `--os-fab-clear` at its foot so it never covers a last row.
 *
 * The current tab is a `nav-selected` pill behind an ink icon, the rest are
 * muted. Menu is the current one while its sheet is open. A refund or write-off
 * waiting at the venue is a small ink dot on Orders (where Refunds and
 * Write-offs live), and Orders' name carries the count.
 */
const DOCK_TABS = ["/dashboard", "/orders", "/calendar", "/catalog"] as const;
const tabOf = (href: string) => NAV_MAIN.find((d) => d.href === href)!;

const dockBtn =
  "relative flex h-13 w-13 min-w-0 shrink items-center justify-center rounded-full transition-colors duration-quick active:scale-95 motion-reduce:transition-none";

export function PhoneDock({ menuOpen, onOpenMenu, onOpenSearch }: { menuOpen: boolean; onOpenMenu: () => void; onOpenSearch: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const waiting = useWaitingTotal();
  const tone = (on: boolean) => (on ? "bg-nav-selected text-fg" : "text-muted hover:text-fg");
  return (
    <nav
      aria-label={t("dock")}
      data-phone-dock
      className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-30 flex w-[min(420px,calc(100%-32px))] -translate-x-1/2 items-center justify-center gap-tight md:hidden"
    >
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={t("search")}
        aria-haspopup="dialog"
        data-dock-search
        className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-line bg-card/85 text-fg shadow-float backdrop-blur-md transition-transform duration-quick active:scale-95 motion-reduce:transition-none"
      >
        <Search size={22} strokeWidth={1.5} aria-hidden />
      </button>
      <div className="flex min-w-0 shrink items-center rounded-full border border-line bg-card/85 p-0.5 shadow-float backdrop-blur-md">
        {DOCK_TABS.map((href) => {
          const d = tabOf(href);
          const current = pathname === href || pathname.startsWith(`${href}/`);
          const isOrders = href === "/orders";
          const count = isOrders ? waiting : 0;
          const Icon = d.icon;
          return (
            <Link
              key={href}
              href={href}
              aria-label={count > 0 ? t("ordersWaiting", { count }) : t(d.key)}
              aria-current={current ? "page" : undefined}
              data-dock-tab={d.key}
              data-waiting={count > 0 ? count : undefined}
              className={cn(dockBtn, tone(current && !menuOpen))}
            >
              <Icon size={22} strokeWidth={1.5} aria-hidden />
              {/* Something is waiting. Ink, not orange — orange means act, and this only
                  says there is something to look at; the ring cuts it out of the tab. */}
              {count > 0 && <span aria-hidden data-menu-dot className="absolute right-3 top-3 h-2 w-2 rounded-full bg-fg ring-2 ring-card" />}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t("menu")}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          data-menu-button
          className={cn(dockBtn, tone(menuOpen))}
        >
          <Menu size={22} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
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
