"use client";

import { useRef } from "react";
import { CalendarClock, CheckCheck, Send, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Browser, Clip, Phone, useCue } from "../_components/media";
import { useReducedMotion, useScrollProgress } from "../_components/motion";
import { Bubble, Mesh } from "./Bubble";
import { HeroTickets } from "./HeroTickets";
import styles from "./Stage.module.css";

/* TUNE: `at` is seconds into public/website/go-sell.webm when each bubble pops.
   Bubbles stack up and clear when the clip loops. Entries whose `pos` starts
   with "hidden" are desktop-only; phones show two bubbles. */
const HERO_CUES = [
  // Times are seconds into go-sell, a real recording: the Heritage Walking Tour
  // at 10:00, two adults, paid by bKash. Re-time these if the clip is re-shot.
  { at: 3.1, icon: CalendarClock, title: "Heritage Walking Tour", sub: "10:00 AM departure", pos: "left-[3%] top-[16%] md:left-[44%] md:top-[18%]" },
  { at: 5.0, icon: Users, title: "2 Adults", sub: "One tap for one more", pos: "hidden md:block md:left-[50%] md:top-[44%]" },
  { at: 6.2, icon: Wallet, title: "Cart · ৳2,760", sub: "VAT worked per line", pos: "hidden md:block md:right-[1%] md:top-[36%]" },
  { at: 10.9, icon: Send, title: "Paid by bKash", sub: "৳2,760.00 · tickets issued", pos: "right-[3%] bottom-[14%] md:right-[2%] md:bottom-[16%]" },
  { at: 11.8, icon: CheckCheck, title: "Sale lands on the dashboard", sub: "Counterfoil OS", pos: "hidden md:block md:left-[6%] md:bottom-[10%]" },
] as const;

/* How far each bubble drifts (px, [x, y]) as the hero scrolls away: different
   depths, so they fan apart with parallax. Same order as HERO_CUES. */
const DRIFT = [[-70, -90], [-30, 80], [90, -70], [80, 100], [-90, 70]] as const;

/** The big hero stage: the real OS behind, the real Go till in front. */
export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(ref);
  const reduce = useReducedMotion();
  const [idx, onTime] = useCue(HERO_CUES);

  return (
    <div ref={ref} className={cn(styles.stage3d, "relative mx-auto h-[540px] max-w-[1120px] overflow-hidden rounded-[32px] md:h-[640px] lg:h-[720px]")}>
      <Mesh />
      <HeroTickets />
      <div className={cn(styles.heroBrowser, "absolute left-[4%] top-[9%] z-[2] hidden w-[66%] md:block")}>
        <Browser url="app.counterfoil.app/dashboard">
          <Clip name="os-dashboard" label="Counterfoil OS dashboard: sales, bookings and capacity updating live" />
        </Browser>
      </div>
      <div className="absolute left-1/2 top-[5%] z-[3] -translate-x-1/2 md:left-auto md:right-[9%] md:top-[10%] md:translate-x-0">
        <div className={styles.heroPhone}>
          <Phone className="w-[220px] md:w-[250px] lg:w-[300px]">
            <Clip name="go-sell" onTime={onTime} label="Counterfoil Go on a phone: selling two Heritage Walking Tour tickets and taking payment by bKash" />
          </Phone>
        </div>
      </div>
      {HERO_CUES.map((c, i) => (
        <Bubble key={c.title} icon={c.icon} title={c.title} sub={c.sub} show={reduce || idx >= i} bob={i * 1.3} drift={DRIFT[i]} className={c.pos} />
      ))}
    </div>
  );
}
