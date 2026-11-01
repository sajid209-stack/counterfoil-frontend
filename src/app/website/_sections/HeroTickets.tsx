import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { LOGO_MARK } from "@/components/brand/logoArt";
import styles from "./Stage.module.css";

/* Decorative paper tickets (the Counterfoil mark on a punched stub) that orbit
   slowly behind the hero stage at different parallax depths. Deterministic. */
const TICKETS = [
  { pos: "left-[2%] top-[6%]", w: 132, ember: true, par: -260, r: -12, dur: 26, dl: 0, ox: 18, oy: -22, show: true },
  { pos: "right-[3%] top-[3%]", w: 104, ember: false, par: 180, r: 9, dur: 22, dl: -6, ox: -16, oy: 20, show: true },
  { pos: "left-[1%] bottom-[10%]", w: 96, ember: false, par: -120, r: 7, dur: 30, dl: -11, ox: 20, oy: 14, show: true },
  { pos: "right-[5%] bottom-[5%]", w: 150, ember: true, par: 300, r: 14, dur: 28, dl: -3, ox: -22, oy: -16, show: true },
  { pos: "left-[44%] top-[1%]", w: 88, ember: false, par: -420, r: -6, dur: 24, dl: -9, ox: 14, oy: 18, show: false },
  { pos: "left-[36%] bottom-[2%]", w: 112, ember: true, par: 220, r: 5, dur: 32, dl: -14, ox: -18, oy: -14, show: false },
] as const;

export function HeroTickets() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
      {TICKETS.map((t, i) => (
        <div key={i} className={cn(styles.tPar, t.pos, !t.show && "hidden md:block")} style={{ "--par": `${t.par}px` } as CSSProperties}>
          <div
            className={styles.tOrbit}
            style={{ "--r0": `${t.r}deg`, "--dur": `${t.dur}s`, "--dl": `${t.dl}s`, "--ox": `${t.ox}px`, "--oy": `${t.oy}px` } as CSSProperties}
          >
            <div className={cn(styles.ticket, t.ember ? styles.tEmber : styles.tWhite)} style={{ "--w": `${t.w}px` } as CSSProperties}>
              <svg viewBox="0 0 70 70" className="absolute left-[10%] top-1/2 h-[46%] -translate-y-1/2" fill={t.ember ? "#fff" : "#f94a00"}>
                <path d={LOGO_MARK} />
              </svg>
              <span className="absolute left-[40%] top-[34%] h-[8%] w-[22%] rounded-full" style={{ background: t.ember ? "rgb(255 255 255 / 0.55)" : "#ffd4b8" }} />
              <span className="absolute left-[40%] top-[52%] h-[8%] w-[14%] rounded-full" style={{ background: t.ember ? "rgb(255 255 255 / 0.35)" : "#ffe6d5" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
