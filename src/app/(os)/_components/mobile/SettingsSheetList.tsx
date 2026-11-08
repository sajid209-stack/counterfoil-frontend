"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { SETTINGS_GROUPS, isCurrentSettingsHref, type SettingsItemKey } from "../../settings/_lib/nav";

/**
 * The phone's Settings sections (docs/mobile.md §8): Shopify mobile's settings
 * anatomy — a small muted label over each group, the group one inset-grouped
 * card, every section a 56px row with its 22px outline icon, a 16px name and a
 * chevron. No tile behind the icon: settings is navigation, and a plain list is
 * the fastest thing to scan. The one you are on (when shown as a sheet) has a
 * semibold name. A section that needs a decision keeps its
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
  inPage = false,
}: {
  pathname: string;
  /** The operator's own word for their resources, when they agree on one. */
  noun: string | null;
  attention: Partial<Record<SettingsItemKey, string>>;
  onNavigate?: () => void;
  /** Drawn as the /settings page: the page already has its gutter, so no side padding of its own. */
  inPage?: boolean;
}) {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  return (
    <nav
      aria-label={t("nav.label")}
      className={cn("flex flex-col gap-comfortable", inPage ? "pb-section" : "px-gutter pt-1")}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`settings-sheet-${group.key}`}>
          <p id={`settings-sheet-${group.key}`} className="px-1 pb-tight text-sm font-medium text-muted">
            {t(`nav.groups.${group.key}.title`)}
          </p>
          <ul className="card-surface flex flex-col overflow-hidden">
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
                    className="relative flex min-h-14 items-center gap-comfortable px-section py-tight transition-colors duration-quick after:absolute after:bottom-0 after:left-13 after:right-0 after:h-px after:bg-hairline after:content-[''] active:bg-nav-hover [li:last-child>&]:after:hidden"
                  >
                    <Icon icon={icon} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-md text-fg", current && "font-semibold")}>{label}</span>
                      {reason && (
                        <span className="mt-0.5 flex items-center gap-inline text-xs text-warning">
                          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                          {reason}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {/* Last, on its own: the way out of the account. */}
      <ul className="card-surface flex flex-col overflow-hidden">
        <li>
          <Link
            href="/signed-out"
            data-settings-signout
            onClick={onNavigate}
            className="flex min-h-14 items-center gap-comfortable px-section py-tight text-md font-medium text-danger-soft-fg transition-colors duration-quick active:bg-danger-soft"
          >
            <LogOut size={22} strokeWidth={1.5} aria-hidden className="shrink-0" />
            {tNav("signOut")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** A section's glyph, plain: 22px outline in muted ink, in a 24px box so labels align. */
function Icon({ icon: I }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }> }) {
  return <I size={22} strokeWidth={1.5} aria-hidden className="shrink-0 text-fg-secondary" />;
}
