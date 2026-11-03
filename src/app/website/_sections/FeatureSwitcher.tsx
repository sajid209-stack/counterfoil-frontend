"use client";

import { createContext, useContext, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView, useReducedMotion } from "../_components/motion";
import { Clip } from "../_components/media";

const ActiveCtx = createContext(true);

/** A Clip that plays only while its feature is the active one. */
export function SwitcherClip(props: { name: string; label: string; className?: string }) {
  return <Clip {...props} playing={useContext(ActiveCtx)} />;
}

/* The Toast / Attio pattern: a list of features beside the active one's real
   recording ("side", for a phone), or tabs above it at full width ("top", for a
   desktop screen, so its UI stays large enough to read). Desktop auto-advances
   while in view (the active item's 2px ember line fills over the clip's length);
   phones get an accordion with the media under the open item and never
   auto-advance. */

export type FeatureItem = {
  id: string;
  title: string;
  body: string;
  media: ReactNode;
  /** Length of the clip, in seconds: how long the progress line takes. */
  seconds: number;
};

const DESKTOP = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

export function FeatureSwitcher({
  items,
  panelClassName,
  mirrored,
  mediaShare = 0.6,
  label,
  layout = "side",
  intro,
}: {
  items: FeatureItem[];
  panelClassName?: string;
  /** List on the right, media on the left. */
  mirrored?: boolean;
  /** Share of the width the media panel takes on desktop (0-1). */
  mediaShare?: number;
  /** Accessible name of the tab list. */
  label?: string;
  /** "side": a list beside the media. "top": tabs above it at full width. */
  layout?: "side" | "top";
  /** A heading drawn above the list, so it shares one screen with the media. */
  intro?: ReactNode;
}) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  const seen = useInView(rootRef, { once: false, margin: "0px", threshold: 0.35 });
  const n = items.length;

  const auto = desktop && !reduce;
  const top = desktop && layout === "top";
  const paused = !seen || hover || focus;

  const select = (i: number, focusTab = false) => {
    const k = (i + n) % n;
    setActive(k);
    if (focusTab) tabRefs.current[k]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = e.key === "ArrowDown" || e.key === "ArrowRight";
    const prev = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (next) select(active + 1, true);
    else if (prev) select(active - 1, true);
    else if (e.key === "Home") select(0, true);
    else if (e.key === "End") select(n - 1, true);
    else return;
    e.preventDefault();
  };

  const panelId = `${uid}-panel`;
  const panelBase = cn("rounded-[24px] bg-[var(--cf-paper)]", panelClassName);

  // Keyed to the item so a new selection restarts it from empty.
  const progress = (it: FeatureItem) => (
    <span
      key={`${it.id}-${active}`}
      className="block h-full origin-left bg-[var(--cf-accent)]"
      style={
        auto
          ? {
              animation: `cf-fill ${it.seconds}s linear forwards`,
              animationPlayState: paused ? "paused" : "running",
            }
          : undefined
      }
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) select(active + 1);
      }}
    />
  );

  if (top) {
    const current = items[active];
    return (
      <div
        ref={rootRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={(e) => setFocus(e.target.matches(":focus-visible"))}
        onBlur={() => setFocus(false)}
      >
        <style>{`@keyframes cf-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
        <div role="tablist" aria-orientation="horizontal" aria-label={label} onKeyDown={onKeyDown} className="grid gap-6" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {items.map((it, i) => {
            const on = i === active;
            return (
              <div key={it.id} role="presentation">
                <div className="h-0.5 overflow-hidden rounded-full bg-[var(--cf-line)]">{on && progress(it)}</div>
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${it.id}`}
                  aria-selected={on}
                  aria-controls={panelId}
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(i)}
                  className={cn(
                    "cf-h3 flex min-h-[44px] w-full items-center rounded-lg pt-2 text-left transition-colors duration-200",
                    on ? "text-[var(--cf-fg)]" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]",
                  )}
                >
                  {it.title}
                </button>
              </div>
            );
          })}
        </div>
        <p className="cf-body mt-1 min-h-[1.55em]">{current.body}</p>
        <div id={panelId} role="tabpanel" aria-labelledby={`${uid}-tab-${current.id}`} className="mt-8 grid">
          {items.map((it, i) => (
            <div
              key={it.id}
              aria-hidden={i !== active}
              className={cn("transition-opacity duration-300 [grid-area:1/1] motion-reduce:transition-none", i === active ? "opacity-100" : "pointer-events-none opacity-0")}
            >
              <ActiveCtx.Provider value={i === active}>{it.media}</ActiveCtx.Provider>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={(e) => setFocus(e.target.matches(":focus-visible"))}
      onBlur={() => setFocus(false)}
      className="grid items-center gap-8 lg:gap-16 lg:[grid-template-columns:var(--cols)]"
      style={{ "--cols": mirrored ? `${mediaShare}fr ${1 - mediaShare}fr` : `${1 - mediaShare}fr ${mediaShare}fr` } as CSSProperties}
    >
      <style>{`@keyframes cf-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>

      <div className={cn("min-w-0", mirrored && "lg:order-2")}>
      {intro && <div className="mb-8">{intro}</div>}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-col"
      >
        {items.map((it, i) => {
          const on = i === active;
          return (
            <div key={it.id} role="presentation" className="py-1">
              <button
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${it.id}`}
                aria-selected={on}
                aria-controls={desktop ? panelId : `${uid}-m-${it.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => select(i)}
                className={cn(
                  "cf-h3 flex min-h-[44px] w-full items-center rounded-lg text-left transition-colors duration-200",
                  on ? "text-[var(--cf-fg)]" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]",
                )}
              >
                {it.title}
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                  on ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden" aria-hidden={!on} inert={!on}>
                  <p className="cf-body pb-3 pt-1">{it.body}</p>
                  {desktop ? (
                    <div className="mb-3 h-0.5 overflow-hidden rounded-full bg-[var(--cf-line)]">
                      {on && progress(it)}
                    </div>
                  ) : (
                    on && (
                      <div id={`${uid}-m-${it.id}`} role="tabpanel" aria-labelledby={`${uid}-tab-${it.id}`} className={cn(panelBase, "mb-3 grid")}>
                        <ActiveCtx.Provider value={true}>
                          <div className="flex items-center justify-center">{it.media}</div>
                        </ActiveCtx.Provider>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {desktop && (
        <div id={panelId} role="tabpanel" aria-labelledby={`${uid}-tab-${items[active].id}`} className={cn(panelBase, "grid min-w-0 overflow-hidden", mirrored && "lg:order-1")}>
          {items.map((it, i) => (
            <div
              key={it.id}
              aria-hidden={i !== active}
              className={cn(
                "flex items-center justify-center transition-opacity duration-300 [grid-area:1/1] motion-reduce:transition-none",
                i === active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <ActiveCtx.Provider value={i === active}>{it.media}</ActiveCtx.Provider>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
