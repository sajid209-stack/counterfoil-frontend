"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Banknote, Check, CreditCard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { PhoneFrame } from "../_components/ui";
import { useInView, useReducedMotion, useTicker } from "../_components/motion";
import phoneEn from "@/app/deck/_media/go-phone-sell.jpg";
import phoneBn from "@/app/deck/_media/go-phone-sell-bn.jpg";
import css from "./Bangladesh.module.css";

type Lang = "en" | "bn";

const METHODS: { name: string; mark?: string; color?: string; icon?: LucideIcon }[] = [
  { name: "bKash", mark: "b", color: "#d1115f" },
  { name: "Bangla QR", mark: "QR", color: "#0b7a4b" },
  { name: "Card", icon: CreditCard },
  { name: "Cash", icon: Banknote },
];

function CheckoutChip({ active }: { active: boolean }) {
  const i = useTicker(METHODS.length, 2200, active);
  const m = METHODS[i];
  const Icon = m.icon;
  return (
    <div aria-hidden className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-[var(--w-white)] px-4 py-3 shadow-[0_20px_50px_-20px_rgb(20_20_19/0.4),0_0_0_1px_rgb(20_20_19/0.06)]">
      <div key={i} className={cn(css.pop, "flex min-w-0 flex-1 items-center gap-3")}>
        {m.mark ? (
          <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl px-1.5 text-[13px] font-bold text-white" style={{ background: m.color }}>
            {m.mark}
          </span>
        ) : (
          Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--w-ink)] text-[var(--w-ember-soft)]">
              <Icon size={19} strokeWidth={1.7} />
            </span>
          )
        )}
        <span className="min-w-0">
          <span className="block text-[12px] text-[var(--w-muted)]">Pay by</span>
          <span className="block truncate text-[16px] font-semibold leading-tight">{m.name}</span>
        </span>
        <span className="ml-auto text-[17px] font-semibold tabular-nums">৳500</span>
      </div>
      <span key={`p${i}`} className={cn(css.paid, "inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--w-success)] px-2.5 py-1 text-[12px] font-semibold text-white")}>
        <Check size={13} strokeWidth={3} />
        Paid
      </span>
    </div>
  );
}

export function BangladeshVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: false, threshold: 0.3 });
  const reduce = useReducedMotion();
  const [lang, setLang] = useState<Lang>("en");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!seen || reduce || manual) return;
    const id = window.setInterval(() => setLang((l) => (l === "en" ? "bn" : "en")), 3800);
    return () => window.clearInterval(id);
  }, [seen, reduce, manual]);

  const choose = (l: Lang) => {
    setManual(true);
    setLang(l);
  };
  const onKey = (e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      choose(lang === "en" ? "bn" : "en");
      requestAnimationFrame(() => (e.currentTarget.parentElement?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
    }
  };

  const fade = "transition-opacity duration-[900ms] [transition-timing-function:var(--w-ease)]";
  return (
    <div ref={ref} className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-6">
      <div role="radiogroup" aria-label="Language shown on the phone" className="relative grid w-[240px] grid-cols-2 rounded-full bg-[var(--w-paper-2)] p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--w-ink)] transition-transform duration-500 [transition-timing-function:var(--w-ease)]"
          style={{ transform: lang === "bn" ? "translateX(100%)" : "none" }}
        />
        {(
          [
            ["en", "EN"],
            ["bn", "বাংলা"],
          ] as const
        ).map(([l, label]) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            tabIndex={lang === l ? 0 : -1}
            onClick={() => choose(l)}
            onKeyDown={onKey}
            lang={l}
            className={cn("relative z-10 min-h-11 rounded-full text-[15px] font-medium transition-colors duration-300", lang === l ? "text-[var(--w-paper)]" : "text-[var(--w-fg)]")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative w-full max-w-[290px]">
        <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
          <div className={cn(fade, lang === "en" ? "opacity-100" : "opacity-0")} aria-hidden={lang !== "en"}>
            <PhoneFrame src={phoneEn} alt="Counterfoil Go on a phone, in English" sizes="290px" />
          </div>
          <div className={cn(fade, lang === "bn" ? "opacity-100" : "opacity-0")} aria-hidden={lang !== "bn"}>
            <PhoneFrame src={phoneBn} alt="Counterfoil Go on a phone, in Bangla" sizes="290px" />
          </div>
        </div>
        <div className="absolute -bottom-5 left-1/2 w-[calc(100%+40px)] max-w-[340px] -translate-x-1/2 sm:left-auto sm:right-[-70px] sm:translate-x-0">
          <CheckoutChip active={seen && !reduce} />
        </div>
      </div>
      <div className="h-6" aria-hidden />
    </div>
  );
}
