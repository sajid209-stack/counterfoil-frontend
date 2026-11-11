"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { scrimClass, useDialogBehaviour } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * The phone's sheet — the menu and Settings' section list stand on it: white
 * (dark: the paper, so the inset groups stay distinguishable).
 *
 * The kit `Sheet` draws its own title row and a bare close glyph, which is the
 * right shape for a form's sheet and the wrong one here: these two open with a
 * HEAD (a round close button, the name centred, the business tile) over inset
 * groups, the way Linear, Notion and Shopify's drawers open on the workspace. So this is the same dialog behaviour (`useDialogBehaviour`: focus
 * trap, Escape captured so it closes the top layer only, scroll lock, focus
 * restored) under a different face.
 *
 * It keeps the kit sheet's four ways out — the close button, the backdrop,
 * Escape and dragging the handle down — and its rise from the bottom edge.
 *
 * The dialog is named by `label`, not by the head: the head shows the business
 * (a name, not a purpose), and "Menu" is what a screen reader should announce.
 */
export function PhoneSheet({
  open,
  onClose,
  label,
  head,
  foot,
  closing = false,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name. */
  label: string;
  /** Drawn above the scrolling body — normally a `PhoneSheetHead`. */
  head: React.ReactNode;
  /** Floats over the bottom of the body, which fades out under it (the menu's
   *  profile and close buttons, in the thumb's reach). */
  foot?: React.ReactNode;
  /** The sheet is on its way out: it slides down and the backdrop fades while
   *  the owner waits `SHEET_EXIT_MS` before unmounting it. */
  closing?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  /* How far the handle has been dragged, so the sheet follows the finger. */
  const [drag, setDrag] = useState(0);
  const from = useRef<number | null>(null);

  useDialogBehaviour(open, panel, onClose, { initialFocus: "first", captureEscape: true });

  if (!open) return null;

  const end = () => {
    const d = drag;
    from.current = null;
    setDrag(0);
    // Far enough to read as a dismissal rather than a stray touch.
    if (d > 80) onClose();
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-standard ease-in md:hidden",
          scrimClass,
          closing ? "pointer-events-none opacity-0" : "animate-[go-scrim-in_280ms_ease-out_backwards]",
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-phone-sheet
        style={closing ? { transform: "translateY(100%)" } : drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-sheet bg-card shadow-lg outline-none md:hidden dark:bg-surface",
          /* In: a long, decelerating glide (360ms on the iOS sheet curve). Out:
             shorter and accelerating (200ms), the way Material 3 and iOS both
             time an exit, so dismissing never feels like waiting. The exit is
             a transition, so a sheet let go mid-drag carries on from where the
             finger left it rather than jumping back first. `backwards` leaves
             no transform behind to create a containing block. */
          closing
            ? "pointer-events-none transition-transform duration-standard ease-in"
            : !drag && "animate-[sheet-up_360ms_cubic-bezier(0.32,0.72,0,1)_backwards]",
          className,
        )}
      >
        <div
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            from.current = e.clientY;
          }}
          onPointerMove={(e) => {
            if (from.current !== null) setDrag(Math.max(0, e.clientY - from.current));
          }}
          onPointerUp={end}
          onPointerCancel={end}
          className="flex shrink-0 cursor-grab touch-none justify-center pb-inline pt-tight active:cursor-grabbing"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-strong" />
        </div>
        {head}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", foot ? "pb-28" : undefined)}>{children}</div>
        {foot && (
          /* The list fades out as it reaches the buttons, so they float over the
             end of it rather than sitting on a hard edge. */
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-card from-55% to-transparent pb-[calc(12px+env(safe-area-inset-bottom))] pt-12 dark:from-surface">
            {/* The buttons arrive a beat after the sheet, rising into place, and
                leave first. */}
            <div
              className={cn(
                "pointer-events-auto flex items-center justify-center gap-tight px-gutter transition-opacity duration-150",
                closing ? "opacity-0" : "animate-[menu-foot-in_300ms_cubic-bezier(0.32,0.72,0,1)_120ms_backwards]",
              )}
            >
              {foot}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** How long a closing sheet takes to leave; unmount it after this. */
export const SHEET_EXIT_MS = 200;

/**
 * A sheet's head, in the kit Sheet's frame (docs/mobile.md section 8, rule 7):
 * a 40px round close button at the top-left (1px line, soft shadow), the name
 * centred at 17/600 with a 13px quiet line under it, and an optional round
 * slot at the right — the business tile. The button's hit area is 44px, so the
 * floor holds without the disc growing past the spec. The close comes first in
 * the DOM, so it is the sheet's first focus and first tab stop.
 */
export function PhoneSheetHead({
  tile,
  title,
  sub,
  onClose,
  closeLabel,
}: {
  /** Drawn left of the title (the business tile). */
  tile?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Omit when the sheet closes from its foot instead (the menu). */
  onClose?: () => void;
  closeLabel?: string;
}) {
  /* Counterfoil's own head (docs/mobile.md section 8, v6): the business tile and
     its name on the left, read first; the close as a soft square on the right.
     The close stays first in the DOM (the sheet's first focus) and is ordered last. */
  return (
    <div className="flex shrink-0 items-center gap-comfortable px-gutter pb-comfortable pt-inline">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="order-last grid h-10 w-10 shrink-0 place-items-center rounded-card bg-subtle text-fg transition-colors duration-quick active:bg-muted-wash"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      )}
      {tile && <div className="shrink-0">{tile}</div>}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-lg font-semibold leading-snug text-fg">{title}</p>
        {sub !== undefined && <div className="mt-0.5 truncate text-sm leading-tight text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/** The business tile in a head: 40px, solid ink, the initials in knocked-out type. */
export function BusinessTile({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-inverse text-base font-semibold text-inverse-fg"
    >
      {initials}
    </span>
  );
}
