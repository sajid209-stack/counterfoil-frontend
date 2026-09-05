"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/** Read a percentage a human typed: `12`, `12%`, `12.5`, ` 7 ` all work. */
export function parsePercent(raw: string): number | null {
  const cleaned = raw.replace(/%/g, "").trim();
  if (!cleaned) return 0;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Over 100 is not a discount, it is a refund with extra steps.
  return Math.min(100, n);
}

/**
 * A percentage a cashier can TYPE.
 *
 * The discount used to be four buttons — 0, 5, 10, 15 — so a manager who
 * agreed 12% had no way to enter it, and the till quietly decided the answer
 * was 10. That is the same mistake the duration controls made before P1, and
 * it is fixed the same way: the field is the control and the chips are
 * shortcuts that FILL it, never the whole menu.
 *
 * It deliberately does NOT clamp to the role's limit. Typing 40 where 10 is
 * allowed is not silently corrected to 10 — the cart's existing over-limit
 * notice names the cap and says to ask a manager, which is an answer; a
 * number that changes itself is not.
 */
export function PercentInput({
  value,
  onChange,
  chips = [5, 10, 15],
  step = 5,
  label,
  disabled,
  className,
  compact,
}: {
  value: number;
  onChange: (pct: number) => void;
  chips?: number[];
  step?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Tighter sizing for an inline row inside a cart line. */
  compact?: boolean;
}) {
  const id = useId();
  // The draft remembers WHICH value it was typed against. While the value is
  // unchanged the draft wins, so typing is never clobbered; the moment the
  // value moves — a chip, the stepper, a reset from outside — the draft is
  // stale and the field falls back to the real number. Same job an effect that
  // setStates would do, without the cascading render this codebase forbids.
  const [draft, setDraft] = useState<{ of: number; text: string }>({ of: value, text: String(value) });
  const text = draft.of === value ? draft.text : String(value);
  const [error, setError] = useState<string | null>(null);
  const setText = (t: string) => setDraft({ of: value, text: t });

  const commit = (raw: string) => {
    const parsed = parsePercent(raw);
    if (parsed == null) {
      setError(`Couldn't read "${raw}" — type a number like 12.`);
      return;
    }
    setError(null);
    setText(String(parsed));
    onChange(parsed);
  };

  const bump = (by: number) => {
    const next = Math.max(0, Math.min(100, value + by));
    setText(String(next));
    setError(null);
    onChange(next);
  };

  const h = compact ? "h-10" : "h-12";

  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      {label && (
        <label htmlFor={id} className="type-label text-[12px] text-muted">
          {label}
        </label>
      )}
      <div className="flex items-center gap-tight">
        <button
          type="button"
          aria-label="Less"
          disabled={disabled || value <= 0}
          onClick={() => bump(-step)}
          className={cn(h, "w-12 shrink-0 rounded-sm border border-line text-lg disabled:opacity-40 active:bg-ember/10")}
        >
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            inputMode="decimal"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => commit(text)}
            onKeyDown={(e) => { if (e.key === "Enter") { commit(text); (e.target as HTMLInputElement).blur(); } }}
            className={cn(
              h,
              "w-full rounded-sm border bg-card pl-comfortable pr-7 text-center font-mono text-sm outline-none",
              error ? "border-danger" : "border-line focus:border-ember",
            )}
          />
          <span className="pointer-events-none absolute right-comfortable top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
        </div>
        <button
          type="button"
          aria-label="More"
          disabled={disabled || value >= 100}
          onClick={() => bump(step)}
          className={cn(h, "w-12 shrink-0 rounded-sm border border-line text-lg disabled:opacity-40 active:bg-ember/10")}
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap gap-tight">
        {[0, ...chips].map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => { setText(String(c)); setError(null); onChange(c); }}
            className={cn(
              compact ? "h-9" : "h-11",
              "min-w-12 flex-1 rounded-sm border px-tight text-[13px] font-medium transition-colors duration-quick",
              value === c ? "border-ember bg-ember/10 text-brand-foreground" : "border-line bg-card active:bg-ember/10",
            )}
          >
            {c === 0 ? "None" : `${c}%`}
          </button>
        ))}
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
