"use client";

import { useRef } from "react";
import { Banknote, Coins, CreditCard, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Clip, Phone } from "../_components/media";
import { useInView, useTicker } from "../_components/motion";
import { Bubble, Mesh } from "./Bubble";

const PAY: { name: string; note: string; mark?: string; color?: string; icon?: LucideIcon }[] = [
  { name: "bKash", note: "By transaction ID", mark: "b", color: "#d1115f" },
  { name: "Bangla QR", note: "Any bank app", mark: "QR", color: "#0b7a4b" },
  { name: "SSLCOMMERZ", note: "Cards, online", mark: "SSL", color: "#2458a8" },
  { name: "Stripe", note: "Cards abroad", mark: "S", color: "#5a4fe6" },
  { name: "Card terminal", note: "Tap or insert", icon: CreditCard },
  { name: "Cash", note: "Counted at close", icon: Banknote },
];

/** The six payment rails beside the real cash screen of Go. */
export function PaymentsStage() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "0px", threshold: 0.3 });
  const hi = useTicker(PAY.length, 1800, inView);

  return (
    <div ref={ref} className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[32px] px-5 py-10 md:px-14 md:py-16">
      <Mesh />
      <div className="relative grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
        <ul className="grid gap-2.5">
          {PAY.map(({ name, note, mark, color, icon: Icon }, i) => (
            <li
              key={name}
              className={cn(
                "flex min-h-14 items-center gap-3.5 rounded-2xl px-3 py-2 transition-[background-color,box-shadow,transform] duration-500",
                i === hi ? "scale-[1.02] bg-white shadow-[0_18px_40px_-18px_rgb(140_50_0/0.35)]" : "bg-white/60",
              )}
            >
              {mark ? (
                <span aria-hidden className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-1.5 text-[13px] font-bold text-white" style={{ background: color }}>
                  {mark}
                </span>
              ) : (
                Icon && (
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]">
                    <Icon size={19} strokeWidth={1.7} />
                  </span>
                )
              )}
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[var(--cf-fg)]">{name}</span>
                <span className="block text-[13px] text-[var(--cf-muted)]">{note}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="relative mx-auto w-[230px] sm:w-[260px]">
          <Phone>
            <Clip name="go-cash" label="Counterfoil Go: taking a cash payment and showing the change due" />
          </Phone>
          <Bubble icon={Coins} title="Change ৳425.00" sub="From ৳1,000, worked out" show bob={0} className="-left-4 top-[6%] sm:-left-28 sm:top-[8%]" />
          <Bubble icon={Lock} title="Counted at close" sub="Cash reconciled" show bob={2} className="-right-4 bottom-[18%] sm:-right-14" />
        </div>
      </div>
    </div>
  );
}
