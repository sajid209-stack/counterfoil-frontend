"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { scrimClass, useDialogBehaviour } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * The phone's paper sheet — the menu and Settings' section list stand on it.
 *
 * The kit `Sheet` draws its own title row and a bare close glyph, which is the
 * right shape for a form's sheet and the wrong one here: these two open with a
 * HEAD (a tile, a name, a quiet line and a round close button) over white cards
 * on the paper ground, the way Linear, Notion and Shopify's drawers open on the
 * workspace. So this is the same dialog behaviour (`useDialogBehaviour`: focus
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
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name. */
  label: string;
  /** Drawn above the scrolling body — normally a `PhoneSheetHead`. */
  head: React.ReactNode;
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
      <div aria-hidden onClick={onClose} className={cn("fixed inset-0 z-50 md:hidden", scrimClass)} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-phone-sheet
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-sheet bg-surface shadow-lg outline-none md:hidden",
          // `backwards`, so no transform is left behind to create a containing
          // block; the global reduced-motion block neutralises it.
          !drag && "animate-[sheet-up_220ms_cubic-bezier(0.32,0.72,0,1)_backwards]",
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </>
  );
}

/**
 * A sheet's head: a 40px tile, a 16/600 name, a 13px quiet line and a round
 * close button. The disc is 40px; its button is 44px, so the thumb target holds
 * the floor without the disc growing past the spec.
 */
export function PhoneSheetHead({
  tile,
  title,
  sub,
  onClose,
  closeLabel,
}: {
  tile: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-comfortable px-gutter pb-comfortable pt-inline">
      {tile}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-md font-semibold leading-tight text-fg">{title}</p>
        {sub !== undefined && <div className="mt-0.5 truncate text-sm leading-tight text-muted">{sub}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full active:opacity-70"
      >
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-muted-wash text-fg-secondary">
          <X size={18} strokeWidth={1.75} />
        </span>
      </button>
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
