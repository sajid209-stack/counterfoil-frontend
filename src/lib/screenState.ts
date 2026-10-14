"use client";

import { useSyncExternalStore } from "react";

/**
 * Which STATE of the current screen is being shown — for previewing, not for
 * real data.
 *
 * Every screen in OS and POS has six faces: the live screen, its loading
 * skeleton, its empty state, an error, "not found" and "session expired". The
 * live data almost never shows the other five, so they rot unseen. The page-
 * state menu in the top bar (OS and POS, beside the venue / counter picker)
 * writes this value and both shells draw the chosen face in place of the
 * page, through the one screen registry (src/components/screens), so a
 * developer or designer can walk every page in every state without faking
 * data.
 *
 * Held per browser, like the venue. "live" is the default and the only value
 * that shows real data.
 */
export type ScreenState = "live" | "loading" | "empty" | "error" | "notFound" | "sessionExpired";

export const SCREEN_STATES: ScreenState[] = ["live", "loading", "empty", "error", "notFound", "sessionExpired"];

const KEY = "cf_screen_state";
export const SCREEN_STATE_EVENT = "cf-screen-state";

function stored(): ScreenState {
  try {
    const v = localStorage.getItem(KEY) as ScreenState | null;
    return v && SCREEN_STATES.includes(v) ? v : "live";
  } catch {
    return "live";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(SCREEN_STATE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SCREEN_STATE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The state being previewed. The server and the first client render say
 *  "live", so a preview never causes a hydration mismatch. */
export function useScreenState(): ScreenState {
  return useSyncExternalStore(subscribe, stored, () => "live");
}

export function setScreenState(s: ScreenState) {
  try {
    if (s === "live") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, s);
  } catch {
    // Blocked storage: the preview simply does not stick.
  }
  window.dispatchEvent(new Event(SCREEN_STATE_EVENT));
}
