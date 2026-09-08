"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Archive and the like — drawn in danger, and expected to confirm. */
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * An overflow menu for actions that should not all be buttons.
 *
 * Written page-local for the bookings catalogue with a note that a second
 * screen would move it here. This is that second screen: an order carries five
 * things you can do to it, and a row of five equal buttons states no opinion
 * about which one you came for — while putting "Refund" and "Write off", both
 * of which move money, at the same weight as "Print receipt".
 *
 * It stops its own click and key events, so it is safe inside a table row that
 * navigates.
 */
export function ActionMenu({ items, label }: { items: ActionMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    // The row navigates on click, so every event in here stops before it gets
    // there — opening a menu must not also open the record behind it.
    <div
      ref={wrap}
      className="relative flex justify-end"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => {
          const r = trigger.current?.getBoundingClientRect();
          // Near the bottom of the window a menu that always drops downward
          // opens off the screen; the last rows of a full table are exactly
          // where these get used.
          if (r) setUp(r.bottom + 220 > window.innerHeight);
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg",
          open && "bg-subtle text-fg",
        )}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "absolute right-0 z-30 min-w-[11rem] rounded-md border border-line bg-card py-inline shadow-lg",
            up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-tight px-comfortable py-tight text-left text-[13px] transition-colors duration-quick",
                item.disabled
                  ? "cursor-not-allowed text-faint"
                  : item.destructive
                    ? "text-danger hover:bg-danger/10"
                    : "text-fg hover:bg-subtle",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
