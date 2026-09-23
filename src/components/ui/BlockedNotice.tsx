"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** The POS refusal pattern: every blocked interaction names the reason AND the
 *  way forward. Paper surface, ember accent bar, auto-dismiss after 3s. */
export function BlockedNotice({
  message,
  action,
  onDismiss,
}: {
  message: string;
  /** The way past the refusal, when there is one. A held slot can be sold to
   *  the party it is held for, and saying so without offering it sends a
   *  cashier to another screen mid-queue. */
  action?: { label: string; onPress: () => void; busy?: boolean };
  onDismiss: () => void;
}) {
  useEffect(() => {
    // A notice that offers an action waits to be dealt with; one that only
    // states a fact gets out of the way on its own.
    if (action) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss, action]);

  return (
    <div className="flex items-start gap-tight rounded-go border border-line border-l-[3px] border-l-ember bg-card p-comfortable shadow-sm" role="status">
      <div className="flex flex-1 flex-col gap-tight">
        <p className="text-[13px] text-fg">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onPress}
            aria-busy={action.busy}
            /* A bordered secondary, not a filled one: the card already has an
               ember edge carrying the alarm, and a black button appears nowhere
               else at this till. */
            className="flex min-h-11 w-fit items-center rounded-go-sm border border-strong bg-card px-comfortable text-[13px] font-semibold text-fg active:bg-subtle"
          >
            {action.label}
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-m-tight flex h-11 w-11 shrink-0 items-center justify-center text-muted active:text-fg">
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
