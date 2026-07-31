"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
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
    (tone: ToastTone, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, tone, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
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
              "pointer-events-auto flex items-start gap-tight rounded-sm border bg-white p-comfortable shadow-lg",
              TONE_STYLES[t.tone],
            )}
          >
            <span className="mt-0.5 shrink-0">{TONE_ICON[t.tone]}</span>
            <p className="flex-1 text-[13px] text-ink">{t.message}</p>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-neutral-400 hover:text-ink"
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
