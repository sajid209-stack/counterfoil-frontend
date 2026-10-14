"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LogOut, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet, Skeleton } from "@/components/ui";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listRoles } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { cn } from "@/lib/cn";
import { NAV_IDLE, NAV_PARENT_OF_SELECTED, NAV_SELECTED, NAV_SELECTED_ICON } from "@/components/ui/navStyles";
import { PageStatePicker } from "@/components/screens";
import { LocationSwitcher } from "./LocationSwitcher";
import { NAV_MAIN, NAV_OPEN, NAV_SETTINGS, isAt, type NavDestination } from "./nav";

/**
 * The phone's way around — a round menu button at the bottom-left, and the
 * full-height sheet it opens.
 *
 * It replaces the old five-tab bar and its More sheet. Shopify admin's phone
 * app has the same shape: the top bar says where you are, and everything else
 * — every destination, the other apps, Settings, the account — is one thumb
 * reach away in a single sheet, rather than four favourite pages on a bar and
 * the rest behind a fifth button.
 *
 * The button is 56px, white (the chrome), lifted by a soft shadow, and sits 12px
 * off the corner plus the device's safe area, so a home indicator never covers
 * it. Its top is 68px up — exactly where the sticky save bars already sit — and
 * every page reserves `--os-fab-clear` at its foot, so it never covers a last
 * row either.
 *
 * It is on the LEFT because the right-hand side of a phone's bottom edge is
 * where a page's own floating action lands, and a thumb reaching for the menu
 * should not have to pass one.
 */
export function MenuButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("menu")}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-menu-button
      className={cn(
        "fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-[calc(12px+env(safe-area-inset-left))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-chrome text-fg transition-transform duration-quick active:scale-95 md:hidden",
        "shadow-float",
      )}
    >
      <Menu size={24} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/** Up to two letters for a disc: "Nadia Islam" → "NI". */
const initialsOf = (name: string | undefined) => {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "C";
  const first = (w: string) => Array.from(w)[0] ?? "";
  return (words.length > 1 ? first(words[0]) + first(words[1]) : Array.from(words[0]).slice(0, 2).join("")).toUpperCase();
};

/**
 * The sheet. Mounted by the shell, but its body only exists while it is open,
 * so the account queries are not paid for on every page of every phone.
 */
export function MobileNav({ open, onClose, business }: { open: boolean; onClose: () => void; business?: string }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("menu")}
      closeLabel={tCommon("close")}
      lead={business ? <p className="truncate text-xs text-muted">{business}</p> : undefined}
      /* Full height: the menu is a place you go, not a note over the page. The
         `!` is deliberate — `cn` does not merge conflicting utilities, so a
         plain max-h-none would be decided by stylesheet order against the
         sheet's own cap. */
      className="h-[calc(100dvh-0.5rem)] max-h-none! md:hidden"
    >
      <MenuBody onClose={onClose} />
    </Sheet>
  );
}

function MenuBody({ onClose }: { onClose: () => void }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const appearanceId = useId();
  const appsId = useId();
  const languageId = useId();

  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const me = meQ.data;
  const role = me ? rolesQ.data?.data.find((r) => r.id === me.roleId)?.name : undefined;

  /* One row, the rail's own states (NAV_*) at a thumb's height. A child is the
     rail's nested row: label only, indented to its parent's label (the row's
     padding, the 20px icon and the gap), and always listed — a sheet is the
     full map, where the rail shows children only for the page you are in. */
  const state = (selected: boolean, parentOf: boolean) =>
    selected ? NAV_SELECTED : parentOf ? NAV_PARENT_OF_SELECTED : cn("font-medium active:bg-secondary-hover", NAV_IDLE);

  const row = (d: NavDestination, leaves = false) => {
    const Icon = d.icon;
    const exact = isAt(d, pathname);
    const kids = d.children ?? [];
    const parentOf = !exact && kids.some((c) => isAt(c, pathname));
    return (
      <li key={d.key}>
        <Link
          href={d.href}
          data-menu-item={d.key}
          aria-current={exact ? "page" : undefined}
          /* Focus lands on the page you are on when the sheet opens, so a keyboard
             or screen-reader user starts inside the dialog, where they are. */
          data-autofocus={exact ? "" : undefined}
          onClick={onClose}
          className={cn(
            "flex h-12 items-center gap-section rounded-control px-comfortable text-md transition-colors duration-quick",
            state(exact, parentOf),
          )}
        >
          <Icon size={20} strokeWidth={1.5} aria-hidden className={cn("shrink-0", exact && NAV_SELECTED_ICON)} />
          <span className="min-w-0 flex-1 truncate">{t(d.key)}</span>
          {leaves && <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />}
        </Link>
        {kids.length > 0 && (
          <ul className="mt-0.5 flex flex-col gap-0.5">
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
                    style={{ paddingLeft: "calc(var(--spacing-comfortable) + 20px + var(--spacing-section))" }}
                    className={cn(
                      "flex h-11 items-center rounded-control pr-comfortable text-md transition-colors duration-quick",
                      state(sel, false),
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

  const hairline = <div aria-hidden className="mx-comfortable my-2 border-t border-hairline" />;

  return (
    <div className="flex flex-col px-tight pb-4 pt-tight">
      {/* The venue first: it qualifies every list behind this sheet. Draws
          nothing for an operator with one venue. */}
      <div className="px-comfortable empty:hidden">
        <LocationSwitcher full />
      </div>
      {/* The page-state preview, next to the venue: a lens on the whole shell. */}
      <div className="mt-2 px-comfortable">
        <PageStatePicker full />
      </div>

      <nav aria-label={t("main")} className="mt-2">
        <ul className="flex flex-col gap-0.5">{NAV_MAIN.map((d) => row(d))}</ul>
      </nav>

      {hairline}

      {/* The group's own heading, as the rail's "Other apps" — not collapsible
          here: the sheet is the whole map. */}
      <p id={appsId} className="px-comfortable pb-1 pt-1 text-sm font-medium text-muted">
        {t("otherApps")}
      </p>
      <ul aria-labelledby={appsId} className="flex flex-col gap-0.5">
        {NAV_OPEN.map((d) => row(d, true))}
      </ul>

      {hairline}

      <ul className="flex flex-col gap-0.5">{row(NAV_SETTINGS)}</ul>

      {hairline}

      {/* The account: who is signed in, how it looks, what language, and the
          way out. The two pickers are the same components Settings →
          Preferences renders, so the places agree by construction. */}
      <section aria-label={t("account")} className="flex flex-col gap-section px-comfortable pt-2">
        <div className="flex items-center gap-comfortable">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-subtle text-sm font-semibold text-fg ring-1 ring-line">
            {initialsOf(me?.name)}
          </span>
          <span className="min-w-0 flex-1">
            {me ? (
              <>
                <span className="block truncate text-base font-semibold leading-tight text-fg">{me.name}</span>
                <span className="mt-0.5 block truncate text-xs leading-tight text-muted">{role ?? me.email ?? ""}</span>
              </>
            ) : (
              <>
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-1 h-3 w-16" />
              </>
            )}
          </span>
          <Link
            href="/settings/profile"
            onClick={onClose}
            className="flex h-11 shrink-0 items-center rounded-control px-comfortable text-sm font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg"
          >
            {t("myProfile")}
          </Link>
        </div>

        <div>
          <p id={appearanceId} className="pb-1 text-xs font-medium text-muted">
            {tCommon("appearance")}
          </p>
          <AppearancePicker showLabel={false} labelledBy={appearanceId} />
        </div>

        <div>
          <p id={languageId} className="pb-1 text-xs font-medium text-muted">
            {tCommon("language")}
          </p>
          <LanguagePicker showLabel={false} labelledBy={languageId} />
        </div>

        <Link
          href="/sign-in"
          data-menu-item="signOut"
          className="flex h-12 items-center gap-section rounded-control px-comfortable text-md font-medium text-fg transition-colors duration-quick hover:bg-muted-wash active:bg-secondary-hover"
        >
          <LogOut size={20} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          {t("signOut")}
        </Link>
      </section>
    </div>
  );
}
