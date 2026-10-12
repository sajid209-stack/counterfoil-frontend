"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
import { PreviewStore } from "./Preview";
import { hexOf } from "./colour";

/**
 * Reads a token in LIGHT and in DARK at the same time.
 *
 * `Preview` shows one configuration at a time (whichever the top bar picks).
 * The Color System tables put both modes side by side, so they need two
 * stores that never move: one attached to an element carrying `.light`, one
 * to an element carrying `.dark`. Each class re-declares every mode token on
 * its own subtree, so `getComputedStyle` on it returns that mode's value —
 * straight from the running stylesheet, so a table can never disagree with
 * globals.css. The probes are visually hidden and `aria-hidden`.
 */

type Stores = { light: PreviewStore; dark: PreviewStore };
const Ctx = createContext<Stores | null>(null);

export type ProbeMode = "light" | "dark";

export function ModeProbes({ children }: { children: React.ReactNode }) {
  const [stores] = useState<Stores>(() => ({ light: new PreviewStore(), dark: new PreviewStore() }));
  const attachLight = useCallback((el: HTMLElement | null) => stores.light.attach(el), [stores]);
  const attachDark = useCallback((el: HTMLElement | null) => stores.dark.attach(el), [stores]);
  return (
    <Ctx.Provider value={stores}>
      <div aria-hidden className="sr-only">
        <span ref={attachLight} className="light" />
        <span ref={attachDark} className="dark" />
      </div>
      {children}
    </Ctx.Provider>
  );
}

const noopSubscribe = () => () => {};

/** A custom property's computed value in the given mode ("" until the client has taken over). */
export function useModeVar(name: string, mode: ProbeMode): string {
  const stores = useContext(Ctx);
  const store = stores?.[mode];
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.readVar(name) : ""),
    () => "",
  );
}

/** "#F94A00" for a token in a mode — "—" until it can be read. */
export function ModeHex({ name, mode, className }: { name: string; mode: ProbeMode; className?: string }) {
  const v = useModeVar(name, mode);
  const hex = v ? hexOf(v) : null;
  return <span className={className}>{hex ? hex.toUpperCase() : "—"}</span>;
}
