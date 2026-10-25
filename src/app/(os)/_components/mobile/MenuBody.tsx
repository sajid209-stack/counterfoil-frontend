"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, ChevronDown, ChevronRight, LogOut, MapPin, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { SegmentedControl, Skeleton } from "@/components/ui";
import { PageStatePicker } from "@/components/screens";
import { LOCALE_COOKIE, LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/locale";
import type { Location, Staff } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NAV_MAIN, NAV_OPEN, NAV_SETTINGS, groupOf, isAt, type NavDestination } from "../nav";
import { NavBadge, useNavBadges } from "../navBadges";
import { IconTile, initialsOf } from "./shared";
import { VenueSheet } from "./VenueSheet";

/*
 * What the menu sheet holds — white cards on the paper ground, 12px apart
 * (docs/mobile.md §7, rule 2). Every destination is still here: the cards only
 * decide how they are grouped and how loudly.
 *
 *   Venue         one row → the venue picker
 *   Destinations  NAV_MAIN; a parent with pages has a separate chevron
 *   Other apps    NAV_OPEN as three tiles
 *   Settings      one row
 *   You           who is signed in, Appearance + Language, profile, sign out
 *   (foot)        the developer's page-state picker, quiet
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
  const appsId = useId();

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
    const count = d.badge ? badges[d.badge] : undefined;
    const expanded = open.has(d.key);
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
            className={cn(
              "flex min-h-12 min-w-0 flex-1 items-center gap-comfortable rounded-md pl-comfortable transition-colors duration-quick active:bg-nav-hover",
              kids.length > 0 ? "pr-tight" : "pr-comfortable",
            )}
          >
            <IconTile icon={d.icon} current={exact} />
            <span className={cn("min-w-0 flex-1 truncate text-md text-fg", (exact || parentOf) && "font-semibold")}>{t(d.key)}</span>
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
              className="grid h-12 w-11 shrink-0 place-items-center rounded-md text-fg-secondary transition-colors duration-quick active:bg-nav-hover"
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
          /* A 1px guide in the icon column, and children that start where the
             parent's label starts (12 pad + 32 tile + 12 gap = 56px). Hidden, not
             unmounted, so the chevron's aria-controls always names a real node. */
          <ul
            id={listId}
            hidden={!expanded}
            className="relative pb-1 before:absolute before:bottom-3 before:left-7 before:top-0 before:w-px before:bg-hairline"
          >
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
                      "ml-11 flex min-h-11 items-center rounded-sm px-comfortable text-md transition-colors duration-quick",
                      sel ? "bg-nav-selected font-semibold text-fg" : "text-muted active:bg-nav-hover",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{t(c.key)}</span>
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
    <div className="flex flex-col gap-comfortable px-gutter pb-4 pt-1">
      {/* The venue first: it qualifies every list behind this sheet. */}
      <section className="card-surface p-1.5">
        {many ? (
          <button
            type="button"
            onClick={() => setVenuesOpen(true)}
            aria-haspopup="dialog"
            data-menu-venue
            className="flex min-h-13 w-full items-center gap-comfortable rounded-md px-comfortable text-start transition-colors duration-quick active:bg-nav-hover"
          >
            <VenueRowBody name={data.location?.name} chevron />
          </button>
        ) : (
          <div className="flex min-h-13 w-full items-center gap-comfortable px-comfortable">
            <VenueRowBody name={data.location?.name} />
          </div>
        )}
      </section>

      <nav aria-label={t("main")} className="card-surface p-1.5">
        <ul className="flex flex-col">{NAV_MAIN.map(parentRow)}</ul>
      </nav>

      {/* The group's own heading, as the rail's "Other apps" — not collapsible
          here: the sheet is the whole map. */}
      <section aria-labelledby={appsId}>
        <p id={appsId} className="px-comfortable pb-1.5 text-xs font-medium text-muted">
          {t("otherApps")}
        </p>
        <ul className="card-surface grid grid-cols-3 gap-1 p-1.5">
          {NAV_OPEN.map((d) => (
            <li key={d.key} className="flex">
              <Link
                href={d.href}
                data-menu-item={d.key}
                onClick={onClose}
                className="flex min-h-20 w-full flex-col items-center gap-1.5 rounded-md px-1 py-comfortable text-center transition-colors duration-quick active:bg-nav-hover"
              >
                <IconTile icon={d.icon} />
                <AppLabel text={t(d.key)} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-surface p-1.5">
        <Link
          href={NAV_SETTINGS.href}
          data-menu-item={NAV_SETTINGS.key}
          aria-current={isAt(NAV_SETTINGS, pathname) ? "page" : undefined}
          data-autofocus={isAt(NAV_SETTINGS, pathname) ? "" : undefined}
          onClick={onClose}
          className="flex min-h-12 items-center gap-comfortable rounded-md px-comfortable transition-colors duration-quick active:bg-nav-hover"
        >
          <IconTile icon={NAV_SETTINGS.icon} current={isAt(NAV_SETTINGS, pathname)} />
          <span className={cn("min-w-0 flex-1 truncate text-md text-fg", isAt(NAV_SETTINGS, pathname) && "font-semibold")}>
            {t(NAV_SETTINGS.key)}
          </span>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
        </Link>
      </section>

      <YouCard me={data.me} role={data.role} onClose={onClose} />

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

/**
 * An app's name with its ↗ — the arrow is tied to the LAST word, so a name that
 * wraps ("Counterfoil Deck") never leaves the arrow alone on a line of its own.
 */
function AppLabel({ text }: { text: string }) {
  const at = text.lastIndexOf(" ");
  const lead = at > 0 ? text.slice(0, at + 1) : "";
  const last = at > 0 ? text.slice(at + 1) : text;
  return (
    <span className="text-sm leading-tight text-fg">
      {lead}
      <span className="whitespace-nowrap">
        {last}
        <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden className="ml-0.5 inline-block align-baseline text-muted" />
      </span>
    </span>
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

/**
 * Who is signed in, how it looks, what language, and the way out.
 *
 * Stripe's and Mercury's mobile apps keep account and preferences as one compact
 * block at the foot rather than a list of form fields, so Appearance and
 * Language are two small segmented controls side by side — the same preferences
 * Settings → Display & language and the till's settings switch, applied the same
 * way (next-themes for the theme; the locale cookie and a soft refresh for the
 * language), so the places agree.
 */
function YouCard({ me, role, onClose }: { me: Staff | undefined; role: string | undefined; onClose: () => void }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const appearanceId = useId();
  const languageId = useId();
  const { theme, setTheme } = useTheme();
  /* The stored theme only exists in the browser; nothing is marked until the
     client has read it, so the server never guesses a button into the wrong
     state (the same gate AppearancePicker uses). */
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const setLocale = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <section aria-label={t("account")} className="card-surface flex flex-col gap-section p-section">
      <div className="flex items-center gap-comfortable">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted-wash text-sm font-semibold text-fg ring-1 ring-inset ring-line"
        >
          {initialsOf(me?.name)}
        </span>
        <span className="min-w-0 flex-1">
          {me ? (
            <>
              <span className="block truncate text-md font-semibold leading-tight text-fg">{me.name}</span>
              <span className="mt-0.5 block truncate text-sm leading-tight text-muted">{role ?? me.email ?? ""}</span>
            </>
          ) : (
            <>
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="mt-1 h-3 w-16" />
            </>
          )}
        </span>
      </div>

      {/* Two across when they fit; stacked on the narrowest phones, where two
          controls in half a card would clip their options. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-comfortable">
        <div>
          <p id={appearanceId} className="pb-1 text-xs font-medium text-muted">
            {tCommon("appearance")}
          </p>
          <SegmentedControl
            fullWidth
            size="sm"
            value={ready ? (theme ?? "") : ""}
            onChange={setTheme}
            aria-labelledby={appearanceId}
            options={[
              { value: "light", label: null, icon: <Sun size={16} strokeWidth={1.75} aria-hidden />, ariaLabel: tCommon("light") },
              { value: "dark", label: null, icon: <Moon size={16} strokeWidth={1.75} aria-hidden />, ariaLabel: tCommon("dark") },
              { value: "system", label: null, icon: <Monitor size={16} strokeWidth={1.75} aria-hidden />, ariaLabel: tCommon("system") },
            ]}
          />
        </div>
        <div>
          <p id={languageId} className="pb-1 text-xs font-medium text-muted">
            {tCommon("language")}
          </p>
          <SegmentedControl
            fullWidth
            size="sm"
            value={locale}
            onChange={(l) => setLocale(l as Locale)}
            aria-labelledby={languageId}
            /* Each option is written in its own language, so a screen reader has
               to be told to pronounce "বাংলা" as Bangla. */
            options={LOCALES.map((l) => ({ value: l, label: <span lang={l}>{LOCALE_LABELS[l]}</span> }))}
          />
        </div>
      </div>

      <ul className="-mx-2.5 -mb-2.5 flex flex-col border-t border-hairline pt-1.5">
        <li>
          <Link
            href="/settings/profile"
            data-menu-item="myProfile"
            onClick={onClose}
            className="flex min-h-12 items-center gap-comfortable rounded-md px-comfortable transition-colors duration-quick active:bg-nav-hover"
          >
            <IconTile icon={UserRound} />
            <span className="min-w-0 flex-1 truncate text-md text-fg">{t("myProfile")}</span>
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
          </Link>
        </li>
        <li>
          <Link
            href="/sign-in"
            data-menu-item="signOut"
            className="flex min-h-12 items-center gap-comfortable rounded-md px-comfortable text-danger-soft-fg transition-colors duration-quick active:bg-nav-hover"
          >
            <IconTile icon={LogOut} danger />
            <span className="min-w-0 flex-1 truncate text-md">{t("signOut")}</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
