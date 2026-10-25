"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, Inbox, LoaderCircle, LockKeyhole, SearchX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { SCREEN_STATES, setScreenState, useScreenState, type ScreenState } from "@/lib/screenState";

const ICON: Record<ScreenState, typeof Eye> = {
  live: Eye,
  loading: LoaderCircle,
  empty: Inbox,
  error: TriangleAlert,
  notFound: SearchX,
  sessionExpired: LockKeyhole,
};

/**
 * The page-state picker for the 72px icon rail.
 *
 * `PageStatePicker` is a dropdown whose list is as wide as its button, which is
 * the right shape in a 248px sidebar and an unusable one in a 72px rail. This
 * is the same choice (the same store, the same six states, the same words) as
 * one icon button that opens a short list beside the rail, the way a folded
 * rail's other flyouts do. It turns amber while a preview runs, as the
 * dropdown does, so nobody mistakes a sample for real data.
 */
export function PageStateIconMenu() {
  const t = useTranslations("screens");
  const state = useScreenState();
  const Icon = ICON[state];
  const previewing = state !== "live";
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const label = t("states.label");

  const open = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    /* Seven rows at 44px plus the card's padding; keep it on a short window. */
    const est = SCREEN_STATES.length * 44 + 12 + 36;
    const edge = button.current?.closest("[data-go-sidebar]")?.getBoundingClientRect().right ?? r.right;
    setAt({ top: Math.max(8, Math.min(r.top, window.innerHeight - est - 8)), left: edge + 8 });
  };
  const close = (refocus = true) => {
    setAt(null);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!at) return;
    (list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>("button"))?.focus();
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
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(list.current?.querySelectorAll<HTMLElement>("button") ?? []);
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [at]);

  return (
    <>
      <button
        ref={button}
        type="button"
        title={`${label}: ${t(`states.${state}`)}`}
        aria-label={`${label}: ${t(`states.${state}`)}`}
        aria-haspopup="listbox"
        aria-expanded={!!at}
        data-page-state={state}
        onClick={() => (at ? close(false) : open())}
        className={cn(
          "mx-auto grid h-11 w-11 place-items-center rounded-control text-muted transition-colors duration-quick hover:bg-nav-hover hover:text-fg",
          previewing && "bg-warning-wash text-warning ring-2 ring-warning-line hover:bg-warning-wash hover:text-warning",
        )}
      >
        <Icon size={20} strokeWidth={1.5} aria-hidden />
      </button>
      {at &&
        createPortal(
          <div
            ref={list}
            role="listbox"
            aria-label={label}
            style={{ top: at.top, left: at.left }}
            className="fixed z-50 min-w-48 rounded-card border border-line bg-card p-inline shadow-float"
          >
            <p className="px-comfortable pb-inline pt-inline text-sm font-medium text-muted">{label}</p>
            {SCREEN_STATES.map((s) => {
              const Ic = ICON[s];
              const on = s === state;
              return (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    setScreenState(s);
                    close();
                  }}
                  className={cn(
                    "flex h-11 w-full items-center gap-comfortable rounded-control px-comfortable text-left text-base transition-colors duration-quick hover:bg-nav-hover",
                    on ? "font-semibold text-fg" : "text-fg-secondary",
                  )}
                >
                  <Ic size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{t(`states.${s}`)}</span>
                  {on && <Check size={16} strokeWidth={2.25} aria-hidden className="shrink-0 text-brand-foreground" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
