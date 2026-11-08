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
          "fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-sheet bg-card shadow-lg outline-none md:hidden dark:bg-surface",
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
  /** Drawn in the right-hand slot; the slot keeps its width without it so the title stays centred. */
  tile?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <div className="grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-tight px-gutter pb-comfortable pt-inline">
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-fg shadow-sm transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] active:bg-muted-wash"
      >
        <X size={18} strokeWidth={1.75} aria-hidden />
      </button>
      <div className="min-w-0 text-center">
        {/* ds-exception: 17px is the sheet title size in docs/mobile.md section 8; no step between md and lg */}
        <p className="line-clamp-2 break-words text-[17px] font-semibold leading-snug text-fg">{title}</p>
        {sub !== undefined && <div className="mt-0.5 truncate text-sm leading-tight text-muted">{sub}</div>}
      </div>
      <div className="justify-self-end">{tile}</div>
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
