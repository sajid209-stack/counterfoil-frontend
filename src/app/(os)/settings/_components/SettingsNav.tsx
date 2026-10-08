"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETTINGS_GROUPS, isCurrentSettingsHref, type SettingsItemKey } from "../_lib/nav";

type Attention = Partial<Record<SettingsItemKey, string>>;

interface ListProps {
  pathname: string;
  /** The operator's own word for their resources, when they agree on one. */
  noun: string | null;
  attention: Attention;
  /** Where the list is drawn. The column is the chrome beside the rail (md and
   *  up); the sheet is the phone's list. */
  variant: "column" | "sheet";
  /** Called when a section is chosen — the sheet closes behind it. */
  onNavigate?: () => void;
}

/**
 * The settings sections, grouped, with the one you are on marked.
 *
 * One list for two places. From md it is the SECOND chrome column that stands
 * beside the collapsed main rail while Settings is open (Shopify admin's
 * shape — `SettingsColumn` in the shell); on a phone it is the sheet the top
 * bar's back chevron opens. They read this, so a section added to the registry
 * appears in both and cannot be reachable from one and missing from the other.
 *
 * A section that needs a decision carries a dot — cash only, a 0% reduced rate
 * on bookings that use it, a tablet gone quiet, tickets that reach nobody. In
 * the column the reason is the row's tooltip and accessible name; the sheet has
 * room to say it in words under the name.
 *
 * Rows use the main rail's own language — 36px (44 under a coarse pointer), a
 * soft tint of the ink for the current one, no border or coloured bar — so the
 * two columns read as one piece of chrome, not as two systems.
 */
export function SettingsSectionList({ pathname, noun, attention, variant, onNavigate }: ListProps) {
  const t = useTranslations("settings");
  const sheet = variant === "sheet";
  return (
    <nav aria-label={t("nav.label")} className={cn("flex flex-col", sheet ? "pb-[max(env(safe-area-inset-bottom),0.5rem)]" : "gap-1")}>
      {SETTINGS_GROUPS.map((group, i) => (
        <div key={group.key} className={cn(sheet ? "py-inline" : i > 0 && "pt-3")}>
          {/* Sentence case, 12px, muted — a heading in the quiet voice the rest
              of the chrome speaks in, not the old tracked-out capitals. */}
          <p className={cn("pb-1 text-[12px] font-medium text-muted", sheet ? "px-card pt-tight" : "px-comfortable")}>
            {t(`nav.groups.${group.key}.title`)}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ key, href, icon: Icon }) => {
              const current = isCurrentSettingsHref(pathname, href);
              const reason = attention[key];
              const label = key === "resources" && noun ? noun : t(`nav.items.${key}.title`);
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    data-autofocus={sheet && current ? "" : undefined}
                    title={sheet ? undefined : reason}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-comfortable rounded-sm text-sm font-medium transition-colors duration-quick",
                      sheet
                        ? "mx-tight min-h-11 px-comfortable py-tight"
                        : "h-9 px-comfortable [@media(pointer:coarse)]:h-11",
                      current ? "bg-fg/[0.07] text-fg dark:bg-fg/[0.09]" : "text-muted hover:bg-fg/[0.04] hover:text-fg",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block", !sheet && "truncate")}>{label}</span>
                      {sheet && reason && (
                        <span className="mt-0.5 flex items-center gap-inline text-[12px] font-normal text-warning">
                          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                          {reason}
                        </span>
                      )}
                    </span>
                    {!sheet && reason && (
                      <>
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                        <span className="sr-only">{`: ${reason}`}</span>
                      </>
                    )}
                    {sheet && current && <Check size={16} strokeWidth={2} aria-hidden className="shrink-0 text-fg" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** A record's way back to the list it was opened from. */
export function BackToList({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-comfortable inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:min-h-9"
    >
      <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
      {label}
    </Link>
  );
}
