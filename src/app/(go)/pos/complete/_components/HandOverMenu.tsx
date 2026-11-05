"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { T } from "../../../_components/type";

/**
 * One way of handing a sale over (Print, or Send) as a single outlined button
 * that opens a short menu of the ways to do it. Two of these replace the six
 * tiles the page used to carry: the choice is made once in Till settings
 * ("After a sale"), and what is left here is the exception.
 *
 * A menu item that cannot be used says why under its name, instead of
 * disappearing.
 */
export interface HandOverItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** A second line: why it is unavailable, where it goes, or that it is done. */
  hint?: string;
  disabled?: boolean;
  /** Already done (sent): drawn with a success tick. */
  done?: boolean;
  onSelect: () => void;
}

export function HandOverMenu({
  label,
  icon,
  items,
  align = "left",
  className,
}: {
  label: string;
  icon: React.ReactNode;
  items: HandOverItem[];
  /** Which edge of the button the menu lines up with. */
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const enabled = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

  useEffect(() => {
    if (open) enabled()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    const r = trigger.current?.getBoundingClientRect();
    // Near the bottom of the window (a phone) the menu opens upward.
    if (r) setUp(r.bottom + 240 > window.innerHeight);
    setOpen(true);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    const list = enabled();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(at + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(at - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className="relative min-w-0" onKeyDown={onKey}>
      <Button
        ref={trigger}
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        icon={icon}
        onClick={toggle}
        className={cn("w-full rail:h-10 rail:w-auto rail:px-comfortable", className)}
      >
        {label}
        <ChevronDown size={16} strokeWidth={2} aria-hidden className="-mr-1 shrink-0 text-muted" />
      </Button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-30 min-w-60 max-w-80 rounded-card border border-hairline bg-card py-inline shadow-lg",
            align === "right" ? "right-0" : "left-0",
            up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              data-focus-inset=""
              onClick={() => {
                setOpen(false);
                // Focus goes back to the button before the action runs, so a dialog it opens restores to the button, not to the page top.
                trigger.current?.focus();
                item.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-start gap-tight px-comfortable py-tight text-left transition-colors duration-quick rail:min-h-10",
                item.disabled ? "cursor-not-allowed text-muted" : "text-fg hover:bg-muted-wash focus-visible:bg-muted-wash",
              )}
            >
              <span aria-hidden className="mt-0.5 flex shrink-0 [&_svg]:size-4">
                {item.done ? <Check className="text-success" /> : item.icon}
              </span>
              <span className="min-w-0">
                <span className={cn("block", T.body, item.disabled && "text-muted")}>{item.label}</span>
                {item.hint && <span className={cn("block", T.meta)}>{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
