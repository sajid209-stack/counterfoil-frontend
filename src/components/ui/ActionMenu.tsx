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
          "flex items-center justify-center text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg",
          shape === "go" ? "h-11 w-11 rounded-full border border-line" : "h-11 w-11 rounded-sm md:h-8 md:w-8",
          open && "bg-subtle text-fg",
        )}
      >
        <MoreHorizontal size={shape === "go" ? 18 : 16} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "absolute right-0 z-30 min-w-[11rem] max-w-[17rem] border border-line bg-card py-inline shadow-lg",
            shape === "go" ? "rounded-go" : "rounded-md",
            up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              style={item.separated ? { borderTop: "1px solid var(--color-hairline)", marginTop: "4px", paddingTop: "8px" } : undefined}
              type="button"
              role="menuitem"
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
                "flex min-h-11 w-full items-center gap-tight px-comfortable py-tight text-left text-[13px] transition-colors duration-quick",
                shape === "default" && "md:min-h-9",
                item.disabled
                  ? "cursor-not-allowed text-muted"
                  : item.destructive
                    ? "text-danger hover:bg-danger/10"
                    : "text-fg hover:bg-subtle",
              )}
            >
              {item.icon}
              {item.hint ? (
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  <span className="mt-[2px] block text-[12px] leading-snug text-muted">{item.hint}</span>
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
