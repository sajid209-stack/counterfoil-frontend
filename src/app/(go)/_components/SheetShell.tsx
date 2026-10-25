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
 *
 * On a desktop (the `rail:` variant — 1024px and wider, held landscape) a
 * bottom sheet is the wrong shape for a screen that is wider than it is tall,
 * so the shell changes form there and only there:
 *  - `drawer`  a panel docked to the right edge of the frame, full height,
 *              sliding in from the right — the booking sheets. The frame
 *              (`frameClassName`) leaves the sale panel uncovered so the sale
 *              stays in view while a booking is made.
 *  - `dialog`  a centred dialog over a scrim — the payment step.
 * Below that nothing changes: a phone and a tablet held upright keep the
 * bottom sheet.
 */
export function SheetShell({
  onClose,
  label,
  labelledBy,
  className,
  frameClassName = "inset-0",
  desktop,
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
  /** What the sheet becomes on a desktop. Omitted: it stays a bottom sheet. */
  desktop?: "drawer" | "dialog";
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const ownTitle = useId();
  useDialogBehaviour(true, panel, onClose, { initialFocus: "panel", captureEscape: true });
  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col justify-end",
        desktop === "drawer" && "rail:flex-row rail:items-stretch rail:justify-end",
        desktop === "dialog" && "rail:items-center rail:justify-center rail:p-major",
        frameClassName,
      )}
    >
      <div className={cn("go-sheet-scrim absolute inset-0", scrimClass)} onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy ?? ownTitle}
        tabIndex={-1}
        className={cn(
          "go-sheet-panel relative z-10 rounded-t-sheet outline-none",
          /* `go-sheet-panel` is unlayered CSS, so a utility cannot beat its
             animation — the desktop shapes name their own with `!`. The
             keyframes (sf-drawer-in, sf-fade-in) already exist for the
             storefront's sheet; reduced motion collapses their duration. */
          desktop === "drawer" && "rail:h-full rail:max-h-none rail:w-[32.5rem] rail:max-w-full rail:rounded-none rail:border-l rail:border-line rail:shadow-float rail:[animation-name:sf-drawer-in]!",
          desktop === "dialog" && "rail:max-h-[90dvh] rail:rounded-sheet rail:shadow-float rail:[animation-name:sf-fade-in]!",
          className,
        )}
      >
        {!labelledBy && <h2 id={ownTitle} className="sr-only">{label}</h2>}
        {children}
      </div>
    </div>
  );
}
