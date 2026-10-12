"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

/**
 * The one scrim recipe — Modal and Sheet both use it: the ink at 40% with a
 * 2px blur. Layering (docs/design-system.md §8): popovers z-40, a modal or
 * sheet (scrim and panel) z-50, toasts z-60.
 */
export const scrimClass = "bg-neutral-950/40 backdrop-blur-[2px]";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Several layers can be open at once (a confirm over a sheet), so the page's
   scroll lock is counted rather than saved and restored per layer — otherwise
   the inner layer closing would hand back "hidden" and unlock it too early, or
   the outer one would restore a stale value. */
let scrollLocks = 0;
let scrollBefore = "";
function lockBodyScroll() {
  if (scrollLocks++ === 0) {
    scrollBefore = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  return () => {
    if (--scrollLocks === 0) document.body.style.overflow = scrollBefore;
  };
}

/**
 * Everything a modal layer owes the keyboard and the page, in one place so
 * Modal and Sheet cannot drift:
 *  • Escape closes it;
 *  • Tab / Shift+Tab cycle inside the panel instead of leaving it;
 *  • the page behind does not scroll;
 *  • opening focus goes to `[data-autofocus]` if there is one, otherwise to
 *    the panel itself ("panel") or the first focusable element ("first");
 *  • closing hands focus back to whatever opened it.
 *
 * `onClose` is read through a ref, so a caller passing an inline function does
 * not re-run the effect (which would re-capture the "opener" from inside the
 * dialog and steal focus on every parent render).
 */
export function useDialogBehaviour(
  open: boolean,
  panel: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  opts: { initialFocus?: "panel" | "first"; captureEscape?: boolean } = {},
) {
  const { initialFocus = "panel", captureEscape = false } = opts;
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();

    const focusables = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Capture phase for a sheet, so Escape closes the top layer only.
        if (captureEscape) e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = !!panel.current?.contains(active);
      if (e.shiftKey && (active === first || !inside || active === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, captureEscape);

    const raf = requestAnimationFrame(() => {
      const el = panel.current;
      if (!el) return;
      const preferred = el.querySelector<HTMLElement>("[data-autofocus]");
      if (preferred) preferred.focus();
      else if (initialFocus === "first") (focusables()[0] ?? el).focus();
      else el.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey, captureEscape);
      cancelAnimationFrame(raf);
      unlock();
      /* Hand focus back to whatever opened this. If the opener has gone
         (a menu item that unmounted itself), put focus on <main> rather than
         leaving it on <body>, so the next Tab resumes in the content. */
      if (opener && document.contains(opener)) {
        opener.focus();
      } else if (document.activeElement === document.body) {
        const main = document.querySelector<HTMLElement>("main");
        if (main) {
          main.tabIndex = -1;
          main.focus();
        }
      }
    };
  }, [open, panel, initialFocus, captureEscape]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Accessible name of the × button. Defaults to the translated "Close". */
  closeLabel?: string;
}) {
  const t = useTranslations("common");
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useDialogBehaviour(open, panel, onClose);

  if (!open) return null;

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-section">
      <div className={cn("absolute inset-0", scrimClass)} onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          /* A solid sheet: the scrim already separates it from the page, and
             the level-3 shadow lifts it. Dark has no visible shadow on ink, so
             it keeps a line edge instead. */
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-sheet border border-transparent bg-card p-card shadow-lg outline-none",
          width,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel ?? t("ui.close")}
          className="absolute right-section top-section flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg"
        >
          <X size={18} strokeWidth={1.5} aria-hidden />
        </button>
        {/* pr-11: the close button is 44px wide, 16 from the edge, so a long
            title has to stop 60px in or it runs under the close button. */}
        {title && (
          <h2 id={titleId} className="type-h2 pr-11 text-lg">
            {title}
          </h2>
        )}
        {description && (
          <p id={descId} className="type-body mt-inline text-sm text-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-section">{children}</div>}
        {footer && <div className="mt-major flex justify-end gap-tight">{footer}</div>}
      </div>
    </div>
  );
}

/** Destructive-confirm variant — archive/delete flows. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loading = false,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  /** Defaults to the translated "Confirm". */
  confirmLabel?: string;
  /** Defaults to the translated "Cancel". */
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      footer={
        <>
          {/* Cancel takes opening focus, never the destructive action — a
              dialog that opens with Delete under the space bar is a dialog
              that deletes things by accident. */}
          <Button data-autofocus variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("ui.cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("ui.confirm")}
          </Button>
        </>
      }
    />
  );
}
