"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Banknote, Check, CreditCard, Nfc, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Window } from "../_components/ui";
import { useInView, useSequence } from "../_components/motion";

type Lang = "en" | "bn";

const RAILS: { id: string; name: string; note: string; mark?: string; color: string; icon?: LucideIcon }[] = [
  { id: "bkash", name: "bKash", note: "By transaction ID", mark: "b", color: "#d1115f" },
  { id: "qr", name: "Bangla QR", note: "Any bank app", mark: "QR", color: "#0b7a4b" },
  { id: "ssl", name: "SSLCOMMERZ", note: "Cards, online", mark: "SSL", color: "#2458a8" },
  { id: "stripe", name: "Stripe", note: "Cards abroad", mark: "S", color: "#5a4fe6" },
  { id: "card", name: "Card terminal", note: "Tap or insert", icon: CreditCard, color: "#111110" },
  { id: "cash", name: "Cash", note: "Counted at close", icon: Banknote, color: "#16803c" },
];

/** The timeline: which rail is on stage and how far through it is. */
const STEPS: { rail: string; phase: number; ms: number }[] = [
  { rail: "bkash", phase: 0, ms: 700 },
  { rail: "bkash", phase: 1, ms: 450 },
  { rail: "bkash", phase: 2, ms: 450 },
  { rail: "bkash", phase: 3, ms: 450 },
  { rail: "bkash", phase: 4, ms: 450 },
  { rail: "bkash", phase: 5, ms: 1700 },
  { rail: "qr", phase: 0, ms: 1900 },
  { rail: "qr", phase: 1, ms: 1700 },
  { rail: "card", phase: 0, ms: 1000 },
  { rail: "card", phase: 1, ms: 900 },
  { rail: "card", phase: 2, ms: 1600 },
  { rail: "cash", phase: 0, ms: 1000 },
  { rail: "cash", phase: 1, ms: 900 },
  { rail: "cash", phase: 2, ms: 2200 },
];
const MS = STEPS.map((s) => s.ms);
const TXN = "9BK4X2M7QA";
const TYPED = [0, 2, 5, 8, 10, 10];

const T = {
  en: {
    due: "Total due",
    bkash: "bKash transaction ID",
    waiting: "Waiting",
    confirmed: "Confirmed",
    qr: "Scan with any bank app",
    paid: "Paid",
    tap: "Tap card",
    approving: "Approving",
    approved: "Approved",
    tendered: "Tendered",
    change: "Change",
    pay: "Take payment",
  },
  bn: {
    due: "মোট প্রদেয়",
    bkash: "বিকাশ ট্রানজ্যাকশন আইডি",
    waiting: "অপেক্ষা",
    confirmed: "নিশ্চিত",
    qr: "যেকোনো ব্যাংক অ্যাপে স্ক্যান করুন",
    paid: "পরিশোধিত",
    tap: "কার্ড ট্যাপ করুন",
    approving: "অনুমোদন হচ্ছে",
    approved: "অনুমোদিত",
    tendered: "প্রদত্ত",
    change: "ফেরত",
    pay: "পেমেন্ট নিন",
  },
} as const;

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const num = (s: string, lang: Lang) => (lang === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s);

/** A QR drawn as a CSS grid: three finder squares and a fixed pseudo-pattern. */
function Qr({ dim }: { dim: boolean }) {
  const N = 13;
  const cells = Array.from({ length: N * N }, (_, k) => {
    const r = Math.floor(k / N);
    const c = k % N;
    const finder = (r < 5 && c < 5) || (r < 5 && c >= N - 5) || (r >= N - 5 && c < 5);
    if (finder) {
      const rr = r >= N - 5 ? r - (N - 5) : r;
      const cc = c >= N - 5 ? c - (N - 5) : c;
      return rr === 0 || rr === 4 || cc === 0 || cc === 4 || (rr === 2 && cc === 2);
    }
    return (r * 7 + c * 13 + r * c) % 3 !== 0;
  });
  return (
    <div className={cn("grid gap-px transition-opacity duration-500", dim && "opacity-25")} style={{ gridTemplateColumns: `repeat(${N}, 7px)` }}>
      {cells.map((on, i) => (
        <span key={i} className={cn("h-[7px] w-[7px]", on ? "bg-[var(--cf-fg)]" : "bg-transparent")} />
      ))}
    </div>
  );
}

function Status({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium transition-colors duration-500",
        ok ? "bg-[var(--cf-green-wash)] text-[var(--cf-green)]" : "bg-[var(--cf-bg-3)] text-[var(--cf-muted)]",
      )}
    >
      {ok && <Check size={12} strokeWidth={2.4} className="cf-pop" />}
      {children}
    </span>
  );
}

export function PaymentsDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, threshold: 0.25, margin: "0px" });
  const stepIdx = useSequence(MS, inView);
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];
  const { rail, phase } = STEPS[stepIdx];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next: Lang = lang === "en" ? "bn" : "en";
      setLang(next);
      e.currentTarget.querySelector<HTMLButtonElement>(`[data-lang="${next}"]`)?.focus();
    }
  };

  return (
    <div ref={ref} className="grid border-t border-[var(--cf-line)] lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="flex flex-col lg:border-r lg:border-[var(--cf-line)]">
        <ul>
          {RAILS.map((r) => {
            const active = r.id === rail;
            const Icon = r.icon;
            return (
              <li key={r.id} className={cn("flex items-center gap-3.5 border-b border-[var(--cf-line)] px-5 py-4 transition-colors duration-500 md:px-8", active && "bg-[var(--cf-bg-2)]")}>
                <span
                  aria-hidden
                  className={cn(
                    "grid h-10 min-w-10 shrink-0 place-items-center rounded-[10px] px-1.5 text-[13px] font-bold transition-colors duration-500",
                    active ? "text-white" : "bg-[var(--cf-bg-3)] text-[var(--cf-muted)]",
                  )}
                  style={active ? { background: r.color } : undefined}
                >
                  {r.mark ?? (Icon && <Icon size={18} strokeWidth={1.7} />)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em]">{r.name}</span>
                  <span className="mt-0.5 block text-[13px] text-[var(--cf-muted)]">{r.note}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-auto px-5 py-5 text-[13px] text-[var(--cf-muted)] md:px-8">Operators already run it in Bangladesh, Malaysia, the US and Canada.</p>
      </div>

      <div className="cf-dots px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto mb-3 flex w-full max-w-[380px] items-center justify-between gap-3">
          <span className="cf-label text-[12px]" id="pay-lang-label">
            Window language
          </span>
          <div role="radiogroup" aria-labelledby="pay-lang-label" onKeyDown={onKey} className="flex rounded-lg bg-white p-0.5 shadow-[inset_0_0_0_1px_var(--cf-line-2)]">
            {(["en", "bn"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                tabIndex={lang === l ? 0 : -1}
                data-lang={l}
                onClick={() => setLang(l)}
                className={cn(
                  "h-11 min-w-14 rounded-md px-3 text-[13px] font-medium transition-colors md:h-8",
                  lang === l ? "bg-[var(--cf-fg)] text-white" : "text-[var(--cf-muted)] hover:text-[var(--cf-fg)]",
                )}
              >
                {l === "en" ? "EN" : "বাংলা"}
              </button>
            ))}
          </div>
        </div>

        <Window title={t.pay} dots className="mx-auto w-full max-w-[380px]" right={<span className="cf-mono text-[12px] text-[var(--cf-muted)]">CF-2026-001053</span>}>
          <div aria-hidden lang={lang === "bn" ? "bn" : undefined}>
            <div className="flex items-baseline justify-between border-b border-[var(--cf-line)] px-4 py-3">
              <span className="text-[13px] text-[var(--cf-muted)]">{t.due}</span>
              <span className="text-[20px] font-semibold tracking-tight">৳{num("1,150.00", lang)}</span>
            </div>
            <div className="h-[236px] p-4">
              {rail === "bkash" && (
                <div key="bkash" className="cf-arrive">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
                    <span className="grid h-6 w-6 place-items-center rounded-md text-[12px] font-bold text-white" style={{ background: "#d1115f" }}>
                      b
                    </span>
                    bKash
                  </div>
                  <p className="mb-1.5 text-[12px] text-[var(--cf-muted)]">{t.bkash}</p>
                  <div className="cf-mono flex h-10 items-center rounded-lg border border-[var(--cf-line-2)] px-3 text-[14px]">
                    {TXN.slice(0, TYPED[phase])}
                    {phase < 5 && <span className="cf-caret" />}
                  </div>
                  <div className="mt-4">
                    <Status ok={phase === 5}>{phase === 5 ? t.confirmed : t.waiting}</Status>
                  </div>
                </div>
              )}
              {rail === "qr" && (
                <div key="qr" className="cf-arrive flex flex-col items-center">
                  <div className="relative">
                    <Qr dim={phase === 1} />
                    {phase === 1 && (
                      <span className="cf-pop absolute inset-0 grid place-items-center">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--cf-green)] text-white">
                          <Check size={24} strokeWidth={2.4} />
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-[var(--cf-muted)]">{t.qr}</p>
                  <div className="mt-2">
                    <Status ok={phase === 1}>{phase === 1 ? t.paid : t.waiting + "…"}</Status>
                  </div>
                </div>
              )}
              {rail === "card" && (
                <div key="card" className="cf-arrive flex h-full flex-col items-center justify-center gap-3">
                  <span className={cn("grid h-16 w-16 place-items-center rounded-full border transition-colors duration-500", phase === 2 ? "border-[var(--cf-green)] text-[var(--cf-green)]" : "border-[var(--cf-line-2)] text-[var(--cf-fg)]")}>
                    {phase === 2 ? <Check size={26} strokeWidth={2.2} className="cf-pop" /> : <Nfc size={26} strokeWidth={1.6} />}
                  </span>
                  <Status ok={phase === 2}>{phase === 0 ? t.tap : phase === 1 ? t.approving + "…" : t.approved}</Status>
                </div>
              )}
              {rail === "cash" && (
                <div key="cash" className="cf-arrive">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--cf-bg-3)] px-3 py-2">
                    <span className="text-[12px] text-[var(--cf-muted)]">{t.tendered}</span>
                    <span className="text-[16px] font-semibold">{phase === 0 ? "৳—" : "৳" + num("1,200", lang)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {["1", "2", "3", "⌫", "4", "5", "6", "00", "7", "8", "9", "0"].map((k) => (
                      <span
                        key={k}
                        className={cn(
                          "grid h-7 place-items-center rounded-md border border-[var(--cf-line)] text-[12px] transition-colors duration-300",
                          phase === 1 && ["1", "2", "00"].includes(k) ? "bg-[var(--cf-fg)] text-white" : "text-[var(--cf-fg-2)]",
                        )}
                      >
                        {num(k, lang)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 h-6 text-[13px] font-medium">
                    {phase === 2 && (
                      <span className="cf-arrive inline-block text-[var(--cf-green)]">
                        {t.change} ৳{num("50.00", lang)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
