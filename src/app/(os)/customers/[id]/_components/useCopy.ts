"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy a string to the clipboard, and say so for two seconds.
 *
 * The async clipboard API needs a secure context and a permission some
 * browsers refuse, so it falls back to a hidden textarea and `execCommand`
 * before giving up. `copied` is the id of whatever was last copied, so one
 * hook can serve a phone number and an e-mail address in the same card.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(async (id: string, text: string): Promise<boolean> => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    }
    return ok;
  }, []);

  return { copied, copy };
}
