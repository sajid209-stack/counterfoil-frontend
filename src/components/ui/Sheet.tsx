"use client";

import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { scrimClass, useDialogBehaviour } from "./Modal";

/**
 * A sheet that rises from the bottom of a phone.
 *
 * There were three of these in the app — the settings section list, the
 * calendar's filters, and the More menu, which was not one at all but a
 * full-height panel dropped from the top — and three implementations of one
 * object drift. This is the one.
 *
 * It follows `modal-escape` (Apple HIG): a sheet must offer a clear way out and
 * dismiss on a downward swipe. So there are four — the close button, the
 * backdrop, Escape, and dragging the handle down — and the handle is drawn
 * because a sheet with no handle does not look draggable.
 *
 * On an OS phone (below md, inside the OS shell — `data-os-shell`) the frame is
 * Counterfoil's own (docs/mobile.md section 8, v6): the title on the left at
 * 18/600 where a left-to-right reader starts, an optional action, and the close
 * as a 40px soft square on the right — the same soft tile the menu's icons sit
 * on — with no rule under the head. Anywhere else — Go, the public pages, md
 * and up — the title row is what it always was. One DOM, restyled by the
 * `max-md:in-data-[os-shell]:` variants, so there is one close button either way.
 *
 * `wide` is where the same content belongs in a dropdown on a desktop: the
 * sheet stays a sheet on a phone and the caller positions the desktop copy.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  /** Drawn above the sheet's own title row — the account line on the More menu. */
  lead,
  action,
  className,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  lead?: React.ReactNode;
  /** An OS phone's top-right slot — a round 40px icon button. Not drawn anywhere else. */
  action?: React.ReactNode;
  className?: string;
  /** From md up, a drawer on the right rather than a sheet from the bottom —
   *  for a detail read beside a list, where a sheet would cover the list. */
  side?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  /* How far it has been dragged, so the sheet follows the finger. Held in
     state rather than written to the node, because it is the thing the render
     is about. */
  const [drag, setDrag] = useState(0);
  const from = useRef<number | null>(null);

  /* Focus trap (Tab / Shift+Tab cycle), Escape (captured, so it closes this
     sheet rather than a dialog behind it), body scroll lock, first-focusable on
     open, and focus restored to the opener on close — shared with Modal. No
     offset reset is needed here: `end` always puts the drag back before it
     closes, so a closed sheet is already at zero. */
  useDialogBehaviour(open, panel, onClose, { initialFocus: "first", captureEscape: true });

  if (!open) return null;

  const start = (y: number) => { from.current = y; };
  const move = (y: number) => {
    if (from.current === null) return;
    // Downward only: a sheet dragged up would just detach from the edge.
    setDrag(Math.max(0, y - from.current));
  };
  const end = () => {
    const d = drag;
    from.current = null;
    setDrag(0);
    // Far enough to read as a dismissal rather than a stray touch.
    if (d > 80) onClose();
  };

  return (
    <>
      <div aria-hidden onClick={onClose} className={cn("fixed inset-0 z-50", scrimClass)} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-sheet border border-transparent bg-card shadow-lg outline-none",
          // Rises from the edge it belongs to. `backwards`, so no transform is
          // left behind to create a containing block; the global
          // reduced-motion block neutralises it.
          !drag && "animate-[sheet-up_220ms_cubic-bezier(0.32,0.72,0,1)_backwards]",
          side && "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-t-none md:rounded-l-sheet",
          className,
        )}
      >
        {/* The handle, and the drag target. Generous, because a 4px bar is not
            something a thumb can find. */}
        <div
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start(e.clientY); }}
          onPointerMove={(e) => move(e.clientY)}
          onPointerUp={end}
          onPointerCancel={end}
          className={cn("flex cursor-grab touch-none justify-center pb-inline pt-tight active:cursor-grabbing rail:hidden", side && "md:invisible")}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-strong" />
        </div>

        <div
          data-sheet-head
          className="flex items-start justify-between gap-tight border-b border-hairline pb-tight pl-card pr-tight max-md:in-data-[os-shell]:grid max-md:in-data-[os-shell]:grid-cols-[minmax(0,1fr)_auto_2.5rem] max-md:in-data-[os-shell]:items-center max-md:in-data-[os-shell]:border-b-0 max-md:in-data-[os-shell]:px-gutter max-md:in-data-[os-shell]:pb-comfortable max-md:in-data-[os-shell]:pt-0"
        >
          {/* First in the DOM, so it is the first focus; on md and elsewhere it is
              ordered to the end, where it has always been. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="relative order-last -mt-inline flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash max-md:in-data-[os-shell]:order-none max-md:in-data-[os-shell]:col-start-3 max-md:in-data-[os-shell]:row-start-1 max-md:in-data-[os-shell]:mt-0 max-md:in-data-[os-shell]:h-10 max-md:in-data-[os-shell]:w-10 max-md:in-data-[os-shell]:rounded-card max-md:in-data-[os-shell]:bg-subtle max-md:in-data-[os-shell]:text-fg max-md:in-data-[os-shell]:before:absolute max-md:in-data-[os-shell]:before:-inset-0.5 max-md:in-data-[os-shell]:before:content-['']"
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <div className="min-w-0 flex-1 max-md:in-data-[os-shell]:col-start-1 max-md:in-data-[os-shell]:row-start-1">
            {lead}
            {/* Wraps to a second line rather than cutting: a sheet's title is often
                the name that tells two things apart ("…Walking Tour of Old
                Dhaka" against "…Walking Tour of Old Dhaka with Rooftop Iftar"). */}
            <p id={titleId} className="line-clamp-2 break-words text-base font-semibold text-fg max-md:in-data-[os-shell]:text-lg">{title}</p>
          </div>
          {action && (
            <div className="hidden max-md:in-data-[os-shell]:col-start-2 max-md:in-data-[os-shell]:row-start-1 max-md:in-data-[os-shell]:flex max-md:in-data-[os-shell]:justify-self-end">{action}</div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div
            className="flex items-center gap-tight border-t border-hairline p-card"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
          >
            {footer}
          </div>
        )}
        {/* With no footer the safe area still has to be cleared, or the last
            row sits under a home indicator. */}
        {!footer && <div aria-hidden style={{ height: "env(safe-area-inset-bottom)" }} />}
      </div>
    </>
  );
}
