"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** The POS refusal pattern: every blocked interaction names the reason AND the
 *  way forward. Paper surface, ember accent bar, auto-dismiss after 3s. */
export function BlockedNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="flex items-start gap-tight rounded-sm border border-line border-l-[3px] border-l-ember bg-card p-comfortable shadow-sm" role="status">
      <p className="flex-1 text-[13px] text-fg">{message}</p>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="shrink-0 text-faint active:text-fg">
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
