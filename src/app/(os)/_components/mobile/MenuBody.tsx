"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, ChevronRight, LogOut, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { PageStatePicker } from "@/components/screens";
import type { Location, Staff } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NAV_IDLE, NAV_PARENT_OF_SELECTED, NAV_SELECTED } from "@/components/ui/navStyles";
import { NAV_MAIN, NAV_SETTINGS, groupOf, isAt, type NavDestination } from "../nav";
import { NavBadge, useNavBadges, badgeCount } from "../navBadges";
import { IconTile, initialsOf } from "./shared";
import { setActiveLocation } from "@/lib/activeLocation";

/*
 * What the menu sheet holds — white cards on the paper ground, 12px apart
 * (docs/mobile.md §7, rule 2). Every destination is still here: the cards only
 * decide how they are grouped and how loudly.
 *
 *   Venue         one row; opens the venues right under it (a dropdown, v9)
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
              "flex h-12 min-w-0 flex-1 items-center gap-comfortable rounded-card pl-comfortable text-md transition-colors duration-quick",
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
              className="grid h-12 w-12 shrink-0 place-items-center rounded-card text-muted transition-colors duration-quick active:bg-nav-hover"
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
          <ul id={listId} hidden={!expanded}>
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
                      "ml-9 flex h-11 items-center rounded-card px-comfortable text-md transition-colors duration-quick",
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
    <div className="flex flex-col gap-section px-gutter pb-section">
      {/* The venue first: it qualifies every list behind this sheet. Switching
          is a dropdown in place (v9), not a second sheet over this one: the
          choice is two or three names, and a popup over a popup loses where
          you were. The venues open right under the row, indented like a
          parent's pages; choosing one applies at once and folds the list. */}
      <section>
        {many ? (
          <>
            <button
              type="button"
              onClick={() => setVenuesOpen(!venuesOpen)}
              aria-expanded={venuesOpen}
              aria-controls={`${baseId}-venues`}
              data-menu-venue
              className="flex h-12 w-full items-center gap-comfortable rounded-card px-comfortable text-start transition-colors duration-quick active:bg-nav-hover"
            >
              <VenueRowBody name={data.location?.name} expanded={venuesOpen} />
            </button>
            {/* The venues as one contained list (v10): a card under the row, rows
                split by hairlines, each led by the venue's initials so three
                names read as three places rather than three lines of text. The
                one you are on is ink-tiled, bold and ticked; a venue that has
                stopped selling carries a quiet pill instead of a second line. */}
            <ul
              id={`${baseId}-venues`}
              hidden={!venuesOpen}
              aria-label={t("venueChoose")}
              data-menu-venues
              className="mt-tight divide-y divide-hairline overflow-hidden rounded-card border border-line bg-card dark:bg-surface"
            >
              {data.locations.map((l) => {
                const on = l.id === data.location?.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      aria-current={on ? "true" : undefined}
                      data-menu-venue-option={l.id}
                      onClick={() => {
                        setActiveLocation(l.id);
                        setVenuesOpen(false);
                      }}
                      className="flex h-14 w-full items-center gap-comfortable px-comfortable text-start transition-colors duration-quick active:bg-nav-hover"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-control text-xs font-semibold",
                          on ? "bg-inverse text-inverse-fg" : "bg-subtle text-muted",
                        )}
                      >
                        {initialsOf(l.name)}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-md", on ? "font-semibold text-fg" : "text-fg")}>{l.name}</span>
                      {l.status !== "active" && (
                        <span className="shrink-0 rounded-full bg-subtle px-tight py-0.5 text-xs font-medium text-muted">{t("venueNotSelling")}</span>
                      )}
                      {on && <Check size={18} strokeWidth={2.25} aria-hidden className="shrink-0 text-brand-foreground" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="flex h-12 w-full items-center gap-comfortable px-comfortable">
            <VenueRowBody name={data.location?.name} />
          </div>
        )}
      </section>

      <nav aria-label={t("main")} className="">
        <ul className="flex flex-col">{NAV_MAIN.map(parentRow)}</ul>
      </nav>

      {/* Settings and Sign out are one group: both are about the account,
          not a page of the business. */}
      <section className="flex flex-col">
        <Link
          /* The phone's Settings is its own list of sections (docs/mobile.md §8);
             the desktop rail keeps going straight to the first section. */
          href="/settings"
          data-menu-item={NAV_SETTINGS.key}
          aria-current={isAt(NAV_SETTINGS, pathname) ? "page" : undefined}
          data-autofocus={isAt(NAV_SETTINGS, pathname) ? "" : undefined}
          onClick={onClose}
          className={cn("flex h-12 items-center gap-comfortable rounded-card px-comfortable text-md transition-colors duration-quick", isAt(NAV_SETTINGS, pathname) ? NAV_SELECTED : NAV_IDLE)}
        >
          <IconTile icon={NAV_SETTINGS.icon} current={isAt(NAV_SETTINGS, pathname)} />
          <span className="min-w-0 flex-1 truncate">
            {t(NAV_SETTINGS.key)}
          </span>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
        </Link>

      {/* The way out of the account, last and quiet. Your profile is the round
          button at the foot of this sheet (and in every page's header); the
          appearance and the language live on it, not here. */}
      <Link
        href="/signed-out"
        data-menu-item="signOut"
        className="flex h-12 items-center gap-comfortable rounded-card px-comfortable text-md text-danger-soft-fg transition-colors duration-quick active:bg-nav-hover"
      >
        <IconTile icon={LogOut} danger />
        <span className="min-w-0 flex-1 truncate">{t("signOut")}</span>
      </Link>
      </section>

      {/* The page-state preview is a developer's tool, so it sits at the very
          foot, quiet: below every destination and the account, where nobody who
          came to do something reaches it by accident. */}
      <div className="px-comfortable">
        <PageStatePicker full />
      </div>
    </div>
  );
}


function VenueRowBody({ name, expanded }: { name: string | undefined; expanded?: boolean }) {
  const t = useTranslations("nav");
  return (
    <>
      <IconTile icon={MapPin} />
      <span className="shrink-0 text-md text-fg">{t("venue")}</span>
      <span className="min-w-0 flex-1 truncate text-end text-md text-muted">
        {name ?? <Skeleton className="ml-auto h-3.5 w-24" />}
      </span>
      {expanded !== undefined && (
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          aria-hidden
          className={cn("shrink-0 text-muted transition-transform duration-standard motion-reduce:transition-none", expanded && "rotate-180")}
        />
      )}
    </>
  );
}
