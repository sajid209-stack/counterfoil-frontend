"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Banknote, Check, CreditCard, Nfc, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Window } from "../_components/ui";
import { Qr } from "@/components/ui/Qr";
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
  { rail: "cash", phase: 2, ms: 1500 },
  { rail: "cash", phase: 3, ms: 2200 },
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
    pay: "Payment",
    bkashTitle: "bKash payment",
    bkashHelp: "Ask the guest to send ৳1,150.00, then enter the transaction ID from their confirmation SMS.",
    failed: "It failed",
    received: "Payment received",
    cash: "CASH",
    exact: "Exact",
    complete: "Complete sale",
    saleDone: "Sale complete · 1 ticket issued",
    paidBy: "Paid by Cash",
    changeDue: "Change ৳50.00",
    newSale: "New sale",
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
    pay: "পেমেন্ট",
    bkashTitle: "বিকাশ পেমেন্ট",
    bkashHelp: "গ্রাহককে ৳১,১৫০.০০ পাঠাতে বলুন, তারপর কনফার্মেশন এসএমএসের ট্রানজ্যাকশন আইডি দিন।",
    failed: "ব্যর্থ হয়েছে",
    received: "পেমেন্ট পেয়েছি",
    cash: "নগদ",
    exact: "সঠিক",
    complete: "বিক্রি সম্পন্ন করুন",
    saleDone: "বিক্রি সম্পন্ন · ১টি টিকিট",
    paidBy: "নগদে পরিশোধ",
    changeDue: "ফেরত ৳৫০.০০",
    newSale: "নতুন বিক্রি",
  },
} as const;

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const num = (s: string, lang: Lang) => (lang === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s);

function Status({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-500",
        ok ? "bg-success-wash text-success" : "bg-subtle text-muted",
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
    <div ref={ref} className="grid gap-3 px-3 pb-3 md:px-6 md:pb-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="flex flex-col">
        <ul className="flex flex-col gap-2 p-3 md:p-5">
          {RAILS.map((r) => {
            const active = r.id === rail;
            const Icon = r.icon;
            return (
              <li key={r.id} className={cn("flex items-center gap-3.5 rounded-card px-4 py-3.5 transition-colors duration-500", active ? "bg-ember-wash" : "bg-subtle")}>
                <span
                  aria-hidden
                  className={cn(
                    "grid h-10 min-w-10 shrink-0 place-items-center rounded-[10px] px-1.5 text-[13px] font-bold transition-colors duration-500",
                    active ? "text-white" : "bg-card text-muted",
                  )}
                  style={active ? { background: r.color } : undefined}
                >
                  {r.mark ?? (Icon && <Icon size={18} strokeWidth={1.7} />)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-fg">{r.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{r.note}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-auto px-4 py-4 text-[13px] text-muted">Operators already run it in Bangladesh, Malaysia, the US and Canada.</p>
      </div>

      <div className="cf-dots rounded-2xl px-4 py-8 md:px-10 md:py-12">
        <div className="mx-auto mb-3 flex w-full max-w-[380px] items-center justify-between gap-3">
          <span className="text-[12px] font-medium text-brand-foreground" id="pay-lang-label">
            Window language
          </span>
          <div role="radiogroup" aria-labelledby="pay-lang-label" onKeyDown={onKey} className="flex rounded-full bg-card p-0.5 shadow-card">
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
                  "h-11 min-w-14 rounded-full px-3 text-[13px] font-medium transition-colors md:h-8",
                  lang === l ? "bg-ember-solid text-on-solid" : "text-muted hover:text-fg",
                )}
              >
                {l === "en" ? "EN" : "বাংলা"}
              </button>
            ))}
          </div>
        </div>

        <Window title={t.pay} className="mx-auto w-full max-w-[380px]" right={<span className="cf-mono text-[12px] text-muted">CF-2026-001053</span>}>
          <div aria-hidden lang={lang === "bn" ? "bn" : undefined} className="bg-card">
            <div className="h-[372px] p-4">
              {rail === "bkash" && (
                <div key="bkash" className="cf-arrive">
                  <p className="text-[17px] font-semibold text-fg">{t.bkashTitle}</p>
                  <p className="mt-2 text-[13px] leading-snug text-muted">{t.bkashHelp}</p>
                  <p className="mb-1.5 mt-4 text-[12px] font-medium tracking-wide text-muted">{t.bkash}</p>
                  <div className="flex h-11 items-center rounded-control bg-surface px-3 text-[15px] text-fg">
                    {TXN.slice(0, TYPED[phase])}
                    {phase < 5 && <span className="cf-caret" />}
                  </div>
                  <div className="mt-3 h-7">
                    <Status ok={phase === 5}>{phase === 5 ? t.confirmed : t.waiting}</Status>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <span className="grid h-11 place-items-center rounded-full bg-subtle text-[14px] font-medium text-fg">{t.failed}</span>
                    <span className={cn("grid h-11 place-items-center rounded-full bg-ember-solid text-[14px] font-semibold text-on-solid transition-transform duration-300", phase === 5 && "scale-95")}>{t.received}</span>
                  </div>
                </div>
              )}
              {rail === "qr" && (
                <div key="qr" className="cf-arrive flex flex-col items-center">
                  <p className="mb-3 self-start text-[17px] font-semibold text-fg">Bangla QR</p>
                  <div className="relative overflow-hidden rounded-card bg-white p-2 shadow-card">
                    <Qr value="CF-2026-001053" size={150} className={cn("transition-opacity duration-500", phase === 1 && "opacity-20")} />
                    {phase === 1 && (
                      <span className="cf-pop absolute inset-0 grid place-items-center">
                        <span className="grid h-14 w-14 place-items-center rounded-full bg-success-solid text-white">
                          <Check size={28} strokeWidth={2.4} />
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-muted">{t.qr}</p>
                  <div className="mt-2">
                    <Status ok={phase === 1}>{phase === 1 ? t.paid : t.waiting + "…"}</Status>
                  </div>
                </div>
              )}
              {rail === "card" && (
                <div key="card" className="cf-arrive flex h-full flex-col items-center justify-center gap-4">
                  <span className={cn("grid h-20 w-20 place-items-center rounded-full transition-colors duration-500", phase === 2 ? "bg-success-wash text-success" : "bg-ember-wash text-brand-foreground")}>
                    {phase === 2 ? <Check size={32} strokeWidth={2.2} className="cf-pop" /> : <Nfc size={32} strokeWidth={1.6} />}
                  </span>
                  <Status ok={phase === 2}>{phase === 0 ? t.tap : phase === 1 ? t.approving + "…" : t.approved}</Status>
                </div>
              )}
              {rail === "cash" && phase < 3 && (
                <div key="cash" className="cf-arrive">
                  <p className="text-[12px] font-medium tracking-wide text-brand-foreground">{t.cash}</p>
                  <div className="mt-1 rounded-card bg-surface p-3">
                    <div className="flex justify-between text-[13px] text-muted">
                      <span>{t.due}</span>
                      <span>৳{num("1,150.00", lang)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-[13px] text-fg">
                      <span>{t.tendered}</span>
                      <span>{phase === 0 ? "৳0.00" : "৳" + num("1,200.00", lang)}</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-success">
                      <span className="text-[14px] font-medium">{t.change}</span>
                      <span className="text-[26px] font-semibold tracking-tight">৳{num(phase === 2 ? "50.00" : "0.00", lang)}</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {["Exact", "৳500", "৳1000", "৳2000"].map((k) => (
                      <span key={k} className={cn("grid h-8 place-items-center rounded-full text-[12px] transition-colors duration-300", k === "৳1000" && phase === 1 ? "bg-ember-wash text-brand-foreground" : "bg-subtle text-fg")}>
                        {k === "Exact" ? t.exact : num(k, lang)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
                      <span key={i} className={cn("grid h-8 place-items-center rounded-control text-[14px] text-fg transition-colors duration-300", k && "bg-subtle", phase === 1 && ["1", "2", "0"].includes(k) && "bg-ember-wash text-brand-foreground")}>
                        {k && num(k, lang)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 grid h-10 place-items-center rounded-full bg-ember-solid text-[14px] font-semibold text-on-solid">{t.complete}</div>
                </div>
              )}
              {rail === "cash" && phase === 3 && (
                <div key="done" className="cf-arrive flex h-full flex-col items-center justify-center text-center">
                  <span className="cf-pop grid h-11 w-11 place-items-center rounded-full bg-success-wash text-success">
                    <Check size={22} strokeWidth={2.4} />
                  </span>
                  <p className="mt-2 text-[14px] font-semibold text-fg">{t.saleDone}</p>
                  <p className="mt-3 text-[12px] text-muted">{t.paidBy}</p>
                  <p className="text-[34px] font-semibold leading-tight tracking-tight text-fg">৳{num("1,150.00", lang)}</p>
                  <p className="text-[12px] text-muted">{t.changeDue}</p>
                  <div className="mt-4 grid h-10 w-full place-items-center rounded-full bg-ember-solid text-[14px] font-semibold text-on-solid">{t.newSale}</div>
                </div>
              )}
            </div>
          </div>
        </Window>
      </div>
    </div>
  );
}
