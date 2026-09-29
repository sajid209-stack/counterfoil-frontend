"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

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
  className?: string;
  /** From md up, a drawer on the right rather than a sheet from the bottom —
   *  for a detail read beside a list, where a sheet would cover the list. */
  side?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  /* How far it has been dragged, so the sheet follows the finger. Held in
     state rather than written to the node, because it is the thing the render
     is about. */
  const [drag, setDrag] = useState(0);
  const from = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    /* No reset needed, and one here would be a setState in an effect: `end`
       always puts the offset back before it closes, so a closed sheet is
       already at zero. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    /* Capture, so Escape closes this sheet rather than a dialog behind it. */
    document.addEventListener("keydown", onKey, true);
    /* The page must not scroll under an open sheet — on a phone that is how a
       sheet ends up floating over content nobody asked to move. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      cancelAnimationFrame(id);
      restore.current?.focus?.();
    };
  }, [open, onClose]);

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
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-md border border-line bg-card shadow-xl",
          // Rises from the edge it belongs to. `backwards`, so no transform is
          // left behind to create a containing block; the global
          // reduced-motion block neutralises it.
          !drag && "animate-[sheet-up_220ms_cubic-bezier(0.32,0.72,0,1)_backwards]",
          side && "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-tr-none md:rounded-bl-md",
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
          className={cn("flex cursor-grab touch-none justify-center pb-inline pt-tight active:cursor-grabbing", side && "md:invisible")}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="flex items-start justify-between gap-tight border-b border-hairline pb-tight pl-card pr-tight">
          <div className="min-w-0 flex-1">
            {lead}
            <p className="truncate text-sm font-semibold text-fg">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mt-inline flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:text-fg active:bg-muted-wash"
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
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
