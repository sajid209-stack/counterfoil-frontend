"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETTINGS_GROUPS, isCurrentSettingsHref, useResourceNoun } from "./_lib/nav";

/**
 * The settings frame.
 *
 * It was a horizontal strip of ten tabs over every settings page. At 1440 that
 * fit; at 1024 Security fell off the right edge, and on a phone six of the ten
 * sat beyond the screen with nothing to say they existed — reachable only by
 * someone who already knew to scroll a tab bar sideways.
 *
 * There is no strip at any width now:
 *  • wide (xl): a grouped rail beside the page — the shape Stripe, Linear and
 *    GitHub all move to once settings outgrow a handful of tabs;
 *  • narrower: the index IS the navigation and every page carries a way back to
 *    it, which is the drill-in pattern every phone settings app uses.
 *
 * The index draws no rail. Its grouped rows already are the list, with each
 * section's current value beside it, and the same names twice on one screen
 * was the old hub's mistake.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("settings");
  const noun = useResourceNoun();

  if (pathname === "/settings") return <>{children}</>;

  // A record (/settings/team/stf_nadia, /settings/roles/new) goes back to its
  // list rather than to the index two levels up — the list is where someone who
  // opened the record came from.
  const parent = SETTINGS_GROUPS.flatMap((g) => g.items).find((item) => pathname.startsWith(`${item.href}/`));
  const back = parent
    ? { href: parent.href, label: parent.key === "resources" && noun ? noun : t(`nav.items.${parent.key}.title`) }
    : { href: "/settings", label: t("nav.back") };

  return (
    <div className="xl:flex">
      {/* The nav stretches to the page's height so the list inside it can
          stick; a rail that scrolls away with the content is no rail.
          top-32 is the shortest OS bar (104px) plus the page's own 24px gap,
          so at rest the first link sits level with the first card whatever
          the bar's height, and once scrolled it still clears the tallest bar
          a settings page draws (125px). top-36 pushed it 16px low on every
          page whose header has no actions. */}
      <nav aria-label={t("nav.label")} className="hidden w-60 shrink-0 xl:block xl:pl-major xl:pt-major">
        <div className="sticky top-32 flex flex-col gap-section pb-major">
          <Link
            href="/settings"
            className="flex min-h-9 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg"
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
            {t("nav.back")}
          </Link>
          {SETTINGS_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="px-comfortable pb-inline font-mono text-[12px] uppercase tracking-wider text-muted">
                {t(`nav.groups.${group.key}.title`)}
              </p>
              <ul className="flex flex-col gap-px">
                {group.items.map(({ key, href, icon: Icon }) => {
                  const current = isCurrentSettingsHref(pathname, href);
                  return (
                    <li key={key}>
                      {/* The sidebar's own selected-row language — a flat
                          tonal fill — so the rail reads as a continuation of
                          the navigation beside it, not a second system. */}
                      <Link
                        href={href}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "flex min-h-9 items-center gap-comfortable rounded-sm px-comfortable py-tight text-sm font-medium transition-colors duration-quick",
                          current ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/60 hover:text-fg",
                        )}
                      >
                        <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0" />
                        <span className="min-w-0">{key === "resources" && noun ? noun : t(`nav.items.${key}.title`)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <div className="px-section pt-section sm:px-major xl:hidden">
          <Link
            href={back.href}
            className="-ml-comfortable inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9"
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
            {back.label}
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
