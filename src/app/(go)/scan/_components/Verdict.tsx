"use client";

import { useEffect } from "react";
import { Check, Wallet, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PaymentMethod } from "@/lib/api";
import type { ScanOutcome } from "../_lib/outcome";

/**
 * The verdict, full-bleed.
 *
 * It must read in under a second at arm's length, so colour AND shape (check
 * against cross) AND the words all carry it — it survives glare and
 * colour-blindness on any one of the three. That much was already right; what
 * was not is that it lived on its own route at 70vh, which left a pale band
 * under a refusal and meant every scan was a navigation that emptied the code
 * field and dropped the focus a hardware scanner types into.
 *
 * Now it is an overlay over the gate console: `fixed inset-0`, so it owns the
 * screen including the tab bar, and closing it puts the cursor straight back
 * in the field.
 */
export interface VerdictLabels {
  admit: string;
  admitCount: (count: number) => string;
  doNotAdmit: string;
  balanceDue: string;
  reason: string;
  advice: string;
  usedAt?: string;
  dated?: string;
  code: string;
  dismiss: string;
  plusOne: string;
  admitAll: (count: number) => string;
  everyoneIn: string;
  groupSummary: string;
  takeAndAdmit: string;
  amount: string;
  methodLabel: (m: PaymentMethod) => string;
}

export function Verdict({
  outcome,
  labels,
  admitted,
  busy,
  methods,
  method,
  onMethod,
  onAdmit,
  onSettle,
  onClose,
}: {
  outcome: ScanOutcome;
  labels: VerdictLabels;
  admitted: number;
  busy: boolean;
  methods: PaymentMethod[];
  method: PaymentMethod;
  onMethod: (m: PaymentMethod) => void;
  onAdmit: (count: number) => void;
  onSettle: () => void;
  onClose: () => void;
}) {
  const holds = outcome.verdict === "group" || outcome.verdict === "balance";

  /* A verdict with nothing to do gets out of the way on its own, so the next
     guest is not waiting on a tap. One that needs a decision stays until the
     decision is made. */
  useEffect(() => {
    if (holds) return;
    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [holds, onClose]);

  /* Escape only, deliberately. Enter is the last key of every scan: a
     verdict that closed on Enter closed on the very keystroke that opened it,
     because a discrete event flushes React synchronously and this listener was
     added while that same keydown was still on its way to the window. A
     scanner's Enter belongs to the NEXT scan, which replaces this verdict. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shell = "fixed inset-0 z-50 flex flex-col items-center justify-center gap-comfortable px-section text-center";

  if (outcome.verdict === "balance" && outcome.balance) {
    return (
      /* Neither an admission nor a refusal, so it wears neither treatment:
         admitted is ink, refused is hatched danger, and this is the amber the
         app already uses for "needs attention" — a thing to be DONE rather
         than a verdict to be read. */
      <div className={cn(shell, "overflow-y-auto bg-warning-wash py-section")} role="dialog" aria-modal="true" aria-label={labels.balanceDue}>
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-current text-fg">
          <Wallet size={44} strokeWidth={2} />
        </span>
        <p className="type-display text-3xl">{labels.balanceDue}</p>
        <p className="type-display text-5xl tabular-nums">{labels.amount}</p>
        <p className="text-lg text-fg">{outcome.title}</p>
        <p className="text-[13px] text-fg/75">{labels.code}</p>

        <div className="flex w-full max-w-md shrink-0 flex-col gap-tight">
          <div className={cn("grid gap-tight", methods.length > 2 ? "grid-cols-2" : "grid-cols-1")}>
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => onMethod(m)}
                className={cn(
                  "h-14 rounded-full border text-sm font-medium transition-colors duration-quick",
                  method === m ? "border-ember bg-ember-solid text-white" : "border-strong bg-card",
                )}
              >
                {labels.methodLabel(m)}
              </button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={onSettle} className="h-16 rounded-full bg-ink text-lg font-medium text-paper disabled:opacity-50 active:opacity-90">
            {labels.takeAndAdmit}
          </button>
          <button type="button" onClick={onClose} className="h-12 rounded-full text-[13px] text-fg/75 underline-offset-4 hover:underline">
            {labels.dismiss}
          </button>
        </div>
      </div>
    );
  }

  if (outcome.verdict === "group" && outcome.group) {
    const remaining = outcome.group.admits - admitted;
    return (
      <div className={cn(shell, "overflow-y-auto bg-ink py-section text-paper")} role="dialog" aria-modal="true" aria-label={labels.admit}>
        <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-paper">
          <Check size={60} strokeWidth={3} />
        </span>
        <p className="type-display text-5xl">{remaining > 0 ? labels.admitCount(remaining) : labels.admit}</p>
        <p className="text-lg text-paper/90">{labels.groupSummary}</p>
        <p className="text-[13px] text-paper/70">{labels.code}</p>
        {remaining > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-tight">
            <button type="button" disabled={busy} onClick={() => onAdmit(1)} className="h-14 rounded-full border-2 border-paper px-major text-lg font-medium active:bg-paper/20">
              {labels.plusOne}
            </button>
            <button type="button" disabled={busy} onClick={() => onAdmit(remaining)} className="h-14 rounded-full bg-paper px-major text-lg font-medium text-ink active:bg-paper/80">
              {labels.admitAll(remaining)}
            </button>
          </div>
        ) : (
          <p className="text-lg">{labels.everyoneIn}</p>
        )}
        <button type="button" onClick={onClose} className="mt-tight h-12 shrink-0 rounded-full px-major text-[13px] text-paper/70 underline-offset-4 hover:underline">
          {labels.dismiss}
        </button>
      </div>
    );
  }

  const admit = outcome.verdict === "admit";
  return (
    <button
      type="button"
      onClick={onClose}
      role="status"
      aria-live="assertive"
      aria-label={admit ? labels.admit : labels.doNotAdmit}
      className={cn(
        shell,
        admit
          ? "bg-ink text-paper"
          : "bg-danger-solid text-white bg-[repeating-linear-gradient(45deg,transparent,transparent_28px,rgba(0,0,0,0.18)_28px,rgba(0,0,0,0.18)_56px)]",
      )}
    >
      <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-current">
        {admit ? <Check size={68} strokeWidth={3} /> : <X size={68} strokeWidth={3} />}
      </span>
      <span className="type-display text-5xl">{admit ? labels.admit : labels.doNotAdmit}</span>
      <span className="text-2xl opacity-95">{admit ? outcome.title : labels.reason}</span>
      {/* A statement, not a warning: the gate does not decide that a past date
          is wrong — it has no per-booking validity window to decide it with —
          so the date is put where a steward will see it and left at that. */}
      {admit && labels.dated && <span className="rounded-full border border-paper/40 bg-paper/10 px-comfortable py-inline text-base">{labels.dated}</span>}
      {!admit && labels.usedAt && <span className="text-lg opacity-90">{labels.usedAt}</span>}
      {!admit && outcome.title && <span className="text-base opacity-80">{outcome.title}</span>}
      <span className="text-sm opacity-75">{labels.code}</span>
      {!admit && <span className="mt-tight max-w-sm text-base opacity-90">{labels.advice}</span>}
      <span className="mt-tight text-[13px] opacity-70">{labels.dismiss}</span>
    </button>
  );
}
