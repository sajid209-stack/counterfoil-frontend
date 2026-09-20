"use client";

import { useEffect } from "react";
import { Ban, RotateCcw, SearchX, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PaymentMethod } from "@/lib/api";
import type { RefuseReason, ScanOutcome } from "../_lib/outcome";

/**
 * The three screens the gate can show.
 *
 * Each must read in under a second at arm's length, so colour AND shape
 * (check against cross) AND the words all carry the answer — it survives
 * glare and colour-blindness on any one of the three.
 *
 * How long each stays is a rule rather than a preference. Feedback guidance is
 * consistent: a confirmation gets out of the way on its own after a moment,
 * and an error stays until somebody has dealt with it. At a gate that is
 * exactly right — an admitted guest is already walking, while a refusal is the
 * middle of a conversation and the screen is the evidence in it. So ADMIT
 * drains a visible timer and clears itself; DO NOT ADMIT and BALANCE DUE stay
 * until dismissed, or until the next scan replaces them.
 */
export const ADMIT_HOLD_MS = 2000;

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
  paidOf?: string;
  previewNote: string;
  methodLabel: (m: PaymentMethod) => string;
}

/** A refusal's kind, beside the reason. The big cross is the verdict and
 *  carries three metres; this is the distinction that matters close up —
 *  somebody re-entering is a different conversation from a code that is not a
 *  ticket at all. Validation guidance treats valid, invalid and duplicate as
 *  three states, and drawing two of them identically loses one. */
const KIND_ICON: Record<RefuseReason, typeof Ban> = {
  alreadyRedeemed: RotateCcw,
  voidRefunded: Ban,
  notFound: SearchX,
};

/** An admission tears a ticket.
 *
 *  A ring with a check in it is what every app does. This is the thing the
 *  product is named after: the ticket parts along its perforation, the guest's
 *  half goes with them, and the **counterfoil** — the stub the venue keeps —
 *  is what stays on screen, with the mark drawn on it. The metaphor is the
 *  whole business, and it costs one graphic.
 *
 *  Two animated elements, which is the ceiling the motion guidance sets: the
 *  tear, and the stroke drawing itself. Both are finished inside 360ms.
 *  Everything rests in its FINAL state — the torn half at opacity 0, the mark
 *  fully drawn — so with motion turned off the screen is simply the kept stub
 *  with its check, never an empty outline. */
function AdmitMark() {
  return (
    <span className="relative flex h-[120px] w-[96px] shrink-0 items-center justify-center">
      {/* The box is the KEPT stub, so the resting composition sits centred
          under the word; the half that leaves is drawn outside it and is
          allowed to overflow while it goes. A counterfoil is the narrow end of
          a torn ticket, so it is taller than it is wide — a square read as a
          checkbox. */}
      <svg viewBox="0 0 80 104" className="verdict-mark h-full w-full overflow-visible" aria-hidden>
        {/* the guest's half, leaving */}
        <g className="verdict-torn">
          <rect x="80" y="10" width="78" height="84" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
          <line x1="94" y1="40" x2="144" y2="40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          <line x1="94" y1="56" x2="126" y2="56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        </g>
        {/* the counterfoil, kept */}
        <g className="verdict-keep">
          <rect x="4" y="10" width="58" height="84" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            className="verdict-draw"
            style={{ "--draw": 48 } as React.CSSProperties}
            d="M16 54 L27 65 L50 39"
            fill="none"
            stroke="currentColor"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {/* the perforation it came apart on */}
        <line x1="71" y1="14" x2="71" y2="90" stroke="currentColor" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" opacity="0.6" />
      </svg>
    </span>
  );
}

/** A refusal keeps the ring and the cross: it has to read as the opposite of
 *  an admission at three metres, and a torn ticket is the wrong story for a
 *  ticket that is not going anywhere. */
function RefuseMark() {
  return (
    <span className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 48 48" className="verdict-mark h-28 w-28" aria-hidden>
        <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" />
        <path className="verdict-draw" d="M16 16 L32 32" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path className="verdict-draw" d="M32 16 L16 32" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Verdict({
  outcome,
  preview = false,
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
  /** Opened from a screen button rather than a scan: nothing was written, and
   *  it stays up until it is dismissed, because it is there to be looked at. */
  preview?: boolean;
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
  const clearsItself = outcome.verdict === "admit" && !preview;

  useEffect(() => {
    if (!clearsItself) return;
    const timer = setTimeout(onClose, ADMIT_HOLD_MS);
    return () => clearTimeout(timer);
  }, [clearsItself, onClose]);

  /* Escape only, deliberately. Enter is the last key of every scan: a verdict
     that closed on Enter closed on the very keystroke that opened it, because
     a discrete event flushes React synchronously and this listener was added
     while that same keydown was still on its way to the window. A scanner's
     Enter belongs to the NEXT scan, which replaces this verdict. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shell = "fixed inset-0 z-50 flex flex-col items-center justify-center gap-comfortable px-section text-center";

  // ── Money owing ───────────────────────────────────────────────────────────
  if (outcome.verdict === "balance" && outcome.balance) {
    return (
      /* Neither an admission nor a refusal, so it wears neither treatment:
         admitted is ink, refused is hatched danger, and this is the amber the
         app already uses for "needs attention" — a thing to be DONE rather
         than a verdict to be read. */
      <div className={cn(shell, "overflow-y-auto bg-warning-wash py-section")} role="dialog" aria-modal="true" aria-label={labels.balanceDue}>
        <span className="verdict-mark flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-current text-fg">
          <Wallet size={32} strokeWidth={2} />
        </span>
        <p className="text-xl font-semibold">{labels.balanceDue}</p>
        {/* The figure to collect leads; what has already been paid sits under
            it, because "you paid half at the counter" is the sentence a
            steward has to say, and the screen should hand it to them. */}
        <p className="type-display text-5xl tabular-nums">{labels.amount}</p>
        {labels.paidOf && <p className="text-base tabular-nums text-fg/75">{labels.paidOf}</p>}
        <p className="text-lg text-fg">{outcome.title}</p>
        <p className="text-[13px] text-fg/75">{labels.code}</p>
        {preview && <p className="text-[13px] text-fg/75">{labels.previewNote}</p>}

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

  // ── A group, counted in at the door ───────────────────────────────────────
  if (outcome.verdict === "group" && outcome.group) {
    const remaining = outcome.group.admits - admitted;
    const through = outcome.group.admits - remaining;
    return (
      <div className={cn(shell, "overflow-y-auto bg-ink py-section text-paper")} role="dialog" aria-modal="true" aria-label={labels.admit}>
        <AdmitMark />
        <p className="type-display text-5xl">{remaining > 0 ? labels.admitCount(remaining) : labels.admit}</p>
        {/* How far through the party is, as a row of marks rather than a
            sentence to parse: at a door the steward is counting people. */}
        <span aria-hidden className="flex shrink-0 items-center gap-tight">
          {Array.from({ length: outcome.group.admits }).map((_, i) => (
            <span key={i} className={cn("h-3 w-3 rounded-full border-2 border-paper", i < through && "bg-paper")} />
          ))}
        </span>
        <p className="text-lg text-paper/90">{labels.groupSummary}</p>
        <p className="text-[13px] text-paper/70">{labels.code}</p>
        {preview && <p className="text-[13px] text-paper/70">{labels.previewNote}</p>}
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

  // ── Admit, and do not admit ───────────────────────────────────────────────
  const admit = outcome.verdict === "admit";
  const Kind = outcome.reason ? KIND_ICON[outcome.reason] : null;
  return (
    <button
      type="button"
      onClick={onClose}
      role="status"
      aria-live="assertive"
      aria-label={admit ? labels.admit : labels.doNotAdmit}
      style={admit ? ({ "--verdict-hold": `${ADMIT_HOLD_MS}ms` } as React.CSSProperties) : undefined}
      className={cn(
        shell,
        admit
          ? "bg-ink text-paper"
          : "bg-danger-solid text-white bg-[repeating-linear-gradient(45deg,transparent,transparent_28px,rgba(0,0,0,0.18)_28px,rgba(0,0,0,0.18)_56px)]",
      )}
    >
      <span className={cn("shrink-0", !admit && "animate-[shake_0.12s_ease-in-out_0s_2]")}>{admit ? <AdmitMark /> : <RefuseMark />}</span>
      <span className="type-display text-5xl">{admit ? labels.admit : labels.doNotAdmit}</span>

      {admit ? (
        <>
          {/* What is being admitted, at size: it is what the steward checks
              against the thing in the guest's hand. */}
          <span className="text-2xl opacity-95">{outcome.title}</span>
          {/* A statement, not a warning: the gate does not decide that a past
              date is wrong — it has no per-booking validity window to decide
              it with — so the date is put where a steward will see it. */}
          {labels.dated && <span className="rounded-full border border-paper/40 bg-paper/10 px-comfortable py-inline text-base">{labels.dated}</span>}
        </>
      ) : (
        <>
          <span className="flex items-center gap-tight text-2xl">
            {Kind && <Kind size={26} strokeWidth={2.5} aria-hidden className="shrink-0" />}
            {labels.reason}
          </span>
          {labels.usedAt && <span className="text-lg opacity-90">{labels.usedAt}</span>}
          {outcome.title && <span className="text-base opacity-80">{outcome.title}</span>}
        </>
      )}

      <span className="text-sm opacity-75">{labels.code}</span>
      {!admit && <span className="mt-tight max-w-sm text-base opacity-90">{labels.advice}</span>}
      <span className="mt-tight text-[13px] opacity-70">{preview ? labels.previewNote : labels.dismiss}</span>

      {admit && !preview && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-paper/20">
          <span className="verdict-timer block h-full w-full bg-paper/70" />
        </span>
      )}
    </button>
  );
}
