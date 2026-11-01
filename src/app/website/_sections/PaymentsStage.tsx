"use client";

import { useRef, type CSSProperties } from "react";
import { Banknote, CreditCard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Clip, Phone } from "../_components/media";
import { useInView, useTicker } from "../_components/motion";
import { GlassChip } from "./Glass";
import styles from "./Scenes.module.css";

const PAY: { name: string; note: string; mark?: string; color: string; icon?: LucideIcon }[] = [
  { name: "bKash", note: "By transaction ID", mark: "b", color: "#d1115f" },
  { name: "Bangla QR", note: "Any bank app", mark: "QR", color: "#0b9a62" },
  { name: "SSLCOMMERZ", note: "Cards, online", mark: "SSL", color: "#3b74d8" },
  { name: "Stripe", note: "Cards abroad", mark: "S", color: "#7a6fff" },
  { name: "Card terminal", note: "Tap or insert", icon: CreditCard, color: "#ff8a4c" },
  { name: "Cash", note: "Counted at close", icon: Banknote, color: "#ff5a14" },
];

/** The six payment rails, lit in turn, beside the real cash screen of Go. */
export function PaymentsStage() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "0px", threshold: 0.3 });
  const hi = useTicker(PAY.length, 1800, inView);

  return (
    <div ref={ref} className="relative mx-auto max-w-[1040px]">
      <div className="grid items-center gap-14 md:grid-cols-[1fr_auto] md:gap-20">
        <ul className="grid gap-2.5">
          {PAY.map(({ name, note, mark, color, icon: Icon }, i) => {
            const on = i === hi;
            return (
              <li
                key={name}
                style={{ "--rail": color } as CSSProperties}
                className={cn(
                  "flex min-h-14 items-center gap-3.5 rounded-2xl border px-3 py-2 backdrop-blur-sm transition-[background-color,box-shadow,border-color,transform] duration-500",
                  on
                    ? "scale-[1.02] border-[color-mix(in_srgb,var(--rail)_55%,transparent)] bg-[color-mix(in_srgb,var(--rail)_10%,#0c0c0b)] shadow-[0_0_44px_-10px_var(--rail)]"
                    : "border-white/[0.07] bg-white/[0.03]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-1.5 text-[13px] font-bold transition-shadow duration-500",
                    mark ? "text-white" : "text-[var(--cf-fg)]",
                    on && "shadow-[0_0_20px_-2px_var(--rail)]",
                  )}
                  style={{ background: mark ? color : `color-mix(in srgb, ${color} 22%, #151513)` }}
                >
                  {mark ?? (Icon && <Icon size={19} strokeWidth={1.7} />)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-[var(--cf-fg)]">{name}</span>
                  <span className="block text-[13px] text-[var(--cf-muted)]">{note}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="relative mx-auto w-[230px] sm:w-[260px]">
          <div aria-hidden className={cn("absolute -bottom-10 left-1/2 h-[60px] w-[240px] -translate-x-1/2 rounded-full bg-[rgb(249_74_0/0.5)] blur-[44px]", styles.glow)} />
          <div className={cn("relative", styles.float)}>
            <Phone>
              <Clip name="go-cash" label="Counterfoil Go: taking a cash payment and showing the change due" />
            </Phone>
            <GlassChip title="Change ৳425.00" sub="from ৳1,000" className="absolute -left-2 top-[8%] sm:-left-28" />
            <GlassChip title="Counted at close" className="absolute -right-2 bottom-[18%] sm:-right-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
