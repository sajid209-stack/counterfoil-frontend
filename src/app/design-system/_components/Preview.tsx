"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { useDsConfig, type DsMode, type DsProduct } from "./DsConfig";

/**
 * The preview wrapper — the island every live example is drawn in.
 *
 * It renders its children inside ONE element carrying both the mode class and
 * `data-product`. That pairing is the point: the stylesheet lists the product
 * blocks after the mode blocks, so on an element that carries both, the
 * product's shape and elevation resolve against that same element's mode
 * values. Splitting them across two nested elements would resolve the product
 * tokens against the OUTER mode.
 *
 * Tokens are read live from that element (`getComputedStyle(el)`), so a table
 * of values can never drift from globals.css: it shows what the browser
 * computed for this configuration, now.
 */

/** The two stores below read the DOM, which is an external store. */
export class PreviewStore {
  el: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private observer: MutationObserver | null = null;

  /** Ref callback: remember the element and watch what can change its tokens. */
  attach = (el: HTMLElement | null) => {
    this.observer?.disconnect();
    this.observer = null;
    this.el = el;
    if (el && typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver(this.emit);
      this.observer.observe(el, { attributes: true, attributeFilter: ["class", "data-product"] });
      // A wrapper that follows the site inherits its mode, so the site's own
      // class (next-themes) and the user's contrast preference matter too.
      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-product", "data-contrast", "style"],
      });
    }
    this.emit();
  };

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  private emit = () => {
    this.listeners.forEach((l) => l());
  };

  readVar = (name: string): string => (this.el ? getComputedStyle(this.el).getPropertyValue(name).trim() : "");

  /** The root font size, so a rem token can be shown in pixels. */
  rootPx = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** The document root, for tables drawn outside any preview (primitives). */
let rootStore: PreviewStore | null = null;
function getRootStore(): PreviewStore {
  if (!rootStore) {
    rootStore = new PreviewStore();
    if (typeof document !== "undefined") rootStore.attach(document.documentElement);
  }
  return rootStore;
}

interface PreviewCtx {
  store: PreviewStore;
  product: DsProduct;
  mode: DsMode | null;
}
const PreviewContext = createContext<PreviewCtx | null>(null);

/** The store behind the nearest Preview (or the document root outside one). */
export function usePreviewStore(): PreviewStore {
  const ctx = useContext(PreviewContext);
  return ctx ? ctx.store : getRootStore();
}

/** A custom property's computed value in the active preview — "" until the
 *  client has taken over, and again if the stylesheet never emitted it. */
export function usePreviewVar(name: string): string {
  const ctx = useContext(PreviewContext);
  const store = ctx ? ctx.store : getRootStore();
  // The context value changes with the configuration, which re-renders the
  // consumer; the store's own observer covers the site theme changing.
  return useSyncExternalStore(store.subscribe, () => store.readVar(name), () => "");
}

/** The root font size in px, for rem → px readouts. */
export function useRootPx(): number {
  const store = usePreviewStore();
  return useSyncExternalStore(store.subscribe, store.rootPx, () => 16);
}

export const modeLabel = (m: DsMode | null) => (m === "dark" ? "Dark" : m === "light" ? "Light" : null);
export const productLabel = (p: DsProduct) => (p === "go" ? "POS" : "OS");

interface PreviewProps {
  children: React.ReactNode;
  /** Pin a configuration instead of following the page's switches. */
  product?: DsProduct;
  mode?: DsMode;
  /** An extra word after the configuration in the caption — "Disabled". */
  label?: string;
  /** Hide the caption (for a preview that is itself captioned). */
  bare?: boolean;
  /** No padding: the content brings its own (a table that runs edge to edge). */
  flush?: boolean;
  className?: string;
  /** Classes for the themed element itself (e.g. a grid for its children). */
  innerClassName?: string;
}

export function Preview({ children, product, mode, label, bare = false, flush = false, className, innerClassName }: PreviewProps) {
  const cfg = useDsConfig();
  const effProduct = product ?? cfg.product;
  const effMode = mode ?? cfg.mode;
  const [store] = useState(() => new PreviewStore());
  const attach = useCallback((el: HTMLElement | null) => store.attach(el), [store]);

  const caption = [productLabel(effProduct), modeLabel(effMode), label].filter(Boolean).join(" · ");

  return (
    <PreviewContext.Provider value={{ store, product: effProduct, mode: effMode }}>
      <figure className={cn("m-0 min-w-0", className)}>
        {/* The frame is the docs' own chrome and keeps the site's theme, so the
            edge of a dark preview on a light page is a clear, constant line. */}
        <div className="overflow-hidden rounded-md border border-line">
          <div
            ref={attach}
            data-ds-preview=""
            data-product={effProduct}
            className={cn(effMode, "bg-surface text-fg")}
          >
            <div className={cn("min-w-0 overflow-x-auto", !flush && "p-section sm:p-major", innerClassName)}>{children}</div>
            {!bare && (
              <figcaption className="border-t border-hairline px-section py-tight text-xs font-medium text-muted sm:px-major">
                {caption}
              </figcaption>
            )}
          </div>
        </div>
      </figure>
    </PreviewContext.Provider>
  );
}

/**
 * The same children, four times: OS light, OS dark, POS light, POS dark.
 * Two columns from `sm`, one on a phone. The page's switches are ignored — a
 * quad is the whole matrix, so there is nothing for them to choose.
 */
export function ThemeQuad({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  const configs: Array<{ product: DsProduct; mode: DsMode }> = [
    { product: "os", mode: "light" },
    { product: "os", mode: "dark" },
    { product: "go", mode: "light" },
    { product: "go", mode: "dark" },
  ];
  return (
    <div className={cn("grid grid-cols-1 gap-section sm:grid-cols-2", className)}>
      {configs.map((c) => (
        <Preview key={`${c.product}-${c.mode}`} product={c.product} mode={c.mode} label={label}>
          {children}
        </Preview>
      ))}
    </div>
  );
}
