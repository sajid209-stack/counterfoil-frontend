"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronLeft, PanelLeft, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETTINGS_GROUPS, isCurrentSettingsHref, type SettingsItemKey } from "../_lib/nav";

type Attention = Partial<Record<SettingsItemKey, string>>;

interface ListProps {
  pathname: string;
  /** The operator's own word for their resources, when they agree on one. */
  noun: string | null;
  attention: Attention;
}

/**
 * The settings rail, beside the page from xl.
 *
 * It is the whole of settings navigation on a wide screen: Settings opens
 * straight onto its first section, so there is no index page for a "back to
 * all settings" link to return to, and the rail no longer carries one.
 *
 * A section that needs a decision carries a dot — cash only, a 0% reduced rate
 * on bookings that use it, a tablet gone quiet, tickets that reach nobody. The
 * reason is its tooltip and its accessible name; the page behind it explains.
 */
export function SettingsRail({ pathname, noun, attention }: ListProps) {
  const t = useTranslations("settings");
  return (
    /* The nav stretches to the page's height so the list inside it can stick;
       a rail that scrolls away with the content is no rail. */
    <nav aria-label={t("nav.label")} className="hidden w-60 shrink-0 xl:block xl:pl-gutter xl:pt-gutter">
      {/* top-24 is the settings bar (74px, a title and a line of description)
          plus a 22px gap, so the first group sits where it rests rather than
          jumping when the page starts to scroll. */}
      <div className="sticky top-24 flex flex-col gap-section pb-major">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.key}>
            <p className="px-comfortable pb-inline font-mono text-[12px] uppercase tracking-wider text-muted">
              {t(`nav.groups.${group.key}.title`)}
            </p>
            <ul className="flex flex-col gap-px">
              {group.items.map(({ key, href, icon: Icon }) => {
                const current = isCurrentSettingsHref(pathname, href);
                const reason = attention[key];
                return (
                  <li key={key}>
                    {/* The sidebar's own selected-row language — a flat tonal
                        fill — so the rail reads as a continuation of the
                        navigation beside it, not a second system. */}
                    <Link
                      href={href}
                      aria-current={current ? "page" : undefined}
                      title={reason}
                      className={cn(
                        "flex min-h-9 items-center gap-comfortable rounded-sm px-comfortable py-tight text-sm font-medium transition-colors duration-quick",
                        current ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/60 hover:text-fg",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0" />
                      <span className="min-w-0 flex-1">{key === "resources" && noun ? noun : t(`nav.items.${key}.title`)}</span>
                      {reason && (
                        <>
                          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                          <span className="sr-only">{`: ${reason}`}</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/**
 * Settings navigation below xl, where there is no room for the rail beside
 * the page.
 *
 * It used to be a link back to an index of every section — a whole page to
 * pass through between Tax and Payments. Now the list opens where you are: a
 * sheet from the bottom on a phone, a panel under the button beyond, with the
 * section you are on ticked and anything needing a decision said in words.
 *
 * The button says "Settings" rather than the section's name, because the page
 * heading directly beneath it already says that, and on a phone so does the
 * bar above it.
 */
export function SettingsMenu({ pathname, noun, attention }: ListProps) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  /* Focus goes back to the button after closing — asked for through state so
     that closing never has to touch a ref during render. */
  const [refocus, setRefocus] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const needs = Object.keys(attention).length;

  const close = (back = true) => {
    setOpen(false);
    if (back) setRefocus((n) => n + 1);
  };

  useEffect(() => {
    if (refocus) btn.current?.focus();
  }, [refocus]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Land on the section you are on, so the list opens where you are in it.
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className="-ml-comfortable inline-flex min-h-11 items-center gap-tight rounded-sm px-comfortable text-sm font-medium text-fg transition-colors duration-quick hover:bg-subtle/60 md:min-h-9"
      >
        <PanelLeft size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
        {t("nav.menu")}
        {needs > 0 && (
          <>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span className="sr-only">{`, ${t("nav.needsAttention", { count: needs })}`}</span>
          </>
        )}
        <ChevronDown size={15} strokeWidth={1.5} aria-hidden className={cn("text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div aria-hidden onClick={() => close(false)} className="fixed inset-0 z-40 bg-ink/40 md:hidden" />
          <div
            id={panelId}
            className={cn(
              "z-50 flex flex-col overflow-hidden border border-line bg-card shadow-xl",
              // A sheet from the bottom on a phone; a panel under the button beyond.
              "fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-md",
              "md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-[calc(100%+6px)] md:max-h-[70vh] md:w-80 md:rounded-md",
            )}
          >
            <div className="flex items-center justify-between border-b border-hairline py-tight pl-card pr-tight md:hidden">
              <p className="text-sm font-semibold text-fg">{t("nav.menu")}</p>
              <button
                type="button"
                onClick={() => close()}
                aria-label={t("nav.close")}
                className="flex h-11 w-11 items-center justify-center rounded-sm text-muted hover:text-fg"
              >
                <X size={18} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <nav aria-label={t("nav.label")} className="min-h-0 flex-1 overflow-y-auto py-tight pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              {SETTINGS_GROUPS.map((group) => (
                <div key={group.key} className="py-inline">
                  <p className="px-card pb-inline pt-tight font-mono text-[12px] uppercase tracking-wider text-muted">
                    {t(`nav.groups.${group.key}.title`)}
                  </p>
                  <ul>
                    {group.items.map(({ key, href, icon: Icon }) => {
                      const current = isCurrentSettingsHref(pathname, href);
                      const reason = attention[key];
                      return (
                        <li key={key}>
                          <Link
                            href={href}
                            aria-current={current ? "page" : undefined}
                            onClick={() => close(false)}
                            className={cn(
                              "flex min-h-11 items-center gap-comfortable px-card py-tight text-sm transition-colors duration-quick",
                              current ? "bg-subtle font-medium text-fg" : "text-fg hover:bg-subtle/60",
                            )}
                          >
                            <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1">
                              <span className="block">{key === "resources" && noun ? noun : t(`nav.items.${key}.title`)}</span>
                              {reason && (
                                <span className="mt-0.5 flex items-center gap-inline text-[12px] text-warning">
                                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                                  {reason}
                                </span>
                              )}
                            </span>
                            {current && <Check size={16} strokeWidth={2} aria-hidden className="shrink-0 text-fg" />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

/** A record's way back to the list it was opened from. */
export function BackToList({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-comfortable inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9"
    >
      <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
      {label}
    </Link>
  );
}
