"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  /** Where focus was before the dialog opened, so it can be handed back. */
  const opener = useRef<HTMLElement | null>(null);

  const focusables = useCallback(
    () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement),
    [],
  );

  /* A dialog that does not trap focus is a dialog a keyboard user tabs
     straight out of, into the page behind it, with no way of knowing they
     have left. Escape closed it already; Tab did not stay inside, and focus
     never came back to the control that opened it. */
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      /* Hand focus back to whatever opened this. A menu item that unmounts
         itself is the case that breaks naive restore — ActionMenu refocuses
         its trigger before running the action for exactly this reason — but
         if the opener has gone anyway, put focus on <main> rather than
         leaving it on <body>, so the next Tab resumes in the content instead
         of at the very top of the page. */
      const back = opener.current;
      if (back && document.contains(back)) {
        back.focus();
      } else if (document.activeElement === document.body) {
        const main = document.querySelector<HTMLElement>("main");
        if (main) { main.tabIndex = -1; main.focus(); }
      }
    };
  }, [open, onClose, focusables]);

  /* Opening focus goes to the element carrying `data-autofocus` when there is
     one — the destructive confirm marks Cancel — and otherwise to the panel
     itself rather than to the first button, so a confirm dialog never opens
     with the destructive action already armed under the space bar. */
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const preferred = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
      (preferred ?? panel.current)?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-section"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-inverse/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          "glass relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-md p-section outline-none sm:p-major",
          width,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-section top-section flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle hover:text-fg"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
        {title && <h2 className="type-h2 pr-major text-lg">{title}</h2>}
        {description && (
          <p className="type-body mt-inline text-[13px] text-muted">
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
  confirmLabel = "Confirm",
  loading = false,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
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
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
