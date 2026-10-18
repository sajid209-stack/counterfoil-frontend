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
  /** A second line under the label — for a disabled item, why it is disabled. */
  hint?: string;
  /** Draw a rule above this item. A menu that mixes two kinds of action —
   *  ways to sell a slot, and taking the field itself out of service — reads
   *  as one undifferentiated list without it. */
  separated?: boolean;
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
 *
 * A disabled item can say why beneath its label. A greyed-out "Suspend" on your
 * own row reads as a fault; "You can't suspend your own account" reads as a rule.
 *
 * Keyboard: Enter/Space/ArrowDown on the trigger opens the menu with the FIRST
 * item focused (ArrowUp opens on the last); Up/Down move (wrapping, skipping
 * disabled items), Home/End jump, Tab closes, and Escape closes and returns
 * focus to the trigger. Use it for 3+ secondary actions on a row or a header;
 * one or two actions should just be buttons.
 */
export function ActionMenu({
  items,
  label,
  shape = "default",
}: {
  items: ActionMenuItem[];
  label: string;
  /** `go` is the till: round, and 44px at EVERY width, because Go is touch on
   *  a phone and on a counter tablet alike. The OS default keeps its denser
   *  desktop row. */
  shape?: "default" | "go";
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  /* Which end to land on when the menu opens: the first item for a click or
     ArrowDown, the last for ArrowUp. A ref, not state — it is only read by the
     effect that runs right after the open. */
  const landOn = useRef<"first" | "last">("first");
  const id = useId();

  const items$ = () =>
    Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  /* Move focus into the menu as it opens — a keyboard user who opened it has
     no other way to reach an item. */
  useEffect(() => {
    if (!open) return;
    const list = items$();
    (landOn.current === "last" ? list[list.length - 1] : list[0])?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openMenu = (from: "first" | "last") => {
    const r = trigger.current?.getBoundingClientRect();
    // Near the bottom of the window a menu that always drops downward
    // opens off the screen; the last rows of a full table are exactly
    // where these get used.
    if (r) setUp(r.bottom + 220 > window.innerHeight);
    landOn.current = from;
    setOpen(true);
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    const list = items$();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (at + 1) % list.length;
    else if (e.key === "ArrowUp") next = (at - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    if (next != null) {
      e.preventDefault();
      list[next]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    // The row navigates on click, so every event in here stops before it gets
    // there — opening a menu must not also open the record behind it.
    <div
      ref={wrap}
      className="relative flex justify-end"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        onMenuKey(e);
        e.stopPropagation();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openMenu("first"))}
        onKeyDown={(e) => {
          if (open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); openMenu("first"); }
          else if (e.key === "ArrowUp") { e.preventDefault(); openMenu("last"); }
        }}
        className={cn(
          "flex items-center justify-center text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg",
          shape === "go" ? "h-11 w-11 rounded-full border border-line" : "h-11 w-11 rounded-control max-sm:text-fg-secondary md:h-8 md:w-8",
          open && "bg-muted-wash text-fg",
        )}
      >
        <MoreHorizontal size={shape === "go" ? 18 : 16} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-orientation="vertical"
          aria-label={label}
          className={cn(
            "absolute right-0 z-30 min-w-[11rem] max-w-[17rem] border border-hairline bg-card py-inline shadow-lg",
            shape === "go" ? "rounded-go" : "rounded-card",
            up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              style={item.separated ? { borderTop: "1px solid var(--color-hairline)", marginTop: "4px", paddingTop: "8px" } : undefined}
              type="button"
              role="menuitem"
              tabIndex={-1}
              // Arrow-key focus is drawn inside the item: an outline outside it
              // would land on the neighbours of a tightly stacked menu.
              data-focus-inset=""
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                /* Hand focus back to the trigger BEFORE running the action.
                   Selecting an item unmounts it, which drops focus to <body>;
                   if the action opens a dialog, that dialog then records
                   <body> as the thing to restore focus to and a keyboard user
                   is returned to the top of the page when it closes. */
                trigger.current?.focus();
                item.onSelect();
              }}
              // 44px on a phone, where these are pressed with a thumb; the
              // desktop keeps the denser row.
              className={cn(
                "flex min-h-11 w-full items-center gap-tight px-comfortable py-tight text-left text-sm transition-colors duration-quick",
                shape === "default" && "md:min-h-9",
                item.disabled
                  ? "cursor-not-allowed text-muted"
                  : item.destructive
                    ? "text-danger hover:bg-danger-wash focus-visible:bg-danger-wash"
                    : "text-fg hover:bg-muted-wash focus-visible:bg-muted-wash",
              )}
            >
              {item.icon}
              {item.hint ? (
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{item.hint}</span>
                </span>
              ) : (
                item.label
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
