"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface ToastAction {
  /** Defaults to the translated "Undo". */
  label?: string;
  run: () => void;
}
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  /** How long it stays before dismissing itself, unless hovered or focused. */
  ms: number;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-success-line bg-success-wash text-success",
  error: "border-danger-line bg-danger-wash text-danger",
  info: "border-info-line bg-info-wash text-info",
};

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
  success: <CircleCheck size={18} strokeWidth={1.5} />,
  error: <CircleAlert size={18} strokeWidth={1.5} />,
  info: <Info size={18} strokeWidth={1.5} />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, action?: ToastAction) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, tone, message, action, ms: action ? 6000 : 4000 }]);
    },
    [],
  );

  const api: ToastApi = {
    success: (m, a) => push("success", m, a),
    error: (m, a) => push("error", m, a),
    info: (m, a) => push("info", m, a),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* TWO live regions, not one.
          Everything used to share a single `aria-live="polite"` region, so a
          failure announcement queued behind whatever success message was
          already speaking — and the one toast a user must not miss is the one
          that says their save did not land. Errors get `role="alert"`
          (assertive); confirmations get `role="status"` (polite). A region's
          politeness cannot be changed per-message after the fact, which is why
          this is two elements rather than one attribute. */}
      {/* ds-exception: toast layer z-60 clears an open dialog (z-50); the only z above the named layers */}
      <div className="pointer-events-none fixed inset-x-section top-19 z-[60] flex flex-col gap-tight md:inset-x-auto md:bottom-section md:left-section md:top-auto md:w-full md:max-w-sm">
        {([
          ["alert", toasts.filter((t) => t.tone === "error")],
          ["status", toasts.filter((t) => t.tone !== "error")],
        ] as const).map(([role, group]) => (
        <div key={role} role={role} className="flex flex-col gap-tight">
        {group.map((t) => (
          <ToastView key={t.id} toast={t} onRemove={remove} />
        ))}
        </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** One toast. Its auto-dismiss timer pauses while the pointer is over it or
 *  focus is inside it (WCAG 2.2.1: time limits the user can extend), and
 *  resumes with whatever time was left. */
function ToastView({ toast: t, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const tc = useTranslations("common");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const left = useRef(t.ms);
  const startedAt = useRef(0);

  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onRemove(t.id), left.current);
  }, [onRemove, t.id]);

  const pause = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    left.current = Math.max(1000, left.current - (Date.now() - startedAt.current));
  }, []);

  useEffect(() => {
    start();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [start]);

  return (
    <div
      onPointerEnter={pause}
      onPointerLeave={start}
      onFocus={pause}
      onBlur={(e) => {
        // Only resume when focus leaves the toast altogether.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) start();
      }}
      className={cn(
        "pointer-events-auto flex items-start gap-tight rounded-card border p-comfortable shadow-float",
        TONE_STYLES[t.tone],
      )}
    >
      <span className="mt-0.5 shrink-0">{TONE_ICON[t.tone]}</span>
      <p className="flex-1 text-sm text-fg">{t.message}</p>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action!.run();
            onRemove(t.id);
          }}
          className="shrink-0 text-sm font-medium text-brand-foreground underline-offset-4 hover:underline"
        >
          {t.action.label ?? tc("ui.undo")}
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(t.id)}
        aria-label={tc("ui.dismiss")}
        className="-m-tight flex h-11 w-11 shrink-0 items-center justify-center text-muted transition-colors duration-quick hover:text-fg"
      >
        <X size={16} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>.");
  return ctx;
}
