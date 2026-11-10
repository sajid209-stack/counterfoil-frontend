"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { PageStatePicker } from "@/components/screens";
import type { Location, Staff } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NAV_IDLE, NAV_PARENT_OF_SELECTED, NAV_SELECTED } from "@/components/ui/navStyles";
import { NAV_MAIN, NAV_SETTINGS, groupOf, isAt, type NavDestination } from "../nav";
import { NavBadge, useNavBadges, badgeCount } from "../navBadges";
import { IconTile } from "./shared";
import { VenueSheet } from "./VenueSheet";

/*
 * What the menu sheet holds — white cards on the paper ground, 12px apart
 * (docs/mobile.md §7, rule 2). Every destination is still here: the cards only
 * decide how they are grouped and how loudly.
 *
 *   Venue         one row → the venue picker
 *   Destinations  NAV_MAIN; a parent with pages has a separate chevron
 *   Settings      one row
 *   Sign out      one row, danger text
 *   (end)         the developer's page-state picker, quiet
 *
 * Your profile (with Appearance and Language on it) is the pill in the sheet's
 * foot, beside the close button (MobileNav, v8).
 *
 * The sheet mounts this only while it is open, so the account queries are not
 * paid for on every page of every phone.
 */

export interface MenuData {
  locations: Location[];
  location: Location | undefined;
  me: Staff | undefined;
  role: string | undefined;
}

export function MenuBody({
  data,
  onClose,
  venuesOpen,
  setVenuesOpen,
}: {
  data: MenuData;
  onClose: () => void;
  venuesOpen: boolean;
  setVenuesOpen: (open: boolean) => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const badges = useNavBadges();
  const baseId = useId();

  /* Which groups are open. The group that holds the page you are on starts
     open; the chevron toggles the rest. The sheet remounts on every open, so
     this resets with it — a disclosure that remembered last time's mess would
     open on the wrong thing. */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const g = groupOf(pathname);
    return new Set(g ? [g.key] : []);
  });
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const many = data.locations.length > 1;

  const parentRow = (d: NavDestination) => {
    const exact = isAt(d, pathname);
    const kids = d.children ?? [];
    const parentOf = !exact && kids.some((c) => isAt(c, pathname));
    const expanded = open.has(d.key);
    const count = badgeCount(d, badges, expanded);
    const listId = `${baseId}-${d.key}`;
    return (
      <li key={d.key}>
        <div className="flex items-stretch">
          <Link
            href={d.href}
            data-menu-item={d.key}
            aria-current={exact ? "page" : undefined}
            /* Focus lands on the page you are on when the sheet opens, so a keyboard
               or screen-reader user starts inside the dialog, where they are. */
            data-autofocus={exact ? "" : undefined}
            onClick={onClose}
            /* The desktop rail's row (navStyles): the light fill and 600 on the
               page you are on, the parent of that page in ink and 600. */
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center gap-comfortable rounded-card pl-comfortable text-md transition-colors duration-quick",
              kids.length > 0 ? "pr-tight" : "pr-comfortable",
              exact ? NAV_SELECTED : parentOf ? NAV_PARENT_OF_SELECTED : NAV_IDLE,
            )}
          >
            <IconTile icon={d.icon} current={exact || parentOf} />
            <span className="min-w-0 flex-1 truncate">{t(d.key)}</span>
            <NavBadge count={count} />
            {count ? <span className="sr-only">{t("waiting", { count })}</span> : null}
          </Link>
          {kids.length > 0 && (
            <button
              type="button"
              onClick={() => toggle(d.key)}
              aria-expanded={expanded}
              aria-controls={listId}
              aria-label={t("showPages", { name: t(d.key) })}
              data-menu-expand={d.key}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-card text-muted transition-colors duration-quick active:bg-nav-hover"
            >
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                aria-hidden
                className={cn("transition-transform duration-standard motion-reduce:transition-none", expanded && "rotate-180")}
              />
            </button>
          )}
        </div>
        {kids.length > 0 && (
          /* Children start where the parent's label starts (12 pad + 24 icon + 12
             gap = 48px), as on the desktop rail; no guide line. Hidden, not
             unmounted, so the chevron's aria-controls always names a real node. */
          <ul id={listId} hidden={!expanded} className="pb-1">
            {kids.map((c) => {
              const sel = isAt(c, pathname);
              return (
                <li key={c.key}>
                  <Link
                    href={c.href}
                    data-menu-item={c.key}
                    aria-current={sel ? "page" : undefined}
                    data-autofocus={sel ? "" : undefined}
                    onClick={onClose}
                    className={cn(
                      "ml-9 flex min-h-11 items-center rounded-card px-comfortable text-md transition-colors duration-quick",
                      sel ? NAV_SELECTED : NAV_IDLE,
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{t(c.key)}</span>
                    <NavBadge count={c.badge ? badges[c.badge] : undefined} />
                    {c.badge && badges[c.badge] ? <span className="sr-only">{t("waiting", { count: badges[c.badge]! })}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-section px-gutter pb-4 pt-1">
      {/* The venue first: it qualifies every list behind this sheet. */}
      <section className="">
        {many ? (
          <button
            type="button"
            onClick={() => setVenuesOpen(true)}
            aria-haspopup="dialog"
            data-menu-venue
            className="flex min-h-11 w-full items-center gap-comfortable rounded-card px-comfortable text-start transition-colors duration-quick active:bg-nav-hover"
          >
            <VenueRowBody name={data.location?.name} chevron />
          </button>
        ) : (
          <div className="flex min-h-11 w-full items-center gap-comfortable px-comfortable">
            <VenueRowBody name={data.location?.name} />
          </div>
        )}
      </section>

      <nav aria-label={t("main")} className="">
        <ul className="flex flex-col">{NAV_MAIN.map(parentRow)}</ul>
      </nav>

      <section className="">
        <Link
          /* The phone's Settings is its own list of sections (docs/mobile.md §8);
             the desktop rail keeps going straight to the first section. */
          href="/settings"
          data-menu-item={NAV_SETTINGS.key}
          aria-current={isAt(NAV_SETTINGS, pathname) ? "page" : undefined}
          data-autofocus={isAt(NAV_SETTINGS, pathname) ? "" : undefined}
          onClick={onClose}
          className={cn("flex min-h-11 items-center gap-comfortable rounded-card px-comfortable text-md transition-colors duration-quick", isAt(NAV_SETTINGS, pathname) ? NAV_SELECTED : NAV_IDLE)}
        >
          <IconTile icon={NAV_SETTINGS.icon} current={isAt(NAV_SETTINGS, pathname)} />
          <span className="min-w-0 flex-1 truncate">
            {t(NAV_SETTINGS.key)}
          </span>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
        </Link>
      </section>

      {/* The way out of the account, last and quiet. Your profile is the round
          button at the foot of this sheet (and in every page's header); the
          appearance and the language live on it, not here. */}
      <Link
        href="/signed-out"
        data-menu-item="signOut"
        className="flex min-h-11 items-center gap-comfortable rounded-card px-comfortable text-md text-danger-soft-fg transition-colors duration-quick active:bg-nav-hover"
      >
        <IconTile icon={LogOut} danger />
        <span className="min-w-0 flex-1 truncate">{t("signOut")}</span>
      </Link>

      {/* The page-state preview is a developer's tool, so it sits at the very
          foot, quiet: below every destination and the account, where nobody who
          came to do something reaches it by accident. */}
      <div className="px-comfortable pb-1 pt-1">
        <PageStatePicker full />
      </div>

      {/* Inside the sheet's own DOM, not beside it: the sheet traps Tab by what is
          inside its panel, and a second dialog outside that panel would be
          fought over by two traps. */}
      <VenueSheet open={venuesOpen} onClose={() => setVenuesOpen(false)} />
    </div>
  );
}


function VenueRowBody({ name, chevron = false }: { name: string | undefined; chevron?: boolean }) {
  const t = useTranslations("nav");
  return (
    <>
      <IconTile icon={MapPin} />
      <span className="shrink-0 text-md text-fg">{t("venue")}</span>
      <span className="min-w-0 flex-1 truncate text-end text-md text-muted">
        {name ?? <Skeleton className="ml-auto h-3.5 w-24" />}
      </span>
      {chevron && <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />}
    </>
  );
}
