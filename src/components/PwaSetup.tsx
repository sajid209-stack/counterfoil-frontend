"use client";

import { useEffect } from "react";

// Registers the app-shell service worker (production only — it would fight
// HMR in dev). Safe to render anywhere once; renders nothing.
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort — the app works without it */
    });
  }, []);
  return null;
}
