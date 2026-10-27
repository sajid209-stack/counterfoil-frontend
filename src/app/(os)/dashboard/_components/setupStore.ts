"use client";

import { useCallback, useSyncExternalStore } from "react";

/* The setup guide's own state, per browser: whether it is hidden or pinned open,
   and which steps were skipped. localStorage is an external store, so it is read
   with useSyncExternalStore (no setState in an effect), and written through
   `write`, which tells every subscriber in this tab. A new account clears it
   (see markFreshAccount in lib/api/client.ts). */
const KEY = "cf_setup_guide";
const EVENT = "cf-setup-guide";

export type GuideMode = "auto" | "hidden" | "shown";
export interface GuideState { mode: GuideMode; skipped: string[] }
const DEFAULT: GuideState = { mode: "auto", skipped: [] };

let cachedRaw: string | null = null;
let cached: GuideState = DEFAULT;

function read(): GuideState {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<GuideState>) : null;
    cached = v
      ? { mode: v.mode === "hidden" || v.mode === "shown" ? v.mode : "auto", skipped: Array.isArray(v.skipped) ? v.skipped.filter((k) => typeof k === "string") : [] }
      : DEFAULT;
  } catch {
    cached = DEFAULT;
  }
  return cached;
}

function write(next: GuideState) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSetupGuideState() {
  const state = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setMode = useCallback((mode: GuideMode) => write({ ...read(), mode }), []);
  const skip = useCallback((key: string) => {
    const s = read();
    if (!s.skipped.includes(key)) write({ ...s, skipped: [...s.skipped, key] });
  }, []);
  const unskip = useCallback((key: string) => {
    const s = read();
    write({ ...s, skipped: s.skipped.filter((k) => k !== key) });
  }, []);
  return { ...state, setMode, skip, unskip };
}
