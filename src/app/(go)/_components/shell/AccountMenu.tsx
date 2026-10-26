"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, CircleHelp, Palette, UserRound, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { TILLS, tillFor } from "@/lib/tills";

/**
 * The person at the foot of the sidebar, and everything that belongs to "me".
 *
 * One control in both shapes. Expanded, the whole person row (disc, name, role)
 * is the button, and the list opens upward over the foot. Folded to the icon
 * rail, the 44px disc itself is the button and the list opens to the right of
 * the rail. The generic row menu cannot do either: its trigger is a fixed
 * "⋯" button, which is what used to sit on top of the avatar when folded.
 *
 * It also carries the sales-screen choice (Cart / Scroll / Classic) as three
 * checked items, on a till route only: it is a review tool, not something a
 * cashier needs on the foot of every page, and a full segmented control there
 * was the loudest thing in the sidebar.
 *
 * The list is portalled and placed in viewport coordinates, as the page-state
 * flyout is: the sidebar clips nothing, but a menu opening past its edge should
 * not depend on that staying true.
 */
export function AccountMenu({
  name,
  role,
  iconOnly,
  onHelp,
}: {
  name: string;
  role: string | undefined;
  iconOnly: boolean;
  /** Opens the help dialog (Help lives here, not in the sidebar list). */
  onHelp: () => void;
}) {
  const t = useTranslations("nav");
  const tp = useTranslations("pos");
  const router = useRouter();
  const pathname = usePathname();
  const current = tillFor(pathname);
  const initial = name.trim().charAt(0).toUpperCase() || "•";
  const label = tp("shell.accountMenu");
  const who = role ? `${name} · ${role}` : name;

  const [at, setAt] = useState<{ left: number; bottom: number; minWidth: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const open = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    /* Beside the RAIL, not beside the 44px disc: the disc is centred in a 72px
       rail, so r.right + 8 would land the list on the rail's own edge. */
    const edge = button.current?.closest("[data-go-sidebar]")?.getBoundingClientRect().right ?? r.right;
    setAt(
      iconOnly
        ? { left: edge + 8, bottom: Math.max(8, window.innerHeight - r.bottom), minWidth: 240 }
        : { left: r.left, bottom: window.innerHeight - r.top + 8, minWidth: Math.max(r.width, 232) },
    );
  };
  const close = (refocus = true) => {
    setAt(null);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!at) return;
    list.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!list.current?.contains(n) && !button.current?.contains(n)) setAt(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAt(null);
        button.current?.focus();
        return;
      }
      if (e.key === "Tab") {
        setAt(null);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const items = Array.from(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [at]);

  const choose = (go: () => void) => {
    close(false);
    go();
  };

  const itemClass =
    "flex h-11 w-full items-center gap-comfortable rounded-control px-comfortable text-left text-base text-fg transition-colors duration-quick hover:bg-nav-hover focus-visible:bg-nav-hover";

  const disc = (size: string) => (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-inverse text-md font-semibold text-inverse-fg", size)}>
      {initial}
    </span>
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!at}
        aria-label={`${label}: ${name}`}
        title={who}
        onClick={() => (at ? close(false) : open())}
        className={cn(
          "transition-colors duration-quick hover:bg-nav-hover",
          iconOnly
            ? "mx-auto grid size-11 place-items-center rounded-full"
            : "flex min-h-12 w-full items-center gap-comfortable rounded-control px-inline text-left",
          at && "bg-nav-hover",
        )}
      >
        {iconOnly ? (
          disc("size-9")
        ) : (
          <>
            {disc("size-9")}
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-base font-semibold text-fg">{name}</span>
              {role && <span className="truncate text-sm text-muted">{role}</span>}
            </span>
            <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
          </>
        )}
      </button>

      {at &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            aria-orientation="vertical"
            style={{ left: at.left, bottom: at.bottom, minWidth: at.minWidth }}
            className="fixed z-50 max-w-72 rounded-card border border-line bg-card p-inline shadow-float"
          >
            <p className="truncate px-comfortable pb-inline pt-inline text-sm text-muted">{who}</p>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => choose(() => router.push("/profile"))} className={itemClass}>
              <UserRound size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              {t("myProfile")}
            </button>
            <button type="button" role="menuitem" tabIndex={-1} onClick={() => choose(() => router.push("/login"))} className={itemClass}>
              <Users size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
              {t("switchUser")}
            </button>

            {current && (
              <div role="group" aria-label={t("tillDesign")} className="mt-inline border-t border-hairline pt-inline">
                <p className="px-comfortable pb-inline pt-inline text-sm text-muted">{t("tillDesign")}</p>
                {TILLS.filter((x) => x.ready).map((x) => {
                  const on = x.id === current.id;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={on}
                      tabIndex={-1}
                      onClick={() => choose(() => !on && router.push(x.href))}
                      className={cn(itemClass, on && "font-semibold")}
                    >
                      <span aria-hidden className="w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{x.name}</span>
                      {on && <Check size={16} strokeWidth={2.25} aria-hidden className="shrink-0 text-brand-foreground" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-inline border-t border-hairline pt-inline">
              <button type="button" role="menuitem" tabIndex={-1} aria-haspopup="dialog" onClick={() => choose(onHelp)} className={itemClass}>
                <CircleHelp size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                {t("help")}
              </button>
              <button type="button" role="menuitem" tabIndex={-1} onClick={() => choose(() => router.push("/design-system?product=go"))} className={itemClass}>
                <Palette size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                {t("designSystem")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
