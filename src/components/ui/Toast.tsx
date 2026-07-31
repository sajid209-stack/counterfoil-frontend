"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface ToastAction {
  label: string; // "Undo"
  run: () => void;
}
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-success/30 text-success",
  error: "border-danger/30 text-danger",
  info: "border-info/30 text-info",
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
      setToasts((t) => [...t, { id, tone, message, action }]);
      setTimeout(() => remove(id), action ? 6000 : 4000);
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m, a) => push("success", m, a),
    error: (m, a) => push("error", m, a),
    info: (m, a) => push("info", m, a),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-section left-section z-[60] flex w-full max-w-sm flex-col gap-tight"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-tight rounded-sm border bg-card p-comfortable shadow-lg",
              TONE_STYLES[t.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{TONE_ICON[t.tone]}</span>
            <p className="flex-1 text-[13px] text-fg">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => { t.action!.run(); remove(t.id); }}
                className="shrink-0 text-[13px] font-medium text-ember underline-offset-4 hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-faint hover:text-fg"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>.");
  return ctx;
}
