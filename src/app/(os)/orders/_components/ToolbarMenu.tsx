"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ToolbarMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  /** Draw a rule above this item. */
  separated?: boolean;
  /** A list that opens in place under the item instead of running it — the
   *  Columns choice. The menu stays open while it is used, because choosing
   *  three columns is one visit and not three. */
  panel?: React.ReactNode;
}

/**
 * The "⋯" at the end of a list's toolbar: everything that is not one of its
 * two main actions.
 *
 * Shopify admin, Stripe and Linear all keep a list's toolbar to a handful of
 * controls and put the rest behind one overflow button, because a row of five
 * equal buttons states no opinion about which one somebody came for. This is
 * that button for the four list pages that share one toolbar.
 *
 * The panel is portalled and placed in viewport coordinates, as the app's other
 * floating lists are, so no card or scroller can clip it; it opens upward when
 * there is no room below.
 */
export function ToolbarMenu({ items, label }: { items: ToolbarMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = (focus = true) => {
    setOpen(false);
    setExpanded(null);
    if (focus) trigger.current?.focus();
  };

  /* Placement is a fact about a layout that has just happened, so it is written
     onto the node rather than held in state. Right edges line up with the
     button: it is the last thing on the row. */
  useLayoutEffect(() => {
    const el = panel.current;
    const tr = trigger.current;
    if (!open || !el || !tr) return;
    const place = () => {
      const pad = 8;
      const a = tr.getBoundingClientRect();
      el.style.top = "0px";
      el.style.left = "0px";
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      const x = Math.max(pad, Math.min(a.right - r.width, window.innerWidth - pad - r.width));
      const below = window.innerHeight - a.bottom;
      const flip = r.height + pad > below && a.top > below;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(flip ? Math.max(pad, a.top - r.height - 4) : a.bottom + 4)}px`;
      el.style.maxHeight = `${Math.round(Math.max(200, (flip ? a.top : below) - pad - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, expanded]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    const away = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!trigger.current?.contains(n) && !panel.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("keydown", esc, true);
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("keydown", esc, true);
      document.removeEventListener("mousedown", away);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line bg-card text-muted transition-colors duration-quick hover:text-fg md:h-9 md:w-9",
          open && "border-strong text-fg",
        )}
      >
        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            aria-label={label}
            className="fixed z-50 flex min-w-[12rem] max-w-[min(20rem,calc(100vw-1rem))] flex-col overflow-y-auto overscroll-contain rounded-md border border-line bg-card py-inline shadow-lg"
          >
            {items.map((item) => {
              const isOpen = expanded === item.key;
              return (
                <div key={item.key} className={cn(item.separated && "mt-inline border-t border-hairline pt-inline")}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    aria-expanded={item.panel ? isOpen : undefined}
                    onClick={() => {
                      if (item.panel) return setExpanded(isOpen ? null : item.key);
                      close();
                      item.onSelect?.();
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-tight px-comfortable text-left text-[0.8125rem] transition-colors duration-quick md:min-h-9",
                      item.disabled ? "cursor-not-allowed text-muted" : "text-fg hover:bg-muted-wash",
                    )}
                  >
                    {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.panel && <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", isOpen && "rotate-180")} />}
                  </button>
                  {item.panel && isOpen && <div className="max-h-64 overflow-y-auto overscroll-contain pb-inline">{item.panel}</div>}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
