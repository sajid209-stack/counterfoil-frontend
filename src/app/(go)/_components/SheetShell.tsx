"use client";

import { useId, useRef } from "react";
import { scrimClass, useDialogBehaviour } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * The shell of a till bottom sheet whose inside is its own (the payment sheet
 * and the booking sheet carry their own header, scroll area and ActionBar, so
 * the kit `Sheet` — which draws all of that itself — cannot hold them).
 *
 * It exists so those sheets owe the keyboard and the page exactly what every
 * other dialog does, in one place: `role="dialog"` + `aria-modal` + a name,
 * Escape to close, Tab kept inside, the page behind locked, focus moved in on
 * open and handed back on close, the shared scrim, and the Go sheet radius.
 *
 * Mount it only while open; the behaviour hook runs for as long as it is
 * mounted.
 */
export function SheetShell({
  onClose,
  label,
  labelledBy,
  className,
  frameClassName = "inset-0",
  children,
}: {
  onClose: () => void;
  /** The dialog's name, read out on open. Drawn as hidden text unless the sheet
   *  has a visible heading whose id is passed as `labelledBy`. */
  label: string;
  labelledBy?: string;
  /** Classes for the panel: its ground (`bg-sheet` or `bg-surface`), width, max height, layout. */
  className?: string;
  /** Where the overlay sits. Defaults to the whole screen; the booking sheet
   *  leaves the tablet's cart panel uncovered. */
  frameClassName?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const ownTitle = useId();
  useDialogBehaviour(true, panel, onClose, { initialFocus: "panel", captureEscape: true });
  return (
    <div className={cn("fixed z-50 flex flex-col justify-end", frameClassName)}>
      <div className={cn("go-sheet-scrim absolute inset-0", scrimClass)} onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy ?? ownTitle}
        tabIndex={-1}
        className={cn("go-sheet-panel relative z-10 rounded-t-sheet outline-none", className)}
      >
        {!labelledBy && <h2 id={ownTitle} className="sr-only">{label}</h2>}
        {children}
      </div>
    </div>
  );
}
