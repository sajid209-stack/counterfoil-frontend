"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView, useReducedMotion } from "./motion";

/* Recordings of the REAL product — Counterfoil Go at phone size and Counterfoil
   OS on a desktop — filmed from the running app (public/website/<name>.webm,
   poster <name>.jpg). The website shows the product itself, not a drawing of it. */

export const clip = (name: string) => ({ src: `/website/${name}.webm`, poster: `/website/${name}.jpg` });

/**
 * A recording that plays only while on screen: muted, looping, inline, and not
 * downloaded until it is near the viewport. Reduced motion shows the poster.
 * `onTime` reports the playhead (seconds) for captions synced to the footage.
 */
export function Clip({
  name,
  className,
  onTime,
  label,
  playing = true,
}: {
  name: string;
  className?: string;
  onTime?: (t: number) => void;
  /** What the recording shows, for assistive tech. */
  label: string;
  /** Lets a parent pause a clip that is in view but not the active one. */
  playing?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const near = useInView(ref, { once: true, margin: "600px 0px 600px 0px", threshold: 0 });
  const seen = useInView(ref, { once: false, margin: "0px", threshold: 0.25 });
  const reduce = useReducedMotion();
  const { src, poster } = clip(name);
  const cb = useRef(onTime);
  useEffect(() => {
    cb.current = onTime;
  });

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    if (seen && playing) v.play().catch(() => {});
    else v.pause();
  }, [seen, playing, reduce, near]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      cb.current?.(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const off = () => cancelAnimationFrame(raf);
    v.addEventListener("play", on);
    v.addEventListener("pause", off);
    return () => {
      off();
      v.removeEventListener("play", on);
      v.removeEventListener("pause", off);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={cn("block h-full w-full object-cover", className)}
      poster={poster}
      src={near && !reduce ? src : undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      role="img"
    />
  );
}

/** Which caption is live at playhead `t`: the last cue whose `at` has passed. */
export function useCue<T extends { at: number }>(cues: readonly T[]) {
  const [i, setI] = useState(-1);
  const last = useRef(-1);
  const onTime = (t: number) => {
    let k = -1;
    for (let j = 0; j < cues.length; j++) if (t >= cues[j].at) k = j;
    if (k !== last.current) {
      last.current = k;
      setI(k);
    }
  };
  return [i, onTime] as const;
}

/**
 * A slim phone around a Go recording: a thin bezel and nothing else. The app
 * draws its own header, so no fake status bar or notch sits on top of it, and
 * the frame is never overlapped or cropped by a layout. Width is the caller's.
 */
export function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[2.5rem] bg-[#1c1c1a] p-[6px] shadow-[0_0_0_1px_rgb(20_20_19/0.1),0_32px_64px_-24px_rgb(20_20_19/0.35)]", className)}>
      <div className="aspect-[390/844] overflow-hidden rounded-[2.15rem] bg-[var(--cf-paper)]">{children}</div>
    </div>
  );
}

/** A quiet window around an OS recording, with the UI large enough to read. */
export function Browser({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-white shadow-[var(--cf-shadow-frame)]", className)}>
      <div aria-hidden className="flex h-8 items-center gap-1.5 bg-[#f7f6f3] px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#dedad1]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#dedad1]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#dedad1]" />
      </div>
      <div className="aspect-[1440/900]">{children}</div>
    </div>
  );
}
