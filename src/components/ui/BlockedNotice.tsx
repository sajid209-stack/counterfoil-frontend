"use client";

import { useEffect } from "react";
import { Notice } from "./Notice";

/** The POS refusal pattern: every blocked interaction names the reason AND the
 *  way forward. Rendered through Notice (warning tone by default, `danger` for
 *  a hard stop); auto-dismisses after 3s unless it offers an action. */
export function BlockedNotice({
  message,
  action,
  onDismiss,
  tone = "warning",
}: {
  message: string;
  /** The way past the refusal, when there is one. A held slot can be sold to
   *  the party it is held for, and saying so without offering it sends a
   *  cashier to another screen mid-queue. */
  action?: { label: string; onPress: () => void; busy?: boolean };
  onDismiss: () => void;
  tone?: "warning" | "danger";
}) {
  useEffect(() => {
    // A notice that offers an action waits to be dealt with; one that only
    // states a fact gets out of the way on its own.
    if (action) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss, action]);

  return (
    <Notice
      tone={tone}
      onDismiss={onDismiss}
      action={
        action
          ? { label: action.label, onClick: action.onPress, busy: action.busy, variant: "button" }
          : undefined
      }
    >
      {message}
    </Notice>
  );
}
