"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/* The website's motion kit. Three rules hold everywhere:
   1. Nothing is hidden unless JS is running — `.w-ready` gates every hidden
      state, so a page that never hydrates still reads top to bottom.
   2. Reduced motion means the end state, at once — never a slower version.
   3. Scroll work writes CSS variables on the element instead of React state,
      so a scroll frame never re-renders a section. */

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the visitor has asked for less motion. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/**
 * Mounted once at the top of the page. Marks the root ready and reveals every
 * `[data-reveal]` element the first time it scrolls into view. A section opts in
 * with nothing more than the attribute (and `--w-delay` for a stagger), so
 * server components can use it too.
 */
export function RevealRoot({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.classList.add("w-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-shown", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    const watch = () => root.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => io.observe(el));
    watch();
    // Sections that render more content later (tabs, toggles) still reveal.
    const mo = new MutationObserver(watch);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [rootId]);
  return null;
}

/** Whether `ref` has come into view. With `once` (the default) it stays true. */
export function useInView<T extends Element>(ref: RefObject<T | null>, { once = true, margin = "0px 0px -15% 0px", threshold = 0.2 } = {}) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          if (once) io.disconnect();
        } else if (!once) setSeen(false);
      },
      { rootMargin: margin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, margin, threshold]);
  return seen;
}

/**
 * How far the visitor has scrolled through `ref`, 0 → 1: 0 when its top meets
 * the bottom of the viewport (or the top, with `from: "top"` — what a sticky
 * story wants), 1 when its bottom meets the top. Written to `--w-p` on the
 * element every frame; `onChange` gets the value too, for the rare part that
 * needs to switch something discrete (call setState only when it changes).
 */
export function useScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { from = "bottom" as "bottom" | "top", onChange }: { from?: "bottom" | "top"; onChange?: (p: number) => void } = {},
) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = from === "top" ? 0 : vh;
      const span = from === "top" ? r.height - vh : r.height + vh;
      const p = Math.min(1, Math.max(0, (start - r.top) / Math.max(1, span)));
      el.style.setProperty("--w-p", p.toFixed(4));
      cb.current?.(p);
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, from]);
}

/** A number that counts up to `value` the first time it is seen. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 1400,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref);
  const reduce = useReducedMotion();
  // The server renders the final figure (readable without JS). Once mounted and
  // still off screen, it is wound back to zero to count up from. Written to the
  // DOM rather than to state: React's text never changes, so it never fights it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      return;
    }
    if (!seen) {
      el.textContent = format(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 4);
      el.textContent = format(value * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `format` is a render-time function; the value and visibility drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, value, duration, reduce]);
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

/** Steps through `0 … count-1` every `ms` while `active`, for looping demos. */
export function useTicker(count: number, ms: number, active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || count < 2) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms, active]);
  return i;
}
