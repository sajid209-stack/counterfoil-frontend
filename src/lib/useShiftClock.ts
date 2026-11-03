"use client";

import { useSyncExternalStore } from "react";
import { DEMO_TODAY } from "@/lib/schedule";

/* How long the till's shift has been open. There is no shift record to read a
   start from yet, so the demo keeps one per browser per day: a shift that began a
   little over three hours before it was first seen. It runs on the real clock, so
   it moves while the page is open and across reloads. A real shift record replaces
   the stored start and nothing else. */
const KEY = "cf_shift_started";
const AS_FIRST_SEEN = 3 * 3_600_000 + 24 * 60_000;

/** Today's start of shift, kept here if storage is blocked. */
let fallback: number | null = null;

function startedAt(): number {
  const startOfDay = Date.parse(`${DEMO_TODAY}T00:00:00+06:00`);
  const invent = () => Math.max(startOfDay, Date.now() - AS_FIRST_SEEN);
  try {
    const saved = Number(localStorage.getItem(KEY));
    if (saved >= startOfDay) return saved;
    const at = invent();
    localStorage.setItem(KEY, String(at));
    return at;
  } catch {
    fallback ??= invent();
    return fallback;
  }
}

/** A shift opened just now, on the till's own Open shift screen. */
export function startShiftClock(): void {
  fallback = Date.now();
  try {
    localStorage.setItem(KEY, String(fallback));
  } catch {
    // The in-memory start above carries it for this page.
  }
}

function elapsed(): string {
  const minutes = Math.max(0, Math.floor((Date.now() - startedAt()) / 60_000));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

/** The shift's length as "h:mm". The server has no clock of the till's, so it draws nothing until hydrated. */
export const useShiftClock = (): string => useSyncExternalStore(subscribe, elapsed, () => "–:––");
