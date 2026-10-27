"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { SETTINGS_GROUPS, isCurrentSettingsHref, type SettingsItemKey } from "../../settings/_lib/nav";
import { IconTile } from "./shared";

/**
 * The phone's Settings sections — the same anatomy as the menu sheet
 * (docs/mobile.md §7, rule 4): each group is a white card of 48px rows on the
 * paper ground, every section has its 32px icon tile, and the one you are on is
 * an ink tile with a semibold name. A section that needs a decision keeps its
 * dot, and says why in words under the name — the phone has the room the
 * desktop column does not.
 *
 * It reads the same registry (`SETTINGS_GROUPS`) and the same attention map as
 * the desktop column's `SettingsSectionList`, so a section added there appears
 * here; only the drawing differs. The attributes the harnesses and assistive
 * tech rely on are unchanged: the nav is named by `settings.nav.label`, the
 * current link carries `aria-current="page"`, and it is the sheet's first focus
 * (`data-autofocus`).
 */
export function SettingsSheetList({
  pathname,
  noun,
  attention,
  onNavigate,
}: {
  pathname: string;
  /** The operator's own word for their resources, when they agree on one. */
  noun: string | null;
  attention: Partial<Record<SettingsItemKey, string>>;
  onNavigate: () => void;
}) {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  return (
    <nav
      aria-label={t("nav.label")}
      className="flex flex-col gap-comfortable px-gutter pt-1"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`settings-sheet-${group.key}`}>
          <p id={`settings-sheet-${group.key}`} className="px-comfortable pb-1.5 text-xs font-medium text-muted">
            {t(`nav.groups.${group.key}.title`)}
          </p>
          <ul className="card-surface flex flex-col p-1.5">
            {group.items.map(({ key, href, icon }) => {
              const current = isCurrentSettingsHref(pathname, href);
              const reason = attention[key];
              const label = key === "resources" && noun ? noun : t(`nav.items.${key}.title`);
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    data-autofocus={current ? "" : undefined}
                    onClick={onNavigate}
                    className="flex min-h-12 items-center gap-comfortable rounded-md px-comfortable py-1 transition-colors duration-quick active:bg-nav-hover"
                  >
                    <IconTile icon={icon} current={current} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-md text-fg", current && "font-semibold")}>{label}</span>
                      {reason && (
                        <span className="mt-0.5 flex items-center gap-inline text-xs text-warning">
                          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                          {reason}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {/* Last, on its own: the way out of the account. */}
      <ul className="card-surface flex flex-col p-1.5">
        <li>
          <Link
            href="/signed-out"
            data-settings-signout
            onClick={onNavigate}
            className="flex min-h-12 items-center gap-comfortable rounded-md px-comfortable py-1 text-md font-medium text-danger-soft-fg transition-colors duration-quick active:bg-danger-soft"
          >
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-danger-soft">
              <LogOut size={18} strokeWidth={1.75} />
            </span>
            {tNav("signOut")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
