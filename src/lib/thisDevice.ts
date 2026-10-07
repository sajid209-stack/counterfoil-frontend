"use client";

import { useSyncExternalStore } from "react";
import { isPaired, type Device } from "@/lib/api";

/**
 * Which registered device THIS browser is.
 *
 * A tablet is paired once, by typing the code a manager got from Settings,
 * Devices. From then on the browser remembers which device it is, so the till's
 * sign-in can list the people allowed on this tablet — not just on the counter
 * it happens to be standing at.
 *
 * Held per browser, like the active counter, and for the same reason: it is a
 * stored id that is only ever read THROUGH the devices that exist. A device
 * that has since been removed in OS, or paired again on a different tablet,
 * simply stops resolving and the browser behaves as an unpaired one.
 */
const KEY = "cf_device";
export const DEVICE_EVENT = "cf-device";

function stored(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    // Storage can be blocked; the browser then acts as an unpaired tablet.
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(DEVICE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DEVICE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The stored device id — "" until this browser has been paired. */
export function useThisDeviceId(): string {
  return useSyncExternalStore(subscribe, stored, () => "");
}

export function setThisDevice(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // The pairing still applies to this render pass.
  }
  window.dispatchEvent(new Event(DEVICE_EVENT));
}

export function clearThisDevice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
  window.dispatchEvent(new Event(DEVICE_EVENT));
}

/**
 * Pure: the device a stored id resolves to — only if it still exists, is not
 * removed, and has really been paired. Anything else is "not paired".
 */
export function resolveThisDevice(devices: Device[], id: string): Device | undefined {
  if (!id) return undefined;
  const d = devices.find((x) => x.id === id);
  return d && d.status !== "archived" && isPaired(d) ? d : undefined;
}
